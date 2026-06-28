import type { CommandDefinition } from "../command-registry";
export const systemCheckUpdatesCommand: CommandDefinition = {
  name: "system.check_updates", description: "Consultar actualizaciones disponibles", examples: ["hay nueva version?"], patterns: [/\b(?:revisa|comprueba) si hay actualizacion\b/, /\bhay (?:una )?nueva version\b/, /\bactualiza la app\b/],
  requiredParams: [], optionalParams: ["platform", "channel"], riskLevel: "low", requiresConfirmation: false, supportedPlatforms: ["web", "windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: true, estimatedTokensSaved: 300
};
