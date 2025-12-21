
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

export interface AgentInput {
  description: string;
  parameter: string;
}

export interface AgentConfig {
  aiEngine: string;
  model: string;
  temperature: number;
  topP: number;
  maxRPM: number;
  maxExecutionTime: number;
  maxIterations: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  domain: string;
  goal: string;
  backstory: string;
  taskDescription: string;
  inputs: AgentInput[];
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
  nodeId: string;
}

export interface DBModel {
  id: string;
  engine_id: number;
  name: string;
  full_name: string;
  max_tokens: number;
}
