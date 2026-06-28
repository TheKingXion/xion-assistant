import type { Env } from "../types";
import type { Repository } from "./repositories";
import { decryptToken } from "./security";

export const getGoogleAccessToken = async (repository: Repository, env: Env, userId: string) => {
  if (!env.TOKEN_ENCRYPTION_KEY) throw new Error("token_encryption_key_required");
  const account = await repository.getOAuthAccountSecrets(userId, "google");
  if (!account?.encryptedAccessToken) throw new Error("google_oauth_not_connected");
  return decryptToken(account.encryptedAccessToken, env.TOKEN_ENCRYPTION_KEY);
};
