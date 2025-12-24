
import { neon } from '@neondatabase/serverless';
import { Agent, Workflow, ExecutionLog, DBModel, WorkflowExecution, Tool, ChatMessage, ChatSession, Engine, FileExtension, AgentVersionData } from '../types';

const sql = neon(`postgres://neondb_owner:npg_o5YcBDbpueE8@ep-dawn-river-a1yzfjdr-pooler.ap-southeast-1.aws.neon.tech/neondb`);

export const dbService = {
  async initSchema() {
    try {
      await sql`CREATE SCHEMA IF NOT EXISTS "AI_Agent"`;
      
      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".domains (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".file_extensions (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          extension TEXT UNIQUE NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".ai_engines (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL
        )
      `;

      // Migration: Ensure all columns exist in ai_engines
      await sql`ALTER TABLE "AI_Agent".ai_engines ADD COLUMN IF NOT EXISTS description TEXT`;
      await sql`ALTER TABLE "AI_Agent".ai_engines ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE "AI_Agent".ai_engines ADD COLUMN IF NOT EXISTS api_key TEXT`;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".models (
          id TEXT PRIMARY KEY,
          engine_id INTEGER REFERENCES "AI_Agent".ai_engines(id),
          name TEXT NOT NULL,
          full_name TEXT NOT NULL,
          max_tokens INTEGER NOT NULL
        )
      `;
      
      await sql`ALTER TABLE "AI_Agent".models ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`;

      const domains = ['AI/ML', 'Backend Engineering', 'Data Engineering', 'Frontend Engineering', 'Platform Engineering', 'Quality Engineering'];
      for (const d of domains) {
        await sql`INSERT INTO "AI_Agent".domains (name) VALUES (${d}) ON CONFLICT DO NOTHING`;
      }

      const extensions = [
        { name: 'Text', extension: '.txt' },
        { name: 'Python', extension: '.py' },
        { name: 'Java', extension: '.java' },
        { name: 'SQL', extension: '.sql' },
        { name: 'Markdown', extension: '.md' },
        { name: 'JavaScript', extension: '.js' },
        { name: 'JSON', extension: '.json' },
      ];
      for (const ext of extensions) {
        await sql`INSERT INTO "AI_Agent".file_extensions (name, extension) VALUES (${ext.name}, ${ext.extension}) ON CONFLICT DO NOTHING`;
      }

      await sql`
        INSERT INTO "AI_Agent".ai_engines (id, name, description) 
        VALUES (1, 'GoogleAI', 'Google Gemini API - Native integration for Flash and Pro models.') 
        ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description
      `;
      await sql`UPDATE "AI_Agent".ai_engines SET api_key = 'AIzaSyAQ9mrDx7rx7L4xjTgCskBd90cEIvwLXDM' WHERE id = 1`;
      
      await sql`
        INSERT INTO "AI_Agent".models (id, engine_id, name, full_name, max_tokens)
        VALUES 
          ('gemini-3-flash-preview', 1, 'Gemini 3 Flash (Fast & Lean)', 'gemini-3-flash-preview', 16384),
          ('gemini-3-pro-preview', 1, 'Gemini 3 Pro (Complex Reasoning)', 'gemini-3-pro-preview', 64000)
        ON CONFLICT (id) DO NOTHING
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

      await sql`ALTER TABLE "AI_Agent".agents ADD COLUMN IF NOT EXISTS output_file_extension TEXT`;
      await sql`ALTER TABLE "AI_Agent".agents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`;
      await sql`ALTER TABLE "AI_Agent".agents ADD COLUMN IF NOT EXISTS versions JSONB DEFAULT '[]'::jsonb`;


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
          duration INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".chat_sessions (
          id UUID PRIMARY KEY,
          title TEXT NOT NULL,
          model TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "AI_Agent".chat_messages (
          id UUID PRIMARY KEY,
          session_id UUID REFERENCES "AI_Agent".chat_sessions(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await sql`DROP TABLE IF EXISTS "AI_Agent".platform_settings`;

      console.log('PostgreSQL Schema & Management Tables Initialized');
    } catch (error) {
      console.error('Failed to initialize schema:', error);
      throw error;
    }
  },

  async getDomains(): Promise<string[]> {
    const rows = await sql`SELECT name FROM "AI_Agent".domains ORDER BY name ASC`;
    return rows.map(r => r.name);
  },

  async getFileExtensions(): Promise<FileExtension[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".file_extensions ORDER BY name ASC`;
    return rows.map(r => ({ id: r.id, name: r.name, extension: r.extension }));
  },

  async getEngines(): Promise<Engine[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".ai_engines ORDER BY name ASC`;
    return rows.map(r => ({ 
      id: r.id, 
      name: r.name, 
      description: r.description, 
      is_active: r.is_active,
      api_key: r.api_key
    }));
  },

  async getModels(): Promise<DBModel[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".models ORDER BY name ASC`;
    return rows.map(r => ({
      id: r.id,
      engine_id: Number(r.engine_id),
      name: r.name,
      full_name: r.full_name,
      max_tokens: Number(r.max_tokens),
      is_active: r.is_active
    }));
  },

  async updateModelStatus(id: string, isActive: boolean) {
    await sql`UPDATE "AI_Agent".models SET is_active = ${isActive} WHERE id = ${id}`;
  },

  async updateEngine(id: number, data: { api_key?: string; is_active?: boolean }) {
    await sql`
      UPDATE "AI_Agent".ai_engines
      SET
        api_key = ${data.api_key},
        is_active = ${data.is_active}
      WHERE id = ${id}
    `;
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
      outputFileExtension: row.output_file_extension,
      config: row.config,
      toolIds: row.tool_ids || [],
      version: row.version,
      versions: row.versions || []
    }));
  },

  async saveAgent(agent: Agent) {
    const getComparableData = (a: any): AgentVersionData => {
      const { name, description, role, domain, goal, backstory, inputs, config } = a;
      return {
        name, description, role, domain, goal, backstory, inputs, config,
        taskDescription: a.task_description || a.taskDescription,
        expectedOutput: a.expected_output || a.expectedOutput,
        outputFileExtension: a.output_file_extension || a.outputFileExtension,
        toolIds: a.tool_ids || a.toolIds || [],
      };
    };

    const existingRows = await sql`SELECT * FROM "AI_Agent".agents WHERE id = ${agent.id}::UUID`;

    if (existingRows.length > 0) {
        const oldAgent = existingRows[0];
        const oldComparable = getComparableData(oldAgent);
        const newComparable = getComparableData(agent);

        const coreDataChanged = JSON.stringify(oldComparable) !== JSON.stringify(newComparable);
        const versioningChanged = oldAgent.version !== agent.version || JSON.stringify(oldAgent.versions || []) !== JSON.stringify(agent.versions || []);
        
        if (coreDataChanged) {
            // Check if the new data is just a revert to a historical version.
            const isRevertToHistory = (oldAgent.versions || []).some(v => 
                JSON.stringify(getComparableData(v.data)) === JSON.stringify(newComparable)
            );

            if (isRevertToHistory) {
                // This is a versioning operation (e.g., loading an old version).
                // We just persist the state from the client without creating a new version entry.
                await sql`
                    UPDATE "AI_Agent".agents SET
                        name = ${agent.name}, description = ${agent.description}, role = ${agent.role}, domain = ${agent.domain}, goal = ${agent.goal}, backstory = ${agent.backstory},
                        task_description = ${agent.taskDescription}, inputs = ${JSON.stringify(agent.inputs)}, expected_output = ${agent.expectedOutput}, output_file_extension = ${agent.outputFileExtension || null},
                        config = ${JSON.stringify(agent.config)}, tool_ids = ${agent.toolIds || []},
                        version = ${agent.version}, versions = ${JSON.stringify(agent.versions)}
                    WHERE id = ${agent.id}::UUID
                `;
            } else {
                // This is a genuine content edit. Create a new version.
                const snapshotData: AgentVersionData = { ...oldComparable };
                const snapshotEntry = { version: oldAgent.version, data: snapshotData, createdAt: Date.now() };
                const newVersions = [...(oldAgent.versions || []), snapshotEntry].sort((a,b) => a.version - b.version);
                const newVersionNumber = oldAgent.version + 1;
                
                await sql`
                    UPDATE "AI_Agent".agents SET
                        name = ${agent.name}, description = ${agent.description}, role = ${agent.role}, domain = ${agent.domain}, goal = ${agent.goal}, backstory = ${agent.backstory},
                        task_description = ${agent.taskDescription}, inputs = ${JSON.stringify(agent.inputs)}, expected_output = ${agent.expectedOutput}, output_file_extension = ${agent.outputFileExtension || null},
                        config = ${JSON.stringify(agent.config)}, tool_ids = ${agent.toolIds || []},
                        version = ${newVersionNumber}, versions = ${JSON.stringify(newVersions)}
                    WHERE id = ${agent.id}::UUID
                `;
            }
        } else if (versioningChanged) {
            // Core data is the same, but version history changed (e.g., deleting a non-current version).
            // Persist only the versioning changes.
            await sql`
                UPDATE "AI_Agent".agents SET
                    version = ${agent.version},
                    versions = ${JSON.stringify(agent.versions)}
                WHERE id = ${agent.id}::UUID
            `;
        }
    } else {
        // New agent
        await sql`
            INSERT INTO "AI_Agent".agents (id, name, description, role, domain, goal, backstory, task_description, inputs, expected_output, output_file_extension, config, tool_ids, version, versions)
            VALUES (${agent.id}::UUID, ${agent.name}, ${agent.description}, ${agent.role}, ${agent.domain}, ${agent.goal}, ${agent.backstory}, ${agent.taskDescription}, ${JSON.stringify(agent.inputs)}, ${agent.expectedOutput}, ${agent.outputFileExtension || null}, ${JSON.stringify(agent.config)}, ${agent.toolIds || []}, 1, '[]'::jsonb)
        `;
    }
},


  async deleteAgentVersion(agentId: string, versionNumber: number) {
    const agentResult = await sql`SELECT * FROM "AI_Agent".agents WHERE id = ${agentId}::UUID`;
    if (agentResult.length === 0) throw new Error("Agent not found");

    const agent = agentResult[0];
    const versions = (agent.versions as any[] || []);
    const updatedVersions = versions.filter(v => v.version !== versionNumber);

    if (versions.length === updatedVersions.length) return;

    await sql`
      UPDATE "AI_Agent".agents SET
        versions = ${JSON.stringify(updatedVersions)}
      WHERE id = ${agentId}::UUID
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

  async saveLog(workflowId: string, log: ExecutionLog, duration?: number) {
    await sql`
      INSERT INTO "AI_Agent".execution_logs (id, workflow_id, execution_id, timestamp, agent_name, status, input, output, error, node_id, version, tool_calls, duration)
      VALUES (${log.id}::UUID, ${workflowId}::UUID, ${log.execution_id}::UUID, ${log.timestamp}, ${log.agentName}, ${log.status}, ${log.input}, ${log.output}, ${log.error}, ${log.nodeId}, ${log.version || 1}, ${JSON.stringify(log.toolCalls || [])}, ${duration || null})
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        output = EXCLUDED.output,
        error = EXCLUDED.error,
        tool_calls = EXCLUDED.tool_calls,
        duration = COALESCE(EXCLUDED.duration, "AI_Agent".execution_logs.duration)
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
          SELECT 
            e.execution_id as id, 
            e.workflow_id, 
            MAX(e.duration) as duration, 
            MAX(e.timestamp) as timestamp, 
            (w.metadata->>'name') as workflow_name,
            (SELECT status FROM "AI_Agent".execution_logs WHERE execution_id = e.execution_id ORDER BY timestamp DESC LIMIT 1) as status
          FROM "AI_Agent".execution_logs e
          JOIN "AI_Agent".workflows w ON e.workflow_id = w.id
          WHERE e.workflow_id = ${workflowId}::UUID
          GROUP BY e.execution_id, e.workflow_id, w.metadata->>'name'
          ORDER BY timestamp DESC`
      : sql`
          SELECT 
            e.execution_id as id, 
            e.workflow_id, 
            MAX(e.duration) as duration, 
            MAX(e.timestamp) as timestamp, 
            (w.metadata->>'name') as workflow_name,
            (SELECT status FROM "AI_Agent".execution_logs WHERE execution_id = e.execution_id ORDER BY timestamp DESC LIMIT 1) as status
          FROM "AI_Agent".execution_logs e
          JOIN "AI_Agent".workflows w ON e.workflow_id = w.id
          GROUP BY e.execution_id, e.workflow_id, w.metadata->>'name'
          ORDER BY timestamp DESC`;
    
    const rows = await query;
    return rows.map(row => ({
      id: row.id,
      workflow_id: row.workflow_id,
      workflow_name: row.workflow_name || 'Unknown Workflow',
      status: row.status as any,
      timestamp: Number(row.timestamp),
      duration: row.duration ? Number(row.duration) : undefined
    }));
  },

  async getChatSessions(): Promise<ChatSession[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".chat_sessions ORDER BY timestamp DESC`;
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      model: r.model,
      timestamp: Number(r.timestamp)
    }));
  },

  async saveChatSession(session: ChatSession) {
    await sql`
      INSERT INTO "AI_Agent".chat_sessions (id, title, model, timestamp)
      VALUES (${session.id}::UUID, ${session.title}, ${session.model}, ${session.timestamp})
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        model = EXCLUDED.model,
        timestamp = EXCLUDED.timestamp
    `;
  },

  async deleteChatSession(id: string) {
    await sql`DELETE FROM "AI_Agent".chat_sessions WHERE id = ${id}::UUID`;
  },

  async getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    const rows = await sql`SELECT * FROM "AI_Agent".chat_messages WHERE session_id = ${sessionId}::UUID ORDER BY timestamp ASC`;
    return rows.map(r => ({
      id: r.id,
      session_id: r.session_id,
      role: r.role as any,
      content: r.content,
      timestamp: Number(r.timestamp)
    }));
  },

  async saveChatMessage(msg: ChatMessage) {
    await sql`
      INSERT INTO "AI_Agent".chat_messages (id, session_id, role, content, timestamp)
      VALUES (${msg.id}::UUID, ${msg.session_id}::UUID, ${msg.role}, ${msg.content}, ${msg.timestamp})
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content
    `;
  },

  async deleteMessagesAfter(sessionId: string, timestamp: number) {
    await sql`DELETE FROM "AI_Agent".chat_messages WHERE session_id = ${sessionId}::UUID AND timestamp >= ${timestamp}`;
  }
};
