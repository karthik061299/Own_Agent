
import React, { useState } from 'react';
import { Agent, GeminiModel } from '../types';
import { Save, X, Settings2, Sparkles, MessageSquare, Info, Hammer } from 'lucide-react';

interface AgentEditorProps {
  agent: Agent;
  onSave: (agent: Agent) => void;
  onCancel: () => void;
}

export const AgentEditor: React.FC<AgentEditorProps> = ({ agent, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Agent>({ ...agent });
  const [activeTab, setActiveTab] = useState<'metadata' | 'prompt' | 'config' | 'tools'>('metadata');

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
            onClick={() => onSave(formData)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-indigo-600/20"
          >
            <Save className="w-4 h-4" />
            Save Agent
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Internal Tabs */}
        <div className="w-64 border-r border-zinc-800 p-4 space-y-2 bg-[#0c0c0e]/50">
          {[
            { id: 'metadata', label: 'Identity', icon: Info },
            { id: 'prompt', label: 'Persona & Logic', icon: MessageSquare },
            { id: 'config', label: 'Parameters', icon: Settings2 },
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

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
          {activeTab === 'metadata' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Agent Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Code Reviewer"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="What is this agent's broad purpose?"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Goal</label>
                  <textarea
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                    rows={4}
                    placeholder="What specifically should the agent achieve?"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Backstory</label>
                  <textarea
                    value={formData.backstory}
                    onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                    rows={4}
                    placeholder="What persona or background does this agent have?"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Task Description</label>
                <textarea
                  value={formData.taskDescription}
                  onChange={(e) => setFormData({ ...formData, taskDescription: e.target.value })}
                  rows={4}
                  placeholder="How should it process inputs?"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Input Placeholder</label>
                  <input
                    type="text"
                    value={formData.inputPlaceholder}
                    onChange={(e) => setFormData({ ...formData, inputPlaceholder: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none transition-all mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Expected Output Format</label>
                  <input
                    type="text"
                    value={formData.expectedOutput}
                    onChange={(e) => setFormData({ ...formData, expectedOutput: e.target.value })}
                    placeholder="e.g. JSON, Bullet points"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-4">Model Selection</label>
                  <select
                    value={formData.config.model}
                    onChange={(e) => setFormData({ ...formData, config: { ...formData.config, model: e.target.value as GeminiModel } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none transition-all"
                  >
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast & Lean)</option>
                    <option value="gemini-3-pro-preview">Gemini 3 Pro (Complex Reasoning)</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between mb-4">
                    <label className="block text-sm font-medium text-zinc-400">Temperature</label>
                    <span className="text-indigo-400 font-mono text-sm">{formData.config.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={formData.config.temperature}
                    onChange={(e) => setFormData({ ...formData, config: { ...formData.config, temperature: parseFloat(e.target.value) } })}
                    className="w-full accent-indigo-600 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Max Tokens</label>
                  <input
                    type="number"
                    value={formData.config.maxTokens}
                    onChange={(e) => setFormData({ ...formData, config: { ...formData.config, maxTokens: parseInt(e.target.value) } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Max RPM</label>
                  <input
                    type="number"
                    value={formData.config.maxRPM}
                    onChange={(e) => setFormData({ ...formData, config: { ...formData.config, maxRPM: parseInt(e.target.value) } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Max Iterations</label>
                  <input
                    type="number"
                    value={formData.config.maxIterations}
                    onChange={(e) => setFormData({ ...formData, config: { ...formData.config, maxIterations: parseInt(e.target.value) } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
                  />
                </div>
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
