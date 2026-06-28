import type { Env, OAuthProvider } from "../types";

type ProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
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

const parseJwtPayload = (token: string): Record<string, unknown> => {
  const [, payload] = token.split(".");
  if (!payload) return {};
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
};

const requireProviderConfig = (config: ProviderConfig) => {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("oauth_provider_not_configured");
  }
  return { clientId: config.clientId, clientSecret: config.clientSecret };
};

export const exchangeOAuthCode = async (input: {
  env: Env;
  provider: OAuthProvider;
  code: string;
  redirectUri: string;
}) => {
  const config = getOAuthProviderConfig(input.env, input.provider);
  const credentials = requireProviderConfig(config);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri
  });

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded"
  };

  if (input.provider === "spotify") {
    headers.authorization = `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`;
  } else {
    body.set("client_id", credentials.clientId);
    body.set("client_secret", credentials.clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body
  });
  if (!response.ok) {
    throw new Error("oauth_token_exchange_failed");
  }

  const token = (await response.json()) as TokenResponse;
  if (!token.access_token) {
    throw new Error("oauth_access_token_missing");
  }

  const scopes = token.scope?.split(/\s+/).filter(Boolean) ?? config.defaultScopes;
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : undefined;
  const providerUserId = await resolveProviderUserId(input.provider, token);

  return {
    providerUserId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    scopes,
    expiresAt
  };
};

const resolveProviderUserId = async (provider: OAuthProvider, token: TokenResponse) => {
  if (provider === "google") {
    const jwtPayload = token.id_token ? parseJwtPayload(token.id_token) : {};
    if (typeof jwtPayload.sub === "string") return jwtPayload.sub;
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` }
    });
    if (!response.ok) throw new Error("oauth_profile_fetch_failed");
    const profile = (await response.json()) as { sub?: string };
    if (!profile.sub) throw new Error("oauth_provider_user_id_missing");
    return profile.sub;
  }

  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { authorization: `Bearer ${token.access_token}` }
  });
  if (!response.ok) throw new Error("oauth_profile_fetch_failed");
  const profile = (await response.json()) as { id?: string };
  if (!profile.id) throw new Error("oauth_provider_user_id_missing");
  return profile.id;
};
