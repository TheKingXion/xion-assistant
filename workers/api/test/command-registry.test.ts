import { describe, expect, it, vi } from "vitest";
import { MockAiGateway } from "../src/services/ai-gateway";
import { handleAssistantMessage } from "../src/services/assistant-engine";
import { InMemoryRepository } from "../src/services/repositories";
import { matchCommand } from "../src/modules/commands/command-matcher";
import { routeCommand } from "../src/modules/commands/command-router";
import { learnCommandShortcut } from "../src/modules/commands/learned-commands.service";

const timezone = "America/Santiago";
const now = new Date("2026-06-28T12:00:00Z");

describe("command registry", () => {
  it.each([
    ["pon alarma a las 6:45", "alarm.create", { time: "06:45" }],
    ["despiertame a las 7", "alarm.create", { time: "07:00" }],
    ["pon alarma a las seis cuarenta y cinco", "alarm.create", { time: "06:45" }],
    ["recuerdame tomar agua a las 3", "reminder.create", { title: "tomar agua", time: "15:00" }],
    ["Busca en YouTube baile inolvidable y dame el link", "youtube.search", { query: "baile inolvidable" }],
    ["busca tutoriales de React en YouTube", "youtube.search", { query: "tutoriales de react" }]
  ])("matches %s", async (text, command, params) => {
    const match = await matchCommand(new InMemoryRepository(), { userId: "user-a", text, timezone, now });
    expect(match.command?.name).toBe(command);
    expect(match.params).toMatchObject(params);
    expect(match.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("keeps identical shortcuts isolated by user", async () => {
    const repository = new InMemoryRepository();
    await learnCommandShortcut(repository, { userId: "user-a", sourceText: "despiertame tempranito", shortcut: "tempranito", intent: "alarm.create", params: { time: "06:45" }, confirmed: true });
    await learnCommandShortcut(repository, { userId: "user-b", sourceText: "despiertame tempranito", shortcut: "tempranito", intent: "alarm.create", params: { time: "08:00" }, confirmed: true });
    const userA = await matchCommand(repository, { userId: "user-a", text: "despiertame tempranito", timezone, now });
    const userB = await matchCommand(repository, { userId: "user-b", text: "despiertame tempranito", timezone, now });
    const userC = await matchCommand(repository, { userId: "user-c", text: "despiertame tempranito", timezone, now });
    expect(userA.params.time).toBe("06:45");
    expect(userB.params.time).toBe("08:00");
    expect(userC.missingParams).toContain("time");
  });

  it("does not call AI for high confidence command", async () => {
    const repository = new InMemoryRepository();
    const gateway = new MockAiGateway();
    const classify = vi.spyOn(gateway, "classifyIntent");
    const result = await handleAssistantMessage(repository, gateway, { userId: "user-a", message: "pon alarma a las 6:45", spokenResponse: false });
    expect(result.status).toBe("completed");
    expect(classify).not.toHaveBeenCalled();
  });

  it("uses AI fallback for low confidence input", async () => {
    const repository = new InMemoryRepository();
    const gateway = new MockAiGateway();
    const generate = vi.spyOn(gateway, "generateText");
    await handleAssistantMessage(repository, gateway, { userId: "user-a", message: "ayudame a pensar", spokenResponse: false });
    expect(generate).toHaveBeenCalledOnce();
    expect((await repository.listCommandUsage("user-a"))[0]?.usedAiFallback).toBe(true);
  });

  it("records estimated token savings", async () => {
    const repository = new InMemoryRepository();
    await routeCommand(repository, { userId: "user-a", text: "pon alarma a las 6:45", timezone });
    const event = (await repository.listCommandUsage("user-a"))[0];
    expect(event?.usedAiFallback).toBe(false);
    expect(event?.estimatedTokensSaved).toBe(500);
  });

  it("persists reminder without AI", async () => {
    const repository = new InMemoryRepository();
    const routed = await routeCommand(repository, { userId: "user-a", text: "recuerdame tomar agua a las 3", timezone });
    expect(routed.kind).toBe("resolved");
    expect((await repository.listReminders("user-a"))[0]?.title).toBe("tomar agua");
    expect(await repository.listReminders("user-b")).toHaveLength(0);
  });

  it("resolves ambiguous afternoon hours from the current timezone", async () => {
    const match = await matchCommand(new InMemoryRepository(), {
      userId: "user-a",
      text: "a las 2 acaba mi break recuerdamelo",
      timezone,
      now: new Date("2026-06-28T16:00:00Z")
    });
    expect(match.command?.name).toBe("reminder.create");
    expect(match.params.time).toBe("14:00");
  });

  it("prepares communication behind confirmation", async () => {
    const repository = new InMemoryRepository();
    await repository.createMemory({ userId: "user-a", memoryType: "contact_alias", key: "pedro", value: "Pedro", confirmed: true, confidence: 1 });
    const routed = await routeCommand(repository, { userId: "user-a", text: "dile a Pedro que voy tarde", timezone });
    expect(routed.kind).toBe("resolved");
    if (routed.kind === "resolved") expect(routed.result.status).toBe("pending_confirmation");
  });

  it("returns a usable youtube link for optimized search", async () => {
    const repository = new InMemoryRepository();
    const routed = await routeCommand(repository, { userId: "user-a", text: "Busca en YouTube baile inolvidable y dame el link", timezone });
    expect(routed.kind).toBe("resolved");
    if (routed.kind === "resolved") {
      expect(routed.result.response).toContain("https://www.youtube.com/results?search_query=baile%20inolvidable");
      expect(routed.result.params.url).toBe("https://www.youtube.com/results?search_query=baile%20inolvidable");
    }
  });

  it("extracts communication phrased as enviar un mensaje", async () => {
    const repository = new InMemoryRepository();
    await repository.createMemory({ userId: "user-a", memoryType: "contact_alias", key: "mi mama", value: "Mama", confirmed: true, confidence: 1 });
    const routed = await routeCommand(repository, { userId: "user-a", text: "envia un mensaje a mi mama diciendo que llego en 10", timezone });
    expect(routed.kind).toBe("resolved");
    if (routed.kind === "resolved") expect(routed.result.status).toBe("pending_confirmation");
  });
});
