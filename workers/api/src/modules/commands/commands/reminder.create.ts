import type { CommandDefinition } from "../command-registry";
export const reminderCreateCommand: CommandDefinition = {
  name: "reminder.create", description: "Crear un recordatorio", examples: ["recuerdame tomar agua a las 3"],
  patterns: [/\brecuerdame(?:lo)?\b/, /\bcrea (?:un )?recordatorio\b/], requiredParams: ["title"], optionalParams: ["date", "time"],
  riskLevel: "low", requiresConfirmation: false, supportedPlatforms: ["web", "windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: true, estimatedTokensSaved: 500
};
