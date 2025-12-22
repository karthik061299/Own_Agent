
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Markdown from 'markdown-to-jsx';
import { Workflow, Agent, ExecutionLog, WorkflowExecution, WorkflowType } from '../types';
import { geminiService } from '../services/gemini';
import { dbService } from '../services/db';
import { 
  Play, Terminal, Clipboard, Loader2, CheckCircle, 
  AlertCircle, Trash2, ArrowRight, History, Zap, Settings, 
  Search, Calendar, Filter, ChevronRight, Clock, Box,
  Download, ChevronDown, ChevronUp, Layers, FileText, Square,
  RotateCcw
} from 'lucide-react';

interface ExecutionPanelProps {
  workflows: Workflow[];
  agents: Agent[];
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ workflows, agents }) => {
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [executionSearch, setExecutionSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, string>>({});
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  
  const executionRef = useRef<{ active: boolean; currentExecutionId: string | null }>({ active: false, currentExecutionId: null });
  const logsRef = useRef<ExecutionLog[]>([]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    loadExecutionHistory();
  }, []);

  const loadExecutionHistory = async () => {
    try {
      const history = await dbService.getWorkflowExecutions();
      setExecutions(history);
    } catch (e) {
      console.error("Failed to load executions:", e);
    }
  };

  useEffect(() => {
    if (activeExecutionId) {
      const loadLogs = async () => {
        try {
          const runLogs = await dbService.getLogsByExecution(activeExecutionId);
          setLogs(runLogs);
          if (runLogs.length > 0) setActiveLogId(runLogs[0].id);
        } catch (e) {
          console.error("Failed to load trace history:", e);
        }
      };
      loadLogs();
    }
  }, [activeExecutionId]);

  const filteredWorkflows = useMemo(() => {
    return workflows.filter(w => w.metadata.name.toLowerCase().includes(workflowSearch.toLowerCase()));
  }, [workflows, workflowSearch]);

  const filteredExecutions = useMemo(() => {
    return executions.filter(ex => {
      const matchesSearch = ex.workflow_name?.toLowerCase().includes(executionSearch.toLowerCase());
      const matchesDate = !dateFilter || new Date(ex.timestamp).toISOString().startsWith(dateFilter);
      return matchesSearch && matchesDate;
    });
  }, [executions, executionSearch, dateFilter]);

  const uniqueParams = useMemo(() => {
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

  const addAndSaveLog = async (executionId: string, logData: Omit<ExecutionLog, 'id' | 'timestamp' | 'execution_id'>) => {
    const newLog: ExecutionLog = {
      ...logData,
      id: crypto.randomUUID(),
      execution_id: executionId,
      timestamp: Date.now()
    };
    
    setLogs(prev => [...prev, newLog]);
    if (!activeLogId) setActiveLogId(newLog.id);
    
    try {
      await dbService.saveLog(selectedWorkflowId, newLog);
    } catch (e) {
      console.error("Log persistence failure:", e);
    }
    
    return newLog.id;
  };

  const finishAndSaveLog = async (id: string, updates: Partial<ExecutionLog>) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
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

  const abortExecution = async () => {
    if (!executionRef.current.currentExecutionId) return;
    
    executionRef.current.active = false;
    const currentId = executionRef.current.currentExecutionId;
    
    // Immediately stop any 'running' logs
    const runningLog = logsRef.current.find(l => l.status === 'running');
    if (runningLog) {
      await finishAndSaveLog(runningLog.id, { 
        status: 'stopped',
        output: runningLog.output || '' // Keep whatever we have
      });
    }

    // Add a system log for clarity
    await addAndSaveLog(currentId, {
      nodeId: 'system',
      agentName: 'System',
      status: 'stopped',
      input: 'User manual abort signal received.',
      output: 'Workflow execution stopped by user.'
    });

    setExecutions(prev => prev.map(ex => ex.id === currentId ? { ...ex, status: 'stopped' } : ex));
    setIsExecuting(false);
  };

  const startExecution = async () => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow || workflow.nodes.length === 0) return;

    const executionId = crypto.randomUUID();
    setIsExecuting(true);
    setActiveExecutionId(executionId);
    setLogs([]); 
    executionRef.current.active = true;
    executionRef.current.currentExecutionId = executionId;

    setExecutions(prev => [{
      id: executionId,
      workflow_id: workflow.metadata.id,
      workflow_name: workflow.metadata.name,
      status: 'running',
      timestamp: Date.now()
    }, ...prev]);

    try {
      // FIX: Strictly follow the drag-and-drop sequence by starting with nodes[0]
      let currentNode = workflow.nodes[0];
      
      let currentOutput = "";
      let iterations = 0;
      const MAX_ITERATIONS = 20;
      const agentIterationCounts = new Map<string, number>();

      while (currentNode && executionRef.current.active && iterations < MAX_ITERATIONS) {
        iterations++;
        const agent = agents.find(a => a.id === currentNode.agentId);
        if (!agent) break;

        const version = (agentIterationCounts.get(agent.id) || 0) + 1;
        agentIterationCounts.set(agent.id, version);

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

        if (!executionRef.current.active) break;

        const logId = await addAndSaveLog(executionId, {
          nodeId: currentNode.id,
          agentName: agent.name,
          status: 'running',
          input: finalInput,
          version: version
        });

        try {
          const output = await geminiService.generate(
            agent.config.model,
            `Backstory: ${agent.backstory}\nGoal: ${agent.goal}\nExpected Output Format: ${agent.expectedOutput}`,
            finalInput,
            agent.config
          );

          if (!executionRef.current.active) {
            await finishAndSaveLog(logId, { status: 'stopped', output: output || '' });
            break;
          }

          await finishAndSaveLog(logId, { status: 'completed', output });
          currentOutput = output;

          if (workflow.metadata.useManager) {
            const managerResponse = await geminiService.routeNextStep(
              workflow.metadata.managerModel,
              workflow.metadata.managerTemperature,
              workflow.metadata.managerTopP,
              workflow.metadata.description,
              JSON.stringify(workflow.nodes),
              JSON.stringify(workflow.edges),
              logsRef.current.map(l => `${l.agentName}: ${l.output}`).join('\n'),
              output
            );

            if (!executionRef.current.active) break;

            await addAndSaveLog(executionId, {
              nodeId: 'manager',
              agentName: 'Manager Thought',
              status: 'completed',
              input: 'Analyzing Workflow Context',
              output: managerResponse.nextNodeId ? `Redirecting to Node: ${managerResponse.nextNodeId}` : `Termination: ${managerResponse.finalSummary}`
            });

            if (managerResponse.nextNodeId) {
              currentNode = workflow.nodes.find(n => n.id === managerResponse.nextNodeId) || null;
            } else {
              currentNode = null;
            }
          } else {
            const nextEdge = workflow.edges.find(e => e.source === currentNode!.id);
            currentNode = nextEdge ? workflow.nodes.find(n => n.id === nextEdge.target) || null : null;
          }

        } catch (err: any) {
          if (executionRef.current.active) {
            await finishAndSaveLog(logId, { status: 'failed', error: err.message });
          } else {
            await finishAndSaveLog(logId, { status: 'stopped' });
          }
          break;
        }
      }

      if (executionRef.current.active) {
        setExecutions(prev => prev.map(ex => ex.id === executionId ? { ...ex, status: 'completed' } : ex));
      }
    } catch (e: any) {
      if (executionRef.current.active) {
        setExecutions(prev => prev.map(ex => ex.id === executionId ? { ...ex, status: 'failed' } : ex));
      }
    } finally {
      setIsExecuting(false);
      executionRef.current.active = false;
      executionRef.current.currentExecutionId = null;
    }
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadConsolidatedLog = () => {
    const content = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const prefix = log.nodeId === 'manager' ? 'MANAGER > ' : log.nodeId === 'system' ? 'SYSTEM > ' : `${log.agentName} (V${log.version}) > `;
      const output = log.output || log.error || 'Awaiting response...';
      const input = (log.nodeId !== 'manager' && log.nodeId !== 'system') ? `\n  REASONING/INPUT: ${log.input.replace(/\n/g, '\n  ')}\n` : '';
      return `[${time}] ${prefix}${output}${input}`;
    }).join('\n');
    handleDownload(content, `execution-${activeExecutionId?.slice(0, 8)}.txt`);
  };

  const activeLog = logs.find(l => l.id === activeLogId);
  const activeExecution = executions.find(ex => ex.id === activeExecutionId);

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-6 border-b border-zinc-800 bg-[#0c0c0e] flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Play className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Workflow Execution</h2>
            <p className="text-sm text-zinc-500">Persisted Runs & Live Tracing</p>
          </div>
        </div>
        {isExecuting && (
          <button 
            onClick={abortExecution}
            className="flex items-center gap-2 px-4 py-2 bg-red-900/20 text-red-400 border border-red-900/30 rounded-lg text-sm hover:bg-red-900/40 transition-all font-bold shadow-lg shadow-red-900/10"
          >
            <Square className="w-4 h-4 fill-current" /> Abort Run
          </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-zinc-800 p-6 flex flex-col bg-[#0c0c0e]/30 overflow-y-auto gap-8 scrollbar-thin">
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-2">
              <Box className="w-3.5 h-3.5" /> Target Workflow
            </h3>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input 
                  type="text" placeholder="Filter..." value={workflowSearch} onChange={(e) => setWorkflowSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <select
                disabled={isExecuting}
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="" disabled>Select a workflow...</option>
                {filteredWorkflows.map(w => <option key={w.metadata.id} value={w.metadata.id}>{w.metadata.name}</option>)}
              </select>
            </div>
          </section>

          {selectedWorkflowId ? (
            <>
              <section className="space-y-4 flex-1">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" /> Runtime Inputs
                </h3>
                <div className="space-y-4">
                  {uniqueParams.map(({ parameter, description }) => (
                    <div key={parameter} className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter mono pl-1">{parameter}</label>
                      <textarea
                        disabled={isExecuting}
                        value={workflowInputs[parameter] || ''}
                        onChange={(e) => setWorkflowInputs(prev => ({ ...prev, [parameter]: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 min-h-[160px] resize-y focus:ring-1 focus:ring-indigo-500 outline-none scrollbar-thin"
                        placeholder={description}
                      />
                    </div>
                  ))}
                  {uniqueParams.length === 0 && <p className="text-[10px] text-zinc-600 italic text-center py-4">No parameters required.</p>}
                </div>
              </section>

              <button
                onClick={startExecution}
                disabled={isExecuting || (uniqueParams.length > 0 && Object.values(workflowInputs).every(v => !v))}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-xl ${
                  isExecuting || (uniqueParams.length > 0 && Object.values(workflowInputs).every(v => !v))
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                }`}
              >
                {isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                {isExecuting ? 'Running...' : 'Execute Run'}
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center py-10 px-4">
              <GitBranch className="w-10 h-10 mb-4 text-zinc-600" />
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Select a workflow to configure inputs</p>
            </div>
          )}
        </div>

        <div className="w-72 border-r border-zinc-800 flex flex-col bg-[#0c0c0e]/10">
           <div className="p-4 border-b border-zinc-800 space-y-3 bg-zinc-900/20">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <History className="w-3.5 h-3.5" /> Run History
              </h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input 
                  type="text" placeholder="Search..." value={executionSearch} onChange={(e) => setExecutionSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <input 
                type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs outline-none text-zinc-400"
              />
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {filteredExecutions.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setActiveExecutionId(ex.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all relative overflow-hidden group ${
                    activeExecutionId === ex.id ? 'bg-indigo-600/10 border-indigo-600/40' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold text-zinc-200 truncate pr-2">{ex.workflow_name}</span>
                    {ex.status === 'running' ? <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" /> : (
                      <div className={`w-2 h-2 rounded-full ${
                        ex.status === 'completed' ? 'bg-emerald-500' : 
                        ex.status === 'stopped' ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-zinc-500">
                    <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(ex.timestamp).toLocaleTimeString()}</div>
                    <div className="flex items-center gap-1 uppercase font-bold tracking-tighter">
                      <span className={
                        ex.status === 'completed' ? 'text-emerald-500' : 
                        ex.status === 'stopped' ? 'text-amber-500' : 
                        ex.status === 'failed' ? 'text-red-500' : 'text-indigo-400'
                      }>
                        {ex.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
           </div>
        </div>

        <div className="flex-1 flex flex-col bg-black/30 overflow-hidden relative">
           {activeExecutionId ? (
             <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin p-8">
                <div className="max-w-4xl mx-auto w-full space-y-8">
                    {/* Consolidated Log Section */}
                    <section className="space-y-4">
                       <div className="flex items-center justify-between">
                         <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                           <Terminal className="w-4 h-4" /> End-to-End Consolidated Log
                         </h3>
                         <div className="flex gap-2">
                           <button onClick={downloadConsolidatedLog} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Download Log">
                             <Download className="w-3.5 h-3.5" />
                           </button>
                           <button onClick={() => setIsLogExpanded(!isLogExpanded)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors">
                             {isLogExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                           </button>
                         </div>
                       </div>
                       
                       {isLogExpanded && (
                         <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5 font-mono text-[11px] font-mono leading-relaxed animate-in slide-in-from-top-2 duration-300">
                            <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                              <span className="text-zinc-500">execution-stream --run-id {activeExecutionId.slice(0,8)}</span>
                              <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-900/50" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-900/50" />
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-900/50" />
                              </div>
                            </div>
                            <div className="p-4 space-y-4 min-h-[200px] max-h-[600px] overflow-y-auto scrollbar-thin">
                              {logs.map((log) => (
                                <div key={log.id} className="animate-in fade-in slide-in-from-left-1 duration-200 border-b border-zinc-800/30 pb-3 last:border-0">
                                  <div className="flex items-start gap-2">
                                    <span className="text-zinc-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                    {log.nodeId === 'manager' ? (
                                      <div className="flex-1">
                                        <span className="text-amber-500 font-bold">MANAGER &gt; </span>
                                        <span className="text-amber-200/80 italic">{log.output}</span>
                                      </div>
                                    ) : log.nodeId === 'system' ? (
                                      <div className="flex-1">
                                        <span className="text-zinc-500 font-bold">SYSTEM &gt; </span>
                                        <span className="text-zinc-400 italic font-medium">{log.output}</span>
                                      </div>
                                    ) : (
                                      <div className="flex-1 space-y-2">
                                        <div>
                                          <span className="text-indigo-400 font-bold">{log.agentName} (V{log.version}) &gt; </span>
                                          <span className={
                                            log.status === 'failed' ? 'text-red-400 font-bold' : 
                                            log.status === 'stopped' ? 'text-amber-500 italic font-semibold' : 
                                            'text-zinc-300'
                                          }>
                                            {log.status === 'running' ? 'Thinking...' : log.output?.slice(0, 150) + (log.output && log.output.length > 150 ? '...' : '')}
                                          </span>
                                        </div>
                                        {(log.status !== 'running') && (
                                          <div className="pl-4 border-l border-zinc-800/50 space-y-1">
                                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Reasoning & Input</div>
                                            <div className="text-zinc-600 text-[10px] whitespace-pre-wrap italic line-clamp-3 hover:line-clamp-none transition-all">{log.input}</div>
                                          </div>
                                        )}
                                        {log.error && <div className="text-red-500 font-bold text-[10px] mt-1">ERROR: {log.error}</div>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {isExecuting && <div className="flex items-center gap-2 text-indigo-400 animate-pulse"><span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" /> Generating intelligence...</div>}
                            </div>
                         </div>
                       )}
                    </section>

                    <section className="space-y-4 pb-20">
                       <div className="flex items-center justify-between">
                         <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                           <Layers className="w-4 h-4" /> Agent Traces
                         </h3>
                         {logs.some(l => l.status === 'stopped') && (
                           <div className="flex items-center gap-2 px-3 py-1 bg-amber-900/10 border border-amber-900/20 rounded-full text-[10px] font-bold text-amber-500 uppercase tracking-tight">
                             <Square className="w-2.5 h-2.5 fill-current" /> Partial Run - Execution Halted
                           </div>
                         )}
                       </div>
                       
                       <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
                          {logs.filter(l => l.nodeId !== 'manager' && l.nodeId !== 'system').map(log => (
                            <button
                              key={log.id}
                              onClick={() => setActiveLogId(log.id)}
                              className={`shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
                                activeLogId === log.id ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/20 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-full ${
                                log.status === 'completed' ? 'bg-emerald-400' : 
                                log.status === 'failed' ? 'bg-red-400' : 
                                log.status === 'stopped' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 
                                'bg-indigo-400 animate-pulse'
                              }`} />
                              <span className="text-[11px] font-bold uppercase tracking-wider">{log.agentName} <span className="opacity-60 text-[9px]">V{log.version}</span></span>
                            </button>
                          ))}
                       </div>

                       {activeLog && activeLog.nodeId !== 'manager' && activeLog.nodeId !== 'system' && (
                         <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-col h-full">
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex justify-between">
                                  Trace Input <button onClick={() => navigator.clipboard.writeText(activeLog.input)}><Clipboard className="w-3 h-3 hover:text-indigo-400" /></button>
                                </h4>
                                <div className="text-[10px] text-zinc-500 mono whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin flex-1">{activeLog.input}</div>
                              </div>
                              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 h-full">
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Metadata</h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-[10px]"><span className="text-zinc-600 uppercase">Agent Version</span><span className="text-indigo-400 font-bold">V{activeLog.version}</span></div>
                                  <div className="flex justify-between text-[10px]"><span className="text-zinc-600 uppercase">Status</span><span className={
                                    activeLog.status === 'completed' ? 'text-emerald-500' : 
                                    activeLog.status === 'failed' ? 'text-red-500' : 
                                    activeLog.status === 'stopped' ? 'text-amber-500 font-bold' : 
                                    'text-indigo-400'
                                  }>{activeLog.status.toUpperCase()}</span></div>
                                  <div className="flex justify-between text-[10px]"><span className="text-zinc-600 uppercase">Timestamp</span><span className="text-zinc-400">{new Date(activeLog.timestamp).toLocaleTimeString()}</span></div>
                                </div>
                              </div>
                            </div>
                            <div className="p-8 bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl relative group min-h-[300px]">
                               <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <button onClick={() => handleDownload(activeLog.output || '', `output-${activeLog.agentName}-v${activeLog.version}.txt`)} className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white" title="Download Output"><Download className="w-4 h-4" /></button>
                                  <button onClick={() => navigator.clipboard.writeText(activeLog.output || '')} className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white" title="Copy Output"><Clipboard className="w-4 h-4" /></button>
                               </div>
                               <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Agent Output</div>
                               
                               {activeLog.status === 'running' ? (
                                 <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                                   <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                                   <p className="text-sm font-medium italic animate-pulse">Engaging neural weights...</p>
                                 </div>
                               ) : activeLog.status === 'stopped' ? (
                                 <div className="space-y-8">
                                    {activeLog.output && (
                                      <div className="prose prose-sm prose-invert max-w-none opacity-80 border-b border-zinc-800 pb-8">
                                        <Markdown>{activeLog.output}</Markdown>
                                      </div>
                                    )}
                                    <div className="flex flex-col items-center py-12 text-center bg-amber-900/5 rounded-xl border border-dashed border-amber-900/20">
                                      <AlertCircle className="w-10 h-10 text-amber-600 mb-4" />
                                      <h4 className="text-amber-500 font-bold uppercase tracking-widest text-xs">Workflow execution has been stopped.</h4>
                                      <p className="text-zinc-500 text-[10px] mt-1 italic">Manual intervention triggered. Further generation suspended.</p>
                                    </div>
                                 </div>
                               ) : (
                                 <div className="prose prose-sm prose-invert max-w-none">
                                    {activeLog.error ? (
                                      <div className="text-red-500 font-bold flex items-center gap-2 bg-red-900/10 p-4 rounded-lg border border-red-900/30">
                                        <AlertCircle className="w-5 h-5" /> EXCEPTION: {activeLog.error}
                                      </div>
                                    ) : (
                                      <Markdown>{activeLog.output || 'No output captured.'}</Markdown>
                                    )}
                                 </div>
                               )}
                            </div>
                         </div>
                       )}
                    </section>
                </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center opacity-20 select-none grayscale">
                <Terminal className="w-24 h-24 mb-6 text-zinc-800" />
                <h3 className="text-2xl font-bold uppercase tracking-widest text-zinc-700">Ready for Launch</h3>
                <p className="text-sm text-zinc-800 font-medium">Select an execution from history or trigger a new run</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
const GitBranch = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-git-branch"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>;
