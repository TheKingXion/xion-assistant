import type { Env } from "../types";
import type { Repository } from "./repositories";
import { getGoogleAccessToken } from "./google-auth";

export type YouTubeSearchItem = {
  id: unknown;
  snippet?: unknown;
};

export type YouTubeSubscription = {
  id: string;
  snippet?: unknown;
};

export const searchYouTube = async (
  repository: Repository,
  env: Env,
  input: { userId: string; query: string; maxResults?: number }
) => {
  const accessToken = await getGoogleAccessToken(repository, env, input.userId);
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", input.query);
  url.searchParams.set("maxResults", String(input.maxResults ?? 10));
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("youtube_search_failed");
  const json = (await response.json()) as { items?: YouTubeSearchItem[] };
  return json.items ?? [];
};

export const listYouTubeSubscriptions = async (
  repository: Repository,
  env: Env,
  input: { userId: string; maxResults?: number }
) => {
  const accessToken = await getGoogleAccessToken(repository, env, input.userId);
  const url = new URL("https://www.googleapis.com/youtube/v3/subscriptions");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", String(input.maxResults ?? 10));
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("youtube_subscriptions_failed");
  const json = (await response.json()) as { items?: YouTubeSubscription[] };
  return json.items ?? [];
};
