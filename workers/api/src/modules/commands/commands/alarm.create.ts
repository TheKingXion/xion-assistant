import type { CommandDefinition } from "../command-registry";
export const alarmCreateCommand: CommandDefinition = {
  name: "alarm.create", description: "Crear una alarma local", examples: ["pon una alarma a las 6:45", "despiertame a las 7"],
  patterns: [/\b(?:pon|activa|crea) (?:una )?alarma\b/, /\bdespiertame\b/], requiredParams: ["time"], optionalParams: ["date", "repeat", "label"],
  riskLevel: "medium", requiresConfirmation: false, supportedPlatforms: ["windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: false, estimatedTokensSaved: 500
};
