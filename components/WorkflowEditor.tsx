
import React, { useState, useEffect, useRef } from 'react';
import { Workflow, Agent, WorkflowType, GeminiModel, WorkflowNode, WorkflowEdge } from '../types';
import { Save, Plus, X, LayoutGrid, Info, Zap, AlertTriangle, ArrowRight, Type, AlignLeft } from 'lucide-react';

interface WorkflowEditorProps {
  workflow: Workflow;
  agents: Agent[];
  onSave: (workflow: Workflow) => void;
  onCancel: () => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, agents, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Workflow>({ ...workflow });
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connStartNodeId, setConnStartNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const addNode = () => {
    if (!selectedAgentId) return;
    const newNode: WorkflowNode = {
      id: crypto.randomUUID(),
      agentId: selectedAgentId,
      position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 }
    };
    setFormData(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
  };

  const removeNode = (id: string) => {
    setFormData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.source !== id && e.target !== id)
    }));
  };

  const tryConnect = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    
    // Check Workflow Rules
    const { type } = formData.metadata;
    const existingOutEdges = formData.edges.filter(e => e.source === sourceId);

    if (type === WorkflowType.SEQUENTIAL) {
      if (existingOutEdges.length > 0) {
        alert("Sequential workflows only allow one connection per agent.");
        return;
      }
      // Check for cycles
      if (targetId === sourceId) return;
    }

    const newEdge: WorkflowEdge = {
      id: `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId
    };

    setFormData(prev => ({
      ...prev,
      edges: prev.edges.some(e => e.source === sourceId && e.target === targetId) 
        ? prev.edges 
        : [...prev.edges, newEdge]
    }));
    setConnStartNodeId(null);
  };

  const updateNodePosition = (id: string, x: number, y: number) => {
    setFormData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === id ? { ...n, position: { x, y } } : n)
    }));
  };

  // Helper for arrow lines
  const getLineData = (sourceId: string, targetId: string) => {
    const s = formData.nodes.find(n => n.id === sourceId);
    const t = formData.nodes.find(n => n.id === targetId);
    if (!s || !t) return null;
    
    const sx = s.position.x + 128; // width/2
    const sy = s.position.y + 40;  // approximate center
    const tx = t.position.x + 128;
    const ty = t.position.y + 40;
    
    return { sx, sy, tx, ty };
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-[#0c0c0e]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">{formData.metadata.name || 'New Workflow'}</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="text-indigo-400 font-bold uppercase tracking-tighter">{formData.metadata.type}</span>
              <span>•</span>
              <span>{formData.nodes.length} Agents</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors text-sm">Cancel</button>
          <button onClick={() => onSave(formData)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-indigo-600/20">
            <Save className="w-4 h-4" /> Save Workflow
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Panel */}
        <div className="w-80 border-r border-zinc-800 bg-[#0c0c0e]/50 p-6 overflow-y-auto">
          <section className="mb-8 space-y-4">
             <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Global Configuration</h3>
             
             <div className="space-y-3">
               <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Workflow Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter workflow name..."
                    value={formData.metadata.name}
                    onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, name: e.target.value }})}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Workflow Description</label>
                  <textarea 
                    placeholder="Enter workflow description..."
                    rows={3}
                    value={formData.metadata.description}
                    onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, description: e.target.value }})}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
               </div>
             </div>

             <div className="pt-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Workflow Type</label>
                <select 
                  value={formData.metadata.type} 
                  onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, type: e.target.value as any }})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none"
                >
                  <option value={WorkflowType.SEQUENTIAL}>Sequential (Linear)</option>
                  <option value={WorkflowType.CIRCULAR}>Circular (Manager Required)</option>
                  <option value={WorkflowType.PARALLEL}>Parallel</option>
                  <option value={WorkflowType.NON_SEQUENTIAL}>Non-Sequential</option>
                </select>
             </div>

             <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="mgr" className="text-xs font-medium text-zinc-300">Manager LLM</label>
                  <input 
                    id="mgr" type="checkbox" checked={formData.metadata.useManager} 
                    onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, useManager: e.target.checked }})}
                    className="accent-indigo-500"
                  />
                </div>
                {formData.metadata.useManager && (
                  <select 
                    value={formData.metadata.managerModel} 
                    onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, managerModel: e.target.value as any }})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px]"
                  >
                    <option value={GeminiModel.PRO}>Gemini 3 Pro (Recommended)</option>
                    <option value={GeminiModel.FLASH}>Gemini 3 Flash</option>
                  </select>
                )}
             </div>
             {formData.metadata.type === WorkflowType.CIRCULAR && !formData.metadata.useManager && (
               <div className="flex items-start gap-2 p-3 bg-amber-900/10 border border-amber-900/30 rounded-lg text-[10px] text-amber-500">
                 <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                 <span>Circular workflows require the Manager LLM to control loop termination.</span>
               </div>
             )}
          </section>

          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Toolbar</h3>
            <div className="space-y-3">
              <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm">
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button onClick={addNode} className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 py-2 rounded text-sm transition-all border border-zinc-700">
                <Plus className="w-4 h-4" /> Add Agent to Canvas
              </button>
            </div>
          </section>
        </div>

        {/* Canvas */}
        <div 
          ref={canvasRef}
          className="flex-1 bg-[radial-gradient(#18181b_1px,transparent_1px)] bg-[size:32px_32px] relative overflow-auto"
          onMouseMove={(e) => {
            if (draggingNodeId) {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) updateNodePosition(draggingNodeId, e.clientX - rect.left - 128, e.clientY - rect.top - 40);
            }
          }}
          onMouseUp={() => {
            setDraggingNodeId(null);
          }}
        >
          {/* SVG Connection Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '2000px', minHeight: '2000px' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4f46e5" />
              </marker>
            </defs>
            {formData.edges.map(edge => {
              const data = getLineData(edge.source, edge.target);
              if (!data) return null;
              return (
                <path
                  key={edge.id}
                  d={`M ${data.sx} ${data.sy} C ${data.sx + 100} ${data.sy}, ${data.tx - 100} ${data.ty}, ${data.tx} ${data.ty}`}
                  stroke="#4f46e5"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="opacity-60"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {formData.nodes.map((node) => {
            const agent = agents.find(a => a.id === node.agentId);
            const isConnStart = connStartNodeId === node.id;
            
            return (
              <div 
                key={node.id} 
                className={`absolute w-64 bg-[#121214] border-2 rounded-xl shadow-2xl p-4 transition-shadow group ${
                  isConnStart ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-zinc-800 hover:border-zinc-600'
                }`}
                style={{ left: node.position.x, top: node.position.y }}
              >
                <div 
                  className="flex justify-between items-start mb-2 cursor-move select-none"
                  onMouseDown={() => setDraggingNodeId(node.id)}
                >
                  <div className="px-2 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                    Agent Node
                  </div>
                  <button onClick={() => removeNode(node.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <h4 className="font-bold text-zinc-100 text-sm truncate">{agent?.name}</h4>
                <p className="text-[10px] text-zinc-500 line-clamp-1 mb-4">{agent?.description}</p>
                
                <div className="flex gap-2">
                   <button 
                     onClick={() => {
                        if (connStartNodeId && connStartNodeId !== node.id) {
                          tryConnect(connStartNodeId, node.id);
                        } else {
                          setConnStartNodeId(node.id);
                        }
                     }}
                     className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                       isConnStart ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                     }`}
                   >
                     {isConnStart ? 'Select Target' : 'Connect'}
                     {!isConnStart && <ArrowRight className="w-3 h-3" />}
                   </button>
                   {isConnStart && (
                     <button onClick={() => setConnStartNodeId(null)} className="px-2 py-1.5 bg-zinc-700 text-zinc-300 rounded text-[10px]">Esc</button>
                   )}
                </div>

                {/* Rules Info */}
                <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between items-center text-[9px] text-zinc-500">
                   <span>Inbound: {formData.edges.filter(e => e.target === node.id).length}</span>
                   <span>Outbound: {formData.edges.filter(e => e.source === node.id).length}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
