import type { Repository } from "../../services/repositories";
import { HIGH_CONFIDENCE, MEDIUM_CONFIDENCE } from "./command-confidence";
import { executeCommandMatch } from "./command-executor";
import { matchCommand } from "./command-matcher";

const missingQuestion = (names: string[]) => {
  const labels: Record<string, string> = { time: "la hora", date: "la fecha", title: "el titulo", query: "que quieres buscar", contact_alias: "el contacto", message: "el mensaje", app_name: "la aplicacion" };
  return `Necesito ${names.map((name) => labels[name] ?? name).join(" y ")}.`;
};

const validTimezone = (value: string) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
};

export const routeCommand = async (repository: Repository, input: { userId: string; text: string; timezone?: string; now?: Date; preferredIntent?: string }) => {
  const requestedTimezone = input.timezone && validTimezone(input.timezone) ? input.timezone : undefined;
  if (requestedTimezone) await repository.setUserSetting(input.userId, "timezone", requestedTimezone);
  const timezone = requestedTimezone ?? await repository.getUserSetting(input.userId, "timezone") ?? "America/Santiago";
  if (!(await repository.getUserSetting(input.userId, "timezone"))) await repository.setUserSetting(input.userId, "timezone", timezone);
  const match = await matchCommand(repository, {
    userId: input.userId,
    text: input.text,
    timezone,
    ...(input.now ? { now: input.now } : {}),
    ...(input.preferredIntent ? { preferredIntent: input.preferredIntent } : {})
  });
  if (match.matched) match.params.timezone = timezone;

  if (!match.matched || !match.command || match.confidence < MEDIUM_CONFIDENCE) {
    await repository.createCommandUsage({ userId: input.userId, inputText: input.text, confidence: match.confidence, usedAiFallback: true, estimatedTokensSaved: 0, status: "ai_fallback" });
    return { kind: "fallback" as const, match };
  }
  if (match.missingParams.length > 0) {
    await repository.createCommandUsage({ userId: input.userId, commandName: match.command.name, inputText: input.text, ...(match.matchedPattern ? { matchedPattern: match.matchedPattern } : {}), confidence: match.confidence, usedAiFallback: false, estimatedTokensSaved: match.command.estimatedTokensSaved, status: "needs_clarification" });
    return { kind: "resolved" as const, result: { ok: true, status: "needs_clarification", response: missingQuestion(match.missingParams), command: match.command.name, matched: true, confidence: match.confidence, params: match.params, usedAiFallback: false, action: null } };
  }
  const result = await executeCommandMatch(repository, { userId: input.userId, match, forceConfirmation: match.confidence < HIGH_CONFIDENCE });
  await repository.createCommandUsage({ userId: input.userId, commandName: match.command.name, inputText: input.text, ...(match.matchedPattern ? { matchedPattern: match.matchedPattern } : {}), confidence: match.confidence, usedAiFallback: false, estimatedTokensSaved: match.command.estimatedTokensSaved, status: result.status });
  return { kind: "resolved" as const, result };
};
