import type { Repository } from "../../services/repositories";
import { calculateCommandConfidence } from "./command-confidence";
import { extractCommandParams } from "./command-extractor";
import { commandRegistry, getCommandDefinition, type CommandDefinition, type CommandParams } from "./command-registry";
import { normalizeCommandText } from "./command-normalizer";

export type CommandMatch = {
  matched: boolean;
  command?: CommandDefinition;
  confidence: number;
  params: CommandParams;
  missingParams: string[];
  source?: "shortcut" | "system";
  matchedPattern?: string;
};

export const matchCommand = async (repository: Repository, input: { userId: string; text: string; timezone: string; now?: Date }): Promise<CommandMatch> => {
  const normalized = normalizeCommandText(input.text);
  const shortcuts = await repository.listCommandShortcuts(input.userId);
  const shortcut = shortcuts.find((item) => item.confirmed && item.isActive && normalized.includes(normalizeCommandText(item.shortcut)));
  if (shortcut) {
    const command = getCommandDefinition(shortcut.intent);
    if (command) {
      const extracted = extractCommandParams(command.name, normalized, input.timezone, input.now);
      let savedParams: CommandParams = {};
      try { savedParams = JSON.parse(shortcut.paramsJson) as CommandParams; } catch { savedParams = {}; }
      const params = { ...extracted, ...savedParams };
      const missingParams = command.requiredParams.filter((name) => params[name] === undefined || params[name] === "");
      return { matched: true, command, confidence: calculateCommandConfidence({ patternMatched: true, requiredParams: command.requiredParams, params, shortcutConfidence: shortcut.confidence }), params, missingParams, source: "shortcut", matchedPattern: shortcut.shortcut };
    }
  }
  for (const command of commandRegistry) {
    const pattern = command.patterns.find((candidate) => candidate.test(normalized));
    if (!pattern) continue;
    const params = extractCommandParams(command.name, normalized, input.timezone, input.now);
    const missingParams = command.requiredParams.filter((name) => params[name] === undefined || params[name] === "");
    return { matched: true, command, confidence: calculateCommandConfidence({ patternMatched: true, requiredParams: command.requiredParams, params }), params, missingParams, source: "system", matchedPattern: pattern.source };
  }
  return { matched: false, confidence: 0, params: {}, missingParams: [] };
};
