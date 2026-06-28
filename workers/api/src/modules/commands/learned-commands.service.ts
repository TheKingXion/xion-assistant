import type { Repository } from "../../services/repositories";
import { normalizeCommandText } from "./command-normalizer";

export const learnCommandShortcut = async (repository: Repository, input: { userId: string; sourceText: string; shortcut: string; intent: string; params: Record<string, unknown>; confirmed: boolean }) => {
  const shortcut = normalizeCommandText(input.shortcut);
  const learning = await repository.createCommandLearning({ userId: input.userId, sourceText: input.sourceText, suggestedShortcut: shortcut, intent: input.intent, paramsJson: JSON.stringify(input.params), confirmed: input.confirmed });
  if (!input.confirmed) return { learning };
  const saved = await repository.createCommandShortcut({ userId: input.userId, shortcut, intent: input.intent, paramsJson: JSON.stringify(input.params), confidence: 1, confirmed: true, isActive: true });
  return { learning, shortcut: saved };
};
