import type { CommandDefinition } from "../command-registry";
export const appOpenCommand: CommandDefinition = {
  name: "app.open", description: "Abrir una aplicacion en el dispositivo", examples: ["abre Spotify", "abre Discord"], patterns: [/\babre (?!youtube y busca)(?:la aplicacion |la app )?\w+/],
  requiredParams: ["app_name"], optionalParams: [], riskLevel: "low", requiresConfirmation: false, supportedPlatforms: ["windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: false, estimatedTokensSaved: 350
};
