import type { CommandDefinition } from "../command-registry";
export const spotifyPlayCommand: CommandDefinition = {
  name: "spotify.play", description: "Preparar reproduccion en Spotify", examples: ["pon musica", "pon Bad Bunny en Spotify"], patterns: [/\bpon musica\b/, /\breproduce\b.*\bspotify\b/, /\bpon\b.*\ben spotify\b/, /\bplaylist\b.*\bspotify\b/, /\bspotify\b.*\bplaylist\b/],
  requiredParams: [], optionalParams: ["query", "playlist", "artist", "mood"], riskLevel: "low", requiresConfirmation: false, supportedPlatforms: ["web", "windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: true, estimatedTokensSaved: 450
};
