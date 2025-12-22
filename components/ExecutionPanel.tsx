
import React, { useState, useRef, useEffect } from 'react';
import { Workflow, Agent, ExecutionLog, WorkflowType } from '../types';
import { geminiService } from '../services/gemini';
import { dbService } from '../services/db';
import { Play, Terminal, Clipboard, Loader2, CheckCircle, AlertCircle, Trash2, Edit3, Save, ArrowRight, History, Zap, Settings } from 'lucide-react';

interface ExecutionPanelProps {
  workflows: Workflow[];
  agents: Agent[];
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ workflows, agents }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflows[0]?.metadata.id || '');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, string>>({});
  
  const executionRef = useRef<{ active: boolean }>({ active: false });
  const logsRef = useRef<ExecutionLog[]>([]);

  // Synchronize ref with state for access in async closures
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Load existing logs from DB when workflow changes
  useEffect(() => {
    if (selectedWorkflowId) {
      const loadHistory = async () => {
        try {
          const history = await dbService.getLogs(selectedWorkflowId);
          setLogs(history);
          if (history.length > 0) setActiveLogId(history[history.length - 1].id);
        } catch (e) {
          console.error("Failed to load trace history:", e);
        }
      };
      loadHistory();
    }
  }, [selectedWorkflowId]);

  const uniqueParams = React.useMemo(() => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow) return [];
    
    const params = new Map<string, string>();
    workflow.nodes.forEach(node => {
      const agent = agents.find(a => a.id === node.agentId);
      agent?.inputs.forEach(input => {
        if (input.parameter) {
          if (!params.has(input.parameter) || !params.get(input.parameter)) {
            params.set(input.parameter, input.description);
          }
        }
      });
    });
    
    return Array.from(params.entries()).map(([parameter, description]) => ({ parameter, description }));
  }, [selectedWorkflowId, workflows, agents]);

  const addAndSaveLog = async (logData: Omit<ExecutionLog, 'id' | 'timestamp'>) => {
    const newLog: ExecutionLog = {
      ...logData,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    
    // Update local state immediately
    setLogs(prev => [...prev, newLog]);
    setActiveLogId(newLog.id);
    
    // Save to DB
    try {
      await dbService.saveLog(selectedWorkflowId, newLog);
    } catch (e) {
      console.error("Log persistence failure:", e);
    }
    
    return newLog.id;
  };

  const finishAndSaveLog = async (id: string, updates: Partial<ExecutionLog>) => {
    // 1. Update local state
    setLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));

    // 2. Compute full log object for DB (UPSERT)
    // We use the current state from the ref to avoid stale closure issues
    const baseLog = logsRef.current.find(l => l.id === id);
    if (baseLog) {
      const updatedLog = { ...baseLog, ...updates };
      try {
        await dbService.saveLog(selectedWorkflowId, updatedLog);
      } catch (e) {
        console.error("Failed to update log in DB:", e);
      }
    }
  };

  const startExecution = async () => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow) return;

    setIsExecuting(true);
    setLogs([]); 
    executionRef.current.active = true;

    try {
      const incomingNodes = new Set(workflow.edges.map(e => e.target));
      let currentNode = workflow.nodes.find(n => !incomingNodes.has(n.id)) || workflow.nodes[0];
      
      let currentOutput = "";
      let iterations = 0;
      const MAX_ITERATIONS = 20;

      while (currentNode && executionRef.current.active && iterations < MAX_ITERATIONS) {
        iterations++;
        const agent = agents.find(a => a.id === currentNode.agentId);
        if (!agent) break;

        let taskWithInputs = agent.taskDescription;
        let paramContext = "";
        
        agent.inputs.forEach(input => {
          const val = workflowInputs[input.parameter] || "";
          const placeholder = `{${input.parameter}}`;
          if (taskWithInputs.includes(placeholder)) {
            taskWithInputs = taskWithInputs.split(placeholder).join(val);
          } else {
            paramContext += `\n- ${input.parameter}: ${val}`;
          }
        });

        const finalInput = `PREVIOUS AGENT OUTPUT: ${currentOutput || 'N/A'}\n\nUSER PROVIDED PARAMETERS:${paramContext || ' None'}\n\nTASK CONTEXT: ${taskWithInputs}`;

        const logId = await addAndSaveLog({
          nodeId: currentNode.id,
          agentName: agent.name,
          status: 'running',
          input: finalInput,
        });

        try {
          const output = await geminiService.generate(
            agent.config.model,
            `Backstory: ${agent.backstory}\nGoal: ${agent.goal}\nExpected Output Format: ${agent.expectedOutput}`,
            finalInput,
            agent.config
          );

          await finishAndSaveLog(logId, { status: 'completed', output });
          currentOutput = output;

          if (workflow.metadata.useManager) {
            const managerLogId = await addAndSaveLog({
              nodeId: 'manager',
              agentName: 'Workflow Manager',
              status: 'running',
              input: 'Analyzing state and history...',
            });

            const route = await geminiService.routeNextStep(
              workflow.metadata.managerModel,
              workflow.metadata.managerTemperature,
              workflow.metadata.managerTopP,
              workflow.metadata.description,
              JSON.stringify(workflow.nodes),
              JSON.stringify(workflow.edges),
              logsRef.current.map(l => `${l.agentName}: ${l.output}`).join('\n'),
              output
            );

            if (route.nextNodeId) {
              await finishAndSaveLog(managerLogId, { status: 'completed', output: `Routing to Node: ${route.nextNodeId}` });
              currentNode = workflow.nodes.find(n => n.id === route.nextNodeId) || null;
            } else {
              await finishAndSaveLog(managerLogId, { 
                status: 'completed', 
                output: route.finalSummary || 'Workflow Complete.',
                error: route.terminationReason 
              });
              currentNode = null;
            }
          } else {
            const nextEdge = workflow.edges.find(e => e.source === currentNode!.id);
            currentNode = nextEdge ? workflow.nodes.find(n => n.id === nextEdge.target) || null : null;
          }

        } catch (err: any) {
          await finishAndSaveLog(logId, { status: 'failed', error: err.message });
          break;
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        await addAndSaveLog({
          nodeId: 'system',
          agentName: 'System',
          status: 'failed',
          input: '',
          error: 'Maximum iterations reached. Loop terminated for safety.'
        });
      }

    } catch (e: any) {
      console.error(e);
    } finally {
      setIsExecuting(false);
      executionRef.current.active = false;
    }
  };

  const activeLog = logs.find(l => l.id === activeLogId);

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-6 border-b border-zinc-800 bg-[#0c0c0e] flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Play className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Live Execution</h2>
            <p className="text-sm text-zinc-500">Orchestrated multi-agent pipeline</p>
          </div>
        </div>
        {isExecuting && (
          <button 
            onClick={() => executionRef.current.active = false}
            className="px-4 py-2 bg-red-900/20 text-red-400 border border-red-900/30 rounded-lg text-sm hover:bg-red-900/40"
          >
            Stop Execution
          </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 border-r border-zinc-800 p-6 flex flex-col bg-[#0c0c0e]/30 overflow-y-auto">
          <div className="mb-6">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Selected Workflow</label>
            <select
              disabled={isExecuting}
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {workflows.map(w => <option key={w.metadata.id} value={w.metadata.id}>{w.metadata.name}</option>)}
            </select>
          </div>

          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
               <Settings className="w-4 h-4 text-zinc-500" />
               <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Workflow Context</h3>
            </div>
            
            <div className="space-y-4">
              {uniqueParams.map(({ parameter, description }) => (
                <div key={parameter} className="space-y-1">
                  <div className="flex justify-between items-end px-1">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter mono">
                      {parameter}
                    </label>
                    <span className="text-[9px] text-zinc-500 italic truncate ml-4">
                      {description || "No description provided"}
                    </span>
                  </div>
                  <textarea
                    disabled={isExecuting}
                    value={workflowInputs[parameter] || ''}
                    onChange={(e) => setWorkflowInputs(prev => ({ ...prev, [parameter]: e.target.value }))}
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 resize-none focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-700"
                    placeholder={`Provide value for ${parameter}...`}
                  />
                </div>
              ))}
              
              {uniqueParams.length === 0 && selectedWorkflowId && (
                <div className="py-12 text-center">
                   <div className="text-zinc-600 mb-2 italic text-xs">This workflow doesn't require any custom input parameters.</div>
                   <div className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Ready for direct execution</div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-800 mt-6">
            <button
              onClick={startExecution}
              disabled={isExecuting || (uniqueParams.length > 0 && Object.values(workflowInputs).every(v => !v))}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-xl ${
                isExecuting || (uniqueParams.length > 0 && Object.values(workflowInputs).every(v => !v))
                  ? 'bg-zinc-800 text-zinc-500' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
              }`}
            >
              {isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              {isExecuting ? 'Workflow Running...' : 'Execute Workflow'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-black/20">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
             <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
               <History className="w-4 h-4" /> Trace History (Database Persisted)
             </div>
             <button onClick={() => setLogs([])} className="text-zinc-600 hover:text-zinc-400"><Trash2 className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-72 border-r border-zinc-800 overflow-y-auto p-4 space-y-3">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setActiveLogId(log.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    activeLogId === log.id ? 'bg-indigo-600/10 border-indigo-600/40 ring-1 ring-indigo-600/20' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-400 truncate">{log.agentName}</span>
                    {log.status === 'running' ? <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" /> : <CheckCircle className={`w-3 h-3 ${log.status === 'completed' ? 'text-emerald-500' : 'text-red-500'}`} />}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">{log.output || log.error || 'Awaiting response...'}</div>
                </button>
              ))}
              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-10">
                  <Terminal className="w-12 h-12 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Idle</p>
                </div>
              )}
            </div>

            <div className="flex-1 p-8 overflow-y-auto">
               {activeLog ? (
                 <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Combined Context Prompt</div>
                      <div className="text-xs text-zinc-400 mono whitespace-pre-wrap line-clamp-[12] overflow-y-auto max-h-48">{activeLog.input}</div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Response Output</h3>
                        <button 
                          onClick={() => navigator.clipboard.writeText(activeLog.output || '')}
                          className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          <Clipboard className="w-3 h-3" /> Copy Result
                        </button>
                      </div>
                      <div className="p-6 bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap ring-1 ring-white/5">
                        {activeLog.status === 'running' ? (
                          <div className="flex flex-col items-center py-12 gap-4">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                            <span className="text-zinc-500 animate-pulse font-medium italic">Synthesizing intelligence...</span>
                          </div>
                        ) : (activeLog.output || activeLog.error || 'Empty')}
                      </div>
                    </div>
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-20">
                    <Zap className="w-16 h-16 mb-4 text-zinc-800" />
                    <p className="text-zinc-500 font-medium tracking-tight">Select a step to inspect intelligence state</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
