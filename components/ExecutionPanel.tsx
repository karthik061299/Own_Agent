
import React, { useState, useRef, useEffect } from 'react';
import { Workflow, Agent, ExecutionLog, WorkflowType } from '../types';
import { geminiService } from '../services/gemini';
import { Play, Terminal, Clipboard, Loader2, CheckCircle, AlertCircle, Trash2, Edit3, Save, ArrowRight, History, Zap } from 'lucide-react';

interface ExecutionPanelProps {
  workflows: Workflow[];
  agents: Agent[];
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ workflows, agents }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflows[0]?.metadata.id || '');
  const [inputText, setInputText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  
  // State for manual extra input mid-flow
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [extraInput, setExtraInput] = useState('');
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  
  const executionRef = useRef<{ active: boolean }>({ active: false });

  const addLog = (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => {
    const newLog: ExecutionLog = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, newLog]);
    setActiveLogId(newLog.id);
    return newLog.id;
  };

  const updateLog = (id: string, updates: Partial<ExecutionLog>) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const startExecution = async () => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow || !inputText) return;

    setIsExecuting(true);
    setLogs([]);
    executionRef.current.active = true;

    try {
      // Find Entry Node (node with no incoming edges)
      const incomingNodes = new Set(workflow.edges.map(e => e.target));
      let currentNode = workflow.nodes.find(n => !incomingNodes.has(n.id)) || workflow.nodes[0];
      
      let currentResult = inputText;
      let iterations = 0;
      const MAX_ITERATIONS = 20;

      while (currentNode && executionRef.current.active && iterations < MAX_ITERATIONS) {
        iterations++;
        const agent = agents.find(a => a.id === currentNode.agentId);
        if (!agent) break;

        // 1. Prepare for Agent Execution
        const logId = addLog({
          nodeId: currentNode.id,
          agentName: agent.name,
          status: 'running',
          input: currentResult,
        });

        // 2. Execution logic
        try {
          // If the node has extra input, append it
          const finalPromptInput = `Primary Input: ${currentResult}${currentNode.extraInput ? `\nAdditional Instructions: ${currentNode.extraInput}` : ''}`;
          
          const output = await geminiService.generate(
            agent.config.model,
            `Backstory: ${agent.backstory}\nGoal: ${agent.goal}\nTask: ${agent.taskDescription}`,
            finalPromptInput,
            agent.config
          );

          updateLog(logId, { status: 'completed', output });
          currentResult = output;

          // 3. Routing Logic
          if (workflow.metadata.useManager) {
            // Let Manager decide next step
            const managerLogId = addLog({
              nodeId: 'manager',
              agentName: 'Workflow Manager',
              status: 'running',
              input: 'Analyzing state and history...',
            });

            const route = await geminiService.routeNextStep(
              workflow.metadata.managerModel,
              workflow.metadata.description,
              JSON.stringify(workflow.nodes),
              JSON.stringify(workflow.edges),
              logs.map(l => `${l.agentName}: ${l.output}`).join('\n'),
              output
            );

            if (route.nextNodeId) {
              updateLog(managerLogId, { status: 'completed', output: `Routing to Node: ${route.nextNodeId}` });
              currentNode = workflow.nodes.find(n => n.id === route.nextNodeId) || null;
            } else {
              updateLog(managerLogId, { 
                status: 'completed', 
                output: route.finalSummary || 'Workflow Complete.',
                error: route.terminationReason 
              });
              currentNode = null;
            }
          } else {
            // Follow strict edges
            const nextEdge = workflow.edges.find(e => e.source === currentNode!.id);
            currentNode = nextEdge ? workflow.nodes.find(n => n.id === nextEdge.target) || null : null;
          }

        } catch (err: any) {
          updateLog(logId, { status: 'failed', error: err.message });
          break;
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        addLog({
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
        {/* Config / Input */}
        <div className="w-80 border-r border-zinc-800 p-6 flex flex-col bg-[#0c0c0e]/30 overflow-y-auto">
          <div className="mb-6">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Target Workflow</label>
            <select
              disabled={isExecuting}
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300"
            >
              {workflows.map(w => <option key={w.metadata.id} value={w.metadata.id}>{w.metadata.name}</option>)}
            </select>
          </div>

          <div className="flex-1 flex flex-col mb-6">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Initial Input</label>
            <textarea
              disabled={isExecuting}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs mono text-zinc-300 resize-none focus:ring-1 focus:ring-indigo-500/50"
              placeholder="Provide the initial prompt for the entry agent..."
            />
          </div>

          {/* Node Config Override (Extra Input) */}
          {selectedWorkflowId && (
            <div className="space-y-4 mb-6">
               <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Node Manual Overrides</label>
               <div className="space-y-2 max-h-48 overflow-y-auto">
                 {workflows.find(w => w.metadata.id === selectedWorkflowId)?.nodes.map(n => (
                   <div key={n.id} className="p-2 bg-zinc-900/50 rounded border border-zinc-800">
                     <div className="text-[10px] text-zinc-500 mb-1">{agents.find(a => a.id === n.agentId)?.name}</div>
                     <input 
                       placeholder="Extra context/rules..." 
                       className="w-full bg-transparent text-[10px] outline-none text-indigo-400"
                       defaultValue={n.extraInput}
                       onChange={(e) => {
                         const w = workflows.find(wf => wf.metadata.id === selectedWorkflowId);
                         if (w) w.nodes = w.nodes.map(node => node.id === n.id ? { ...node, extraInput: e.target.value } : node);
                       }}
                     />
                   </div>
                 ))}
               </div>
            </div>
          )}

          <button
            onClick={startExecution}
            disabled={isExecuting || !inputText}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-xl ${
              isExecuting || !inputText ? 'bg-zinc-800 text-zinc-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
            }`}
          >
            {isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            {isExecuting ? 'Processing Flow...' : 'Launch Pipeline'}
          </button>
        </div>

        {/* Process Viewer */}
        <div className="flex-1 flex flex-col bg-black/20">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
             <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
               <History className="w-4 h-4" /> Trace History
             </div>
             <button onClick={() => setLogs([])} className="text-zinc-600 hover:text-zinc-400"><Trash2 className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Timeline */}
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

            {/* Content Inspector */}
            <div className="flex-1 p-8 overflow-y-auto">
               {activeLog ? (
                 <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                         <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Input Captured</div>
                         <div className="text-xs text-zinc-400 mono whitespace-pre-wrap line-clamp-6">{activeLog.input}</div>
                       </div>
                       {activeLog.extraInput && (
                         <div className="p-4 bg-indigo-900/5 rounded-xl border border-indigo-900/20">
                           <div className="text-[10px] font-bold text-indigo-500/50 uppercase tracking-widest mb-2">Manual Override</div>
                           <div className="text-xs text-indigo-400 mono italic">{activeLog.extraInput}</div>
                         </div>
                       )}
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Response Body</h3>
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
