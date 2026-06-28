import type { CommandDefinition } from "../command-registry";
export const alarmCancelCommand: CommandDefinition = {
  name: "alarm.cancel", description: "Cancelar una alarma local", examples: ["cancela la alarma de las 6:45"],
  patterns: [/\b(?:cancela|borra|quita) (?:mi |la )?alarma\b/], requiredParams: [], optionalParams: ["time", "date", "label"],
  riskLevel: "medium", requiresConfirmation: true, supportedPlatforms: ["windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: false, estimatedTokensSaved: 450
};
