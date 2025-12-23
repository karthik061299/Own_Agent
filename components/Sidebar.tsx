
import React from 'react';
import { Users, GitBranch, Play, Settings, Cpu, PanelLeftClose, Hammer, MessageSquare } from 'lucide-react';

interface SidebarProps {
  activeTab: 'agents' | 'workflows' | 'execution' | 'tools' | 'chat' | 'settings';
  onTabChange: (tab: 'agents' | 'workflows' | 'execution' | 'tools' | 'chat' | 'settings') => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isCollapsed, setIsCollapsed }) => {
  const menuItems = [
    { id: 'agents', label: 'Agents', icon: Users },
    { id: 'workflows', label: 'Workflows', icon: GitBranch },
    { id: 'tools', label: 'Tools', icon: Hammer },
    { id: 'execution', label: 'Execution', icon: Play },
    { id: 'chat', label: 'Chat with AI', icon: MessageSquare },
  ] as const;

  if (isCollapsed) return null;

  return (
    <aside 
      className={`w-64 border-r border-zinc-800 bg-[#0c0c0e] flex flex-col transition-all duration-300 transform translate-x-0 overflow-hidden shadow-2xl z-40`}
    >
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">Nexus Agents</h1>
        </div>
        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
              activeTab === item.id
                ? 'bg-zinc-800/50 text-indigo-400 shadow-sm border border-zinc-700/50'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/30'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-colors ${activeTab === item.id ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-zinc-800">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Local-Only Instance</span>
        </div>
        <button 
          onClick={() => onTabChange('settings')}
          className={`w-full mt-4 flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
            activeTab === 'settings' ? 'text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-indigo-400' : ''}`} />
          Settings
        </button>
      </div>
    </aside>
  );
};
