import type { ToolDefinition } from "@xion-assistant/shared";

export const tools: ToolDefinition[] = [
  {
    name: "assistant.classify_intent",
    description: "Classify user intent and risk level.",
    requiredScopes: [],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
  {
    name: "assistant.create_plan",
    description: "Create an assistant action plan before execution.",
    requiredScopes: [],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
  {
    name: "communication.resolve_contact",
    description: "Resolve recipient by user-owned contact, alias and preferred channel.",
    requiredScopes: [],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
  {
    name: "communication.send_message",
    description: "Send or hand off a prepared message through a supported connector.",
    requiredScopes: ["communication:send"],
    requiresAuth: true,
    requiresConfirmation: true,
    riskLevel: "high"
  },
  {
    name: "memory.create",
    description: "Create confirmed user memory.",
    requiredScopes: [],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "medium"
  },
  {
    name: "memory.delete",
    description: "Delete or deactivate user memory.",
    requiredScopes: [],
    requiresAuth: true,
    requiresConfirmation: true,
    riskLevel: "high"
  },
  {
    name: "voice.list_voices",
    description: "List available assistant voices.",
    requiredScopes: [],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
  {
    name: "voice.speak",
    description: "Generate assistant spoken response through TTS gateway.",
    requiredScopes: [],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
  {
    name: "system.check_updates",
    description: "Check latest app update manifest.",
    requiredScopes: [],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  }
];

export const listTools = () => tools;
export const getTool = (name: string) => tools.find((tool) => tool.name === name);
