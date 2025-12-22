
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Workflow, Agent, WorkflowType, WorkflowNode, WorkflowEdge, DBModel } from '../types';
import { dbService } from '../services/db';
import { 
  Save, X, Zap, ArrowRight, Search, Cpu, GripVertical, User, 
  AlertCircle, CheckCircle2, RotateCcw 
} from 'lucide-react';

interface WorkflowEditorProps {
  workflow: Workflow;
  agents: Agent[];
  onSave: (workflow: Workflow) => void;
  onCancel: () => void;
}

const ManagerSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500">
      <span>{label}</span>
      <span className="text-indigo-400 mono">{(value ?? 0).toFixed(2)}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step} value={value ?? 0} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
    />
  </div>
);

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, agents, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Workflow>(() => ({
    ...workflow,
    metadata: {
      ...workflow.metadata,
      managerTemperature: workflow.metadata.managerTemperature ?? 0.7,
      managerTopP: workflow.metadata.managerTopP ?? 0.9,
      managerModel: workflow.metadata.managerModel || 'gemini-3-pro-preview'
    }
  }));
  const [models, setModels] = useState<DBModel[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentDomainFilter, setAgentDomainFilter] = useState('');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connStartNodeId, setConnStartNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dbService.getModels().then(setModels);
  }, []);

  const addNodeAt = (agentId: string, x: number, y: number) => {
    const newNode: WorkflowNode = {
      id: crypto.randomUUID(),
      agentId: agentId,
      position: { x, y }
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

  const resetGraph = () => {
    const confirmed = confirm("Completely reset the workflow graph? This will clear all agents and connections.");
    if (confirmed) {
      setFormData(prev => ({ 
        ...prev, 
        nodes: [], 
        edges: [] 
      }));
      setConnStartNodeId(null);
      setDraggingNodeId(null);
    }
  };

  const tryConnect = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const { type } = formData.metadata;
    const existingOutEdges = formData.edges.filter(e => e.source === sourceId);

    if (type === WorkflowType.SEQUENTIAL) {
      if (existingOutEdges.length > 0) {
        return; 
      }
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

  const validation = useMemo(() => {
    const { nodes, edges, metadata } = formData;
    if (nodes.length === 0) return { valid: false, message: "Add at least one agent to the workflow." };

    const adjacencyList = new Map<string, string[]>();
    nodes.forEach(n => adjacencyList.set(n.id, []));
    edges.forEach(e => adjacencyList.get(e.source)?.push(e.target));

    const hasCycle = () => {
      const visited = new Set<string>();
      const recStack = new Set<string>();
      const isCyclicUtil = (v: string): boolean => {
        if (!visited.has(v)) {
          visited.add(v);
          recStack.add(v);
          for (const neighbor of adjacencyList.get(v) || []) {
            if (!visited.has(neighbor) && isCyclicUtil(neighbor)) return true;
            else if (recStack.has(neighbor)) return true;
          }
        }
        recStack.delete(v);
        return false;
      };
      for (const node of nodes) {
        if (isCyclicUtil(node.id)) return true;
      }
      return false;
    };

    const cycleExists = hasCycle();

    if (metadata.type === WorkflowType.CIRCULAR) {
      if (!cycleExists) return { valid: false, message: "Circular flow requires at least one feedback loop." };
      if (!metadata.useManager) return { valid: false, message: "Manager LLM required for Circular flows." };
    }

    if (metadata.type === WorkflowType.SEQUENTIAL) {
      if (cycleExists) return { valid: false, message: "Cycles detected. Change type to Circular." };
    }

    return { valid: true, message: "" };
  }, [formData]);

  const getLineData = (sourceId: string, targetId: string) => {
    const s = formData.nodes.find(n => n.id === sourceId);
    const t = formData.nodes.find(n => n.id === targetId);
    if (!s || !t) return null;
    
    // Exact Node Geometry
    const NODE_WIDTH = 256;
    const ANCHOR_Y_OFFSET = 110; 

    const isBackwards = t.position.x < s.position.x;

    // Source Anchor (Right/Left Center Edge)
    const sx = isBackwards ? s.position.x : s.position.x + NODE_WIDTH;
    const sy = s.position.y + ANCHOR_Y_OFFSET;

    // Target Anchor (Left/Right Center Edge)
    const tx = isBackwards ? t.position.x + NODE_WIDTH : t.position.x;
    const ty = t.position.y + ANCHOR_Y_OFFSET;

    return {
      sx,
      sy,
      tx,
      ty,
      isBackwards
    };
  };

  const filteredAgents = agents.filter(a => {
    const matchesName = a.name.toLowerCase().includes(agentSearch.toLowerCase());
    const matchesDomain = !agentDomainFilter || a.domain === agentDomainFilter;
    return matchesName && matchesDomain;
  });

  const domains = Array.from(new Set(agents.map(a => a.domain))).sort();

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
              <span className={`font-bold uppercase tracking-tighter ${validation.valid ? 'text-indigo-400' : 'text-amber-500'}`}>
                {formData.metadata.type} {validation.valid ? '• VALID' : '• INVALID'}
              </span>
              <span>•</span>
              <span>{formData.nodes.length} Agents</span>
            </div>
          </div>
        </div>

        {!validation.valid && (
          <div className="flex-1 px-8 animate-in fade-in slide-in-from-top-1">
            <div className="bg-amber-900/10 border border-amber-900/30 rounded-lg px-4 py-2 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-200/80 font-medium leading-tight line-clamp-1">
                {validation.message}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button 
            onClick={resetGraph} 
            className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-red-400 transition-colors text-sm font-medium"
            title="Clear all agents and connections"
          >
            <RotateCcw className="w-4 h-4" /> Reset Graph
          </button>
          <div className="w-px h-8 bg-zinc-800 my-auto mx-1" />
          <button onClick={onCancel} className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors text-sm font-medium">Cancel</button>
          <button 
            onClick={() => onSave(formData)} 
            disabled={!validation.valid}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all font-semibold shadow-lg ${
              validation.valid 
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 cursor-pointer' 
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed grayscale'
            }`}
          >
            <Save className="w-4 h-4" /> Save Workflow
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-zinc-800 bg-[#0c0c0e]/50 flex flex-col">
          <div className="p-6 space-y-8 overflow-y-auto scrollbar-thin">
            <section className="space-y-4">
               <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Configuration</h3>
               <div className="space-y-3">
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Workflow Name</label>
                    <input 
                      type="text" placeholder="Enter name..." value={formData.metadata.name}
                      onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, name: e.target.value }})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Description</label>
                    <textarea 
                      placeholder="Workflow goal..." rows={2} value={formData.metadata.description}
                      onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, description: e.target.value }})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Workflow Type</label>
                    <select 
                      value={formData.metadata.type} 
                      onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, type: e.target.value as any }})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm outline-none"
                    >
                      <option value={WorkflowType.SEQUENTIAL}>Sequential</option>
                      <option value={WorkflowType.CIRCULAR}>Circular</option>
                      <option value={WorkflowType.PARALLEL}>Parallel</option>
                      <option value={WorkflowType.NON_SEQUENTIAL}>Non-Sequential</option>
                    </select>
                 </div>
               </div>

               {formData.metadata.type === WorkflowType.CIRCULAR && !formData.metadata.useManager && (
                 <div className="flex gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-900/30 text-amber-400 text-[10px] leading-relaxed animate-in fade-in zoom-in duration-300">
                   <AlertCircle className="w-4 h-4 shrink-0" />
                   <p><strong>Manager required</strong> to avoid infinite loops.</p>
                 </div>
               )}

               <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="mgr" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Manager LLM</label>
                    <input 
                      id="mgr" type="checkbox" checked={formData.metadata.useManager} 
                      onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, useManager: e.target.checked }})}
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  {formData.metadata.useManager && (
                    <div className="space-y-4 pt-2 border-t border-zinc-800">
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Manager Model</label>
                        <select 
                          value={formData.metadata.managerModel} 
                          onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, managerModel: e.target.value }})}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[10px] text-zinc-200"
                        >
                          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <ManagerSlider 
                        label="Temperature" min={0} max={1} step={0.05} value={formData.metadata.managerTemperature}
                        onChange={(v) => setFormData({ ...formData, metadata: { ...formData.metadata, managerTemperature: v }})}
                      />
                      <ManagerSlider 
                        label="Top-P" min={0} max={1} step={0.05} value={formData.metadata.managerTopP}
                        onChange={(v) => setFormData({ ...formData, metadata: { ...formData.metadata, managerTopP: v }})}
                      />
                    </div>
                  )}
               </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Agents</h3>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="text" placeholder="Search..." value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <select 
                  value={agentDomainFilter} onChange={(e) => setAgentDomainFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-[11px] outline-none"
                >
                  <option value="">All Domains</option>
                  {domains.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <div className="space-y-2 mt-4">
                  {filteredAgents.map(agent => (
                    <div 
                      key={agent.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('agentId', agent.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-indigo-500/50 cursor-grab active:cursor-grabbing group transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors">{agent.name}</span>
                        <GripVertical className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500" />
                      </div>
                      <div className="text-[9px] text-zinc-500 line-clamp-1">{agent.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div 
          ref={canvasRef}
          className="flex-1 bg-[radial-gradient(#18181b_1px,transparent_1px)] bg-[size:32px_32px] relative overflow-auto scrollbar-thin"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const agentId = e.dataTransfer.getData('agentId');
            if (agentId && canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const scrollLeft = canvasRef.current.scrollLeft;
              const scrollTop = canvasRef.current.scrollTop;
              const x = e.clientX - rect.left + scrollLeft - 128;
              const y = e.clientY - rect.top + scrollTop - 60;
              addNodeAt(agentId, x, y);
            }
          }}
          onMouseMove={(e) => {
            if (draggingNodeId && canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const scrollLeft = canvasRef.current.scrollLeft;
              const scrollTop = canvasRef.current.scrollTop;
              updateNodePosition(draggingNodeId, e.clientX - rect.left + scrollLeft - 128, e.clientY - rect.top + scrollTop - 60);
            }
          }}
          onMouseUp={() => setDraggingNodeId(null)}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '5000px', minHeight: '5000px' }}>
            <defs>
              <marker id="arrowhead" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
                <path d="M0,0 L14,5 L0,10 Z" fill="#4f46e5" />
              </marker>
            </defs>
            {formData.edges.map(edge => {
              const data = getLineData(edge.source, edge.target);
              if (!data) return null;
              
              const dx = data.tx - data.sx;
              const controlDist = Math.max(Math.abs(dx) / 1.5, 120); 
              
              const cp1x = data.isBackwards ? data.sx - controlDist : data.sx + controlDist;
              const cp2x = data.isBackwards ? data.tx + controlDist : data.tx - controlDist;

              return (
                <path
                  key={edge.id}
                  d={`M ${data.sx} ${data.sy} C ${cp1x} ${data.sy}, ${cp2x} ${data.ty}, ${data.tx} ${data.ty}`}
                  stroke="#4f46e5" strokeWidth="2.5" fill="none" markerEnd="url(#arrowhead)" 
                  className="opacity-70 transition-all duration-300"
                />
              );
            })}
          </svg>

          {formData.nodes.map((node, idx) => {
            const agent = agents.find(a => a.id === node.agentId);
            const isConnStart = connStartNodeId === node.id;
            
            return (
              <div 
                key={node.id} 
                className={`absolute w-64 bg-[#121214] border-2 rounded-xl shadow-2xl transition-all group ${
                  isConnStart ? 'border-indigo-500 ring-4 ring-indigo-500/20 z-20' : 'border-zinc-800 hover:border-zinc-600 z-10'
                }`}
                style={{ left: node.position.x, top: node.position.y }}
              >
                {/* SEQUENCE INDICATOR BADGE */}
                <div className="absolute -top-3 -left-3 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-[#09090b] shadow-lg z-30">
                  {idx + 1}
                </div>

                <div 
                  className="p-4 cursor-move select-none"
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    setDraggingNodeId(node.id);
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center">
                      <User className="w-4 h-4 text-indigo-400" />
                    </div>
                    <button onClick={() => removeNode(node.id)} className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h4 className="font-bold text-zinc-100 text-sm mb-1 truncate">{agent?.name}</h4>
                  <p className="text-[10px] text-zinc-500 line-clamp-2 mb-3 leading-relaxed">{agent?.description}</p>
                  
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 mb-4">
                    <Cpu className="w-3 h-3 text-indigo-500" />
                    <span className="text-[9px] font-medium text-zinc-400 truncate">{agent?.config.model}</span>
                  </div>

                  <div className="flex gap-2">
                     <button 
                       onClick={() => {
                          if (connStartNodeId && connStartNodeId !== node.id) {
                            tryConnect(connStartNodeId, node.id);
                          } else {
                            setConnStartNodeId(node.id);
                          }
                       }}
                       className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg ${
                         isConnStart ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                       }`}
                     >
                       {isConnStart ? 'Select Target' : 'Connect'}
                       {!isConnStart && <ArrowRight className="w-3 h-3" />}
                     </button>
                     {isConnStart && (
                       <button onClick={() => setConnStartNodeId(null)} className="px-3 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold">CANCEL</button>
                     )}
                  </div>
                </div>

                <div className="px-4 py-2 bg-zinc-900/50 border-t border-zinc-800 flex justify-between items-center text-[9px] text-zinc-600 font-bold uppercase">
                   <span>In: {formData.edges.filter(e => e.target === node.id).length}</span>
                   <span>Out: {formData.edges.filter(e => e.source === node.id).length}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
