
import React, { useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { Agent, Tool } from '../types';
import { geminiService } from '../services/gemini';
import { ArrowLeft, Play, Download, Loader2, AlertCircle, Cpu, FileText } from 'lucide-react';

interface AgentTestViewProps {
  agent: Agent;
  onBack: () => void;
}

export const AgentTestView: React.FC<AgentTestViewProps> = ({ agent, onBack }) => {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRunTest = async () => {
    setIsLoading(true);
    setError('');
    setOutput('');
    
    try {
      let taskWithInputs = agent.taskDescription;
      let paramContext = "";
      
      agent.inputs.forEach(input => {
        const val = inputs[input.parameter] || "";
        const placeholder = `{${input.parameter}}`;
        if (taskWithInputs.includes(placeholder)) {
          taskWithInputs = taskWithInputs.split(placeholder).join(val);
        } else {
          paramContext += `\n- ${input.parameter}: ${val}`;
        }
      });

      const finalInput = `CONTEXT_CHAIN: This is a standalone test run.\n\nPARAM_BLOCK:${paramContext || ' None'}\n\nASSIGNED_TASK: ${taskWithInputs}`;

      const response = await geminiService.generate(
        agent.config.model,
        `IDENTITY: ${agent.backstory}\nGOAL: ${agent.goal}\nOUTPUT_REQUIREMENTS: ${agent.expectedOutput}`,
        finalInput,
        agent.config,
      );

      setOutput(response.text || 'Agent produced no output.');

    } catch (e: any) {
      setError(e.message || 'An unknown error occurred during execution.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_${agent.name}_v${agent.version}_output${agent.outputFileExtension || '.txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-[#0c0c0e] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-zinc-400 hover:text-zinc-100"><ArrowLeft className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-800" />
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Test Agent: {agent.name} (V{agent.version})</h2>
            <p className="text-xs text-zinc-500">Run an isolated test to validate agent logic and output format.</p>
          </div>
        </div>
        <button onClick={handleRunTest} disabled={isLoading} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isLoading ? 'Executing...' : 'Run Test'}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Input Panel */}
        <div className="w-[450px] border-r border-zinc-800 p-6 flex flex-col gap-6 overflow-y-auto scrollbar-thin">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Input Parameters</h3>
          {agent.inputs.length > 0 ? (
            agent.inputs.map(input => (
              <div key={input.parameter} className="space-y-2">
                <label className="text-sm font-medium text-indigo-400 font-mono">{input.parameter}</label>
                <p className="text-xs text-zinc-500">{input.description}</p>
                <textarea
                  value={inputs[input.parameter] || ''}
                  onChange={(e) => setInputs(prev => ({...prev, [input.parameter]: e.target.value}))}
                  rows={4}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm mono focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                />
              </div>
            ))
          ) : (
            <div className="text-center text-zinc-600 text-sm py-20">This agent requires no inputs.</div>
          )}
        </div>

        {/* Output Panel */}
        <div className="flex-1 p-8 flex flex-col overflow-y-auto scrollbar-thin">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Agent Output</h3>
            <button onClick={handleDownload} disabled={!output} className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-30">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
          <div className="flex-1 bg-[#0c0c0e] border border-zinc-800 rounded-xl p-6 prose prose-sm prose-invert w-full max-w-none">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                <div className="relative"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /><Cpu className="w-5 h-5 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
                <span>Awaiting response from model...</span>
              </div>
            ) : error ? (
              <div className="text-red-400 flex flex-col items-center justify-center h-full gap-4">
                <AlertCircle className="w-12 h-12" />
                <div className="text-center">
                  <h4 className="font-bold mb-2">Execution Failed</h4>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            ) : output ? (
              <Markdown>{output}</Markdown>
            ) : (
               <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-4">
                <FileText className="w-12 h-12" />
                <span>Output will appear here</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
