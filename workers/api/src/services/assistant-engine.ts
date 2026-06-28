import type { RiskLevel } from "@xion-assistant/shared";
import { mustConfirm } from "@xion-assistant/shared";
import { synthesizeSpeech } from "@xion-assistant/voice";
import { prepareCommunication } from "./communication-router";
import type { Repository } from "./repositories";

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
  input: {
    userId: string;
    message: string;
    spokenResponse: boolean;
  }
) => {
  const aliasIntent = extractWifeAliasMessage(input.message);

  if (aliasIntent) {
    const prepared = await prepareCommunication(repository, {
      userId: input.userId,
      recipientQuery: aliasIntent.alias,
      message: aliasIntent.message
    });
    const fallbackMemory = prepared ? undefined : await repository.resolveMemory(input.userId, aliasIntent.alias);
    if (!prepared && !fallbackMemory) {
      return {
        ok: true,
        status: "needs_clarification",
        response: "No se quien es tu esposa todavia. Indica contacto y preguntare si debo recordarlo.",
        plan: null,
        audio: null
      };
    }

    const riskLevel = classifyRisk("communication.send_message");
    const recipient = prepared?.recipient ?? fallbackMemory?.value ?? aliasIntent.alias;
    const channel = prepared?.channel ?? "preferred";
    const response = `Le enviare a ${recipient} por ${channel}: "${aliasIntent.message}". Confirmas envio?`;
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
