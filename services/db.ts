
import { neon } from '@neondatabase/serverless';
import { Agent, Workflow, ExecutionLog, DBModel, WorkflowExecution, Tool } from '../types';

const sql = neon(`postgres://neondb_owner:npg_o5YcBDbpueE8@ep-dawn-river-a1yzfjdr-pooler.ap-southeast-1.aws.neon.tech/neondb`);

export const dbService = {
  async initSchema() {
    try {
      await sql`CREATE SCHEMA IF NOT EXISTS "AI_Agent"`;
      
      // Lookup Tables
      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".domains (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".ai_engines (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".models (
          id TEXT PRIMARY KEY,
          engine_id INTEGER REFERENCES "AI_Agent".ai_engines(id),
          name TEXT NOT NULL,
          full_name TEXT NOT NULL,
          max_tokens INTEGER NOT NULL
        )
      `;

      // Seed Lookups
      const domains = ['AI/ML', 'Backend Engineering', 'Data Engineering', 'Frontend Engineering', 'Platform Engineering', 'Quality Engineering'];
      for (const d of domains) {
        await sql`INSERT INTO "AI_Agent".domains (name) VALUES (${d}) ON CONFLICT DO NOTHING`;
      }

      await sql`INSERT INTO "AI_Agent".ai_engines (id, name) VALUES (1, 'GoogleAI') ON CONFLICT DO NOTHING`;
      
      await sql`
        INSERT INTO "AI_Agent".models (id, engine_id, name, full_name, max_tokens)
        VALUES 
          ('gemini-3-flash-preview', 1, 'Gemini 3 Flash (Fast & Lean)', 'gemini-3-flash-preview', 16384),
          ('gemini-3-pro-preview', 1, 'Gemini 3 Pro (Complex Reasoning)', 'gemini-3-pro-preview', 64000)
        ON CONFLICT DO NOTHING
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".tools (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          class_name TEXT NOT NULL,
          code TEXT NOT NULL,
          language TEXT DEFAULT 'javascript',
          parameters JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Migration: Ensure language column exists
      await sql`ALTER TABLE "AI_Agent".tools ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'javascript'`;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".agents (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          role TEXT DEFAULT '',
          domain TEXT DEFAULT '',
          goal TEXT NOT NULL,
          backstory TEXT NOT NULL,
          task_description TEXT NOT NULL,
          inputs JSONB DEFAULT '[]',
          expected_output TEXT NOT NULL,
          config JSONB NOT NULL,
          tool_ids UUID[] DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Migration: Ensure tool_ids column exists for users with older schemas
      await sql`ALTER TABLE "AI_Agent".agents ADD COLUMN IF NOT EXISTS tool_ids UUID[] DEFAULT '{}'`;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".workflows (
          id UUID PRIMARY KEY,
          metadata JSONB NOT NULL,
          nodes JSONB DEFAULT '[]',
          edges JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".execution_logs (
          id UUID PRIMARY KEY,
          workflow_id UUID,
          execution_id UUID,
          timestamp BIGINT,
          agent_name TEXT,
          status TEXT,
          input TEXT,
          output TEXT,
          error TEXT,
          node_id TEXT,
          version INTEGER DEFAULT 1,
          tool_calls JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Migration: Ensure tool_calls column exists for users with older schemas
      await sql`ALTER TABLE "AI_Agent".execution_logs ADD COLUMN IF NOT EXISTS tool_calls JSONB DEFAULT '[]'`;

      // Seed Initial Tools if none exist
      const toolCount = await sql`SELECT count(*) FROM "AI_Agent".tools`;
      if (Number(toolCount[0].count) === 0) {
        const sampleTools = [
          {
            id: 'd9e5b072-4d2c-4f7d-8e6a-7d9c8b5a4e32',
            name: 'GitHub File Reader',
            description: 'Reads content from a GitHub repository file using fetch.',
            class_name: 'GitHubReader',
            language: 'javascript',
            parameters: {
              type: 'OBJECT',
              properties: {
                owner: { type: 'STRING', description: 'GitHub username or org' },
                repo: { type: 'STRING', description: 'Repository name' },
                path: { type: 'STRING', description: 'Path to the file' }
              },
              required: ['owner', 'repo', 'path']
            },
            code: `async ({ owner, repo, path }) => {
  const url = \`https://raw.githubusercontent.com/\${owner}/\${repo}/main/\${path}\`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(\`Failed to read file: \${response.statusText}\`);
  return await response.text();
}`
          },
          {
            id: 'a1b2c3d4-e5f6-4a5b-b6c7-d8e9f0a1b2c3',
            name: 'String Manipulator',
            description: 'Performs basic string operations like reverse or upper case.',
            class_name: 'StringUtils',
            language: 'javascript',
            parameters: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING', description: 'Input text' },
                operation: { type: 'STRING', description: 'Operation: uppercase, lowercase, reverse' }
              },
              required: ['text', 'operation']
            },
            code: `({ text, operation }) => {
  if (operation === 'uppercase') return text.toUpperCase();
  if (operation === 'lowercase') return text.toLowerCase();
  if (operation === 'reverse') return text.split('').reverse().join('');
  return text;
}`
          }
        ];

        for (const t of sampleTools) {
          await sql`
            INSERT INTO "AI_Agent".tools (id, name, description, class_name, parameters, code, language)
            VALUES (${t.id}::UUID, ${t.name}, ${t.description}, ${t.class_name}, ${JSON.stringify(t.parameters)}, ${t.code}, ${t.language})
          `;
        }
      }

      console.log('PostgreSQL Schema & Seed Tools Initialized');
    } catch (error) {
      console.error('Failed to initialize schema:', error);
    }
  },

  async getDomains(): Promise<string[]> {
    const rows = await sql`SELECT name FROM "AI_Agent".domains ORDER BY name ASC`;
    return rows.map(r => r.name);
  },

  async getEngines(): Promise<{id: number, name: string}[]> {
    const rows = await sql`SELECT id, name FROM "AI_Agent".ai_engines ORDER BY name ASC`;
    return rows.map(r => ({ id: r.id, name: r.name }));
  },

  async getModels(): Promise<DBModel[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".models ORDER BY name ASC`;
    return rows.map(r => ({
      id: r.id,
      engine_id: Number(r.engine_id),
      name: r.name,
      full_name: r.full_name,
      max_tokens: Number(r.max_tokens)
    }));
  },

  async getTools(): Promise<Tool[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".tools ORDER BY created_at DESC`;
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      className: r.class_name,
      code: r.code,
      language: r.language as any,
      parameters: r.parameters
    }));
  },

  async saveTool(tool: Tool) {
    await sql`
      INSERT INTO "AI_Agent".tools (id, name, description, class_name, code, parameters, language)
      VALUES (${tool.id}::UUID, ${tool.name}, ${tool.description}, ${tool.className}, ${tool.code}, ${JSON.stringify(tool.parameters)}, ${tool.language})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        class_name = EXCLUDED.class_name,
        code = EXCLUDED.code,
        parameters = EXCLUDED.parameters,
        language = EXCLUDED.language
    `;
  },

  async deleteTool(id: string) {
    await sql`DELETE FROM "AI_Agent".tools WHERE id = ${id}::UUID`;
  },

  async getAgents(): Promise<Agent[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".agents ORDER BY created_at DESC`;
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      role: row.role || '',
      domain: row.domain || '',
      goal: row.goal,
      backstory: row.backstory,
      taskDescription: row.task_description,
      inputs: row.inputs,
      expectedOutput: row.expected_output,
      config: row.config,
      toolIds: row.tool_ids || []
    }));
  },

  async saveAgent(agent: Agent) {
    await sql`
      INSERT INTO "AI_Agent".agents (id, name, description, role, domain, goal, backstory, task_description, inputs, expected_output, config, tool_ids)
      VALUES (${agent.id}::UUID, ${agent.name}, ${agent.description}, ${agent.role}, ${agent.domain}, ${agent.goal}, ${agent.backstory}, ${agent.taskDescription}, ${JSON.stringify(agent.inputs)}, ${agent.expectedOutput}, ${JSON.stringify(agent.config)}, ${agent.toolIds || []})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        role = EXCLUDED.role,
        domain = EXCLUDED.domain,
        goal = EXCLUDED.goal,
        backstory = EXCLUDED.backstory,
        task_description = EXCLUDED.task_description,
        inputs = EXCLUDED.inputs,
        expected_output = EXCLUDED.expected_output,
        config = EXCLUDED.config,
        tool_ids = EXCLUDED.tool_ids
    `;
  },

  async deleteAgent(id: string) {
    await sql`DELETE FROM "AI_Agent".agents WHERE id = ${id}::UUID`;
  },

  async getWorkflows(): Promise<Workflow[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".workflows ORDER BY created_at DESC`;
    return rows.map(row => ({
      metadata: row.metadata,
      nodes: row.nodes,
      edges: row.edges
    }));
  },

  async saveWorkflow(workflow: Workflow) {
    await sql`
      INSERT INTO "AI_Agent".workflows (id, metadata, nodes, edges)
      VALUES (${workflow.metadata.id}::UUID, ${JSON.stringify(workflow.metadata)}, ${JSON.stringify(workflow.nodes)}, ${JSON.stringify(workflow.edges)})
      ON CONFLICT (id) DO UPDATE SET
        metadata = EXCLUDED.metadata,
        nodes = EXCLUDED.nodes,
        edges = EXCLUDED.edges
    `;
  },

  async deleteWorkflow(id: string) {
    await sql`DELETE FROM "AI_Agent".workflows WHERE id = ${id}::UUID`;
  },

  async saveLog(workflowId: string, log: ExecutionLog) {
    await sql`
      INSERT INTO "AI_Agent".execution_logs (id, workflow_id, execution_id, timestamp, agent_name, status, input, output, error, node_id, version, tool_calls)
      VALUES (${log.id}::UUID, ${workflowId}::UUID, ${log.execution_id}::UUID, ${log.timestamp}, ${log.agentName}, ${log.status}, ${log.input}, ${log.output}, ${log.error}, ${log.nodeId}, ${log.version || 1}, ${JSON.stringify(log.toolCalls || [])})
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        output = EXCLUDED.output,
        error = EXCLUDED.error,
        tool_calls = EXCLUDED.tool_calls
    `;
  },

  async getLogsByExecution(executionId: string): Promise<ExecutionLog[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".execution_logs WHERE execution_id = ${executionId}::UUID ORDER BY timestamp ASC`;
    return rows.map(row => ({
      id: row.id,
      execution_id: row.execution_id,
      timestamp: Number(row.timestamp),
      agentName: row.agent_name,
      status: row.status as any,
      input: row.input,
      output: row.output,
      error: row.error,
      nodeId: row.node_id,
      version: row.version,
      toolCalls: row.tool_calls
    }));
  },

  async getWorkflowExecutions(workflowId?: string): Promise<WorkflowExecution[]> {
    const query = workflowId 
      ? sql`
          SELECT * FROM (
            SELECT DISTINCT ON (e.execution_id) 
              e.execution_id, 
              e.workflow_id, 
              e.timestamp, 
              e.status, 
              (w.metadata->>'name') as workflow_name 
            FROM "AI_Agent".execution_logs e
            JOIN "AI_Agent".workflows w ON e.workflow_id = w.id
            WHERE e.workflow_id = ${workflowId}::UUID 
            ORDER BY e.execution_id, e.timestamp DESC
          ) sub
          ORDER BY sub.timestamp DESC`
      : sql`
          SELECT * FROM (
            SELECT DISTINCT ON (e.execution_id) 
              e.execution_id, 
              e.workflow_id, 
              e.timestamp, 
              e.status, 
              (w.metadata->>'name') as workflow_name 
            FROM "AI_Agent".execution_logs e
            JOIN "AI_Agent".workflows w ON e.workflow_id = w.id
            ORDER BY e.execution_id, e.timestamp DESC
          ) sub
          ORDER BY sub.timestamp DESC`;
    
    const rows = await query;
    return rows.map(row => ({
      id: row.execution_id,
      workflow_id: row.workflow_id,
      workflow_name: row.workflow_name || 'Unknown Workflow',
      status: row.status as any,
      timestamp: Number(row.timestamp)
    }));
  }
};
