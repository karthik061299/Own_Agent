
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
// FIX: Removed unused and non-existent PlatformSettings type.
import { Engine, DBModel } from '../types';
import { 
  Settings, Save, Globe, Cpu, CheckCircle2, XCircle, 
  Info, ShieldCheck, Loader2, Key, Eye, EyeOff
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [models, setModels] = useState<DBModel[]>([]);
  // FIX: Removed state for deprecated PlatformSettings.
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // FIX: Removed call to non-existent getPlatformSettings.
      const [e, m] = await Promise.all([
        dbService.getEngines(),
        dbService.getModels(),
      ]);
      setEngines(e);
      setModels(m);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    // FIX: Removed check for settings object.
    setIsSaving(true);
    try {
      // FIX: Removed call to non-existent savePlatformSettings.
      
      // Save engine specific keys and status
      for (const engine of engines) {
        await dbService.updateEngine(engine.id, { 
          api_key: engine.api_key, 
          is_active: engine.is_active 
        });
      }
      
      alert("Success: All configurations and API keys have been committed to the database.");
    } catch (err) {
      alert("Failed to save settings. Check your database connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateEngineKey = (id: number, key: string) => {
    setEngines(prev => prev.map(e => e.id === id ? { ...e, api_key: key } : e));
  };

  const toggleKeyVisibility = (id: number) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleModelStatus = async (id: string, current: boolean) => {
    try {
      await dbService.updateModelStatus(id, !current);
      setModels(prev => prev.map(m => m.id === id ? { ...m, is_active: !current } : m));
    } catch (err) {
      alert("Failed to update model status.");
    }
  };

  // FIX: Removed check for settings object.
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full bg-[#09090b] overflow-y-auto scrollbar-thin">
      <header className="p-10 border-b border-zinc-800 bg-[#0c0c0e]/50 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">Platform Settings</h2>
            <p className="text-sm text-zinc-500 uppercase tracking-widest font-bold">Engine Orchestration & Decentralized Keys</p>
          </div>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl transition-all font-bold shadow-xl shadow-indigo-600/10 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Commit Changes
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-10 space-y-12">
        {/* API Key Banner */}
        <section className="bg-indigo-600/5 border border-indigo-600/20 rounded-3xl p-8 flex gap-6 items-center shadow-2xl">
          <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-indigo-300 uppercase tracking-tighter">Database-Backed Credentials</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              API keys are stored in the <code className="text-indigo-400 font-mono">"AI_Agent".ai_engines</code> table. 
              Entering a key below and clicking <strong>Commit Changes</strong> will persist the value to the Postgres record.
            </p>
          </div>
        </section>

        {/* FIX: Removed Global Defaults section which relied on the deprecated PlatformSettings. */}
        
        {/* Engine Management */}
        <section className="space-y-6">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-3">
             <Globe className="w-4 h-4" /> AI Engine Registry
          </h3>
          <div className="space-y-6">
            {engines.map(engine => (
              <div key={engine.id} className="bg-[#0c0c0e] border border-zinc-800 p-8 rounded-3xl space-y-6 shadow-lg relative overflow-hidden group">
                <div className="flex justify-between items-center">
                  <div className="flex gap-6 items-center">
                    <div className="w-14 h-14 bg-indigo-600/10 rounded-2xl flex items-center justify-center border border-indigo-600/20">
                      <Globe className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-zinc-100 mb-1">{engine.name}</h4>
                      <p className="text-sm text-zinc-500 max-w-lg leading-relaxed">{engine.description}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
                    engine.is_active ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                  }`}>
                    {engine.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {engine.is_active ? 'Active' : 'Disabled'}
                  </div>
                </div>

                <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <Key className="w-3 h-3 text-indigo-400" /> {engine.name} API Key
                    </label>
                    <button 
                      onClick={() => toggleKeyVisibility(engine.id)}
                      className="text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase"
                    >
                      {visibleKeys[engine.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {visibleKeys[engine.id] ? 'Hide Key' : 'Reveal Key'}
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type={visibleKeys[engine.id] ? "text" : "password"}
                      placeholder="Enter Provider API Key..."
                      value={engine.api_key || ''}
                      onChange={(e) => updateEngineKey(engine.id, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-indigo-100 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-700 font-mono pr-12"
                    />
                    {!engine.api_key && (
                      // Move title attribute to wrapper div because Lucide icons do not support direct title prop in this context
                      <div className="absolute right-4 top-1/2 -translate-y-1/2" title="Key is currently empty in the database.">
                        <Info className="w-4 h-4 text-zinc-700" />
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] text-zinc-600 italic">Keys are saved as plain text in your database to be used by the orchestration server.</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Model Catalog */}
        <section className="space-y-6 pb-20">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-3">
             <Cpu className="w-4 h-4" /> Model Capabilities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map(model => (
              <div key={model.id} className={`p-6 rounded-2xl border transition-all ${
                model.is_active ? 'bg-zinc-900/60 border-zinc-800' : 'bg-black/40 border-zinc-900 opacity-60'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h5 className="font-bold text-zinc-100 mb-0.5">{model.name}</h5>
                    <p className="text-[10px] font-mono text-zinc-500">{model.full_name}</p>
                  </div>
                  <button 
                    onClick={() => toggleModelStatus(model.id, model.is_active || false)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${
                      model.is_active ? 'bg-indigo-600' : 'bg-zinc-800'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      model.is_active ? 'left-5' : 'left-1'
                    }`} />
                  </button>
                </div>
                <div className="flex gap-3">
                   <div className="px-2.5 py-1 rounded-lg bg-black border border-zinc-800 text-[10px] text-zinc-400 font-bold">
                     {model.max_tokens.toLocaleString()} TOKENS
                   </div>
                   <div className="px-2.5 py-1 rounded-lg bg-black border border-zinc-800 text-[10px] text-zinc-400 font-bold uppercase">
                     {engines.find(e => e.id === model.engine_id)?.name}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
