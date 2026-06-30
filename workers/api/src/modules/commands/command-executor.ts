import { prepareCommunication } from "../../services/communication-router";
import type { Repository } from "../../services/repositories";
import type { CommandMatch } from "./command-matcher";

const youtubeSearchUrl = (query: unknown) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(String(query))}`;

const responseFor = (name: string, params: Record<string, unknown>) => {
  if (name === "alarm.create") return `Alarma preparada para ${String(params.time)}${params.repeat === "daily" ? " todos los dias" : ""}.`;
  if (name === "alarm.cancel") return "Alarma localizada. Confirma que quieres cancelarla.";
  if (name === "reminder.create") return `Recordatorio creado: ${String(params.title)}.`;
  if (name === "reminder.list") return "Consulta de recordatorios preparada.";
  if (name === "app.open") return `Orden local preparada para abrir ${String(params.app_name)}.`;
  if (name === "spotify.play") return "Reproduccion de Spotify preparada.";
  if (name === "spotify.pause") return "Pausa de Spotify preparada.";
  if (name === "youtube.search") return `Link de YouTube para "${String(params.query)}": ${youtubeSearchUrl(params.query)}`;
  if (name === "system.check_updates") return "Consulta de actualizaciones preparada.";
  if (name === "calendar.quick_create") return "Evento preparado. Confirma antes de crearlo.";
  return "Comando preparado.";
};

export const executeCommandMatch = async (repository: Repository, input: { userId: string; match: CommandMatch; forceConfirmation?: boolean }) => {
  const command = input.match.command!;
  const params = { ...input.match.params };
  let toolName = command.name;
  let requiresConfirmation = command.requiresConfirmation || Boolean(input.forceConfirmation);

  if (command.name === "reminder.create") {
    const date = params.date ? String(params.date) : undefined;
    const time = params.time ? String(params.time) : undefined;
    const dueAt = date && time ? `${date}T${time}:00` : date ?? time;
    const reminder = await repository.createReminder({ userId: input.userId, title: String(params.title), ...(dueAt ? { dueAt } : {}) });
    params.reminderId = reminder.id;
  }
  if (command.name === "reminder.list") {
    params.reminders = await repository.listReminders(input.userId);
  }
  if (command.name === "youtube.search" && params.query) {
    params.url = youtubeSearchUrl(params.query);
  }

  if (command.name === "alarm.create" && params.repeat === "daily") requiresConfirmation = true;

  if (command.name === "communication.prepare_message") {
    const alias = String(params.contact_alias);
    const prepared = await prepareCommunication(repository, { userId: input.userId, recipientQuery: alias, message: String(params.message), ...(params.channel ? { channel: String(params.channel) } : {}) });
    const memory = prepared ? undefined : await repository.resolveMemory(input.userId, alias);
    if (!prepared && !memory) {
      return { ok: true, status: "needs_clarification", response: `No se quien es ${alias}. Indica el contacto antes de preparar el mensaje.`, command: command.name, matched: true, confidence: input.match.confidence, params, action: null };
    }
    toolName = "communication.send_message";
    requiresConfirmation = true;
    params.recipient = prepared?.recipient ?? memory?.value ?? alias;
    params.contactId = prepared?.contactId;
    params.channel = prepared?.channel ?? params.channel ?? "preferred";
    params.address = prepared?.address;
  }

  const action = await repository.createAction({
    userId: input.userId,
    toolName,
    riskLevel: command.riskLevel,
    status: requiresConfirmation ? "pending_confirmation" : "completed",
    inputJson: JSON.stringify(params),
    ...(!requiresConfirmation ? { resultJson: JSON.stringify({ execution: command.canExecuteCloud ? "command_resolved" : "local_instruction", params }) } : {})
  });
  const savedPlan = await repository.createPlanWithSteps(
    {
      userId: input.userId,
      status: action.status,
      title: `Comando optimizado: ${command.name}`,
      goal: responseFor(command.name, params),
      riskLevel: command.riskLevel
    },
    [{
      orderIndex: 1,
      title: command.description,
      toolName,
      status: action.status,
      requiresConfirmation,
      ...(action.resultJson ? { resultJson: action.resultJson } : {})
    }]
  );

  const response = command.name === "communication.prepare_message"
    ? `Mensaje preparado para ${String(params.recipient)} por ${String(params.channel)}: "${String(params.message)}". Confirma el envio.`
    : responseFor(command.name, params);
  return {
    ok: true,
    status: requiresConfirmation ? "pending_confirmation" : "completed",
    response,
    command: command.name,
    matched: true,
    confidence: input.match.confidence,
    params,
    usedAiFallback: false,
    action: { id: action.id, toolName: action.toolName, riskLevel: action.riskLevel, status: action.status },
    plan: { id: savedPlan.plan.id, title: savedPlan.plan.title, riskLevel: savedPlan.plan.riskLevel, steps: savedPlan.steps.map((step) => ({ id: step.id, order: step.orderIndex, title: step.title, status: step.status, requiresConfirmation: step.requiresConfirmation })) }
  };
};
