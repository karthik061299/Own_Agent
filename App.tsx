
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { AgentList } from './components/AgentList';
import { AgentEditor } from './components/AgentEditor';
import { WorkflowList } from './components/WorkflowList';
import { WorkflowEditor } from './components/WorkflowEditor';
import { ExecutionPanel } from './components/ExecutionPanel';
import { Agent, Workflow } from './types';
import { dbService } from './services/db';
import { Settings, Users, GitBranch, Play, Loader2, PanelLeft } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'workflows' | 'execution'>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await dbService.initSchema();
        const [loadedAgents, loadedWorkflows] = await Promise.all([
          dbService.getAgents(),
          dbService.getWorkflows()
        ]);
        setAgents(loadedAgents);
        setWorkflows(loadedWorkflows);
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleSaveAgent = async (agent: Agent) => {
    try {
      await dbService.saveAgent(agent);
      setAgents(prev => {
        const exists = prev.find(a => a.id === agent.id);
        if (exists) return prev.map(a => a.id === agent.id ? agent : a);
        return [agent, ...prev];
      });
      setEditingAgent(null);
    } catch (e: any) {
      console.error("Failed to save agent to database:", e);
      alert(`Failed to save agent to database: ${e.message || 'Unknown error'}`);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (confirm("Are you sure you want to delete this agent? This action is permanent in the database.")) {
      try {
        await dbService.deleteAgent(id);
        setAgents(prev => prev.filter(a => a.id !== id));
      } catch (e) {
        alert("Failed to delete agent");
      }
    }
  };

  const handleSaveWorkflow = async (workflow: Workflow) => {
    try {
      await dbService.saveWorkflow(workflow);
      setWorkflows(prev => {
        const exists = prev.find(w => w.metadata.id === workflow.metadata.id);
        if (exists) return prev.map(w => w.metadata.id === workflow.metadata.id ? workflow : w);
        return [workflow, ...prev];
      });
      setEditingWorkflow(null);
    } catch (e) {
      alert("Failed to save workflow to database");
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (confirm("Are you sure you want to delete this workflow?")) {
      try {
        await dbService.deleteWorkflow(id);
        setWorkflows(prev => prev.filter(w => w.metadata.id !== id));
      } catch (e) {
        alert("Failed to delete workflow");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="text-zinc-500 font-medium animate-pulse uppercase tracking-widest text-xs">Connecting to PostgreSQL...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 overflow-hidden relative">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          setEditingAgent(null);
          setEditingWorkflow(null);
        }} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      
      {isSidebarCollapsed && (
        <button 
          onClick={() => setIsSidebarCollapsed(false)}
          className="absolute left-4 top-4 z-50 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white transition-all shadow-xl"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      <main className="flex-1 relative overflow-auto transition-all duration-300">
        {activeTab === 'agents' && (
          editingAgent ? (
            <AgentEditor 
              agent={editingAgent} 
              onSave={handleSaveAgent} 
              onCancel={() => setEditingAgent(null)} 
            />
          ) : (
            <AgentList 
              agents={agents} 
              onEdit={setEditingAgent} 
              onDelete={handleDeleteAgent}
              onCreate={() => setEditingAgent({
                id: crypto.randomUUID(),
                name: '',
                description: '',
                role: '',
                domain: '',
                goal: '',
                backstory: '',
                taskDescription: '',
                inputs: [],
                expectedOutput: '',
                config: {
                  aiEngine: 'GoogleAI',
                  model: 'gemini-3-flash-preview',
                  temperature: 0.7,
                  topP: 0.9,
                  maxRPM: 10,
                  maxExecutionTime: 60,
                  maxIterations: 5
                }
              })}
            />
          )
        )}

        {activeTab === 'workflows' && (
          editingWorkflow ? (
            <WorkflowEditor 
              workflow={editingWorkflow} 
              agents={agents}
              onSave={handleSaveWorkflow}
              onCancel={() => setEditingWorkflow(null)}
            />
          ) : (
            <WorkflowList 
              workflows={workflows}
              onEdit={setEditingWorkflow}
              onDelete={handleDeleteWorkflow}
              onCreate={() => setEditingWorkflow({
                metadata: {
                  id: crypto.randomUUID(),
                  name: '',
                  description: '',
                  type: 'SEQUENTIAL' as any,
                  useManager: false,
                  managerModel: 'gemini-3-pro-preview',
                  managerTemperature: 0.7,
                  managerTopP: 0.9
                },
                nodes: [],
                edges: []
              })}
            />
          )
        )}

        {activeTab === 'execution' && (
          <ExecutionPanel workflows={workflows} agents={agents} />
        )}
      </main>
    </div>
  );
};

export default App;
