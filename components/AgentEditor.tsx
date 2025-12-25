
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Agent, AgentInput, DBModel, Tool, Engine, AgentVersion, FileExtension, AgentVersionData } from '../types';
import { dbService } from '../services/db';
import { Save, X, Settings2, Sparkles, MessageSquare, Fingerprint, Hammer, Plus, Trash2, Cpu, ChevronDown, Check, Search, TestTube, GitCommit, GitCompare, AlertCircle } from 'lucide-react';

interface AgentEditorProps {
  agent: Agent;
  tools: Tool[];
  onSave: (agent: Agent) => void;
  onTest: (agent: Agent) => void;
  onCancel: () => void;
  onSaveAndCompare: (agent: Agent) => void;
}

const SliderInput: React.FC<{ label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void }> = ({ label, value, min, max, step, onChange }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-16 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-0.5 text-xs text-indigo-600 dark:text-indigo-400 font-mono focus:outline-none" />
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-zinc-300 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
  </div>
);

export const AgentEditor: React.FC<AgentEditorProps> = ({ agent, tools, onSave, onTest, onCancel, onSaveAndCompare }) => {
  const [formData, setFormData] = useState<Agent>(agent);
  const [domains, setDomains] = useState<string[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [models, setModels] = useState<DBModel[]>([]);
  const [fileExtensions, setFileExtensions] = useState<FileExtension[]>([]);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [inputToDelete, setInputToDelete] = useState<number | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null);
  const [isOtherExtension, setIsOtherExtension] = useState(false);
  const [customExtension, setCustomExtension] = useState('');
  const [initialAgentJSON] = useState(() => JSON.stringify(agent));

  const versionDropdownRef = useRef<HTMLDivElement>(null);
  
  const allVersions = useMemo(() => {
    const getComparableData = (a: Agent): AgentVersionData => ({ name: a.name, description: a.description, role: a.role, domain: a.domain, goal: a.goal, backstory: a.backstory, taskDescription: a.taskDescription, inputs: a.inputs, expectedOutput: a.expectedOutput, outputFileExtension: a.outputFileExtension, config: a.config, toolIds: a.toolIds });
    const currentVersionData = getComparableData(formData);
    const currentVersionEntry: AgentVersion = { version: formData.version, data: currentVersionData, createdAt: Date.now() };
    return [...(formData.versions || []), currentVersionEntry].sort((a, b) => b.version - a.version);
  }, [formData]);

  const isDirty = useMemo(() => initialAgentJSON !== JSON.stringify(formData), [initialAgentJSON, formData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setIsVersionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadLookups = async () => {
      const [d, e, m, fe] = await Promise.all([dbService.getDomains(), dbService.getEngines(), dbService.getModels(), dbService.getFileExtensions()]);
      setDomains(d);
      setEngines(e);
      setModels(m);
      setFileExtensions(fe);
      
      const currentExt = agent.outputFileExtension || '';
      const isPredefined = fe.some(ext => ext.extension === currentExt);
      if (!isPredefined && currentExt) {
        setIsOtherExtension(true);
        setCustomExtension(currentExt);
      }
    };
    loadLookups();
  }, [agent]);
  
  const handleVersionLoad = (versionToLoad: AgentVersion) => {
    const getAgentData = (a: Agent): AgentVersionData => ({ name: a.name, description: a.description, role: a.role, domain: a.domain, goal: a.goal, backstory: a.backstory, taskDescription: a.taskDescription, inputs: a.inputs, expectedOutput: a.expectedOutput, outputFileExtension: a.outputFileExtension, config: a.config, toolIds: a.toolIds });
    
    const oldCurrentData = getAgentData(formData);
    const oldCurrentVersion = formData.version;

    const newHistoryEntry: AgentVersion = {
      version: oldCurrentVersion,
      data: oldCurrentData,
      createdAt: Date.now()
    };
    
    const newHistory = [
      ...(formData.versions || []).filter(v => v.version !== versionToLoad.version),
      newHistoryEntry
    ].sort((a, b) => a.version - b.version);

    const newFormData: Agent = {
        ...formData,
        ...versionToLoad.data,
        version: versionToLoad.version,
        versions: newHistory,
    };

    setFormData(newFormData);
    setIsVersionDropdownOpen(false);
  };

  const handleConfirmDeleteVersion = async () => {
    if (versionToDelete === null) return;
    
    // Combine current with history to get a full picture
    const getAgentData = (a: Agent): AgentVersionData => ({ name: a.name, description: a.description, role: a.role, domain: a.domain, goal: a.goal, backstory: a.backstory, taskDescription: a.taskDescription, inputs: a.inputs, expectedOutput: a.expectedOutput, outputFileExtension: a.outputFileExtension, config: a.config, toolIds: a.toolIds });
    const fullHistory: AgentVersion[] = [...(formData.versions || []), { version: formData.version, data: getAgentData(formData), createdAt: Date.now() }];
    
    // Filter out the deleted version and sort
    const remainingVersions = fullHistory.filter(v => v.version !== versionToDelete).sort((a, b) => a.version - b.version);
    
    if (remainingVersions.length === 0) {
      setVersionToDelete(null);
      return; // Cannot delete the last version
    }
    
    // The last one in the sorted list becomes the new current version
    const newCurrentVersion = remainingVersions.pop()!;
    
    // The rest are the new history, re-numbered
    const newHistory = remainingVersions.map((v, index) => ({
      ...v,
      version: index + 1
    }));
    
    const newFormData: Agent = {
        ...formData,
        ...newCurrentVersion.data,
        version: newHistory.length + 1,
        versions: newHistory
    };

    setFormData(newFormData);
    setVersionToDelete(null);
  };


  const handleExtensionChange = (value: string) => {
    if (value === 'other') {
      setIsOtherExtension(true);
      setCustomExtension('');
      setFormData(prev => ({...prev, outputFileExtension: ''}));
    } else {
      setIsOtherExtension(false);
      setCustomExtension('');
      setFormData(prev => ({...prev, outputFileExtension: value}));
    }
  };
  
  const handleCustomExtensionChange = (value: string) => {
    setCustomExtension(value);
    const predefined = fileExtensions.find(fe => fe.extension === value);
    if (predefined) {
      handleExtensionChange(predefined.extension);
    } else {
      setFormData(prev => ({...prev, outputFileExtension: value}));
    }
  };
  
  const isValidExtension = (ext: string | undefined): boolean => {
    if (!ext) return false;
    const regex = /^\.[a-zA-Z0-9]+$/;
    return regex.test(ext);
  };

  const isExtensionValid = isValidExtension(formData.outputFileExtension);

  const addInput = () => setFormData(prev => ({ ...prev, inputs: [...prev.inputs, { description: '', parameter: '' }] }));
  const removeInput = (index: number) => {
    setFormData(prev => ({ ...prev, inputs: prev.inputs.filter((_, i) => i !== index) }));
    setInputToDelete(null);
  };
  const updateInput = (index: number, field: keyof AgentInput, value: string) => {
    setFormData(prev => {
      const newInputs = [...prev.inputs];
      newInputs[index] = { ...newInputs[index], [field]: value };
      return { ...prev, inputs: newInputs };
    });
  };

  const toggleTool = (id: string) => {
    setFormData(prev => {
      const toolIds = prev.toolIds || [];
      const newToolIds = toolIds.includes(id) ? toolIds.filter(tid => tid !== id) : [...toolIds, id];
      return { ...prev, toolIds: newToolIds };
    });
  };

  const filteredModels = models.filter(m => {
    const engine = engines.find(e => e.name === formData.config.aiEngine);
    return engine && m.engine_id === engine.id && m.is_active;
  });

  const filteredTools = useMemo(() => tools.filter(tool => tool.name.toLowerCase().includes(toolSearch.toLowerCase())), [tools, toolSearch]);
  
  const isFormValid = () => !!(formData.name && formData.description && formData.role && formData.domain && formData.goal && formData.backstory && formData.taskDescription && formData.expectedOutput && isExtensionValid);

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      {/* Header */}
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"><X className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{formData.name || "New Agent"}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={versionDropdownRef}>
            <button onClick={() => setIsVersionDropdownOpen(p => !p)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800">
              <GitCommit className="w-3.5 h-3.5" /> Version {formData.version} <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {isVersionDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-2 z-30 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase">Versions</div>
                <div className="max-h-60 overflow-y-auto scrollbar-thin pr-1">
                  {allVersions.map(v => (
                    <div key={v.version} className="flex items-center justify-between group hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-md">
                      <button onClick={() => handleVersionLoad(v)} className="flex-1 text-left flex justify-between items-center p-2 rounded-md text-xs">
                        <span className="text-zinc-800 dark:text-zinc-300">Version {v.version} {v.version === formData.version && <span className="text-indigo-500 dark:text-indigo-400">(Current)</span>}</span>
                        <span className="text-zinc-500">{new Date(v.createdAt).toLocaleDateString()}</span>
                      </button>
                       {v.version !== formData.version && (
                         <button onClick={() => setVersionToDelete(v.version)} className="p-2 text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Trash2 className="w-3 h-3" />
                         </button>
                       )}
                    </div>
                  ))}
                </div>
                <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-2" />
                <button onClick={() => onSaveAndCompare(formData)} className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700/80 text-xs text-zinc-800 dark:text-zinc-300">
                  <GitCompare className="w-4 h-4" /> Save & Compare
                </button>
              </div>
            )}
          </div>
          <button onClick={() => onSave(formData)} disabled={!isFormValid() || !isDirty} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"><Save className="w-3.5 h-3.5" /> Save</button>
          <button onClick={() => onTest(formData)} disabled={!isFormValid()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition-all text-xs font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"><TestTube className="w-4 h-4" /> Save & Test</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[380px] border-r border-zinc-200 dark:border-zinc-800 p-6 space-y-8 overflow-y-auto scrollbar-thin">
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-4 h-4" />Identity</h3>
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Agent Name</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Agent Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Domain</label><select value={formData.domain} onChange={(e) => setFormData({ ...formData, domain: e.target.value })} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"><option value="">Select Domain...</option>{domains.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          </section>
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Settings2 className="w-4 h-4" />LLM Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <select value={formData.config.aiEngine} onChange={(e) => setFormData({ ...formData, config: { ...formData.config, aiEngine: e.target.value } })} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none">{engines.map(eng => <option key={eng.id} value={eng.name}>{eng.name}</option>)}</select>
              <select value={formData.config.model} onChange={(e) => setFormData({ ...formData, config: { ...formData.config, model: e.target.value } })} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none">{filteredModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </div>
            <div className="space-y-6 pt-2">
              <SliderInput label="Temperature" value={formData.config.temperature} min={0} max={1} step={0.05} onChange={(v) => setFormData({ ...formData, config: { ...formData.config, temperature: v } })} />
              <SliderInput label="Top-P" value={formData.config.topP} min={0} max={1} step={0.05} onChange={(v) => setFormData({ ...formData, config: { ...formData.config, topP: v } })} />
              <SliderInput label="Max Iterations" value={formData.config.maxIterations} min={0} max={100} step={1} onChange={(v) => setFormData({ ...formData, config: { ...formData.config, maxIterations: v } })} />
            </div>
          </section>
        </div>

        <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-6">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare className="w-4 h-4" />Persona & Logic</h3>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Role</label><textarea value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} rows={1} placeholder="e.g., Senior Software Architect" className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Goal</label><textarea value={formData.goal} onChange={(e) => setFormData({ ...formData, goal: e.target.value })} rows={5} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full" /></div>
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Backstory</label><textarea value={formData.backstory} onChange={(e) => setFormData({ ...formData, backstory: e.target.value })} rows={5} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full" /></div>
          </div>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Instructions</label><textarea value={formData.taskDescription} onChange={(e) => setFormData({ ...formData, taskDescription: e.target.value })} rows={16} placeholder="Detailed instructions..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-4 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 mono" /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Execution Inputs</label><button onClick={addInput} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"><Plus className="w-3 h-3 inline-block mr-1" />Add</button></div>
            {formData.inputs.map((input, idx) => (
              <div key={idx} className="flex gap-2 items-center"><textarea value={input.description} onChange={(e) => updateInput(idx, 'description', e.target.value)} rows={1} placeholder="Description" className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-y" /><input type="text" value={input.parameter} onChange={(e) => updateInput(idx, 'parameter', e.target.value.replace(/\s+/g, '_'))} placeholder="param_name" className="w-40 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs mono text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none" /><button onClick={() => setInputToDelete(idx)} className="p-1 text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400"><Trash2 className="w-3 h-3" /></button></div>
            ))}
          </div>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Expected Output</label><textarea value={formData.expectedOutput} onChange={(e) => setFormData({ ...formData, expectedOutput: e.target.value })} rows={8} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Output File Extension</label>
            <div className="flex gap-2">
              <select value={isOtherExtension ? 'other' : formData.outputFileExtension} onChange={e => handleExtensionChange(e.target.value)} className="w-48 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none">
                <option value="" disabled>Select...</option>
                {fileExtensions.map(fe => <option key={fe.id} value={fe.extension}>{fe.name} ({fe.extension})</option>)}
                <option value="other">Other...</option>
              </select>
              {isOtherExtension && <input type="text" value={customExtension} onChange={e => handleCustomExtensionChange(e.target.value)} placeholder=".custom" className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />}
            </div>
            {!isExtensionValid && formData.outputFileExtension && <p className="text-red-500 text-xs mt-2">Invalid extension format. Must start with a dot and contain no other dots (e.g., '.py').</p>}
          </div>
        </div>

        <div className={`border-l border-zinc-200 dark:border-zinc-800 p-6 space-y-4 overflow-y-auto scrollbar-thin transition-all duration-300 ${isToolsCollapsed ? 'w-16' : 'w-[420px]'}`}>
          <button onClick={() => setIsToolsCollapsed(p => !p)} className="w-full flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest"><Hammer className="w-4 h-4" /> {!isToolsCollapsed && "Tools & Capabilities"}</button>
          {!isToolsCollapsed && (<>
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /><input type="text" value={toolSearch} onChange={(e) => setToolSearch(e.target.value)} placeholder="Search tools..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" /></div>
            <div className="space-y-2">
              {filteredTools.map(tool => (
                <button key={tool.id} onClick={() => toggleTool(tool.id)} className={`w-full p-3 rounded-lg border text-left transition-all relative ${formData.toolIds?.includes(tool.id) ? 'bg-indigo-100/50 dark:bg-indigo-600/10 border-indigo-300 dark:border-indigo-600/40' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{tool.name}</h4>
                  <p className="text-[10px] text-zinc-500 line-clamp-1">{tool.description}</p>
                  {formData.toolIds?.includes(tool.id) && <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                </button>
              ))}
            </div>
          </>)}
        </div>
      </div>
      {inputToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Confirm Deletion</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6">Are you sure you want to delete the input parameter "{formData.inputs[inputToDelete]?.parameter || 'untitled'}"?</p>
            <div className="flex gap-3"><button onClick={() => setInputToDelete(null)} className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-lg font-bold text-xs border border-zinc-200 dark:border-zinc-800">Cancel</button><button onClick={() => removeInput(inputToDelete)} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs">Delete</button></div>
          </div>
        </div>
      )}
      {versionToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Confirm Version Deletion</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6">Are you sure you want to permanently delete Version {versionToDelete}? This action cannot be undone.</p>
            <div className="flex gap-3"><button onClick={() => setVersionToDelete(null)} className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-lg font-bold text-xs border border-zinc-200 dark:border-zinc-800">Cancel</button><button onClick={handleConfirmDeleteVersion} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs">Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
