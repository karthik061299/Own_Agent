
import React, { useState, useEffect, useRef } from 'react';
import { Users, GitBranch, Play, Settings, Database, Cpu, PanelLeftClose } from 'lucide-react';

interface SidebarProps {
  activeTab: 'agents' | 'workflows' | 'execution';
  onTabChange: (tab: 'agents' | 'workflows' | 'execution') => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const INACTIVITY_TIMEOUT = 10000; // 10 seconds of inactivity to auto-hide

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isCollapsed, setIsCollapsed }) => {
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<number | null>(null);

  const resetTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (!isCollapsed && !isHovered) {
      timerRef.current = window.setTimeout(() => {
        setIsCollapsed(true);
      }, INACTIVITY_TIMEOUT);
    }
  };

  useEffect(() => {
    if (!isCollapsed && !isHovered) {
      resetTimer();
    } else if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [isCollapsed, isHovered]);

  const menuItems = [
    { id: 'agents', label: 'Agents', icon: Users },
    { id: 'workflows', label: 'Workflows', icon: GitBranch },
    { id: 'execution', label: 'Execution', icon: Play },
  ] as const;

  if (isCollapsed) return null;

  return (
    <aside 
      className={`w-64 border-r border-zinc-800 bg-[#0c0c0e] flex flex-col transition-all duration-300 transform translate-x-0 overflow-hidden shadow-2xl z-40`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={resetTimer}
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
        <button className="w-full mt-4 flex items-center gap-3 px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  );
};
