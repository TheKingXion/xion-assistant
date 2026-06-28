import type { CommandDefinition } from "../command-registry";
export const spotifyPauseCommand: CommandDefinition = {
  name: "spotify.pause", description: "Pausar Spotify", examples: ["pausa la musica"], patterns: [/\bpausa (?:la )?(?:musica|reproduccion|spotify)\b/], requiredParams: [], optionalParams: [],
  riskLevel: "low", requiresConfirmation: false, supportedPlatforms: ["web", "windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: true, estimatedTokensSaved: 350
};
