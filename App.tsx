
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { AgentList } from './components/AgentList';
import { AgentEditor } from './components/AgentEditor';
import { WorkflowList } from './components/WorkflowList';
import { WorkflowEditor } from './components/WorkflowEditor';
import { ExecutionPanel } from './components/ExecutionPanel';
import { ToolsList } from './components/ToolsList';
import { ToolEditor } from './components/ToolEditor';
import { ChatInterface } from './components/ChatInterface';
import { AgentTestView } from './components/AgentTestView';
import { AgentCompareView } from './components/AgentCompareView';
import { Agent, Workflow, Tool } from './types';
import { dbService } from './services/db';
import { Users, GitBranch, Play, Loader2, PanelRight, Hammer, MessageSquare, AlertCircle, X, Settings } from 'lucide-react';

type AppView = 'agentList' | 'agentEditor' | 'agentTester' | 'agentComparer' | 'workflowList' | 'workflowEditor' | 'toolList' | 'toolEditor' | 'execution' | 'chat' | 'settings';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('agentList');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);
  const [comparingAgent, setComparingAgent] = useState<Agent | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [deletionTarget, setDeletionTarget] = useState<{ type: 'agent' | 'workflow' | 'tool', id: string, name: string } | null>(null);
  const [navigationSource, setNavigationSource] = useState<{ view: AppView, data: any } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await dbService.initSchema();
        await reloadAllData();
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const reloadAllData = async () => {
    const [loadedAgents, loadedWorkflows, loadedTools] = await Promise.all([
      dbService.getAgents(),
      dbService.getWorkflows(),
      dbService.getTools()
    ]);
    setAgents(loadedAgents);
    setWorkflows(loadedWorkflows);
    setTools(loadedTools);
  };

  const navigateTo = (view: AppView) => {
    setEditingAgent(null);
    setEditingWorkflow(null);
    setEditingTool(null);
    setTestingAgent(null);
    setComparingAgent(null);
    setNavigationSource(null);
    setActiveView(view);
  };

  const handleSaveAgent = async (agent: Agent) => {
    try {
      await dbService.saveAgent(agent);
      await reloadAllData();
      if (navigationSource?.view === 'workflowEditor') {
        const updatedWorkflow = await dbService.getWorkflows().then(ws => ws.find(w => w.metadata.id === navigationSource.data.metadata.id));
        setEditingWorkflow(updatedWorkflow || navigationSource.data);
        setActiveView('workflowEditor');
        setNavigationSource(null);
      } else {
        navigateTo('agentList');
      }
    } catch (e: any) {
      console.error("Failed to save agent to database:", e);
      alert(`Failed to save agent to database: ${e.message || 'Unknown error'}`);
    }
  };
  
  const handleTestAgent = async (agent: Agent) => {
    try {
      await dbService.saveAgent(agent);
      const updatedAgents = await dbService.getAgents();
      setAgents(updatedAgents);
      const agentToTest = updatedAgents.find(a => a.id === agent.id);
      if (agentToTest) {
        setTestingAgent(agentToTest);
        setActiveView('agentTester');
      } else {
        setTestingAgent(agent);
        setActiveView('agentTester');
      }
    } catch(e) {
      alert("Failed to save and prepare agent for testing.");
    }
  };

  const handleSaveAndCompare = async (agent: Agent) => {
    try {
      await dbService.saveAgent(agent);
      const updatedAgents = await dbService.getAgents();
      setAgents(updatedAgents);
      const agentToCompare = updatedAgents.find(a => a.id === agent.id);
      if (agentToCompare) {
        setComparingAgent(agentToCompare);
        setActiveView('agentComparer');
      } else {
        // Fallback for new agents not yet in the main list
        setComparingAgent(agent);
        setActiveView('agentComparer');
      }
    } catch (e) {
      alert("Failed to save and prepare agent for comparison.");
    }
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setActiveView('agentEditor');
  };
  
  const handleEditAgentFromWorkflow = (agent: Agent, workflow: Workflow) => {
    setNavigationSource({ view: 'workflowEditor', data: workflow });
    setEditingAgent(agent);
    setActiveView('agentEditor');
  };

  const handleCreateAgent = () => {
    setEditingAgent({
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
      outputFileExtension: '.txt',
      toolIds: [],
      version: 1,
      versions: [],
      config: {
        aiEngine: 'GoogleAI',
        model: 'gemini-3-flash-preview',
        temperature: 0.7,
        topP: 0.9,
        maxRPM: 10,
        maxExecutionTime: 60,
        maxIterations: 5
      }
    });
    setActiveView('agentEditor');
  };

  const handleDeleteAgent = (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (agent) {
      setDeletionTarget({ type: 'agent', id, name: agent.name });
    }
  };

  const handleSaveWorkflow = async (workflow: Workflow) => {
    await dbService.saveWorkflow(workflow);
    await reloadAllData();
    navigateTo('workflowList');
  };

  const handleDeleteWorkflow = (id: string) => {
    const workflow = workflows.find(w => w.metadata.id === id);
    if (workflow) {
      setDeletionTarget({ type: 'workflow', id, name: workflow.metadata.name });
    }
  };

  const handleSaveTool = async (tool: Tool) => {
    await dbService.saveTool(tool);
    await reloadAllData();
    navigateTo('toolList');
  };

  const handleDeleteTool = (id: string) => {
    const tool = tools.find(t => t.id === id);
    if (tool) {
      setDeletionTarget({ type: 'tool', id, name: tool.name });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletionTarget) return;
    const { type, id } = deletionTarget;
    try {
      if (type === 'agent') await dbService.deleteAgent(id);
      else if (type === 'workflow') await dbService.deleteWorkflow(id);
      else if (type === 'tool') await dbService.deleteTool(id);
      await reloadAllData();
    } catch (e) {
      alert(`Failed to delete ${type}`);
    } finally {
      setDeletionTarget(null);
    }
  };

  const handleCancelEdit = () => {
    if (navigationSource?.view === 'workflowEditor') {
      setEditingWorkflow(navigationSource.data);
      setActiveView('workflowEditor');
      setNavigationSource(null);
    } else {
      navigateTo('agentList');
    }
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'agentList':
        return <AgentList agents={agents} tools={tools} onEdit={handleEditAgent} onDelete={handleDeleteAgent} onCreate={handleCreateAgent} />;
      case 'agentEditor':
        return editingAgent && <AgentEditor agent={editingAgent} tools={tools} onSave={handleSaveAgent} onTest={handleTestAgent} onCancel={handleCancelEdit} onSaveAndCompare={handleSaveAndCompare} />;
      case 'agentTester':
        return testingAgent && <AgentTestView agent={testingAgent} onBack={() => { setTestingAgent(null); setActiveView('agentEditor'); setEditingAgent(testingAgent); }} />;
      case 'agentComparer':
        return comparingAgent && <AgentCompareView agent={comparingAgent} onBack={() => { setComparingAgent(null); setActiveView('agentEditor'); setEditingAgent(comparingAgent); }} />;
      case 'workflowList':
        return <WorkflowList workflows={workflows} onEdit={(w) => { setEditingWorkflow(w); setActiveView('workflowEditor'); }} onDelete={handleDeleteWorkflow} onCreate={() => { setEditingWorkflow({ metadata: { id: crypto.randomUUID(), name: '', description: '', type: 'SEQUENTIAL' as any, useManager: false, managerModel: 'gemini-3-pro-preview', managerTemperature: 0.7, managerTopP: 0.9 }, nodes: [], edges: [] }); setActiveView('workflowEditor'); }} />;
      case 'workflowEditor':
        return editingWorkflow && <WorkflowEditor workflow={editingWorkflow} agents={agents} onSave={handleSaveWorkflow} onCancel={() => navigateTo('workflowList')} onEditAgent={(agent) => handleEditAgentFromWorkflow(agent, editingWorkflow)} />;
      case 'toolList':
        return <ToolsList tools={tools} onEdit={(t) => { setEditingTool(t); setActiveView('toolEditor'); }} onDelete={handleDeleteTool} onCreate={() => { setEditingTool({ id: crypto.randomUUID(), name: '', description: '', className: '', language: 'javascript', parameters: { type: 'OBJECT', properties: {}, required: [] }, code: `async (args) => {\n  // Implementation here\n  return 'Success';\n}` }); setActiveView('toolEditor'); }} />;
      case 'toolEditor':
        return editingTool && <ToolEditor tool={editingTool} onSave={handleSaveTool} onCancel={() => navigateTo('toolList')} />;
      case 'execution':
        return <ExecutionPanel workflows={workflows} agents={agents} tools={tools} />;
      case 'chat':
        return <ChatInterface />;
      default:
        return <AgentList agents={agents} tools={tools} onEdit={handleEditAgent} onDelete={handleDeleteAgent} onCreate={handleCreateAgent} />;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="text-zinc-500 font-medium animate-pulse uppercase tracking-widest text-xs">Accessing System Registry...</p>
      </div>
    );
  }

  const activeTab = activeView.includes('agent') ? 'agents' : activeView.includes('workflow') ? 'workflows' : activeView.includes('tool') ? 'tools' : activeView;

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 overflow-hidden relative">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => navigateTo(tab as AppView)}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      
      {isSidebarCollapsed && (
        <div className="w-14 border-r border-zinc-800 bg-[#0c0c0e] flex flex-col items-center py-6 gap-6 z-50 transition-all">
          <button onClick={() => setIsSidebarCollapsed(false)} className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-600/20 transition-all shadow-lg" title="Expand Navigation">
            <PanelRight className="w-5 h-5" />
          </button>
          <div className="flex flex-col gap-4">
            <button onClick={() => navigateTo('agentList')} className={`p-2 rounded-lg transition-all ${activeTab === 'agents' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}><Users className="w-5 h-5" /></button>
            <button onClick={() => navigateTo('workflowList')} className={`p-2 rounded-lg transition-all ${activeTab === 'workflows' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}><GitBranch className="w-5 h-5" /></button>
            <button onClick={() => navigateTo('toolList')} className={`p-2 rounded-lg transition-all ${activeTab === 'tools' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}><Hammer className="w-5 h-5" /></button>
            <button onClick={() => navigateTo('execution')} className={`p-2 rounded-lg transition-all ${activeTab === 'execution' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}><Play className="w-5 h-5" /></button>
            <button onClick={() => navigateTo('chat')} className={`p-2 rounded-lg transition-all ${activeTab === 'chat' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}><MessageSquare className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      <main className="flex-1 relative overflow-auto transition-all duration-300">
        {renderActiveView()}
      </main>

      {deletionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-amber-500 mb-6">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20"><AlertCircle className="w-6 h-6" /></div>
              <h3 className="text-lg font-bold text-zinc-100">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">Are you sure you want to permanently delete the {deletionTarget.type} <strong className="text-indigo-400">"{deletionTarget.name}"</strong>? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletionTarget(null)} className="flex-1 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-800">Cancel</button>
              <button onClick={handleConfirmDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-600/20">Delete</button>
            </div>
            <button onClick={() => setDeletionTarget(null)} className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
