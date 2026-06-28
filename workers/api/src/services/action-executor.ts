import type { Env } from "../types";
import { createGoogleCalendarEvent } from "./google-calendar";
import type { Repository } from "./repositories";

export const executeConfirmedAction = async (
  repository: Repository,
  env: Env,
  input: { userId: string; actionId: string }
) => {
  const action = await repository.getActionForUser(input.userId, input.actionId);
  if (!action) throw new Error("action_not_found");

  if (action.toolName === "calendar.create_event") {
    const parsed = JSON.parse(action.inputJson) as {
      calendarId?: string;
      event: {
        summary: string;
        description?: string;
        start: string;
        end: string;
        timeZone?: string;
      };
    };
    const request: {
      userId: string;
      calendarId?: string;
      event: typeof parsed.event;
    } = {
      userId: input.userId,
      event: parsed.event
    };
    if (parsed.calendarId !== undefined) request.calendarId = parsed.calendarId;
    const created = await createGoogleCalendarEvent(repository, env, request);
    return {
      status: "completed" as const,
      result: {
        execution: "google_calendar_created",
        event: created
      }
    };
  }

  return {
    status: "failed" as const,
    result: {
      confirmationRecorded: true,
      execution: "connector_not_configured"
    }
  };
};
