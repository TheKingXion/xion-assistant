import type { RiskLevel } from "@xion-assistant/shared";
import { mustConfirm } from "@xion-assistant/shared";
import { synthesizeSpeechAsync } from "@xion-assistant/voice";
import type { AiGateway } from "./ai-gateway";
import { prepareCommunication } from "./communication-router";
import type { Repository } from "./repositories";
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

export const classifyRisk = (toolName: string): RiskLevel => {
  if (toolName.includes("send") || toolName.includes("delete") || toolName.includes("execute")) {
    return "high";
  }
  if (toolName.includes("create") || toolName.includes("update")) {
    return "medium";
  }
  return "low";
};

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

  const generated = await aiGateway.generateText({
    userId: input.userId,
    prompt: input.message
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
