import type { Env, OAuthProvider } from "../types";

type ProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
};

export const supportedOAuthProviders = ["google", "spotify"] as const;

export const isOAuthProvider = (value: string): value is OAuthProvider =>
  supportedOAuthProviders.includes(value as OAuthProvider);

export const getOAuthProviderConfig = (env: Env, provider: OAuthProvider): ProviderConfig => {
  if (provider === "google") {
    const config: ProviderConfig = {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      defaultScopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.events"]
    };
    if (env.GOOGLE_CLIENT_ID !== undefined) config.clientId = env.GOOGLE_CLIENT_ID;
    if (env.GOOGLE_CLIENT_SECRET !== undefined) config.clientSecret = env.GOOGLE_CLIENT_SECRET;
    return config;
  }

  const config: ProviderConfig = {
    authorizationUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    defaultScopes: ["user-read-email", "user-read-private", "user-modify-playback-state", "user-read-playback-state"]
  };
  if (env.SPOTIFY_CLIENT_ID !== undefined) config.clientId = env.SPOTIFY_CLIENT_ID;
  if (env.SPOTIFY_CLIENT_SECRET !== undefined) config.clientSecret = env.SPOTIFY_CLIENT_SECRET;
  return config;
};

export const createOAuthState = (input: { userId: string; provider: OAuthProvider }) =>
  btoa(
    JSON.stringify({
      userId: input.userId,
      provider: input.provider,
      nonce: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    })
  );

export const parseOAuthState = (state: string): { userId: string; provider: OAuthProvider } => {
  const parsed = JSON.parse(atob(state)) as { userId?: string; provider?: string };
  if (!parsed.userId || !parsed.provider || !isOAuthProvider(parsed.provider)) {
    throw new Error("invalid_oauth_state");
  }
  return { userId: parsed.userId, provider: parsed.provider };
};

export const buildAuthorizationUrl = (input: {
  env: Env;
  provider: OAuthProvider;
  userId: string;
  scopes?: string[];
}) => {
  const config = getOAuthProviderConfig(input.env, input.provider);
  const redirectUri = `${input.env.PUBLIC_API_URL}/api/oauth/${input.provider}/callback`;
  const scopes = input.scopes?.length ? input.scopes : config.defaultScopes;
  const state = createOAuthState({ userId: input.userId, provider: input.provider });
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId ?? "<missing-client-id>");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  if (input.provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }
  return {
    authorizationUrl: url.toString(),
    redirectUri,
    state,
    scopes,
    configured: Boolean(config.clientId && config.clientSecret)
  };
};
