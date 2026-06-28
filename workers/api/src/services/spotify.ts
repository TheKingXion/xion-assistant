import type { Env } from "../types";
import type { Repository } from "./repositories";
import { decryptToken } from "./security";

export type SpotifyPlayback = {
  is_playing?: boolean;
  item?: unknown;
  device?: unknown;
  progress_ms?: number;
};

export type SpotifyPlayInput = {
  deviceId?: string;
  contextUri?: string;
  uris?: string[];
};

export type SpotifyPauseInput = {
  deviceId?: string;
};

const getSpotifyAccessToken = async (repository: Repository, env: Env, userId: string) => {
  if (!env.TOKEN_ENCRYPTION_KEY) throw new Error("token_encryption_key_required");
  const account = await repository.getOAuthAccountSecrets(userId, "spotify");
  if (!account?.encryptedAccessToken) throw new Error("spotify_oauth_not_connected");
  return decryptToken(account.encryptedAccessToken, env.TOKEN_ENCRYPTION_KEY);
};

export const getSpotifyPlayback = async (repository: Repository, env: Env, input: { userId: string }) => {
  const accessToken = await getSpotifyAccessToken(repository, env, input.userId);
  const response = await fetch("https://api.spotify.com/v1/me/player", {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error("spotify_playback_failed");
  return (await response.json()) as SpotifyPlayback;
};

export const playSpotify = async (repository: Repository, env: Env, input: { userId: string; playback: SpotifyPlayInput }) => {
  const accessToken = await getSpotifyAccessToken(repository, env, input.userId);
  const url = new URL("https://api.spotify.com/v1/me/player/play");
  if (input.playback.deviceId) url.searchParams.set("device_id", input.playback.deviceId);
  const body: Record<string, unknown> = {};
  if (input.playback.contextUri) body.context_uri = input.playback.contextUri;
  if (input.playback.uris) body.uris = input.playback.uris;
  const request: RequestInit = {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    }
  };
  if (Object.keys(body).length > 0) request.body = JSON.stringify(body);
  const response = await fetch(url, request);
  if (!response.ok && response.status !== 204) throw new Error("spotify_play_failed");
  return { status: "spotify_play_started" };
};

export const pauseSpotify = async (repository: Repository, env: Env, input: { userId: string; playback: SpotifyPauseInput }) => {
  const accessToken = await getSpotifyAccessToken(repository, env, input.userId);
  const url = new URL("https://api.spotify.com/v1/me/player/pause");
  if (input.playback.deviceId) url.searchParams.set("device_id", input.playback.deviceId);
  const response = await fetch(url, {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok && response.status !== 204) throw new Error("spotify_pause_failed");
  return { status: "spotify_paused" };
};
