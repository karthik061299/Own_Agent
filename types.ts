
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

export interface Tool {
  id: string;
  name: string;
  description: string;
  className: string;
  code: string;
  language: 'javascript' | 'python' | 'java';
  parameters: any; // JSON Schema
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
  toolIds?: string[];
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  type: WorkflowType;
  useManager: boolean;
  managerModel: string;
  managerTemperature: number;
  managerTopP: number;
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
  execution_id: string;
  timestamp: number;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  input: string;
  output?: string;
  error?: string;
  nodeId: string;
  version?: number;
  toolCalls?: any[];
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  timestamp: number;
  duration?: number;
}

export interface DBModel {
  id: string;
  engine_id: number;
  name: string;
  full_name: string;
  max_tokens: number;
  is_active?: boolean;
}

export interface Engine {
  id: number;
  name: string;
  description?: string;
  is_active?: boolean;
  api_key?: string;
}

export interface PlatformSettings {
  id: string;
  default_rpm: number;
  default_timeout: number;
  default_max_iterations: number;
  enable_thinking_mode: boolean;
  updated_at: number;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}
