
import React from 'react';
import { Settings, Sun, Moon, CheckCircle2 } from 'lucide-react';

interface SettingsViewProps {
  currentTheme: string;
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const ThemeCard: React.FC<{
  theme: 'light' | 'dark';
  currentTheme: string;
  onSelect: () => void;
}> = ({ theme, currentTheme, onSelect }) => {
  const isSelected = theme === currentTheme;
  const isLight = theme === 'light';

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-2xl border-2 p-1 transition-all duration-300 relative overflow-hidden ${
        isSelected
          ? 'border-indigo-500 ring-4 ring-indigo-500/20'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600'
      }`}
    >
      <div className={`p-6 rounded-xl ${isLight ? 'bg-zinc-100' : 'bg-zinc-900'}`}>
        <div className="flex space-x-2">
          <div className={`w-1/3 rounded-md p-2 ${isLight ? 'bg-white' : 'bg-zinc-800'}`}>
            <div className={`h-2 w-3/4 rounded-full ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
            <div className={`h-2 w-1/2 rounded-full mt-1.5 ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
          </div>
          <div className={`flex-1 rounded-md p-2 ${isLight ? 'bg-white' : 'bg-zinc-800'}`}>
            <div className={`h-2 w-full rounded-full ${isLight ? 'bg-indigo-300' : 'bg-indigo-700'}`} />
            <div className={`h-2 w-5/6 rounded-full mt-1.5 ${isLight ? 'bg-zinc-200' : 'bg-zinc-600'}`} />
          </div>
        </div>
        <div className={`h-12 mt-2 rounded-md p-2 ${isLight ? 'bg-white' : 'bg-zinc-800'}`} />
      </div>
      <div className="p-4 flex justify-between items-center bg-white/50 dark:bg-black/20">
        <div className="flex items-center gap-3">
          {isLight ? (
            <Sun className="w-5 h-5 text-amber-500" />
          ) : (
            <Moon className="w-5 h-5 text-sky-400" />
          )}
          <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{isLight ? 'Light Mode' : 'Dark Mode'}</span>
        </div>
        {isSelected && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
      </div>
    </div>
  );
};

export const SettingsView: React.FC<SettingsViewProps> = ({ currentTheme, onThemeChange }) => {
  return (
    <div className="h-full bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 overflow-y-auto scrollbar-thin">
      <header className="p-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Platform Settings</h2>
            <p className="text-sm text-zinc-500">Manage the look, feel, and behavior of the application.</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-10 space-y-12">
        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-1">Appearance</h3>
          <h4 className="text-lg font-bold mb-2">Theme</h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mb-6">
            Select a visual theme for the application interface. Your preference will be saved for your next visit.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ThemeCard
              theme="light"
              currentTheme={currentTheme}
              onSelect={() => onThemeChange('light')}
            />
            <ThemeCard
              theme="dark"
              currentTheme={currentTheme}
              onSelect={() => onThemeChange('dark')}
            />
          </div>
        </section>
      </main>
    </div>
  );
};
