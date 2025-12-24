
import React, { useState } from 'react';
import { Agent, Tool } from '../types';
import { Plus, Edit2, Trash2, User, Search, Filter, Cpu, Hammer, GitCommit } from 'lucide-react';

interface AgentListProps {
  agents: Agent[];
  tools: Tool[];
  onEdit: (agent: Agent) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export const AgentList: React.FC<AgentListProps> = ({ agents, tools, onEdit, onDelete, onCreate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');

  const domains = Array.from(new Set(agents.map(a => a.domain))).sort();

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = !domainFilter || agent.domain === domainFilter;
    return matchesSearch && matchesDomain;
  });

  const getAgentToolNames = (agent: Agent) => {
    if (!agent.toolIds || agent.toolIds.length === 0) return [];
    return tools
      .filter(t => agent.toolIds?.includes(t.id))
      .map(t => t.name);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-zinc-100 mb-2">AI Agents</h2>
          <p className="text-zinc-400">Define specialized agents with specific goals and behaviors.</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-all font-medium shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" />
          Create Agent
        </button>
      </div>

      <div className="flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter by Agent Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121214] border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="w-64 relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="w-full bg-[#121214] border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
          >
            <option value="">All Domains</option>
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => {
          const agentToolNames = getAgentToolNames(agent);
          
          return (
            <div
              key={agent.id}
              className="bg-[#121214] border border-zinc-800 p-6 rounded-xl hover:border-zinc-700 transition-all group relative flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(agent)}
                    className="p-2 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-zinc-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(agent.id)}
                    className="p-2 hover:bg-red-900/30 rounded-md text-zinc-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-lg font-bold text-zinc-100 mb-1">{agent.name || 'Untitled Agent'}</h3>
                  <div className="flex items-center gap-1 text-xs font-bold text-zinc-500">
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>V{agent.version}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <div className="px-2 py-0.5 rounded bg-indigo-900/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-900/30 inline-block">
                    {agent.domain}
                  </div>
                </div>
                <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                  {agent.description || 'No description provided.'}
                </p>

                {agentToolNames.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                      <Hammer className="w-3 h-3" /> Enabled Tools
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {agentToolNames.map((name, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-amber-900/10 text-amber-500 text-[9px] font-bold border border-amber-900/20">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-4 border-t border-zinc-800/50">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-[10px] text-zinc-300 font-medium">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="truncate">{agent.config.model}</span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredAgents.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 gap-4 h-64">
            <Search className="w-8 h-8 opacity-20" />
            <span className="font-medium">No agents found matching your criteria</span>
          </div>
        )}
      </div>
    </div>
  );
};
