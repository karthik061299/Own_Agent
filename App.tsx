
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { AgentList } from './components/AgentList';
import { AgentEditor } from './components/AgentEditor';
import { WorkflowList } from './components/WorkflowList';
import { WorkflowEditor } from './components/WorkflowEditor';
import { ExecutionPanel } from './components/ExecutionPanel';
import { Agent, Workflow } from './types';
import { Settings, Users, GitBranch, Play } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'workflows' | 'execution'>('agents');
  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem('nexus_agents');
    return saved ? JSON.parse(saved) : [];
  });
  const [workflows, setWorkflows] = useState<Workflow[]>(() => {
    const saved = localStorage.getItem('nexus_workflows');
    return saved ? JSON.parse(saved) : [];
  });
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  useEffect(() => {
    localStorage.setItem('nexus_agents', JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    localStorage.setItem('nexus_workflows', JSON.stringify(workflows));
  }, [workflows]);

  const handleSaveAgent = (agent: Agent) => {
    setAgents(prev => {
      const exists = prev.find(a => a.id === agent.id);
      if (exists) return prev.map(a => a.id === agent.id ? agent : a);
      return [...prev, agent];
    });
    setEditingAgent(null);
  };

  const handleSaveWorkflow = (workflow: Workflow) => {
    setWorkflows(prev => {
      const exists = prev.find(w => w.metadata.id === workflow.metadata.id);
      if (exists) return prev.map(w => w.metadata.id === workflow.metadata.id ? workflow : w);
      return [...prev, workflow];
    });
    setEditingWorkflow(null);
  };

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab);
        setEditingAgent(null);
        setEditingWorkflow(null);
      }} />
      
      <main className="flex-1 relative overflow-auto">
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
              onDelete={(id) => setAgents(prev => prev.filter(a => a.id !== id))}
              onCreate={() => setEditingAgent({
                id: crypto.randomUUID(),
                name: '',
                description: '',
                goal: '',
                backstory: '',
                taskDescription: '',
                inputs: [],
                expectedOutput: '',
                config: {
                  temperature: 0.7,
                  topP: 0.95,
                  maxTokens: 2048,
                  maxRPM: 10,
                  maxExecutionTime: 60,
                  maxIterations: 5,
                  model: 'gemini-3-flash-preview' as any
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
              onDelete={(id) => setWorkflows(prev => prev.filter(w => w.metadata.id !== id))}
              onCreate={() => setEditingWorkflow({
                metadata: {
                  id: crypto.randomUUID(),
                  name: '',
                  description: '',
                  type: 'SEQUENTIAL' as any,
                  useManager: false,
                  managerModel: 'gemini-3-pro-preview' as any
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
