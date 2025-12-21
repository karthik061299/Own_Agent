
import { GoogleGenAI } from "@google/genai";
import { AgentConfig, GeminiModel } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable is not defined");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generate(
    model: string,
    systemInstruction: string,
    prompt: string,
    config: Partial<AgentConfig>
  ) {
    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: config.temperature,
          topP: config.topP,
          maxOutputTokens: config.maxTokens,
          // thinkingConfig is only for Gemini 3 and 2.5
          // We can conditionally add it if model supports it
          ...(model.startsWith('gemini-3') || model.startsWith('gemini-2.5') 
            ? { thinkingConfig: { thinkingBudget: 0 } } 
            : {})
        }
      });
      return response.text || "No response received.";
    } catch (error: any) {
      console.error("Gemini Generation Error:", error);
      throw new Error(error.message || "Failed to generate content");
    }
  }

  async orchestrate(
    managerModel: string,
    taskDescription: string,
    agentContexts: string[],
    userInput: string
  ) {
    const systemInstruction = `You are a Workflow Manager. Your job is to coordinate multiple agents to solve a task. 
    Current task: ${taskDescription}.
    Available context from previous steps: ${agentContexts.join('\n')}`;

    const prompt = `Based on the user input: "${userInput}", summarize the findings or determine if more steps are needed. Provide a final comprehensive output.`;

    return this.generate(managerModel, systemInstruction, prompt, { temperature: 0.3, maxTokens: 4096 });
  }
}

export const geminiService = new GeminiService();
