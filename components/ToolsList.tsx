
import React, { useState } from 'react';
import { Tool } from '../types';
import { Plus, Edit2, Trash2, Hammer, Search, Filter, Code, Terminal } from 'lucide-react';

interface ToolsListProps {
  tools: Tool[];
  onEdit: (tool: Tool) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export const ToolsList: React.FC<ToolsListProps> = ({ tools, onEdit, onDelete, onCreate }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = tools.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Capabilities & Tools</h2>
          <p className="text-zinc-600 dark:text-zinc-400">Custom functions agents can invoke to interact with the outside world.</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-all font-medium shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" />
          Define Tool
        </button>
      </div>

      <div className="mb-8 relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        <input
          type="text"
          placeholder="Filter Tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group relative flex flex-col h-full"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                <Hammer className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(tool)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(tool.id)}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">{tool.name}</h3>
              <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase tracking-tighter flex items-center gap-1">
                <Terminal className="w-3 h-3" /> {tool.className}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                {tool.description}
              </p>
            </div>

            <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-700 bg-indigo-100 dark:bg-indigo-900/10 dark:text-indigo-400 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-900/20 uppercase tracking-widest">
                <Code className="w-3 h-3" /> JavaScript
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-bold uppercase tracking-tighter">
                {Object.keys(tool.parameters.properties || {}).length} Params
              </span>
            </div>
          </div>
        ))}

        {filteredTools.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 gap-4 h-64">
            <Hammer className="w-8 h-8 opacity-20" />
            <span className="font-medium">No tools found matching your search.</span>
          </div>
        )}
      </div>
    </div>
  );
};
