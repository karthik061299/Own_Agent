
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Markdown from 'markdown-to-jsx';
import { Workflow, Agent, ExecutionLog, WorkflowExecution, Tool, WorkflowNode, WorkflowType } from '../types';
import { geminiService } from '../services/gemini';
import { dbService } from '../services/db';
import { 
  Play, Terminal, Loader2, History, Zap, Settings, 
  Search, Clock, Box, Download, ChevronDown, ChevronUp, Layers, FileText, Square, Hammer, AlertCircle, Cpu, Eye, EyeOff, ThumbsUp, ThumbsDown, MessageSquare, GitCommit, Upload, X
} from 'lucide-react';

interface ExecutionPanelProps {
  workflows: Workflow[];
  agents: Agent[];
  tools: Tool[];
}

type HumanCheckpoint = {
  logId: string;
  nodeId: string;
  agent: Agent;
  finalInput: string;
  outputVersions: { output: string }[];
  currentOutputVersionIndex: number;
};

const LogEntry: React.FC<{ log: ExecutionLog }> = ({ log }) => {
  const [isHovering, setIsHovering] = useState(false);

  const parseInput = (input: string) => {
    const contextMatch = input.match(/CONTEXT_CHAIN: ([\s\S]*?)\n\nPARAM_BLOCK:/);
    const paramsMatch = input.match(/PARAM_BLOCK:([\s\S]*?)\n\nASSIGNED_TASK:/);
    const taskMatch = input.match(/ASSIGNED_TASK: ([\s\S]*)/);
    return {
      context: contextMatch ? contextMatch[1].trim() : 'N/A',
      params: paramsMatch ? paramsMatch[1].trim() : 'N/A',
      task: taskMatch ? taskMatch[1].trim() : input
    };
  };

  const { context, params, task } = parseInput(log.input);

  return (
    <div 
      className="group relative animate-in fade-in slide-in-from-left-2 duration-300 border-b border-zinc-800/40 pb-4 last:border-0 last:pb-0"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex items-start gap-4">
        <span className="text-zinc-700 shrink-0 font-bold">[{new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
        
        <div className="flex-1 space-y-2">
          {log.nodeId === 'manager' || log.nodeId === 'system' ? (
             <div>
              <span className={`${log.nodeId === 'manager' ? 'text-amber-500' : 'text-zinc-500'} font-bold uppercase tracking-tighter`}>{log.agentName} &gt; </span>
              <span className={`${log.nodeId === 'manager' ? 'text-amber-100/90' : 'text-zinc-400'} italic`}>{log.output}</span>
            </div>
          ) : (
            <>
              <div>
                <span className="text-indigo-400 font-bold uppercase tracking-tighter">{log.agentName} (V{log.version}) &gt; </span>
                <span className="text-zinc-500 italic">
                    {
                        log.status === 'running' ? 'Executing task...' :
                        log.status === 'completed' ? `Completed. Output: ${(log.output || '').substring(0, 80)}...` :
                        log.status === 'paused' ? 'Paused, awaiting human input.' :
                        log.status === 'failed' ? `Failed. Error: ${(log.error || '').substring(0, 80)}...` :
                        log.status === 'stopped' ? 'Stopped by user.' : 'Pending.'
                    }
                </span>
              </div>
              
              <div className="max-h-0 overflow-hidden group-hover:max-h-none transition-all duration-500 ease-in-out">
                <div className="pt-3 mt-2 border-t border-zinc-800/60 space-y-4">
                  <div className="text-[10px] space-y-1"><h5 className="font-bold text-zinc-500 uppercase tracking-widest">Input: Context Chain</h5><div className="prose prose-sm prose-invert italic text-zinc-400 p-2 bg-black/20 rounded-md"><Markdown>{context}</Markdown></div></div>
                  {params.trim() !== 'None' && params.trim() !== '' && (<div className="text-[10px] space-y-1"><h5 className="font-bold text-zinc-500 uppercase tracking-widest">Input: Workflow Parameters</h5><div className="prose prose-sm prose-invert"><Markdown>{'```\n' + params + '\n```'}</Markdown></div></div>)}
                  <div className="text-[10px] space-y-1"><h5 className="font-bold text-zinc-500 uppercase tracking-widest">Input: Assigned Task</h5><div className="prose prose-sm prose-invert text-zinc-300 p-2 bg-black/20 rounded-md"><Markdown>{task}</Markdown></div></div>
                  {log.toolCalls?.map((tc: any, i: number) => (<div key={i} className="text-[10px] text-amber-500 font-bold flex items-center gap-2"><Hammer className="w-3 h-3" /> Invoke Tool: {tc.name}</div>))}
                   <div className="text-[10px] space-y-1 pt-3 border-t border-zinc-800/40"><h5 className="font-bold text-indigo-400 uppercase tracking-widest">Final Output</h5><div className={`prose prose-sm prose-invert ${log.status === 'failed' ? 'text-red-400' : 'text-zinc-300'}`}><Markdown>{log.status === 'failed' ? `**Error:** ${log.error || 'Execution halted'}` : log.output || '*(No text output)*'}</Markdown></div></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className={`absolute -left-8 top-1 p-1 rounded-full bg-zinc-800 border border-zinc-700 transition-all duration-200 opacity-0 group-hover:opacity-100`}>
        {isHovering ? <Eye className="w-3 h-3 text-indigo-400" /> : <EyeOff className="w-3 h-3 text-zinc-500" />}
      </div>
    </div>
  );
};


export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ workflows, agents, tools }) => {
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [executionSearch, setExecutionSearch] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, string | File[]>>({});
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [isPausedForHumanInput, setIsPausedForHumanInput] = useState(false);
  const [humanCheckpointData, setHumanCheckpointData] = useState<HumanCheckpoint | null>(null);
  const [humanFeedback, setHumanFeedback] = useState('');
  const [isReRunning, setIsReRunning] = useState(false);
  
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);

  const executionStateRef = useRef({ active: false, currentExecutionId: null as string | null, startTime: 0, currentOutput: "", currentNode: null as WorkflowNode | null, agentIterationCounts: new Map<string, number>() });
  const timerRef = useRef<number | null>(null);

  useEffect(() => { loadExecutionHistory(); }, []);
  useEffect(() => { if (activeExecutionId) { loadLogs(activeExecutionId); } else { setLogs([]); } }, [activeExecutionId]);

  const loadExecutionHistory = async () => setExecutions(await dbService.getWorkflowExecutions());
  const loadLogs = async (sid: string) => setLogs(await dbService.getLogsByExecution(sid));
  
  const readFileAsText = (file: File): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsText(file); });
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, parameter: string) => e.target.files && setWorkflowInputs(p => ({...p, [parameter]: Array.from(e.target.files!)}));
  const handleRemoveFile = (parameter: string, fileIndex: number) => setWorkflowInputs(p => { const c = p[parameter] as File[]; const n = c.filter((_, i) => i !== fileIndex); return {...p, [parameter]: n.length > 0 ? n : ''}; });

  const filteredWorkflows = useMemo(() => workflows.filter(w => w.metadata.name.toLowerCase().includes(workflowSearch.toLowerCase())), [workflows, workflowSearch]);
  const filteredExecutions = useMemo(() => executions.filter(ex => ex.workflow_name?.toLowerCase().includes(executionSearch.toLowerCase())), [executions, executionSearch]);

  const uniqueParams = useMemo(() => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId); if (!workflow) return []; const params = new Map<string, string>();
    workflow.nodes.forEach(node => agents.find(a => a.id === node.agentId)?.inputs.forEach(input => { if (input.parameter && !params.has(input.parameter)) params.set(input.parameter, input.description); }));
    return Array.from(params.entries()).map(([parameter, description]) => ({ parameter, description }));
  }, [selectedWorkflowId, workflows, agents]);

  const addLog = async (logData: Omit<ExecutionLog, 'id' | 'timestamp' | 'execution_id'>): Promise<string> => {
    const newLog: ExecutionLog = { ...logData, id: crypto.randomUUID(), execution_id: executionStateRef.current.currentExecutionId!, timestamp: Date.now() };
    setLogs(prev => [...prev, newLog]);
    setActiveLogId(newLog.id); 
    await dbService.saveLog(selectedWorkflowId, newLog);
    return newLog.id;
  };
  
  const updateLog = async (id: string, updates: Partial<ExecutionLog>) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    const logToUpdate = logs.find(l => l.id === id) || (await dbService.getLogsByExecution(executionStateRef.current.currentExecutionId!)).find(l => l.id === id);
    if(logToUpdate) await dbService.saveLog(selectedWorkflowId, { ...logToUpdate, ...updates });
  };
  
  const triggerDownload = (filename: string, content: string) => { const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
  
  const downloadAllOutputs = () => { /* ... existing code ... */ };
  const executeTool = async (toolClassName: string, args: any, agentTools: Tool[]) => { /* ... existing code ... */ return "Tool Executed"; };

  const finishExecution = async (status: 'completed' | 'failed' | 'stopped') => {
    if (!executionStateRef.current.active) return;
    const duration = Math.floor((Date.now() - executionStateRef.current.startTime) / 1000);
    await addLog({ nodeId: 'system', agentName: 'System', status: 'completed', input: 'Teardown', output: `Pipeline finished. Total time: ${formatDuration(duration)}.` });
    setExecutions(prev => prev.map(ex => ex.id === executionStateRef.current.currentExecutionId ? { ...ex, status, duration } : ex));
    setIsExecuting(false);
    setIsPausedForHumanInput(false);
    executionStateRef.current.active = false;
    if (timerRef.current) clearInterval(timerRef.current);
    loadExecutionHistory();
  };

  const processNode = async (node: WorkflowNode, input: string) => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow || !executionStateRef.current.active) return finishExecution('stopped');

    const agent = agents.find(a => a.id === node.agentId);
    if (!agent) { updateLog(await addLog({ nodeId: node.id, agentName: "Error", status: 'failed', input: `System error: Agent with ID ${node.agentId} not found.`}), { error: "Agent not found!" }); return finishExecution('failed'); }
    
    setIsExecuting(true);
    const agentTools = tools.filter(t => agent.toolIds?.includes(t.id));
    const iterCount = (executionStateRef.current.agentIterationCounts.get(agent.id) || 0) + 1;
    executionStateRef.current.agentIterationCounts.set(agent.id, iterCount);

    let taskWithInputs = agent.taskDescription;
    let paramContext = "";
    for(const inputDef of agent.inputs) {
      const val = workflowInputs[inputDef.parameter]; let processedValue = '';
      if (Array.isArray(val) && val.length > 0) { const contents = await Promise.all(val.map(readFileAsText)); processedValue = contents.join('\n\n--- (File Content Break) ---\n\n'); } else if (typeof val === 'string') { processedValue = val; }
      if (taskWithInputs.includes(`{${inputDef.parameter}}`)) { taskWithInputs = taskWithInputs.split(`{${inputDef.parameter}}`).join(processedValue); } else { paramContext += `\n- ${inputDef.parameter}: ${processedValue}`; }
    }
    const finalInput = `CONTEXT_CHAIN: ${input || 'Start of Workflow'}\n\nPARAM_BLOCK:${paramContext || ' None'}\n\nASSIGNED_TASK: ${taskWithInputs}`;
    const logId = await addLog({ nodeId: node.id, agentName: agent.name, status: 'running', input: finalInput, version: iterCount });
    
    try {
      const systemInstruction = `IDENTITY: ${agent.backstory}\nGOAL: ${agent.goal}\nOUTPUT_REQUIREMENTS: ${agent.expectedOutput}`;
      const response = await geminiService.generate(agent.config.model, systemInstruction, finalInput, agent.config, undefined, agentTools);
      if (!executionStateRef.current.active) return finishExecution('stopped');
      
      let output = response.text || "Task complete.";
      // Tool logic could go here
      
      await updateLog(logId, { status: 'completed', output });
      executionStateRef.current.currentOutput = output;
      
      const nextEdge = workflow.edges.find(e => e.source === node.id);
      if (nextEdge?.humanCheckpoint) {
        setIsExecuting(false);
        setIsPausedForHumanInput(true);
        setHumanCheckpointData({ logId, nodeId: node.id, agent, finalInput, outputVersions: [{ output }], currentOutputVersionIndex: 0 });
        await updateLog(logId, { status: 'paused' });
        return;
      }

      if (workflow.metadata.useManager) { /* ... manager logic ... */ } 
      else {
        const nextNode = nextEdge ? workflow.nodes.find(n => n.id === nextEdge.target) : null;
        if (nextNode) { processNode(nextNode, output); } else { finishExecution('completed'); }
      }
    } catch (err: any) {
      if (executionStateRef.current.active) { await updateLog(logId, { status: 'failed', error: err.message || 'Critical agent error.' }); }
      finishExecution('failed');
    }
  };

  const handleHumanApproval = () => {
    if (!humanCheckpointData) return;
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId)!;
    const approvedOutput = humanCheckpointData.outputVersions[humanCheckpointData.currentOutputVersionIndex].output;
    
    updateLog(humanCheckpointData.logId, { status: 'completed', output: approvedOutput });
    
    setIsPausedForHumanInput(false);
    setHumanCheckpointData(null);
    setHumanFeedback('');
    
    const nextEdge = workflow.edges.find(e => e.source === humanCheckpointData.nodeId);
    const nextNode = nextEdge ? workflow.nodes.find(n => n.id === nextEdge.target) : null;
    
    if (nextNode) {
      processNode(nextNode, approvedOutput);
    } else {
      finishExecution('completed');
    }
  };
  
  const handleHumanRejectionAndRerun = async () => {
    if (!humanCheckpointData || !humanFeedback) return;
    setIsReRunning(true);
    const { agent, finalInput } = humanCheckpointData;
    try {
      const systemInstruction = `IDENTITY: ${agent.backstory}\nGOAL: ${agent.goal}\nOUTPUT_REQUIREMENTS: ${agent.expectedOutput}`;
      const response = await geminiService.generate(agent.config.model, systemInstruction, finalInput, agent.config, undefined, [], humanFeedback);
      const newOutput = response.text || "Task complete (re-run).";
      
      setHumanCheckpointData(prev => prev ? ({ ...prev, outputVersions: [...prev.outputVersions, { output: newOutput }], currentOutputVersionIndex: prev.outputVersions.length }) : null);
      setHumanFeedback('');
    } catch (err: any) {
      alert("Failed to re-run agent: " + err.message);
    } finally {
      setIsReRunning(false);
    }
  };
  
  const startExecution = async () => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow || workflow.nodes.length === 0) return;
    
    const executionId = crypto.randomUUID();
    const startTime = Date.now();
    
    executionStateRef.current = { active: true, currentExecutionId: executionId, startTime, currentOutput: "", currentNode: workflow.nodes[0], agentIterationCounts: new Map() };
    
    setIsExecuting(true); setActiveExecutionId(executionId); setLogs([]); setElapsedSeconds(0);
    setIsPausedForHumanInput(false); setHumanCheckpointData(null);
    
    timerRef.current = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    setExecutions(prev => [{ id: executionId, workflow_id: workflow.metadata.id, workflow_name: workflow.metadata.name, status: 'running', timestamp: startTime }, ...prev]);
    
    processNode(workflow.nodes[0], "");
  };
  
  const formatDuration = (seconds?: number) => { if (seconds === undefined || seconds === null) return '0s'; if (seconds < 60) return `${seconds}s`; return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; };
  const activeLog = logs.find(l => l.id === activeLogId);
  const activeExecution = executions.find(ex => ex.id === activeExecutionId);
  const activeWorkflow = workflows.find(w => w.metadata.id === activeExecution?.workflow_id);

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-6 border-b border-zinc-800 bg-[#0c0c0e] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4"><div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20"><Play className="w-6 h-6 text-white" /></div><div><h2 className="text-xl font-bold text-zinc-100">Workflow Execution</h2><p className="text-sm text-zinc-500">Persisted Traceability & Live Intelligence</p></div></div>
        {isExecuting && <button onClick={()=>{}} className="flex items-center gap-2 px-5 py-2.5 bg-red-900/20 text-red-400 border border-red-900/30 rounded-xl text-xs hover:bg-red-900/40 transition-all font-bold shadow-lg shadow-red-900/10 active:scale-95"><Square className="w-4 h-4 fill-current" /> Terminate Workflow</button>}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[580px] border-r border-zinc-800 flex">
            <div className="w-80 border-r border-zinc-800 p-6 flex flex-col bg-[#0c0c0e]/30 overflow-y-auto gap-8 scrollbar-thin">
            <section>
              <button onClick={() => setIsConfigCollapsed(p => !p)} className="w-full flex justify-between items-center text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 mb-4">
                <span className="flex items-center gap-2"><Box className="w-3.5 h-3.5" /> Target Blueprint</span>
                <ChevronUp className={`w-4 h-4 transition-transform ${isConfigCollapsed ? 'rotate-180' : ''}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 space-y-4 ${isConfigCollapsed ? 'max-h-0' : 'max-h-[1000px]'}`}>
                <div className="space-y-3"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input type="text" placeholder="Find workflow..." value={workflowSearch} onChange={(e) => setWorkflowSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" /></div><select disabled={isExecuting} value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500"><option value="" disabled>Select workflow...</option>{filteredWorkflows.map(w => <option key={w.metadata.id} value={w.metadata.id}>{w.metadata.name}</option>)}</select></div>
                {selectedWorkflowId ? (<><section className="space-y-4 flex-1"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-2"><Settings className="w-3.5 h-3.5" /> Execution Config</h3><div className="space-y-4 overflow-y-auto pr-1">{uniqueParams.map(({ parameter, description }) => (<div key={parameter} className="space-y-2"><label className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter mono pl-1">{parameter}</label>{Array.isArray(workflowInputs[parameter]) && (workflowInputs[parameter] as File[]).length > 0 ? (<div className="space-y-1">{(workflowInputs[parameter] as File[]).map((f, i) => (<div key={i} className="flex items-center justify-between text-xs bg-zinc-950 p-2 rounded-md border border-zinc-800"><span className="truncate">{f.name}</span><button onClick={()=>handleRemoveFile(parameter,i)} className="p-1"><X className="w-3 h-3"/></button></div>))}<button onClick={() => setWorkflowInputs(p=>({...p, [parameter]:''}))} className="text-red-400 text-[9px] w-full text-center p-1 hover:bg-zinc-800 rounded-md">Clear Files</button></div>) : (<textarea disabled={isExecuting} value={typeof workflowInputs[parameter] === 'string' ? workflowInputs[parameter] as string : ''} onChange={(e) => setWorkflowInputs(prev => ({ ...prev, [parameter]: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 min-h-[60px] resize-y focus:ring-1 focus:ring-indigo-500 outline-none scrollbar-thin" placeholder={description} />)}<label htmlFor={`wf-file-${parameter}`} className="cursor-pointer flex items-center justify-center gap-2 w-full p-1.5 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg text-[9px] font-bold text-zinc-400 transition-colors"><Upload className="w-3 h-3" /> Attach</label><input id={`wf-file-${parameter}`} type="file" multiple className="hidden" onChange={e=>handleFileChange(e,parameter)}/></div>))}{uniqueParams.length === 0 && <p className="text-[10px] text-zinc-600 italic text-center py-4">No runtime params needed.</p>}</div></section><button onClick={startExecution} disabled={isExecuting} className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-xl ${isExecuting ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95'}`}>{isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />} {isExecuting ? 'Workflow Active' : 'Start Execution'}</button></>) : (<div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center py-10 px-4"><History className="w-10 h-10 mb-4 text-zinc-600" /><p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Select blueprint to begin</p></div>)}
              </div>
            </section>
            </div>
            <div className="flex-1 flex flex-col bg-[#0c0c0e]/10 overflow-hidden">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 shrink-0">
                  <button onClick={() => setIsHistoryCollapsed(p => !p)} className="w-full flex justify-between items-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><History className="w-3.5 h-3.5" /> Previous Runs</span>
                    <ChevronUp className={`w-4 h-4 transition-transform ${isHistoryCollapsed ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isHistoryCollapsed ? 'max-h-0' : 'max-h-full'}`}>
                  <div className="p-4 border-b border-zinc-800 bg-zinc-900/20">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input type="text" placeholder="Search history..." value={executionSearch} onChange={(e) => setExecutionSearch(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                    {filteredExecutions.map(ex => (<button key={ex.id} onClick={() => setActiveExecutionId(ex.id)} className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden group ${activeExecutionId === ex.id ? 'bg-indigo-600/10 border-indigo-600/40 shadow-lg' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'}`}><div className="flex justify-between items-start mb-2"><span className="text-[11px] font-bold text-zinc-200 truncate pr-2">{ex.workflow_name}</span><div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${ex.status === 'completed' ? 'bg-emerald-500' : ex.status === 'paused' ? 'bg-yellow-500' : ex.status === 'stopped' ? 'bg-amber-500' : ex.status === 'running' ? 'bg-indigo-500 animate-pulse' : 'bg-red-500'}`} /></div><div className="flex items-center justify-between text-[9px] text-zinc-600"><div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(ex.timestamp).toLocaleTimeString()}</div>{ex.duration !== undefined && ex.duration !== null && (<div className="text-indigo-400 font-bold">{formatDuration(ex.duration)}</div>)}</div></button>))}
                    {filteredExecutions.length === 0 && <p className="text-[10px] text-zinc-700 text-center py-10 uppercase tracking-widest font-bold">No history available</p>}
                  </div>
                </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col bg-black/40 overflow-hidden relative">
           {activeExecutionId ? (<div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin p-8"><div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
            {isPausedForHumanInput && humanCheckpointData && (
              <section className="bg-yellow-900/10 border-2 border-dashed border-yellow-500/30 p-8 rounded-3xl space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-yellow-400 flex items-center gap-3"><ThumbsUp className="w-6 h-6"/> Human Input Required</h3><div className="flex items-center gap-2"><div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{humanCheckpointData.agent.name}</div><div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"/></div></div>
                <div className="bg-black/30 border border-zinc-800 rounded-2xl p-6 min-h-[200px] max-h-[400px] overflow-y-auto scrollbar-thin space-y-4"><div className="flex justify-between items-center"><div className="text-xs font-bold text-zinc-500 uppercase">Agent Output</div>{humanCheckpointData.outputVersions.length > 1 && (<div className="flex gap-2">{humanCheckpointData.outputVersions.map((_, i) => (<button key={i} onClick={()=>setHumanCheckpointData(p=>p?{...p, currentOutputVersionIndex:i}:null)} className={`px-3 py-1 text-[10px] rounded-md font-bold ${i === humanCheckpointData.currentOutputVersionIndex ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>V{i+1}</button>))}</div>)}</div><div className="prose prose-sm prose-invert"><Markdown>{humanCheckpointData.outputVersions[humanCheckpointData.currentOutputVersionIndex].output}</Markdown></div></div>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6">
                  <p className="text-sm font-bold text-zinc-300 mb-4">Are you satisfied with this output?</p>
                  <div className="flex gap-4 items-stretch">
                      <div className="flex-1 space-y-3">
                          <label className="text-xs font-bold text-zinc-400">Provide feedback for revision (optional)</label>
                          <textarea value={humanFeedback} onChange={e=>setHumanFeedback(e.target.value)} rows={3} placeholder="e.g., 'Make the tone more professional and add a concluding paragraph.'" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-yellow-500 outline-none resize-y min-h-[100px]"></textarea>
                          <button onClick={handleHumanRejectionAndRerun} disabled={!humanFeedback || isReRunning} className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold text-white text-sm disabled:opacity-50">
                              <MessageSquare className="w-4 h-4"/>
                              {isReRunning ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Re-run with Feedback'}
                          </button>
                      </div>
                      <div className="w-px bg-zinc-700"/>
                      <div className="flex flex-col justify-end">
                        <button onClick={handleHumanApproval} className="px-5 py-3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all text-sm">
                            <ThumbsUp className="w-4 h-4"/> 
                            <span>Approve & Continue</span>
                        </button>
                      </div>
                  </div>
                </div>
              </section>
            )}
            <section className="space-y-4">
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsLogExpanded(!isLogExpanded)} className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors"><Terminal className="w-4 h-4 text-indigo-500" /> Consolidated Log {isLogExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>
                  {(isExecuting ? elapsedSeconds > 0 : activeExecution?.duration !== undefined) && (<span className="px-2.5 py-1 rounded-full bg-indigo-900/30 text-indigo-400 text-[10px] font-bold border border-indigo-500/20">Execution Time: {formatDuration(isExecuting ? elapsedSeconds : activeExecution?.duration)}</span>)}
                </div>
                {!isExecuting && logs.some(l => l.status === 'completed' && l.output) && <button onClick={downloadAllOutputs} className="flex items-center gap-2 text-xs font-bold bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors" title="Download All Outputs"><Download className="w-3.5 h-3.5" /><span>Download All</span></button>}
              </div>
              {isLogExpanded && (<div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5 font-mono text-[11px] leading-relaxed animate-in slide-in-from-top-3 duration-300"><div className="bg-zinc-900/50 px-5 py-3 border-b border-zinc-800 flex items-center justify-between"><span className="text-zinc-600 uppercase tracking-widest text-[9px] font-bold">Live System Trace • ID: {activeExecutionId.slice(0,8)}</span>{(isExecuting || isReRunning) && <span className="flex items-center gap-2 text-indigo-500 text-[9px] font-bold uppercase animate-pulse"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" /> Synchronizing</span>}</div><div className="p-6 space-y-4 min-h-[150px] max-h-[500px] overflow-y-auto scrollbar-thin">{logs.map((log) => <LogEntry key={log.id} log={log} />)}{(isExecuting || isReRunning) && <div className="flex items-center gap-3 text-indigo-400 text-[10px] font-bold uppercase tracking-widest pl-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing next instruction...</div>}</div></div>)}</section>
            <section className="space-y-4 pb-20"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4" /> Agent Traces</h3><div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">{logs.filter(l => l.nodeId !== 'manager' && l.nodeId !== 'system').map(log => (<button key={log.id} onClick={() => setActiveLogId(log.id)} className={`shrink-0 flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all ${activeLogId === log.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}><div className={`w-2.5 h-2.5 rounded-full ${log.status === 'completed' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : log.status === 'failed' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' : log.status === 'paused' ? 'bg-yellow-400' : 'bg-indigo-400 animate-pulse'}`} /><span className="text-[11px] font-bold uppercase tracking-wider">{log.agentName} (V{log.version})</span></button>))}</div>
            {activeLog && activeLog.nodeId !== 'manager' && activeLog.nodeId !== 'system' && (<div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6"><div className="p-10 bg-[#0c0c0e] border border-zinc-800 rounded-3xl shadow-2xl relative group min-h-[400px]"><div className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-8 flex items-center justify-between"><div className="flex items-center gap-3"><FileText className="w-4 h-4" /><span>Agent Trace: {activeLog.agentName}</span><span className="text-[9px] font-mono text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-800">V{activeLog.version}</span></div><div className="flex items-center gap-4"><button onClick={() => { const node = activeWorkflow?.nodes.find(n => n.id === activeLog.nodeId); const agent = agents.find(a => a.id === node?.agentId); triggerDownload(`${activeLog.agentName}_v${activeLog.version}_output${agent?.outputFileExtension || '.txt'}`, activeLog.output || ''); }} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors text-[10px] font-bold"><Download className="w-3.5 h-3.5" /> DOWNLOAD</button><div className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase ${activeLog.status === 'failed' ? 'bg-red-900/10 border-red-500 text-red-400 shadow-lg shadow-red-900/20' : activeLog.status === 'completed' ? 'bg-emerald-900/10 border-emerald-500 text-emerald-400' : 'bg-indigo-900/10 border-indigo-500 text-indigo-400'}`}>Status: {activeLog.status}</div></div></div>{activeLog.status === 'running' ? (<div className="flex flex-col items-center py-32 gap-6 opacity-40"><div className="relative"><Loader2 className="w-16 h-16 animate-spin text-indigo-500" /><Cpu className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div><div className="text-center space-y-1"><p className="text-base font-bold text-zinc-300">Agent Thinking</p><p className="text-xs text-zinc-500 italic animate-pulse">Navigating internal logic layers...</p></div></div>) : activeLog.status === 'failed' ? (<div className="animate-in zoom-in-95 duration-300 p-8 border-2 border-red-900/30 bg-red-900/10 rounded-3xl flex flex-col items-center text-center gap-5"><div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center border border-red-600/30"><AlertCircle className="w-8 h-8 text-red-500" /></div><div><h4 className="text-xl font-bold text-red-400 mb-2">Execution Halted</h4><p className="text-sm text-red-200/60 max-w-lg leading-relaxed mb-6">The agent encountered an error during processing. This is typically caused by prompt constraints, model refusal, or connectivity issues.</p><div className="bg-black/40 border border-red-900/30 p-5 rounded-2xl text-left mono text-xs text-red-400 w-full overflow-auto max-h-[200px] scrollbar-thin"><span className="font-bold text-red-500 block mb-2 uppercase tracking-widest text-[10px]">Error Trace:</span>{activeLog.error || 'The system was unable to capture a specific error reason. Please check the agent backstory and task definition.'}</div></div></div>) : (<div className="prose prose-md prose-invert max-w-none animate-in fade-in duration-500"><Markdown>{activeLog.output || 'No output text returned for this trace segment.'}</Markdown></div>)}</div></div>)}</section>
           </div></div>) : (<div className="flex-1 flex flex-col items-center justify-center opacity-10 select-none grayscale py-40"><Terminal className="w-32 h-32 mb-8 text-zinc-800" /><h3 className="text-4xl font-bold uppercase tracking-[0.4em] text-zinc-700">Awaiting Signal</h3><p className="mt-4 text-sm font-medium uppercase tracking-widest text-zinc-800">Select or execute a blueprint to view traces</p></div>)}
        </div>
      </div>
    </div>
  );
};
