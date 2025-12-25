
import React from 'react';
import { Workflow, WorkflowType } from '../types';
import { Plus, Edit2, Trash2, GitBranch, Layers, Clock, Activity, UserCheck } from 'lucide-react';

interface WorkflowListProps {
  workflows: Workflow[];
  onEdit: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

const TypeIcon: React.FC<{ type: WorkflowType }> = ({ type }) => {
  switch (type) {
    case WorkflowType.SEQUENTIAL: return <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
    case WorkflowType.PARALLEL: return <Layers className="w-4 h-4 text-sky-500 dark:text-sky-400" />;
    case WorkflowType.CIRCULAR: return <Activity className="w-4 h-4 text-orange-500 dark:text-orange-400" />;
    case WorkflowType.NON_SEQUENTIAL: return <GitBranch className="w-4 h-4 text-purple-500 dark:text-purple-400" />;
    case WorkflowType.HUMAN_IN_THE_LOOP: return <UserCheck className="w-4 h-4 text-teal-500 dark:text-teal-400" />;
    default: return null;
  }
};

export const WorkflowList: React.FC<WorkflowListProps> = ({ workflows, onEdit, onDelete, onCreate }) => {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Workflows</h2>
          <p className="text-zinc-600 dark:text-zinc-400">Orchestrate multiple agents into complex pipelines.</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-all font-medium shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" />
          Create Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map((workflow) => (
          <div
            key={workflow.metadata.id}
            className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(workflow)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(workflow.metadata.id)}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">{workflow.metadata.name || 'Untitled Workflow'}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4">
              {workflow.metadata.description || 'No description provided.'}
            </p>

            <div className="space-y-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TypeIcon type={workflow.metadata.type} />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-400 uppercase tracking-wider">{workflow.metadata.type.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-xs text-zinc-500">{workflow.nodes.length} Agents</span>
              </div>
              {workflow.metadata.useManager && (
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">
                  Manager Enabled
                </div>
              )}
            </div>
          </div>
        ))}

        {workflows.length === 0 && (
          <button
            onClick={onCreate}
            className="border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/20 transition-all gap-4 h-64"
          >
            <Plus className="w-8 h-8" />
            <span className="font-medium">Create your first workflow</span>
          </button>
        )}
      </div>
    </div>
  );
};
