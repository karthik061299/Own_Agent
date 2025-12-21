
export enum WorkflowType {
  SEQUENTIAL = 'SEQUENTIAL',
  PARALLEL = 'PARALLEL',
  CIRCULAR = 'CIRCULAR',
  NON_SEQUENTIAL = 'NON_SEQUENTIAL'
}

export enum GeminiModel {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview'
}

export interface AgentConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  maxRPM: number;
  maxExecutionTime: number;
  maxIterations: number;
  model: GeminiModel;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  goal: string;
  backstory: string;
  taskDescription: string;
  inputPlaceholder: string; // The variable name, e.g., "user_query"
  expectedOutput: string;
  config: AgentConfig;
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  type: WorkflowType;
  useManager: boolean;
  managerModel: GeminiModel;
}

export interface WorkflowNode {
  id: string;
  agentId: string;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface Workflow {
  metadata: WorkflowMetadata;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecutionLog {
  id: string;
  timestamp: number;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: string;
  output?: string;
  error?: string;
}
