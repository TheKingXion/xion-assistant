import type { RiskLevel } from "@xion-assistant/shared";
import { mustConfirm } from "@xion-assistant/shared";
import { synthesizeSpeechAsync } from "@xion-assistant/voice";
import type { AiGateway } from "./ai-gateway";
import { prepareCommunication } from "./communication-router";
import type { Repository } from "./repositories";
import type { AssistantMessageRecord, MemoryRecord } from "../types";
import { routeCommand } from "../modules/commands/command-router";

const extractWifeAliasMessage = (message: string) => {
  const normalized = message.toLowerCase();
  if (!normalized.includes("mi esposa")) return null;
  const [, afterSaying] = message.split(/diciendo que|que/i);
  return {
    alias: "mi esposa",
    message: afterSaying?.trim() || "te amo"
  };
};

const memoryInstructionPatterns = [
  /^(?:recuerda|aprende|guarda|memoriza)(?:\s+(?:que|esto|este dato(?: de la conversacion)?))?\s*[:,-]?\s+(.+)$/i,
  /^(?:quiero que recuerdes|quiero que aprendas|necesito que recuerdes)\s+(?:que\s+)?(.+)$/i
];

const extractMemoryInstruction = (message: string) => {
  const text = message.replace(/\s+/g, " ").trim();
  const fact = memoryInstructionPatterns.map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean);
  if (!fact || fact.length < 4) return null;
  const split = fact.match(/^(.+?)\s+(?:es|son|se llama|se llaman|se reinicia|se reinician|queda|quedan|esta|estan)\s+(.+)$/i);
  if (split?.[1] && split[2]) {
    return {
      key: compactText(split[1].trim(), 80),
      value: compactText(fact, 240)
    };
  }
  return {
    key: compactText(fact, 80),
    value: compactText(fact, 240)
  };
};

export const classifyRisk = (toolName: string): RiskLevel => {
  if (toolName.includes("send") || toolName.includes("delete") || toolName.includes("execute")) {
    return "high";
  }
  if (toolName.includes("create") || toolName.includes("update")) {
    return "medium";
  }
  return "low";
};

const compactText = (value: string, maxLength = 220) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trim()}...` : normalized;
};

const memoryKeyForMessage = (message: string) => compactText(message.toLowerCase(), 90);

const termsFor = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2 && !["que", "con", "para", "por", "las", "los", "una", "uno", "del", "como", "cuando"].includes(term))
  );

const persistConversationMemory = async (repository: Repository, userId: string, message: string) => {
  const value = compactText(message, 360);
  if (value.length < 4) return;
  const key = memoryKeyForMessage(value);
  const existing = await repository.resolveMemory(userId, key);
  if (existing) {
    await repository.updateMemory(userId, existing.id, { value, confirmed: true, confidence: 0.8 });
    return;
  }
  await repository.createMemory({
    userId,
    memoryType: "conversation_note",
    key,
    value,
    confirmed: true,
    confidence: 0.8
  });
};

const selectRelevantMemories = (memories: MemoryRecord[], message: string) => {
  const queryTerms = termsFor(message);
  const scored = memories.map((memory) => {
    const memoryTerms = termsFor(`${memory.key} ${memory.value}`);
    let score = memory.confirmed ? 2 : 0;
    for (const term of queryTerms) if (memoryTerms.has(term)) score += 3;
    score += memory.confidence;
    return { memory, score };
  });
  return scored
    .sort((a, b) => b.score - a.score || b.memory.createdAt.localeCompare(a.memory.createdAt))
    .filter((item, index) => item.score > 2 || index < 4)
    .slice(0, 12)
    .map((item) => item.memory);
};

const formatHistory = (messages: AssistantMessageRecord[]) => {
  const ordered = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-6);
  if (ordered.length === 0) return "Sin historial.";
  return ordered.map((message) => `${message.role}: ${compactText(message.content)}`).join("\n");
};

const formatMemories = (memories: MemoryRecord[]) => {
  if (memories.length === 0) return "Sin memorias.";
  return memories.map((memory) => `- ${compactText(memory.key, 60)}: ${compactText(memory.value, 150)}`).join("\n");
};

export const buildAssistantContextPrompt = (input: {
  message: string;
  history: AssistantMessageRecord[];
  memories: MemoryRecord[];
  timezone?: string;
}) => `Contexto:
TZ: ${input.timezone ?? "desconocida"}

Memorias:
${formatMemories(input.memories)}

Historial:
${formatHistory(input.history)}

Usuario:
${input.message}

Responde al mensaje actual.`;

export const handleAssistantMessage = async (
  repository: Repository,
  aiGateway: AiGateway,
  input: {
    userId: string;
    message: string;
    spokenResponse: boolean;
    platform?: "web" | "windows" | "android" | "ios" | "unknown";
    timezone?: string;
    voice?: {
      provider?: string | undefined;
      apiKey?: string | undefined;
      model?: string | undefined;
      defaultVoice?: string;
      defaultLanguage?: string;
      defaultSpeed?: number;
    };
  }
) => {
  const speak = (text: string) =>
    synthesizeSpeechAsync({
      text,
      userId: input.userId,
      voiceId: input.voice?.defaultVoice ?? "xion_voice_1",
      language: input.voice?.defaultLanguage ?? "es-CL",
      speed: input.voice?.defaultSpeed ?? 1,
      provider: input.voice?.provider,
      apiKey: input.voice?.apiKey,
      model: input.voice?.model
    });
  const safeSpeak = async (text: string) => {
    if (!input.spokenResponse) return null;
    try {
      return await speak(text);
    } catch {
      return null;
    }
  };
  await repository.createAssistantMessage({
    userId: input.userId,
    role: "user",
    content: input.message
  });
  await persistConversationMemory(repository, input.userId, input.message);

  const memoryInstruction = extractMemoryInstruction(input.message);
  if (memoryInstruction) {
    const existing = await repository.resolveMemory(input.userId, memoryInstruction.key);
    if (existing) {
      await repository.updateMemory(input.userId, existing.id, {
        value: memoryInstruction.value,
        confirmed: true,
        confidence: 1
      });
    } else {
      await repository.createMemory({
        userId: input.userId,
        memoryType: "user_fact",
        key: memoryInstruction.key,
        value: memoryInstruction.value,
        confirmed: true,
        confidence: 1
      });
    }
    const response = `Lo recuerdo: ${memoryInstruction.value}.`;
    await repository.createAssistantMessage({
      userId: input.userId,
      role: "assistant",
      content: response
    });
    return {
      ok: true,
      status: "completed",
      response,
      plan: null,
      audio: await safeSpeak(response)
    };
  }

  const routed = await routeCommand(repository, {
    userId: input.userId,
    text: input.message,
    ...(input.timezone ? { timezone: input.timezone } : {})
  });
  if (routed.kind === "resolved") {
    await repository.createAssistantMessage({
      userId: input.userId,
      role: "assistant",
      content: routed.result.response
    });
    return {
      ...routed.result,
      audio: await safeSpeak(routed.result.response)
    };
  }

  const aliasIntent = extractWifeAliasMessage(input.message);

  if (aliasIntent) {
    const prepared = await prepareCommunication(repository, {
      userId: input.userId,
      recipientQuery: aliasIntent.alias,
      message: aliasIntent.message
    });
    const fallbackMemory = prepared ? undefined : await repository.resolveMemory(input.userId, aliasIntent.alias);
    if (!prepared && !fallbackMemory) {
      const response = "No se quien es tu esposa todavia. Indica contacto y preguntare si debo recordarlo.";
      await repository.createAssistantMessage({
        userId: input.userId,
        role: "assistant",
        content: response
      });
      return {
        ok: true,
        status: "needs_clarification",
        response,
        plan: null,
        audio: null
      };
    }

    const riskLevel: RiskLevel = "high";
    const recipient = prepared?.recipient ?? fallbackMemory?.value ?? aliasIntent.alias;
    const channel = prepared?.channel ?? "preferred";
    const response = `Le enviare a ${recipient} por ${channel}: "${aliasIntent.message}". Confirmas envio?`;
    await repository.createAssistantMessage({
      userId: input.userId,
      role: "assistant",
      content: response
    });
    const action = await repository.createAction({
      userId: input.userId,
      toolName: "communication.send_message",
      riskLevel,
      status: "pending_confirmation",
      inputJson: JSON.stringify({
        recipient,
        contactId: prepared?.contactId,
        message: aliasIntent.message,
        channel,
        address: prepared?.address
      })
    });
    const savedPlan = await repository.createPlanWithSteps(
      {
        userId: input.userId,
        status: "pending_confirmation",
        title: "Enviar mensaje con confirmacion",
        goal: `Enviar mensaje a ${recipient}`,
        riskLevel
      },
      [
        {
          orderIndex: 1,
          title: "Resolver destinatario",
          description: `Alias ${aliasIntent.alias} resuelto a ${recipient}`,
          toolName: prepared ? "communication.resolve_contact" : "memory.resolve",
          status: "completed",
          requiresConfirmation: false,
          resultJson: JSON.stringify({ contact: recipient, channel })
        },
        {
          orderIndex: 2,
          title: "Preparar mensaje",
          description: aliasIntent.message,
          toolName: "communication.send_message",
          status: "pending_confirmation",
          requiresConfirmation: mustConfirm(riskLevel)
        }
      ]
    );
    return {
      ok: true,
      status: "pending_confirmation",
      response,
      action: {
        id: action.id,
        toolName: "communication.send_message",
        riskLevel,
        status: "pending_confirmation"
      },
      plan: {
        id: savedPlan.plan.id,
        title: "Enviar mensaje con confirmacion",
        riskLevel,
        steps: savedPlan.steps.map((step) => ({
          id: step.id,
          order: step.orderIndex,
          title: step.title,
          status: step.status,
          requiresConfirmation: step.requiresConfirmation
        }))
      },
      audio: await safeSpeak(response)
    };
  }

  const [history, memories] = await Promise.all([
    repository.listAssistantMessages(input.userId, 6),
    repository.listMemoriesForUser(input.userId)
  ]);
  const contextInput: Parameters<typeof buildAssistantContextPrompt>[0] = {
    message: input.message,
    history,
    memories: selectRelevantMemories(memories, input.message)
  };
  if (input.timezone) contextInput.timezone = input.timezone;
  const generated = await aiGateway.generateText({
    userId: input.userId,
    prompt: buildAssistantContextPrompt(contextInput)
  });
  const response = generated.text;
  await repository.createAssistantMessage({
    userId: input.userId,
    role: "assistant",
    content: response
  });
  return {
    ok: true,
    status: "completed",
    response,
    plan: null,
    audio: await safeSpeak(response)
  };
};
