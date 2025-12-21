
import React from 'react';
import { Agent } from '../types';
import { Plus, Edit2, Trash2, User, Target } from 'lucide-react';

interface AgentListProps {
  agents: Agent[];
  onEdit: (agent: Agent) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export const AgentList: React.FC<AgentListProps> = ({ agents, onEdit, onDelete, onCreate }) => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-[#121214] border border-zinc-800 p-6 rounded-xl hover:border-zinc-700 transition-all group relative"
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

            <h3 className="text-lg font-bold text-zinc-100 mb-1">{agent.name || 'Untitled Agent'}</h3>
            <p className="text-sm text-zinc-400 line-clamp-2 mb-4">
              {agent.description || 'No description provided.'}
            </p>

            <div className="space-y-3 pt-4 border-t border-zinc-800/50">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Target className="w-3.5 h-3.5" />
                <span className="font-medium text-zinc-400 truncate">{agent.goal || 'No goal set'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-900/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-900/30">
                  {agent.config.model.split('-')[1].toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                  Temp: {agent.config.temperature}
                </span>
              </div>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <button
            onClick={onCreate}
            className="border-2 border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/20 transition-all gap-4 h-64"
          >
            <Plus className="w-8 h-8" />
            <span className="font-medium">Create your first agent</span>
          </button>
        )}
      </div>
    </div>
  );
};
