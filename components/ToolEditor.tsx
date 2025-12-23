
import React, { useState, useEffect } from 'react';
import { Tool } from '../types';
import { Save, X, Hammer, Code, Terminal, Play, Loader2, AlertCircle, Info, Trash2, Plus, ChevronDown, Globe } from 'lucide-react';

interface ToolEditorProps {
  tool: Tool;
  onSave: (tool: Tool) => void;
  onCancel: () => void;
}

const TEMPLATES = {
  javascript: `async ({ owner, repo, path }) => {\n  // Example: Fetch from GitHub\n  const url = \`https://raw.githubusercontent.com/\${owner}/\${repo}/main/\${path}\`;\n  const response = await fetch(url);\n  if (!response.ok) throw new Error('File not found');\n  return await response.text();\n}`,
  python: `def main(args):\n    # This code runs in your target environment\n    owner = args.get('owner')\n    repo = args.get('repo')\n    path = args.get('path')\n    # implementation logic here...\n    return f"Read {path} from {owner}/{repo}"`,
  java: `public class ToolImplementation {\n    public Object execute(Map<String, Object> args) {\n        // implementation logic here...\n        return "Success";\n    }\n}`
};

export const ToolEditor: React.FC<ToolEditorProps> = ({ tool, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Tool>({ 
    ...tool, 
    language: tool.language || 'javascript' 
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testArgs, setTestArgs] = useState<string>('{\n  "owner": "google",\n  "repo": "gson",\n  "path": "README.md"\n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Apply template if code is empty or just the default
  useEffect(() => {
    if (!formData.code || formData.code.includes('Implementation here')) {
      setFormData(prev => ({ ...prev, code: TEMPLATES[formData.language] }));
    }
  }, [formData.language]);

  const runTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const args = JSON.parse(testArgs);
      
      if (formData.language === 'javascript') {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('args', formData.code);
        const result = await fn(args);
        setTestResult(result);
      } else {
        // Simulation for non-JS
        await new Promise(resolve => setTimeout(resolve, 800));
        setTestResult({
          status: "simulated_output",
          language: formData.language,
          environment: "Browser (Local Preview)",
          notice: "Python/Java execution requires a specialized backend runner. The platform currently simulates output for these languages during local testing.",
          input_received: args
        });
      }
    } catch (e: any) {
      setTestError(e.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.className || !formData.code) {
      alert("Please fill in the required tool details.");
      return;
    }
    onSave(formData);
  };

  const getLanguageColor = (lang: string) => {
    switch (lang) {
      case 'javascript': return 'text-amber-400';
      case 'python': return 'text-blue-400';
      case 'java': return 'text-red-400';
      default: return 'text-zinc-400';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-[#0c0c0e]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Hammer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Tool Definition</h2>
            <p className="text-sm text-zinc-500">Logic & Interface Signature</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors text-sm font-medium">Cancel</button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-indigo-600/20"
          >
            <Save className="w-4 h-4" /> Save Tool
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Tool Identity</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Display Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. GitHub Reader"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Code Language</label>
                    <div className="relative">
                      <select
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value as any })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"
                      >
                        <option value="javascript">JavaScript (Live)</option>
                        <option value="python">Python (Target)</option>
                        <option value="java">Java (Target)</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Class Name (ID)</label>
                  <input
                    type="text"
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value.replace(/\s+/g, '') })}
                    placeholder="e.g. GitHubClient"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-indigo-500 outline-none mono text-indigo-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Tool Description (Vital for Agent Choice)</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Explain what this tool does so the AI knows when to use it..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Interface Signature (JSON Schema)</h3>
              <div className="bg-[#0c0c0e] border border-zinc-800 rounded-lg p-1 min-h-[220px] flex flex-col overflow-hidden">
                <textarea
                  value={JSON.stringify(formData.parameters, null, 2)}
                  onChange={(e) => {
                    try {
                      const params = JSON.parse(e.target.value);
                      setFormData({ ...formData, parameters: params });
                    } catch (err) {}
                  }}
                  className="w-full flex-1 bg-transparent p-4 text-xs mono text-zinc-400 focus:outline-none scrollbar-thin resize-none"
                  spellCheck={false}
                />
                <div className="bg-zinc-900/50 p-2 text-[9px] text-zinc-600 font-bold flex items-center gap-2 uppercase tracking-tight">
                  <Info className="w-3.5 h-3.5 text-indigo-500" /> Define properties the model must provide.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2"><Code className="w-4 h-4" /> Implementation Source</div>
              <div className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${getLanguageColor(formData.language)}`}>
                <div className={`w-1.5 h-1.5 rounded-full bg-current ${formData.language === 'javascript' ? 'animate-pulse' : ''}`} />
                {formData.language} Mode
              </div>
            </h3>
            
            {formData.language !== 'javascript' && (
              <div className="bg-blue-900/10 border border-blue-900/30 p-3 rounded-lg flex items-center gap-3 text-blue-400 text-xs animate-in slide-in-from-left-2">
                <Globe className="w-4 h-4 shrink-0" />
                <p><strong>Note:</strong> Your browser executes JavaScript natively. {formData.language} code is stored and passed to agents, but testing below will return simulated output.</p>
              </div>
            )}

            <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative group">
              <div className="bg-zinc-900/80 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-mono">
                  {formData.language === 'javascript' ? 'main.js' : formData.language === 'python' ? 'main.py' : 'Main.java'}
                </span>
              </div>
              <textarea
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full min-h-[400px] bg-transparent p-6 text-sm mono text-indigo-100 focus:outline-none resize-y scrollbar-thin"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        <div className="w-96 border-l border-zinc-800 bg-[#0c0c0e]/30 flex flex-col">
          <header className="p-6 border-b border-zinc-800 bg-zinc-900/20">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Run & Debug
            </h3>
          </header>
          
          <div className="p-6 space-y-6 flex-1 overflow-y-auto scrollbar-thin">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Input Arguments (JSON)</label>
              <textarea
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs mono text-zinc-300 min-h-[140px] focus:ring-1 focus:ring-indigo-500 outline-none scrollbar-thin"
                placeholder="{}"
                spellCheck={false}
              />
            </div>

            <button
              onClick={runTest}
              disabled={isTesting}
              className={`w-full py-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                isTesting ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
              }`}
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {isTesting ? 'Executing...' : 'Invoke Tool'}
            </button>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Execution Response</label>
              <div className="min-h-[250px] bg-black/40 border border-zinc-800 rounded-xl p-5 font-mono text-[11px] overflow-auto scrollbar-thin ring-1 ring-white/5 shadow-inner">
                {testError ? (
                  <div className="text-red-400 flex items-start gap-2 bg-red-900/10 p-3 rounded-lg border border-red-900/20">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">Runtime Error: {testError}</span>
                  </div>
                ) : testResult !== null ? (
                  <pre className={`whitespace-pre-wrap leading-relaxed ${formData.language === 'javascript' ? 'text-emerald-400' : 'text-blue-300'}`}>
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale py-12">
                    <Terminal className="w-8 h-8 mb-2" />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Awaiting Call</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
