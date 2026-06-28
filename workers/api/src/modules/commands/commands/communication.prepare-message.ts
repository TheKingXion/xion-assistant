import type { CommandDefinition } from "../command-registry";
export const communicationPrepareMessageCommand: CommandDefinition = {
  name: "communication.prepare_message", description: "Preparar mensaje sin enviarlo", examples: ["dile a Pedro que voy tarde"], patterns: [/\b(?:mandale|dile|envia(?:le)?)(?: un mensaje)? a\b/],
  requiredParams: ["contact_alias", "message"], optionalParams: ["channel"], riskLevel: "high", requiresConfirmation: true, supportedPlatforms: ["web", "windows", "android", "ios", "unknown"], canExecuteLocally: true, canExecuteCloud: true, estimatedTokensSaved: 600
};
