import { parseSpanishNumber } from "./command-normalizer";
import type { CommandParams } from "./command-registry";

const weekdays: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

const datePartsInTimezone = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
};

const addDays = (parts: { year: number; month: number; day: number }, days: number) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return date.toISOString().slice(0, 10);
};

const minutesInTimezone = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(value.hour) * 60 + Number(value.minute);
};

const resolveAmbiguousHour = (hour: number, minute: number, text: string, timezone: string, now: Date, preferMorning = false) => {
  const explicitAm = /\b(?:am|a\.m\.|de la manana|de la madrugada)\b/.test(text);
  const explicitPm = /\b(?:pm|p\.m\.|de la tarde|de la noche)\b/.test(text);
  if (explicitAm) return hour === 12 ? 0 : hour;
  if (explicitPm) return hour < 12 ? hour + 12 : hour;
  if (hour === 12 || hour === 0 || hour > 11) return hour;
  if (preferMorning) return hour;

  const current = minutesInTimezone(now, timezone);
  const morning = hour * 60 + minute;
  const afternoon = (hour + 12) * 60 + minute;
  if (morning > current + 5) return hour;
  if (afternoon > current + 5) return hour + 12;
  return hour + 12;
};

const extractTime = (commandName: string, text: string, timezone: string, now: Date) => {
  const preferMorning = commandName === "alarm.create";
  const numeric = text.match(/(?:a|para|de) las?\s+(\d{1,2})(?::(\d{1,2}))?(?:\s*(?:am|pm|a\.m\.|p\.m\.|de la manana|de la madrugada|de la tarde|de la noche))?/);
  if (numeric) {
    const rawHour = Number(numeric[1]);
    const minute = Number(numeric[2] ?? 0);
    const hour = resolveAmbiguousHour(rawHour, minute, numeric[0], timezone, now, preferMorning);
    if (hour <= 23 && minute <= 59) return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const words = text.match(/(?:a|para|de) las?\s+([a-z]+)(?:\s+((?:y\s+)?[a-z]+(?:\s+y\s+[a-z]+)?))?(?:\s*(?:am|pm|a\.m\.|p\.m\.|de la manana|de la madrugada|de la tarde|de la noche))?(?:\s|$)/);
  if (!words) return undefined;
  const rawHour = parseSpanishNumber(words[1] ?? "");
  const minute = words[2] ? parseSpanishNumber(words[2].replace(/^y\s+/, "")) : 0;
  if (rawHour === undefined || minute === undefined || rawHour > 23 || minute > 59) return undefined;
  const hour = resolveAmbiguousHour(rawHour, minute, words[0], timezone, now, preferMorning);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const extractDate = (text: string, timezone: string, now: Date) => {
  const today = datePartsInTimezone(now, timezone);
  if (/\bmanana\b/.test(text)) return addDays(today, 1);
  if (/\bhoy\b/.test(text)) return addDays(today, 0);
  for (const [name, target] of Object.entries(weekdays)) {
    if (!new RegExp(`\\b${name}\\b`).test(text)) continue;
    const current = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
    const delta = (target - current + 7) % 7 || 7;
    return addDays(today, delta);
  }
  return undefined;
};

const removeTemporalSuffix = (value: string) => value
  .replace(/\b(?:hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b.*$/i, "")
  .replace(/\ba las?\s+\d{1,2}(?::\d{1,2})?(?:\s*(?:am|pm|a\.m\.|p\.m\.|de la manana|de la madrugada|de la tarde|de la noche))?/i, "")
  .replace(/\brecuerdame(?:lo)?\b.*$/i, "")
  .replace(/\s+/g, " ")
  .trim();

const extractReminderTitle = (text: string) => {
  const afterVerb = text.match(/(?:recuerdame(?:lo)?|crea (?:un )?recordatorio(?: para)?)(?: que)?\s+(.+)/)?.[1];
  if (afterVerb) return removeTemporalSuffix(afterVerb);
  const beforeVerb = text.match(/^(.*?)\s+recuerdame(?:lo)?\b/)?.[1];
  if (beforeVerb) return removeTemporalSuffix(beforeVerb);
  return undefined;
};

export const extractCommandParams = (commandName: string, text: string, timezone: string, now = new Date()): CommandParams => {
  const params: CommandParams = {};
  const time = extractTime(commandName, text, timezone, now);
  const date = extractDate(text, timezone, now);
  const duration = text.match(/\ben\s+(\d+)\s+minutos?\b/);
  if (time) params.time = time;
  if (date) params.date = date;
  if (duration) params.duration = Number(duration[1]);
  if (/\b(?:todos los dias|diariamente|cada dia)\b/.test(text)) params.repeat = "daily";

  if (commandName === "reminder.create") {
    const title = extractReminderTitle(text);
    if (title) params.title = title;
  }
  if (commandName === "app.open") {
    const app = text.match(/\babre (?:la aplicacion |la app |el )?([a-z0-9]+)/)?.[1];
    if (app) params.app_name = app;
  }
  if (commandName === "youtube.search") {
    const query = text
      .replace(/^(?:abre youtube y |buscame |busca )/, "")
      .replace(/\s+en youtube$/, "")
      .replace(/^videos? de\s+/, "")
      .replace(/^busca\s+/, "")
      .trim();
    if (query) params.query = query;
  }
  if (commandName === "spotify.play") {
    const query = text.replace(/^(?:pon|reproduce)\s+/, "").replace(/\s+en spotify$/, "").trim();
    if (query && query !== "musica") params.query = query;
    if (/\bplaylist\b/.test(text)) params.playlist = query;
  }
  if (commandName === "communication.prepare_message") {
    const match = text.match(/(?:mandale|dile|enviale|envia)(?: un mensaje)? a\s+(.+?)\s+(?:diciendo que|que)\s+(.+)/);
    if (match?.[1]) params.contact_alias = match[1].trim();
    if (match?.[2]) params.message = match[2].trim();
    const channel = text.match(/\b(?:por|en)\s+(whatsapp|telegram|sms|email|correo)\b/)?.[1];
    if (channel) params.channel = channel === "correo" ? "email" : channel;
  }
  if (commandName === "calendar.quick_create") {
    const title = text.match(/(?:crea|agenda) (?:un )?(?:evento|reunion|cita)(?: de| para)?\s+(.+)/)?.[1];
    if (title) params.title = removeTemporalSuffix(title);
  }
  return params;
};
