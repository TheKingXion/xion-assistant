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

const pickText = (payload: unknown) => {
  const response = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
};

const safeJson = <T>(text: string, fallback: T): T => {
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
};

export class GoogleGeminiGateway implements AiGateway {
  constructor(private readonly config: AiGatewayConfig) {}

  private get model() {
    return this.config.model ?? "gemini-2.5-flash";
  }

  private async generate(prompt: string, options?: { json?: boolean; small?: boolean }) {
    if (!this.config.apiKey) throw new Error("google_ai_api_key_required");
    const model = options?.small ? (this.config.smallModel ?? this.model) : this.model;
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.config.apiKey },
      body: JSON.stringify({
        model,
        input: prompt,
        generation_config: {
          temperature: options?.json ? 0.1 : 0.7
        }
      })
    });
    if (!response.ok) throw new Error("google_ai_generate_failed");
    const payload = (await response.json()) as { output_text?: string };
    const text = payload.output_text?.trim() || pickText(payload);
    if (!text) throw new Error("google_ai_empty_response");
    return { text, model };
  }

  async generateText(input: { userId: string; prompt: string }) {
    const generated = await this.generate(`Responde en espanol chileno, breve y util.\n\nUsuario ${input.userId}:\n${input.prompt}`);
    return { text: generated.text, usage: usage({ ...this.config, model: generated.model }, input.prompt, generated.text) };
  }

  async classifyIntent(input: { userId: string; message: string }): Promise<IntentResult> {
    const fallback: Omit<IntentResult, "usage"> = {
      intent: "assistant.chat",
      riskLevel: "low",
      entities: {},
      requiresClarification: false
    };
    const prompt = `Clasifica este mensaje para Xion Assistant.
Devuelve JSON estricto:
{"intent":"assistant.chat|communication.send_message|calendar.create_event|spotify.play|spotify.pause|youtube.search|reminder.create|memory.create|voice.update_settings","riskLevel":"low|medium|high","entities":{"recipient":"","message":"","query":"","time":""},"requiresClarification":false}
Mensaje: ${input.message}`;
    const generated = await this.generate(prompt, { json: true, small: true });
    const parsed = safeJson<Omit<IntentResult, "usage">>(generated.text, fallback);
    return {
      intent: parsed.intent || fallback.intent,
      riskLevel: parsed.riskLevel || fallback.riskLevel,
      entities: parsed.entities ?? {},
      requiresClarification: Boolean(parsed.requiresClarification),
      usage: usage({ ...this.config, model: generated.model }, input.message, generated.text)
    };
  }

  async extractEntities(input: { userId: string; message: string }) {
    const prompt = `Extrae entidades del mensaje. Devuelve solo JSON plano con strings.
Campos utiles: recipient, message, query, time, date, app, voice.
Mensaje: ${input.message}`;
    const generated = await this.generate(prompt, { json: true, small: true });
    return {
      entities: safeJson<Record<string, string>>(generated.text, {}),
      usage: usage({ ...this.config, model: generated.model }, input.message, generated.text)
    };
  }

  async summarize(input: { userId: string; text: string }) {
    const generated = await this.generate(`Resume en maximo 3 frases:\n${input.text}`, { small: true });
    return { summary: generated.text, usage: usage({ ...this.config, model: generated.model }, input.text, generated.text) };
  }

  async createActionPlan(input: { userId: string; goal: string; riskLevel?: RiskLevel }) {
    const riskLevel = input.riskLevel ?? "low";
    const prompt = `Crea plan de accion para asistente personal. Devuelve JSON estricto compatible:
{"title":"","goal":"","riskLevel":"${riskLevel}","steps":[{"title":"","description":"","toolName":"","requiresConfirmation":false}]}
Reglas: si riesgo high, algun paso debe requerir confirmacion. Goal: ${input.goal}`;
    const generated = await this.generate(prompt, { json: true });
    const fallback = await new MockAiGateway({ ...this.config, model: generated.model }).createActionPlan(input);
    const plan = safeJson<AssistantPlan>(generated.text, fallback.plan);
    return { plan, usage: usage({ ...this.config, model: generated.model }, input.goal, generated.text) };
  }
}

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

export const createAiGateway = (config: AiGatewayConfig) => {
  if (config.provider === "google" && config.apiKey) return new GoogleGeminiGateway(config);
  return new MockAiGateway(config);
};
