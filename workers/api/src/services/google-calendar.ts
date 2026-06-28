import type { Env } from "../types";
import type { Repository } from "./repositories";
import { getGoogleAccessToken } from "./google-auth";

export type CalendarEventInput = {
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  htmlLink?: string;
  start?: unknown;
  end?: unknown;
};

export const listGoogleCalendarEvents = async (
  repository: Repository,
  env: Env,
  input: { userId: string; calendarId?: string; timeMin?: string; maxResults?: number }
) => {
  const accessToken = await getGoogleAccessToken(repository, env, input.userId);
  const calendarId = encodeURIComponent(input.calendarId ?? "primary");
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(input.maxResults ?? 10));
  if (input.timeMin) url.searchParams.set("timeMin", input.timeMin);

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("google_calendar_list_failed");
  const json = (await response.json()) as { items?: CalendarEvent[] };
  return json.items ?? [];
};

export const createGoogleCalendarEvent = async (
  repository: Repository,
  env: Env,
  input: { userId: string; calendarId?: string; event: CalendarEventInput }
) => {
  const accessToken = await getGoogleAccessToken(repository, env, input.userId);
  const calendarId = encodeURIComponent(input.calendarId ?? "primary");
  const body: Record<string, unknown> = {
    summary: input.event.summary,
    start: {
      dateTime: input.event.start,
      timeZone: input.event.timeZone ?? "America/Santiago"
    },
    end: {
      dateTime: input.event.end,
      timeZone: input.event.timeZone ?? "America/Santiago"
    }
  };
  if (input.event.description) body.description = input.event.description;

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("google_calendar_create_failed");
  return (await response.json()) as CalendarEvent;
};
