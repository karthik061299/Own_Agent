
import React, { useState, useEffect } from 'react';
import { Agent, AgentInput, DBModel } from '../types';
import { dbService } from '../services/db';
import { Save, X, Settings2, Sparkles, MessageSquare, Fingerprint, Hammer, Plus, Trash2, Cpu, ChevronDown } from 'lucide-react';

interface AgentEditorProps {
  agent: Agent;
  onSave: (agent: Agent) => void;
  onCancel: () => void;
}

const SliderInput: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  labels: { min: string; mid: string; max: string };
}> = ({ label, value, min, max, step, onChange, labels }) => {
  return (
    <div className="space-y-4 max-w-md">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-zinc-400">{label}</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-indigo-400 font-mono focus:outline-none"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
      <div className="flex justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-tight">
        <span>{labels.min}</span>
        <span>{labels.mid}</span>
        <span>{labels.max}</span>
      </div>
    </div>
  );
};

export const AgentEditor: React.FC<AgentEditorProps> = ({ agent, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Agent>({ ...agent });
  const [activeTab, setActiveTab] = useState<'metadata' | 'prompt' | 'config' | 'tools'>('metadata');
  const [domains, setDomains] = useState<string[]>([]);
  const [engines, setEngines] = useState<{id: number, name: string}[]>([]);
  const [models, setModels] = useState<DBModel[]>([]);

  useEffect(() => {
    const loadLookups = async () => {
      const [d, e, m] = await Promise.all([
        dbService.getDomains(),
        dbService.getEngines(),
        dbService.getModels()
      ]);
      setDomains(d);
      setEngines(e);
      setModels(m);
      
      // Default engine/model if empty
      if (!formData.config.aiEngine && e.length > 0) {
        const defaultEngine = e[0];
        const defaultModel = m.find(x => x.engine_id === defaultEngine.id);
        setFormData(prev => ({
          ...prev,
          config: { 
            ...prev.config, 
            aiEngine: defaultEngine.name, 
            model: defaultModel?.id || '' 
          }
        }));
      }
    };
    loadLookups();
  }, []);

  const addInput = () => {
    setFormData(prev => ({
      ...prev,
      inputs: [...prev.inputs, { description: '', parameter: '' }]
    }));
  };

  const removeInput = (index: number) => {
    setFormData(prev => ({
      ...prev,
      inputs: prev.inputs.filter((_, i) => i !== index)
    }));
  };

  const updateInput = (index: number, field: keyof AgentInput, value: string) => {
    setFormData(prev => {
      const newInputs = [...prev.inputs];
      newInputs[index] = { ...newInputs[index], [field]: value };
      return { ...prev, inputs: newInputs };
    });
  };

  const isFormValid = () => {
    const { name, description, role, domain, goal, backstory, taskDescription, expectedOutput } = formData;
    return !!(name && description && role && domain && goal && backstory && taskDescription && expectedOutput);
  };

  const handleSave = () => {
    if (!isFormValid()) {
      alert("Please fill in all mandatory fields before saving.");
      return;
    }
    onSave(formData);
  };

  const filteredModels = models.filter(m => {
    const engine = engines.find(e => e.name === formData.config.aiEngine);
    return engine && m.engine_id === engine.id;
  });

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-[#0c0c0e] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Configure Agent</h2>
            <p className="text-sm text-zinc-500">Define intelligence, persona, and constraints.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-indigo-600/20"
          >
            <Save className="w-4 h-4" />
            Save Agent
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-zinc-800 p-4 space-y-2 bg-[#0c0c0e]/50">
          {[
            { id: 'metadata', label: 'Identity', icon: Fingerprint },
            { id: 'prompt', label: 'Persona & Logic', icon: MessageSquare },
            { id: 'config', label: 'LLM Configuration', icon: Settings2 },
            { id: 'tools', label: 'Tools', icon: Hammer },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                activeTab === tab.id
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
          {activeTab === 'metadata' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Agent Name <span className="text-indigo-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Provide a Unique Agent Name"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Description <span className="text-indigo-500">*</span></label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="What is this agent's broad purpose?"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Domain <span className="text-indigo-500">*</span></label>
                  <div className="relative">
                    <select
                      required
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all appearance-none"
                    >
                      <option value="">Select Domain...</option>
                      {domains.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Role <span className="text-indigo-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g. Senior Software Architect"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Goal <span className="text-indigo-500">*</span></label>
                  <textarea
                    required
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                    rows={4}
                    placeholder="What specifically should the agent achieve?"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-y min-h-[100px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Backstory <span className="text-indigo-500">*</span></label>
                  <textarea
                    required
                    value={formData.backstory}
                    onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                    rows={4}
                    placeholder="What persona or background does this agent have?"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-y min-h-[100px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Task Description <span className="text-indigo-500">*</span></label>
                <textarea
                  required
                  value={formData.taskDescription}
                  onChange={(e) => setFormData({ ...formData, taskDescription: e.target.value })}
                  rows={6}
                  placeholder="Describe the agent instructions"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-y min-h-[150px] mono text-sm"
                />
              </div>

              {/* Execution Inputs */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Execution Inputs</label>
                  <button 
                    onClick={addInput}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase"
                  >
                    <Plus className="w-3 h-3" /> Add Input
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.inputs.map((input, idx) => (
                    <div key={idx} className="flex gap-3 items-end group">
                      <div className="flex-1">
                        <label className="block text-[10px] text-zinc-500 font-bold mb-1 uppercase tracking-tighter">Input Description</label>
                        <input
                          type="text"
                          value={input.description}
                          onChange={(e) => updateInput(idx, 'description', e.target.value)}
                          placeholder="What does this input represent?"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="w-48">
                        <label className="block text-[10px] text-zinc-500 font-bold mb-1 uppercase tracking-tighter">Input Parameter</label>
                        <input
                          type="text"
                          value={input.parameter}
                          onChange={(e) => updateInput(idx, 'parameter', e.target.value.replace(/\s+/g, '_'))}
                          placeholder="Parameter_Name"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs mono text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <button onClick={() => removeInput(idx)} className="p-2 mb-0.5 text-zinc-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Expected Output <span className="text-indigo-500">*</span></label>
                <textarea
                  required
                  value={formData.expectedOutput}
                  onChange={(e) => setFormData({ ...formData, expectedOutput: e.target.value })}
                  rows={4}
                  placeholder="Describe the expected output format"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none transition-all resize-y min-h-[100px]"
                />
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-10 animate-in fade-in duration-300 max-w-2xl">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">LLM Model Selection</h3>
                <div className="grid grid-cols-2 gap-6 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">AI Engine <span className="text-indigo-500">*</span></label>
                    <div className="relative">
                      <select
                        value={formData.config.aiEngine}
                        onChange={(e) => setFormData({ ...formData, config: { ...formData.config, aiEngine: e.target.value } })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none appearance-none"
                      >
                        {engines.map(eng => <option key={eng.id} value={eng.name}>{eng.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Model <span className="text-indigo-500">*</span></label>
                    <div className="relative">
                      <select
                        value={formData.config.model}
                        onChange={(e) => setFormData({ ...formData, config: { ...formData.config, model: e.target.value } })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none appearance-none"
                      >
                        {filteredModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-10">
                <SliderInput
                  label="Temperature"
                  value={formData.config.temperature}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setFormData({ ...formData, config: { ...formData.config, temperature: v } })}
                  labels={{ min: 'Precise', mid: 'Balanced', max: 'Creative' }}
                />
                <SliderInput
                  label="Top-P"
                  value={formData.config.topP}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setFormData({ ...formData, config: { ...formData.config, topP: v } })}
                  labels={{ min: 'Narrow', mid: 'Balanced', max: 'Broad' }}
                />
                <SliderInput
                  label="Max Iterations"
                  value={formData.config.maxIterations}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setFormData({ ...formData, config: { ...formData.config, maxIterations: v } })}
                  labels={{ min: 'Single Run', mid: 'Standard Retries', max: 'High Retries' }}
                />
                <SliderInput
                  label="Max RPM"
                  value={formData.config.maxRPM}
                  min={0}
                  max={20}
                  step={1}
                  onChange={(v) => setFormData({ ...formData, config: { ...formData.config, maxRPM: v } })}
                  labels={{ min: 'Low Traffic', mid: 'Team Testing', max: 'Production Scale' }}
                />
                <SliderInput
                  label="Max Execution Time"
                  value={formData.config.maxExecutionTime}
                  min={0}
                  max={3600}
                  step={10}
                  onChange={(v) => setFormData({ ...formData, config: { ...formData.config, maxExecutionTime: v } })}
                  labels={{ min: 'Quick Timeout', mid: 'Balanced', max: 'Extended' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50 grayscale">
              <Hammer className="w-16 h-16 text-zinc-700 mb-4" />
              <h3 className="text-xl font-bold text-zinc-300">Tools are coming soon</h3>
              <p className="text-zinc-500 max-w-sm mt-2">
                External tools like web search, code execution, and database connectors are in active development.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
