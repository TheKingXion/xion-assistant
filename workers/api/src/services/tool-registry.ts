import type { ToolDefinition } from "@xion-assistant/shared";

export const tools: ToolDefinition[] = [
  {
    name: "calendar.list_events",
    description: "List Google Calendar events for the connected user.",
    requiredScopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
  {
    name: "calendar.create_event",
    description: "Create a Google Calendar event after explicit confirmation.",
    requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
    requiresAuth: true,
    requiresConfirmation: true,
    riskLevel: "medium"
  },
  {
    name: "spotify.get_playback",
    description: "Read current Spotify playback state for the connected user.",
    requiredScopes: ["user-read-playback-state"],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
  {
    name: "spotify.play",
    description: "Start Spotify playback after explicit confirmation.",
    requiredScopes: ["user-modify-playback-state"],
    requiresAuth: true,
    requiresConfirmation: true,
    riskLevel: "medium"
  },
  {
    name: "spotify.pause",
    description: "Pause Spotify playback after explicit confirmation.",
    requiredScopes: ["user-modify-playback-state"],
    requiresAuth: true,
    requiresConfirmation: true,
    riskLevel: "medium"
  },
  {
    name: "youtube.search",
    description: "Search YouTube videos for the connected Google account.",
    requiredScopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
  {
    name: "youtube.list_subscriptions",
    description: "List YouTube channel subscriptions for the connected Google account.",
    requiredScopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    requiresAuth: true,
    requiresConfirmation: false,
    riskLevel: "low"
  },
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
