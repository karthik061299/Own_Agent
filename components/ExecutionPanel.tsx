
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Markdown from 'markdown-to-jsx';
import { Workflow, Agent, ExecutionLog, WorkflowExecution, Tool } from '../types';
import { geminiService } from '../services/gemini';
import { dbService } from '../services/db';
import { 
  Play, Terminal, Loader2, History, Zap, Settings, 
  Search, Clock, Box, Download, ChevronDown, ChevronUp, Layers, FileText, Square, Hammer, AlertCircle, Cpu, Eye, EyeOff
} from 'lucide-react';

interface ExecutionPanelProps {
  workflows: Workflow[];
  agents: Agent[];
  tools: Tool[];
}

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
  const [dateFilter, setDateFilter] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, string>>({});
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  const executionRef = useRef<{ active: boolean; currentExecutionId: string | null; startTime: number }>({ active: false, currentExecutionId: null, startTime: 0 });
  const logsRef = useRef<ExecutionLog[]>([]);
  const timerRef = useRef<number | null>(null);

  const updateLogsAndRef = (newLogs: ExecutionLog[]) => {
    logsRef.current = newLogs;
    setLogs([...newLogs]);
  };

  useEffect(() => { loadExecutionHistory(); }, []);
  useEffect(() => { if (activeExecutionId) { loadLogs(activeExecutionId); } }, [activeExecutionId]);

  const loadExecutionHistory = async () => setExecutions(await dbService.getWorkflowExecutions());
  const loadLogs = async (sid: string) => updateLogsAndRef(await dbService.getLogsByExecution(sid));

  const filteredWorkflows = useMemo(() => workflows.filter(w => w.metadata.name.toLowerCase().includes(workflowSearch.toLowerCase())), [workflows, workflowSearch]);
  const filteredExecutions = useMemo(() => executions.filter(ex => (ex.workflow_name?.toLowerCase().includes(executionSearch.toLowerCase())) && (!dateFilter || new Date(ex.timestamp).toISOString().startsWith(dateFilter))), [executions, executionSearch, dateFilter]);

  const uniqueParams = useMemo(() => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow) return [];
    const params = new Map<string, string>();
    workflow.nodes.forEach(node => agents.find(a => a.id === node.agentId)?.inputs.forEach(input => { if (input.parameter && !params.has(input.parameter)) params.set(input.parameter, input.description); }));
    return Array.from(params.entries()).map(([parameter, description]) => ({ parameter, description }));
  }, [selectedWorkflowId, workflows, agents]);

  const addAndSaveLog = async (executionId: string, logData: Omit<ExecutionLog, 'id' | 'timestamp' | 'execution_id'>, duration?: number) => {
    const newLog: ExecutionLog = { ...logData, id: crypto.randomUUID(), execution_id: executionId, timestamp: Date.now() };
    updateLogsAndRef([...logsRef.current, newLog]);
    setActiveLogId(newLog.id); 
    await dbService.saveLog(selectedWorkflowId, newLog, duration);
    return newLog.id;
  };

  const finishAndSaveLog = async (id: string, updates: Partial<ExecutionLog>) => {
    const logToUpdate = logsRef.current.find(l => l.id === id);
    if (!logToUpdate) return;
    const updatedLog = { ...logToUpdate, ...updates };
    updateLogsAndRef(logsRef.current.map(l => l.id === id ? updatedLog : l));
    await dbService.saveLog(selectedWorkflowId, updatedLog);
  };
  
  const triggerDownload = (filename: string, content: string) => {
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
  
  const downloadAllOutputs = () => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow) return;
    logsRef.current.forEach(log => {
      if (log.status === 'completed' && log.output && log.nodeId !== 'system' && log.nodeId !== 'manager') {
        const node = workflow.nodes.find(n => n.id === log.nodeId);
        const agent = agents.find(a => a.id === node?.agentId);
        const extension = agent?.outputFileExtension || '.txt';
        const filename = `${log.agentName}_v${log.version}_output${extension}`;
        triggerDownload(filename, log.output);
      }
    });
  };

  const executeTool = async (toolClassName: string, args: any, agentTools: Tool[]) => {
    const tool = agentTools.find(t => t.className === toolClassName);
    if (!tool) throw new Error(`Tool definition for '${toolClassName}' not found.`);
    if (tool.language !== 'javascript') return `[Simulation]: Invoked non-JS tool ${tool.name}. Arguments: ${JSON.stringify(args)}`;
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('args', tool.code);
      return await fn(args);
    } catch (err: any) { throw new Error(`Tool Logic Error (${tool.name}): ${err.message}`); }
  };

  const startExecution = async () => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow || workflow.nodes.length === 0) return;
    
    const executionId = crypto.randomUUID();
    const startTime = Date.now();
    setIsExecuting(true); setActiveExecutionId(executionId); updateLogsAndRef([]); setElapsedSeconds(0);
    executionRef.current = { active: true, currentExecutionId: executionId, startTime };
    timerRef.current = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    setExecutions(prev => [{ id: executionId, workflow_id: workflow.metadata.id, workflow_name: workflow.metadata.name, status: 'running', timestamp: startTime }, ...prev]);

    try {
      let currentNode = workflow.nodes[0];
      let currentOutput = "";
      let iterations = 0;
      const MAX_ITERATIONS = 20;
      const agentIterationCounts = new Map<string, number>();

      while (currentNode && executionRef.current.active && iterations < MAX_ITERATIONS) {
        iterations++;
        const agent = agents.find(a => a.id === currentNode.agentId);
        if (!agent) throw new Error("Agent for current node not found!");

        const agentTools = tools.filter(t => agent.toolIds?.includes(t.id));
        const version = (agentIterationCounts.get(agent.id) || 0) + 1;
        agentIterationCounts.set(agent.id, version);

        let taskWithInputs = agent.taskDescription;
        let paramContext = "";
        agent.inputs.forEach(input => {
          const val = workflowInputs[input.parameter] || "";
          taskWithInputs = taskWithInputs.split(`{${input.parameter}}`).join(val);
          paramContext += `\n- ${input.parameter}: ${val}`;
        });
        const finalInput = `CONTEXT_CHAIN: ${currentOutput || 'Start of Workflow'}\n\nPARAM_BLOCK:${paramContext || ' None'}\n\nASSIGNED_TASK: ${taskWithInputs}`;
        const logId = await addAndSaveLog(executionId, { nodeId: currentNode.id, agentName: agent.name, status: 'running', input: finalInput, version: version });

        try {
          const systemInstruction = `IDENTITY: ${agent.backstory}\nGOAL: ${agent.goal}\nOUTPUT_REQUIREMENTS: ${agent.expectedOutput}`;
          const response = await geminiService.generate(agent.config.model, systemInstruction, finalInput, agent.config, undefined, agentTools);
          if (!executionRef.current.active) break;

          const functionCalls = response.functionCalls;
          let output = "";

          if (functionCalls && functionCalls.length > 0) {
            const toolResults = [];
            for (const fc of functionCalls) {
              try {
                toolResults.push({ id: fc.id, name: fc.name, response: { result: await executeTool(fc.name, fc.args, agentTools) } });
              } catch (err: any) {
                toolResults.push({ id: fc.id, name: fc.name, response: { error: err.message } });
              }
            }
            await finishAndSaveLog(logId, { toolCalls: functionCalls });
            const finalResponse = await geminiService.generateWithToolResults(agent.config.model, agent.config, systemInstruction, finalInput, functionCalls, toolResults);
            output = finalResponse.text || "Execution finished after tool calls.";
          } else {
            output = response.text || "Task complete.";
          }
          
          await finishAndSaveLog(logId, { status: 'completed', output });
          currentOutput = output;

          if (workflow.metadata.useManager) {
            const managerResponse = await geminiService.routeNextStep(workflow.metadata.managerModel, workflow.metadata.managerTemperature, workflow.metadata.managerTopP, workflow.metadata.description, JSON.stringify(workflow.nodes), JSON.stringify(workflow.edges), logsRef.current.map(l => `${l.agentName}: ${l.output}`).join('\n'), currentOutput);
            if (!executionRef.current.active) break;
            await addAndSaveLog(executionId, { nodeId: 'manager', agentName: 'Manager Thought', status: 'completed', input: 'Analysis step', output: managerResponse.nextNodeId ? `Manager Decision: Branching to node ${managerResponse.nextNodeId}` : `Workflow Finished: ${managerResponse.finalSummary}` });
            currentNode = managerResponse.nextNodeId ? workflow.nodes.find(n => n.id === managerResponse.nextNodeId) || null : null;
          } else {
            const nextEdge = workflow.edges.find(e => e.source === currentNode!.id);
            currentNode = nextEdge ? workflow.nodes.find(n => n.id === nextEdge.target) || null : null;
          }
        } catch (err: any) {
          if (executionRef.current.active) { await finishAndSaveLog(logId, { status: 'failed', error: err.message || 'Critical agent error.' }); }
          break;
        }
      }
    } catch (e: any) {
      console.error("Critical Execution Failure:", e);
    } finally {
      if (executionRef.current.active) {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await addAndSaveLog(executionId, { nodeId: 'system', agentName: 'System', status: 'completed', input: 'Teardown', output: `Pipeline finished. Total time: ${formatDuration(duration)}.` }, duration);
        setExecutions(prev => prev.map(ex => ex.id === executionId ? { ...ex, status: 'completed', duration } : ex));
      }
      setIsExecuting(false);
      executionRef.current.active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      loadExecutionHistory();
    }
  };

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return '0s';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };
  
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
        {/* Run Selector & History Sidebars */}
        <div className="w-[580px] border-r border-zinc-800 flex">
            {/* Run Selector */}
            <div className="w-80 border-r border-zinc-800 p-6 flex flex-col bg-[#0c0c0e]/30 overflow-y-auto gap-8 scrollbar-thin">
            <section className="space-y-4"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-2"><Box className="w-3.5 h-3.5" /> Target Blueprint</h3><div className="space-y-3"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input type="text" placeholder="Find workflow..." value={workflowSearch} onChange={(e) => setWorkflowSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" /></div><select disabled={isExecuting} value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500"><option value="" disabled>Select workflow...</option>{filteredWorkflows.map(w => <option key={w.metadata.id} value={w.metadata.id}>{w.metadata.name}</option>)}</select></div></section>
            {selectedWorkflowId ? (<><section className="space-y-4 flex-1"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-2"><Settings className="w-3.5 h-3.5" /> Execution Config</h3><div className="space-y-4 overflow-y-auto pr-1">{uniqueParams.map(({ parameter, description }) => (<div key={parameter} className="space-y-1"><label className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter mono pl-1">{parameter}</label><textarea disabled={isExecuting} value={workflowInputs[parameter] || ''} onChange={(e) => setWorkflowInputs(prev => ({ ...prev, [parameter]: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 min-h-[100px] resize-y focus:ring-1 focus:ring-indigo-500 outline-none scrollbar-thin" placeholder={description} /></div>))}{uniqueParams.length === 0 && <p className="text-[10px] text-zinc-600 italic text-center py-4">No runtime params needed.</p>}</div></section><button onClick={startExecution} disabled={isExecuting || (uniqueParams.length > 0 && Object.values(workflowInputs).every(v => !v))} className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-xl ${isExecuting || (uniqueParams.length > 0 && Object.values(workflowInputs).every(v => !v)) ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95'}`}>{isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />} {isExecuting ? 'Workflow Active' : 'Start Execution'}</button></>) : (<div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center py-10 px-4"><History className="w-10 h-10 mb-4 text-zinc-600" /><p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Select blueprint to begin</p></div>)}
            </div>
            {/* History */}
            <div className="flex-1 flex flex-col bg-[#0c0c0e]/10"><div className="p-4 border-b border-zinc-800 space-y-3 bg-zinc-900/20"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3.5 h-3.5" /> Previous Runs</h3><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input type="text" placeholder="Search history..." value={executionSearch} onChange={(e) => setExecutionSearch(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500" /></div></div><div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">{filteredExecutions.map(ex => (<button key={ex.id} onClick={() => setActiveExecutionId(ex.id)} className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden group ${activeExecutionId === ex.id ? 'bg-indigo-600/10 border-indigo-600/40 shadow-lg' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'}`}><div className="flex justify-between items-start mb-2"><span className="text-[11px] font-bold text-zinc-200 truncate pr-2">{ex.workflow_name}</span><div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${ex.status === 'completed' ? 'bg-emerald-500' : ex.status === 'stopped' ? 'bg-amber-500' : ex.status === 'running' ? 'bg-indigo-500 animate-pulse' : 'bg-red-500'}`} /></div><div className="flex items-center justify-between text-[9px] text-zinc-600"><div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(ex.timestamp).toLocaleTimeString()}</div>{ex.duration !== undefined && ex.duration !== null && (<div className="text-indigo-400 font-bold">{formatDuration(ex.duration)}</div>)}</div></button>))}{filteredExecutions.length === 0 && <p className="text-[10px] text-zinc-700 text-center py-10 uppercase tracking-widest font-bold">No history available</p>}</div></div>
        </div>

        {/* Central Log/Trace Display */}
        <div className="flex-1 flex flex-col bg-black/40 overflow-hidden relative">
           {activeExecutionId ? (<div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin p-8"><div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
            <section className="space-y-4"><div className="flex items-center justify-between group"><div className="flex items-center gap-3"><button onClick={() => setIsLogExpanded(!isLogExpanded)} className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors"><Terminal className="w-4 h-4 text-indigo-500" /> Consolidated Log {isLogExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>{(isExecuting ? elapsedSeconds > 0 : activeExecution?.duration !== undefined) && (<span className="px-2.5 py-1 rounded-full bg-indigo-900/30 text-indigo-400 text-[10px] font-bold border border-indigo-500/20">Execution Time: {formatDuration(isExecuting ? elapsedSeconds : activeExecution?.duration)}</span>)}</div><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={downloadAllOutputs} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Download All Outputs"><Download className="w-4 h-4" /></button></div></div>{isLogExpanded && (<div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5 font-mono text-[11px] leading-relaxed animate-in slide-in-from-top-3 duration-300"><div className="bg-zinc-900/50 px-5 py-3 border-b border-zinc-800 flex items-center justify-between"><span className="text-zinc-600 uppercase tracking-widest text-[9px] font-bold">Live System Trace • ID: {activeExecutionId.slice(0,8)}</span>{isExecuting && <span className="flex items-center gap-2 text-indigo-500 text-[9px] font-bold uppercase animate-pulse"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" /> Synchronizing</span>}</div><div className="p-6 space-y-4 min-h-[150px] max-h-[500px] overflow-y-auto scrollbar-thin">{logs.map((log) => <LogEntry key={log.id} log={log} />)}{isExecuting && <div className="flex items-center gap-3 text-indigo-400 text-[10px] font-bold uppercase tracking-widest pl-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing next instruction...</div>}</div></div>)}</section>
            <section className="space-y-4 pb-20"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4" /> Agent Traces</h3><div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">{logs.filter(l => l.nodeId !== 'manager' && l.nodeId !== 'system').map(log => (<button key={log.id} onClick={() => setActiveLogId(log.id)} className={`shrink-0 flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all ${activeLogId === log.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}><div className={`w-2.5 h-2.5 rounded-full ${log.status === 'completed' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : log.status === 'failed' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' : log.status === 'stopped' ? 'bg-amber-400' : 'bg-indigo-400 animate-pulse'}`} /><span className="text-[11px] font-bold uppercase tracking-wider">{log.agentName} (V{log.version})</span></button>))}</div>
            {activeLog && activeLog.nodeId !== 'manager' && activeLog.nodeId !== 'system' && (<div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6"><div className="p-10 bg-[#0c0c0e] border border-zinc-800 rounded-3xl shadow-2xl relative group min-h-[400px]">
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-8 flex items-center justify-between"><div className="flex items-center gap-3"><FileText className="w-4 h-4" /><span>Agent Trace: {activeLog.agentName}</span><span className="text-[9px] font-mono text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-800">V{activeLog.version}</span></div>
                <div className="flex items-center gap-4">
                  <button onClick={() => { const node = activeWorkflow?.nodes.find(n => n.id === activeLog.nodeId); const agent = agents.find(a => a.id === node?.agentId); triggerDownload(`${activeLog.agentName}_v${activeLog.version}_output${agent?.outputFileExtension || '.txt'}`, activeLog.output || ''); }} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors text-[10px] font-bold"><Download className="w-3.5 h-3.5" /> DOWNLOAD</button>
                  <div className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase ${activeLog.status === 'failed' ? 'bg-red-900/10 border-red-500 text-red-400 shadow-lg shadow-red-900/20' : activeLog.status === 'completed' ? 'bg-emerald-900/10 border-emerald-500 text-emerald-400' : 'bg-indigo-900/10 border-indigo-500 text-indigo-400'}`}>Status: {activeLog.status}</div>
                </div>
              </div>
              {activeLog.status === 'running' ? (<div className="flex flex-col items-center py-32 gap-6 opacity-40"><div className="relative"><Loader2 className="w-16 h-16 animate-spin text-indigo-500" /><Cpu className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div><div className="text-center space-y-1"><p className="text-base font-bold text-zinc-300">Agent Thinking</p><p className="text-xs text-zinc-500 italic animate-pulse">Navigating internal logic layers...</p></div></div>) : activeLog.status === 'failed' ? (<div className="animate-in zoom-in-95 duration-300 p-8 border-2 border-red-900/30 bg-red-900/10 rounded-3xl flex flex-col items-center text-center gap-5"><div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center border border-red-600/30"><AlertCircle className="w-8 h-8 text-red-500" /></div><div><h4 className="text-xl font-bold text-red-400 mb-2">Execution Halted</h4><p className="text-sm text-red-200/60 max-w-lg leading-relaxed mb-6">The agent encountered an error during processing. This is typically caused by prompt constraints, model refusal, or connectivity issues.</p><div className="bg-black/40 border border-red-900/30 p-5 rounded-2xl text-left mono text-xs text-red-400 w-full overflow-auto max-h-[200px] scrollbar-thin"><span className="font-bold text-red-500 block mb-2 uppercase tracking-widest text-[10px]">Error Trace:</span>{activeLog.error || 'The system was unable to capture a specific error reason. Please check the agent backstory and task definition.'}</div></div></div>) : (<div className="prose prose-md prose-invert max-w-none animate-in fade-in duration-500"><Markdown>{activeLog.output || 'No output text returned for this trace segment.'}</Markdown></div>)}
            </div></div>)}</section>
           </div></div>) : (<div className="flex-1 flex flex-col items-center justify-center opacity-10 select-none grayscale py-40"><Terminal className="w-32 h-32 mb-8 text-zinc-800" /><h3 className="text-4xl font-bold uppercase tracking-[0.4em] text-zinc-700">Awaiting Signal</h3><p className="mt-4 text-sm font-medium uppercase tracking-widest text-zinc-800">Select or execute a blueprint to view traces</p></div>)}
        </div>
      </div>
    </div>
  );
};
