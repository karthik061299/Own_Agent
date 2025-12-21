
import React, { useState, useCallback } from 'react';
import { Workflow, Agent, WorkflowType, GeminiModel, WorkflowNode, WorkflowEdge } from '../types';
import { Save, X, Plus, Settings, GitGraph, Database, Cpu, ChevronRight, LayoutGrid } from 'lucide-react';

interface WorkflowEditorProps {
  workflow: Workflow;
  agents: Agent[];
  onSave: (workflow: Workflow) => void;
  onCancel: () => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, agents, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Workflow>({ ...workflow });
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');

  const addNode = () => {
    if (!selectedAgentId) return;
    const newNode: WorkflowNode = {
      id: crypto.randomUUID(),
      agentId: selectedAgentId,
      position: { x: 50 + formData.nodes.length * 100, y: 50 + formData.nodes.length * 50 }
    };
    setFormData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  };

  const removeNode = (id: string) => {
    setFormData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.source !== id && e.target !== id)
    }));
  };

  const addEdge = (source: string, target: string) => {
    if (source === target) return;
    const newEdge: WorkflowEdge = {
      id: `edge-${source}-${target}`,
      source,
      target
    };
    setFormData(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge]
    }));
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-[#0c0c0e]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <LayoutGrid className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Workflow Canvas</h2>
            <p className="text-sm text-zinc-500">Design agentic orchestration flows.</p>
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
            Save Workflow
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Config Panel */}
        <div className="w-80 border-r border-zinc-800 bg-[#0c0c0e]/50 p-6 overflow-y-auto">
          <section className="mb-8">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Metadata</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.metadata.name}
                  onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, name: e.target.value } })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  value={formData.metadata.description}
                  onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, description: e.target.value } })}
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none transition-all resize-none"
                />
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Orchestration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Execution Type</label>
                <select
                  value={formData.metadata.type}
                  onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, type: e.target.value as WorkflowType } })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none"
                >
                  <option value={WorkflowType.SEQUENTIAL}>Sequential</option>
                  <option value={WorkflowType.PARALLEL}>Parallel</option>
                  <option value={WorkflowType.CIRCULAR}>Circular</option>
                  <option value={WorkflowType.NON_SEQUENTIAL}>Condition-based</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useManager"
                  checked={formData.metadata.useManager}
                  onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, useManager: e.target.checked } })}
                  className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-indigo-600"
                />
                <label htmlFor="useManager" className="text-xs font-medium text-zinc-300">Enable Manager Agent</label>
              </div>
              {formData.metadata.useManager && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Manager Model</label>
                  <select
                    value={formData.metadata.managerModel}
                    onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, managerModel: e.target.value as GeminiModel } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Add Agents</h3>
            <div className="space-y-3">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
              >
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                {agents.length === 0 && <option value="">No agents available</option>}
              </select>
              <button
                onClick={addNode}
                disabled={agents.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 py-2 rounded text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add to Canvas
              </button>
            </div>
          </section>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-[radial-gradient(#18181b_1px,transparent_1px)] bg-[size:24px_24px] relative overflow-hidden flex items-center justify-center">
          <div className="absolute top-4 left-4 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 px-3 py-1.5 rounded-full text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Visual Editor
          </div>
          
          <div className="relative w-full h-full p-20 overflow-auto flex flex-wrap gap-10 items-start content-start">
             {formData.nodes.map((node, index) => {
               const agent = agents.find(a => a.id === node.agentId);
               return (
                 <div key={node.id} className="w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-4 group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="px-2 py-0.5 rounded bg-indigo-900/30 text-indigo-400 text-[8px] font-bold uppercase tracking-wider">
                        {index + 1}. Agent Node
                      </div>
                      <button 
                        onClick={() => removeNode(node.id)}
                        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-bold text-zinc-100 mb-1">{agent?.name || 'Unknown Agent'}</h4>
                    <p className="text-[10px] text-zinc-500 mb-3">{agent?.description || 'No description'}</p>
                    
                    <div className="space-y-2">
                       <div className="h-px bg-zinc-800" />
                       <div className="text-[9px] font-medium text-zinc-400 mb-1">Connect to:</div>
                       <div className="flex flex-wrap gap-1">
                          {formData.nodes.filter(n => n.id !== node.id).map(n => (
                            <button
                              key={n.id}
                              onClick={() => addEdge(node.id, n.id)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[9px] text-zinc-300 border border-zinc-700 transition-all"
                            >
                              Node {formData.nodes.findIndex(nn => nn.id === n.id) + 1}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-800">
                      <div className="text-[9px] text-zinc-500">
                        Outbound Connections: {formData.edges.filter(e => e.source === node.id).length}
                      </div>
                    </div>
                 </div>
               );
             })}

             {formData.nodes.length === 0 && (
               <div className="text-zinc-600 text-center">
                 <Cpu className="w-12 h-12 mx-auto mb-4 opacity-20" />
                 <p className="text-sm">Select an agent and add it to start building your flow.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
