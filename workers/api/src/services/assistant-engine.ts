import type { RiskLevel } from "@xion-assistant/shared";
import { mustConfirm } from "@xion-assistant/shared";
import { synthesizeSpeech } from "@xion-assistant/voice";
import { repository } from "./repositories";

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

export const handleAssistantMessage = (input: {
  userId: string;
  message: string;
  spokenResponse: boolean;
}) => {
  const aliasIntent = extractWifeAliasMessage(input.message);
  const planSteps = [];

  if (aliasIntent) {
    const memory = repository.resolveMemory(input.userId, aliasIntent.alias);
    if (!memory) {
      return {
        ok: true,
        status: "needs_clarification",
        response: "No se quien es tu esposa todavia. Indica contacto y preguntare si debo recordarlo.",
        plan: null,
        audio: null
      };
    }

    const riskLevel = classifyRisk("communication.send_message");
    planSteps.push({
      order: 1,
      title: "Resolver destinatario",
      status: "completed",
      result: memory.value
    });
    planSteps.push({
      order: 2,
      title: "Preparar mensaje",
      status: "pending_confirmation",
      requiresConfirmation: mustConfirm(riskLevel)
    });

    const response = `Le enviare a ${memory.value}: "${aliasIntent.message}". Confirmas envio?`;
    return {
      ok: true,
      status: "pending_confirmation",
      response,
      action: {
        toolName: "communication.send_message",
        riskLevel,
        status: "pending_confirmation"
      },
      plan: {
        title: "Enviar mensaje con confirmacion",
        riskLevel,
        steps: planSteps
      },
      audio: input.spokenResponse
        ? synthesizeSpeech({
            text: response,
            userId: input.userId,
            voiceId: "xion_voice_1",
            language: "es-CL",
            speed: 1
          })
        : null
    };
  }

  const response = "Xion Assistant base activo. Puedo gestionar memoria, voz, planes y updates.";
  return {
    ok: true,
    status: "completed",
    response,
    plan: {
      title: "Responder consulta simple",
      riskLevel: "low",
      steps: [{ order: 1, title: "Generar respuesta", status: "completed" }]
    },
    audio: input.spokenResponse
      ? synthesizeSpeech({
          text: response,
          userId: input.userId,
          voiceId: "xion_voice_1",
          language: "es-CL",
          speed: 1
        })
      : null
  };
};
