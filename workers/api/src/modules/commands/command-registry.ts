import type { RiskLevel } from "@xion-assistant/shared";
import { alarmCreateCommand } from "./commands/alarm.create";
import { alarmCancelCommand } from "./commands/alarm.cancel";
import { reminderCreateCommand } from "./commands/reminder.create";
import { reminderListCommand } from "./commands/reminder.list";
import { appOpenCommand } from "./commands/app.open";
import { spotifyPlayCommand } from "./commands/spotify.play";
import { spotifyPauseCommand } from "./commands/spotify.pause";
import { youtubeSearchCommand } from "./commands/youtube.search";
import { systemCheckUpdatesCommand } from "./commands/system.check-updates";
import { calendarQuickCreateCommand } from "./commands/calendar.quick-create";
import { communicationPrepareMessageCommand } from "./commands/communication.prepare-message";

export type CommandPlatform = "web" | "windows" | "android" | "ios" | "unknown";
export type CommandParams = Record<string, unknown>;
export type CommandDefinition = {
  name: string;
  description: string;
  examples: string[];
  patterns: RegExp[];
  requiredParams: string[];
  optionalParams: string[];
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  supportedPlatforms: CommandPlatform[];
  canExecuteLocally: boolean;
  canExecuteCloud: boolean;
  estimatedTokensSaved: number;
};

export const commandRegistry: CommandDefinition[] = [
  alarmCreateCommand,
  alarmCancelCommand,
  reminderCreateCommand,
  reminderListCommand,
  appOpenCommand,
  spotifyPlayCommand,
  spotifyPauseCommand,
  youtubeSearchCommand,
  systemCheckUpdatesCommand,
  calendarQuickCreateCommand,
  communicationPrepareMessageCommand
];

export const getCommandDefinition = (name: string) => commandRegistry.find((command) => command.name === name);

export const publicCommandDefinition = (command: CommandDefinition) => ({
  name: command.name,
  description: command.description,
  examples: command.examples,
  requiredParams: command.requiredParams,
  optionalParams: command.optionalParams,
  riskLevel: command.riskLevel,
  requiresConfirmation: command.requiresConfirmation,
  supportedPlatforms: command.supportedPlatforms,
  canExecuteLocally: command.canExecuteLocally,
  canExecuteCloud: command.canExecuteCloud
});
