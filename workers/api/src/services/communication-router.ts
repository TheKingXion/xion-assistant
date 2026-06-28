import type { RiskLevel } from "@xion-assistant/shared";
import type { Repository } from "./repositories";

export type PreparedCommunication = {
  recipient: string;
  contactId: string;
  channel: string;
  address?: string;
  message: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
};

export const prepareCommunication = async (
  repository: Repository,
  input: {
    userId: string;
    recipientQuery: string;
    message: string;
    channel?: string;
  }
): Promise<PreparedCommunication | undefined> => {
  const resolved = await repository.resolveContact(input.userId, input.recipientQuery);
  if (!resolved) return undefined;

  const selectedChannel =
    input.channel ??
    resolved.preferredChannel?.channel ??
    "manual";

  const prepared: PreparedCommunication = {
    recipient: resolved.contact.displayName,
    contactId: resolved.contact.id,
    channel: selectedChannel,
    message: input.message,
    riskLevel: "high",
    requiresConfirmation: true
  };

  if (resolved.preferredChannel?.address) {
    prepared.address = resolved.preferredChannel.address;
  }

  return prepared;
};
