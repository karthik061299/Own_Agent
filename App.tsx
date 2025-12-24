
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
import { Agent, Workflow, Tool } from './types';
import { dbService } from './services/db';
import { Settings, Users, GitBranch, Play, Loader2, PanelRight, Hammer, MessageSquare, AlertCircle, X } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'workflows' | 'execution' | 'tools' | 'chat'>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [deletionTarget, setDeletionTarget] = useState<{ type: 'agent' | 'workflow' | 'tool', id: string, name: string } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await dbService.initSchema();
        const [loadedAgents, loadedWorkflows, loadedTools] = await Promise.all([
          dbService.getAgents(),
          dbService.getWorkflows(),
          dbService.getTools()
        ]);
        setAgents(loadedAgents);
        setWorkflows(loadedWorkflows);
        setTools(loadedTools);
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

  const handleDeleteAgent = (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (agent) {
      setDeletionTarget({ type: 'agent', id, name: agent.name });
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

  const handleDeleteWorkflow = (id: string) => {
    const workflow = workflows.find(w => w.metadata.id === id);
    if (workflow) {
      setDeletionTarget({ type: 'workflow', id, name: workflow.metadata.name });
    }
  };

  const handleSaveTool = async (tool: Tool) => {
    try {
      await dbService.saveTool(tool);
      setTools(prev => {
        const exists = prev.find(t => t.id === tool.id);
        if (exists) return prev.map(t => t.id === tool.id ? tool : t);
        return [tool, ...prev];
      });
      setEditingTool(null);
    } catch (e) {
      alert("Failed to save tool to database");
    }
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
      if (type === 'agent') {
        await dbService.deleteAgent(id);
        setAgents(prev => prev.filter(a => a.id !== id));
      } else if (type === 'workflow') {
        await dbService.deleteWorkflow(id);
        setWorkflows(prev => prev.filter(w => w.metadata.id !== id));
      } else if (type === 'tool') {
        await dbService.deleteTool(id);
        setTools(prev => prev.filter(t => t.id !== id));
      }
    } catch (e) {
      alert(`Failed to delete ${type}`);
    } finally {
      setDeletionTarget(null);
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

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 overflow-hidden relative">
      <Sidebar 
        activeTab={activeTab as any} 
        onTabChange={(tab) => {
          setActiveTab(tab as any);
          setEditingAgent(null);
          setEditingWorkflow(null);
          setEditingTool(null);
        }} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      
      {isSidebarCollapsed && (
        <div className="w-14 border-r border-zinc-800 bg-[#0c0c0e] flex flex-col items-center py-6 gap-6 z-50 transition-all">
          <button 
            onClick={() => setIsSidebarCollapsed(false)}
            className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-600/20 transition-all shadow-lg"
            title="Expand Navigation"
          >
            <PanelRight className="w-5 h-5" />
          </button>
          <div className="flex flex-col gap-4">
            <button onClick={() => {setActiveTab('agents'); setEditingAgent(null);}} className={`p-2 rounded-lg transition-all ${activeTab === 'agents' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <Users className="w-5 h-5" />
            </button>
            <button onClick={() => {setActiveTab('workflows'); setEditingWorkflow(null);}} className={`p-2 rounded-lg transition-all ${activeTab === 'workflows' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <GitBranch className="w-5 h-5" />
            </button>
            <button onClick={() => {setActiveTab('tools'); setEditingTool(null);}} className={`p-2 rounded-lg transition-all ${activeTab === 'tools' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <Hammer className="w-5 h-5" />
            </button>
            <button onClick={() => setActiveTab('execution')} className={`p-2 rounded-lg transition-all ${activeTab === 'execution' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <Play className="w-5 h-5" />
            </button>
            <button onClick={() => setActiveTab('chat')} className={`p-2 rounded-lg transition-all ${activeTab === 'chat' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 relative overflow-auto transition-all duration-300">
        {activeTab === 'agents' && (
          editingAgent ? (
            <AgentEditor 
              agent={editingAgent} 
              tools={tools}
              onSave={handleSaveAgent} 
              onCancel={() => setEditingAgent(null)} 
            />
          ) : (
            <AgentList 
              agents={agents} 
              tools={tools}
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
                toolIds: [],
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

        {activeTab === 'tools' && (
          editingTool ? (
            <ToolEditor 
              tool={editingTool} 
              onSave={handleSaveTool} 
              onCancel={() => setEditingTool(null)} 
            />
          ) : (
            <ToolsList 
              tools={tools}
              onEdit={setEditingTool}
              onDelete={handleDeleteTool}
              onCreate={() => setEditingTool({
                id: crypto.randomUUID(),
                name: '',
                description: '',
                className: '',
                language: 'javascript',
                parameters: { type: 'OBJECT', properties: {}, required: [] },
                code: `async (args) => {\n  // Implementation here\n  return 'Success';\n}`
              })}
            />
          )
        )}

        {activeTab === 'execution' && (
          <ExecutionPanel workflows={workflows} agents={agents} tools={tools} />
        )}

        {activeTab === 'chat' && (
          <ChatInterface />
        )}

      </main>

      {/* Deletion Confirmation Modal */}
      {deletionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0c0e] border border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-amber-500 mb-6">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">
              Are you sure you want to permanently delete the {deletionTarget.type} <strong className="text-indigo-400">"{deletionTarget.name}"</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletionTarget(null)}
                className="flex-1 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-800"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
            <button 
              onClick={() => setDeletionTarget(null)}
              className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;