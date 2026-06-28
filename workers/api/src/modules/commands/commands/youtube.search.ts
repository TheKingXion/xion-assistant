import type { CommandDefinition } from "../command-registry";
export const youtubeSearchCommand: CommandDefinition = {
  name: "youtube.search", description: "Buscar videos en YouTube", examples: ["busca tutoriales de React en YouTube"], patterns: [/\b(?:busca|buscame)\b.*\byoutube\b/, /\babre youtube y busca\b/, /\bbuscame videos? de\b/],
  requiredParams: ["query"], optionalParams: [], riskLevel: "low", requiresConfirmation: false, supportedPlatforms: ["web", "windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: true, estimatedTokensSaved: 400
};
