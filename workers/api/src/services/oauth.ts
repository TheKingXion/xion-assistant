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

export type GoogleAuthExchange = {
  providerUserId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt?: string;
};

export const supportedOAuthProviders = ["google", "spotify"] as const;

export const isOAuthProvider = (value: string): value is OAuthProvider =>
  supportedOAuthProviders.includes(value as OAuthProvider);

export const getOAuthProviderConfig = (env: Env, provider: OAuthProvider): ProviderConfig => {
  if (provider === "google") {
    const config: ProviderConfig = {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      defaultScopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/youtube.readonly"
      ]
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

export const createGoogleAuthState = () =>
  btoa(
    JSON.stringify({
      flow: "google_auth",
      nonce: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    })
  );

export const parseGoogleAuthState = (state: string) => {
  const parsed = JSON.parse(atob(state)) as { flow?: string; nonce?: string };
  if (parsed.flow !== "google_auth" || !parsed.nonce) {
    throw new Error("invalid_oauth_state");
  }
  return parsed;
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

export const buildGoogleAuthAuthorizationUrl = (env: Env) => {
  const config = getOAuthProviderConfig(env, "google");
  const redirectUri = `${env.PUBLIC_API_URL}/api/auth/google/callback`;
  const scopes = ["openid", "email", "profile"];
  const state = createGoogleAuthState();
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId ?? "<missing-client-id>");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
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

export const exchangeGoogleAuthCode = async (input: {
  env: Env;
  code: string;
  redirectUri: string;
}): Promise<GoogleAuthExchange> => {
  const config = getOAuthProviderConfig(input.env, "google");
  const credentials = requireProviderConfig(config);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("oauth_token_exchange_failed");

  const token = (await response.json()) as TokenResponse;
  if (!token.access_token) throw new Error("oauth_access_token_missing");

  const profile = await resolveGoogleAuthProfile(token);
  const scopes = token.scope?.split(/\s+/).filter(Boolean) ?? ["openid", "email", "profile"];
  const result: GoogleAuthExchange = {
    providerUserId: profile.sub,
    email: profile.email,
    displayName: profile.name ?? profile.email.split("@")[0] ?? "Google User",
    accessToken: token.access_token,
    scopes
  };
  if (token.refresh_token !== undefined) result.refreshToken = token.refresh_token;
  if (token.expires_in !== undefined) result.expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  return result;
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

const resolveGoogleAuthProfile = async (token: TokenResponse) => {
  const jwtPayload = token.id_token ? parseJwtPayload(token.id_token) : {};
  const jwtProfile = {
    sub: typeof jwtPayload.sub === "string" ? jwtPayload.sub : undefined,
    email: typeof jwtPayload.email === "string" ? jwtPayload.email : undefined,
    name: typeof jwtPayload.name === "string" ? jwtPayload.name : undefined
  };
  if (jwtProfile.sub && jwtProfile.email) {
    return { sub: jwtProfile.sub, email: jwtProfile.email, name: jwtProfile.name };
  }

  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` }
  });
  if (!response.ok) throw new Error("oauth_profile_fetch_failed");
  const profile = (await response.json()) as { sub?: string; email?: string; name?: string };
  if (!profile.sub) throw new Error("oauth_provider_user_id_missing");
  if (!profile.email) throw new Error("oauth_email_missing");
  return { sub: profile.sub, email: profile.email, name: profile.name };
};
