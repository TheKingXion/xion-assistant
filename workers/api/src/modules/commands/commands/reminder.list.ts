import type { CommandDefinition } from "../command-registry";
export const reminderListCommand: CommandDefinition = {
  name: "reminder.list", description: "Listar recordatorios", examples: ["muestra mis recordatorios"],
  patterns: [/\b(?:muestra|lista|revisa) (?:mis |los )?recordatorios\b/], requiredParams: [], optionalParams: [], riskLevel: "low", requiresConfirmation: false,
  supportedPlatforms: ["web", "windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: true, estimatedTokensSaved: 350
};
