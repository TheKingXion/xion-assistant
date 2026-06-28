import type { CommandDefinition } from "../command-registry";
export const calendarQuickCreateCommand: CommandDefinition = {
  name: "calendar.quick_create", description: "Crear evento simple de calendario", examples: ["crea evento reunion manana a las 10"], patterns: [/\b(?:crea|agenda) (?:un )?(?:evento|reunion|cita)\b/],
  requiredParams: ["title", "date", "time"], optionalParams: ["duration"], riskLevel: "medium", requiresConfirmation: true, supportedPlatforms: ["web", "windows", "android", "ios", "unknown"], canExecuteLocally: false, canExecuteCloud: true, estimatedTokensSaved: 550
};
