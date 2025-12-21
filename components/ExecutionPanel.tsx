
import React, { useState, useRef } from 'react';
import { Workflow, Agent, ExecutionLog } from '../types';
import { geminiService } from '../services/gemini';
// Added missing Cpu icon to imports
import { Play, FileUp, Terminal, Clipboard, Loader2, CheckCircle, AlertCircle, Trash2, Download, Cpu } from 'lucide-react';

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
  
  const logEndRef = useRef<HTMLDivElement>(null);

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

  const handleExecute = async () => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow || !inputText) return;

    setIsExecuting(true);
    setLogs([]);
    
    try {
      let currentInput = inputText;
      const results: string[] = [];

      // Simple Sequential implementation for this phase
      // Future: Implement more complex DAG traversal based on WorkflowType
      for (const node of workflow.nodes) {
        const agent = agents.find(a => a.id === node.agentId);
        if (!agent) continue;

        const logId = addLog({
          agentName: agent.name,
          status: 'running',
          input: currentInput
        });

        try {
          const systemPrompt = `Backstory: ${agent.backstory}\nGoal: ${agent.goal}\nInstructions: ${agent.taskDescription}`;
          const prompt = `Input (${agent.inputPlaceholder}): ${currentInput}\n\nExpected Format: ${agent.expectedOutput}`;
          
          const output = await geminiService.generate(
            agent.config.model,
            systemPrompt,
            prompt,
            agent.config
          );

          updateLog(logId, { status: 'completed', output });
          results.push(`[${agent.name} Output]: ${output}`);
          
          // Pass output to next agent
          currentInput = output;
        } catch (err: any) {
          updateLog(logId, { status: 'failed', error: err.message });
          throw err;
        }
      }

      if (workflow.metadata.useManager) {
        const logId = addLog({
          agentName: 'Workflow Manager',
          status: 'running',
          input: 'Aggregating results...'
        });
        
        const summary = await geminiService.orchestrate(
          workflow.metadata.managerModel,
          workflow.metadata.description,
          results,
          inputText
        );
        
        updateLog(logId, { status: 'completed', output: summary });
      }

    } catch (error) {
      console.error("Workflow Execution Failed", error);
    } finally {
      setIsExecuting(false);
    }
  };

  const activeLog = logs.find(l => l.id === activeLogId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setInputText(event.target?.result as string || '');
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-6 border-b border-zinc-800 bg-[#0c0c0e] flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Play className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Execution Runtime</h2>
            <p className="text-sm text-zinc-500">Run and monitor agentic processes.</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Input Controls */}
        <div className="w-1/3 border-r border-zinc-800 flex flex-col p-6 bg-[#0c0c0e]/30">
          <div className="mb-6">
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Select Workflow</label>
            <select
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm"
            >
              {workflows.map(w => <option key={w.metadata.id} value={w.metadata.id}>{w.metadata.name}</option>)}
              {workflows.length === 0 && <option value="">No workflows created</option>}
            </select>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Global Input</label>
              <div className="flex gap-2">
                <label className="cursor-pointer p-1.5 bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-all">
                  <FileUp className="w-4 h-4" />
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
                <button 
                  onClick={() => navigator.clipboard.readText().then(setInputText)}
                  className="p-1.5 bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-all"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste content, upload a file, or type prompt here..."
              className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all resize-none mono"
            />
          </div>

          <button
            onClick={handleExecute}
            disabled={isExecuting || !inputText || !selectedWorkflowId}
            className={`mt-6 w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-lg ${
              isExecuting || !inputText || !selectedWorkflowId
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
            }`}
          >
            {isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {isExecuting ? 'Workflow Running...' : 'Execute Workflow'}
          </button>
        </div>

        {/* Output & Logs */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black/40">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Process Inspector</span>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setLogs([])} className="text-zinc-500 hover:text-zinc-300">
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Step List */}
            <div className="w-64 border-r border-zinc-800 p-4 space-y-3 overflow-y-auto">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setActiveLogId(log.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    activeLogId === log.id
                      ? 'bg-indigo-600/10 border-indigo-600/30 ring-1 ring-indigo-600/20'
                      : 'bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                      {log.agentName}
                    </span>
                    {log.status === 'running' && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
                    {log.status === 'completed' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                    {log.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-500" />}
                  </div>
                  <div className="text-xs text-zinc-300 font-medium truncate">
                    {log.status === 'running' ? 'Processing...' : (log.output || log.error || 'Empty response')}
                  </div>
                </button>
              ))}
              {logs.length === 0 && !isExecuting && (
                <div className="text-center py-20 opacity-20">
                  <Terminal className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-[10px] uppercase font-bold tracking-widest">Logs idle</p>
                </div>
              )}
            </div>

            {/* Content Detail */}
            <div className="flex-1 p-8 overflow-y-auto">
              {activeLog ? (
                <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Input Snippet</h3>
                    <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 text-sm text-zinc-400 mono whitespace-pre-wrap leading-relaxed">
                      {activeLog.input}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Model Output</h3>
                      <button 
                         onClick={() => navigator.clipboard.writeText(activeLog.output || '')}
                         className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300"
                      >
                         <Clipboard className="w-3 h-3" />
                         Copy Result
                      </button>
                    </div>
                    {activeLog.status === 'running' ? (
                       <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-xl border border-zinc-800/50">
                          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                          <p className="text-sm text-zinc-500 font-medium italic">Gemini is thinking...</p>
                       </div>
                    ) : (
                      <div className={`p-6 rounded-xl border ${activeLog.status === 'failed' ? 'bg-red-900/10 border-red-900/30 text-red-300' : 'bg-zinc-900 border-zinc-700 text-zinc-100'} text-base leading-relaxed whitespace-pre-wrap shadow-xl`}>
                        {activeLog.output || activeLog.error || 'No content produced.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <Cpu className="w-16 h-16 mb-4 text-zinc-700" />
                  <p className="text-lg font-medium text-zinc-600">Select an execution step to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
