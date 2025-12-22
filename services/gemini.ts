
import { GoogleGenAI } from "@google/genai";
import { AgentConfig, GeminiModel } from "../types";
import { dbService } from "./db";

export class GeminiService {
  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable is not defined");
    }
  }

  async generate(
    model: string,
    systemInstruction: string,
    prompt: string,
    config: Partial<AgentConfig>,
    responseMimeType?: "application/json" | "text/plain"
  ) {
    try {
      const allModels = await dbService.getModels();
      const modelInfo = allModels.find(m => m.id === model);
      const maxTokens = modelInfo?.max_tokens || 2048;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: config.temperature,
          topP: config.topP,
          maxOutputTokens: maxTokens,
          responseMimeType: responseMimeType,
          ...(model.startsWith('gemini-3') || model.startsWith('gemini-2.5') 
            ? { thinkingConfig: { thinkingBudget: 1024 } } 
            : {})
        }
      });
      return response.text || "No response received.";
    } catch (error: any) {
      console.error("Gemini Generation Error:", error);
      throw new Error(error.message || "Failed to generate content");
    }
  }

  async routeNextStep(
    managerModel: string,
    managerTemp: number,
    managerTopP: number,
    workflowDesc: string,
    nodesJson: string,
    edgesJson: string,
    executionHistory: string,
    lastOutput: string
  ): Promise<{ nextNodeId: string | null; finalSummary?: string; terminationReason?: string }> {
    const systemInstruction = `You are a Workflow Orchestrator. 
    Workflow Objective: ${workflowDesc}
    
    Graph Structure:
    Nodes: ${nodesJson}
    Edges: ${edgesJson}
    
    Current Execution History:
    ${executionHistory}
    
    Your Task:
    Analyze the progress and the last agent's output. 
    Determine which Node ID should execute next based on the graph edges OR if the process should terminate.
    In circular loops (A->B->A), evaluate if the goal is met (e.g., code is fixed, accuracy 100%) to stop the loop.
    
    Respond STRICTLY in JSON format. Do not include any conversation or explanation outside the JSON object.
    {
      "nextNodeId": "string or null",
      "finalSummary": "string describing final result if terminating",
      "terminationReason": "string describing why it stopped"
    }`;

    const prompt = `Last Agent Output: "${lastOutput}". Determine the next step.`;

    const result = await this.generate(
      managerModel, 
      systemInstruction, 
      prompt, 
      { temperature: managerTemp, topP: managerTopP },
      "application/json"
    );

    try {
      const jsonStart = result.indexOf('{');
      const jsonEnd = result.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON object found in response");
      const cleanJson = result.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Manager Routing Parsing Error. Raw Result:", result);
      return { 
        nextNodeId: null, 
        finalSummary: result,
        terminationReason: "Parsing error in manager response"
      };
    }
  }
}

export const geminiService = new GeminiService();
