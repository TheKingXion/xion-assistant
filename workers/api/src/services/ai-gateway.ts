import type { AiGatewayUsage, AssistantPlan, RiskLevel } from "@xion-assistant/shared";

export type AiGatewayConfig = {
  provider?: string;
  apiKey?: string;
  model?: string;
  smallModel?: string;
};

export type IntentResult = {
  intent: string;
  riskLevel: RiskLevel;
  entities: Record<string, string>;
  requiresClarification: boolean;
  usage: AiGatewayUsage;
};

export type AiGateway = {
  generateText(input: { userId: string; prompt: string }): Promise<{ text: string; usage: AiGatewayUsage }>;
  classifyIntent(input: { userId: string; message: string }): Promise<IntentResult>;
  extractEntities(input: { userId: string; message: string }): Promise<{ entities: Record<string, string>; usage: AiGatewayUsage }>;
  summarize(input: { userId: string; text: string }): Promise<{ summary: string; usage: AiGatewayUsage }>;
  createActionPlan(input: { userId: string; goal: string; riskLevel?: RiskLevel }): Promise<{ plan: AssistantPlan; usage: AiGatewayUsage }>;
};

const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

const usage = (config: AiGatewayConfig, input: string, output: string): AiGatewayUsage => ({
  provider: config.provider ?? "mock",
  model: config.model ?? "mock-assistant",
  tokensInput: estimateTokens(input),
  tokensOutput: estimateTokens(output),
  estimatedCostUsd: 0
});

export class MockAiGateway implements AiGateway {
  constructor(private readonly config: AiGatewayConfig = {}) {}

  async generateText(input: { userId: string; prompt: string }) {
    const text = `Respuesta mock para ${input.userId}: ${input.prompt}`;
    return { text, usage: usage(this.config, input.prompt, text) };
  }

  async classifyIntent(input: { userId: string; message: string }): Promise<IntentResult> {
    const normalized = input.message.toLowerCase();
    const intent = normalized.includes("mandale") || normalized.includes("envia")
      ? "communication.send_message"
      : "assistant.chat";
    const riskLevel: RiskLevel = intent === "communication.send_message" ? "high" : "low";
    const entities = await this.extractEntities(input);
    return {
      intent,
      riskLevel,
      entities: entities.entities,
      requiresClarification: intent === "communication.send_message" && !entities.entities.recipient,
      usage: usage(this.config, input.message, intent)
    };
  }

  async extractEntities(input: { userId: string; message: string }) {
    const recipient = input.message.toLowerCase().includes("mi esposa") ? "mi esposa" : "";
    const [, afterSaying] = input.message.split(/diciendo que|que/i);
    const entities: Record<string, string> = {};
    if (recipient) entities.recipient = recipient;
    if (afterSaying?.trim()) entities.message = afterSaying.trim();
    return { entities, usage: usage(this.config, input.message, JSON.stringify(entities)) };
  }

  async summarize(input: { userId: string; text: string }) {
    const summary = input.text.length > 120 ? `${input.text.slice(0, 117)}...` : input.text;
    return { summary, usage: usage(this.config, input.text, summary) };
  }

  async createActionPlan(input: { userId: string; goal: string; riskLevel?: RiskLevel }) {
    const riskLevel = input.riskLevel ?? "low";
    const plan: AssistantPlan = {
      title: riskLevel === "high" ? "Plan con confirmacion requerida" : "Plan del asistente",
      goal: input.goal,
      riskLevel,
      steps: [
        {
          title: "Interpretar solicitud",
          description: "Clasificar intencion y extraer entidades",
          toolName: "assistant.classify_intent",
          requiresConfirmation: false
        },
        {
          title: riskLevel === "high" ? "Solicitar confirmacion" : "Ejecutar respuesta segura",
          description: riskLevel === "high" ? "No ejecutar hasta confirmacion explicita" : "Responder sin accion sensible",
          toolName: riskLevel === "high" ? "assistant.request_confirmation" : "assistant.generate_response",
          requiresConfirmation: riskLevel === "high"
        }
      ]
    };
    return { plan, usage: usage(this.config, input.goal, JSON.stringify(plan)) };
  }
}

export const createAiGateway = (config: AiGatewayConfig) => new MockAiGateway(config);
