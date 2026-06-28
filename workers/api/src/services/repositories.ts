import type { MemoryRecord, UserRecord } from "../types";
import { createId } from "../utils/id";

export class InMemoryRepository {
  private users = new Map<string, UserRecord>();
  private memories = new Map<string, MemoryRecord>();
  private voiceSettings = new Map<string, unknown>();

  createUser(input: { email: string; displayName: string; passwordHash?: string }) {
    const existing = [...this.users.values()].find((user) => user.email === input.email);
    if (existing) return existing;

    const user: UserRecord = {
      id: createId("usr"),
      email: input.email,
      displayName: input.displayName,
      createdAt: new Date().toISOString()
    };
    if (input.passwordHash) {
      user.passwordHash = input.passwordHash;
    }
    this.users.set(user.id, user);
    return user;
  }

  findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email);
  }

  createMemory(input: Omit<MemoryRecord, "id" | "createdAt">) {
    const memory: MemoryRecord = {
      ...input,
      id: createId("mem"),
      createdAt: new Date().toISOString()
    };
    this.memories.set(memory.id, memory);
    return memory;
  }

  listMemoriesForUser(userId: string) {
    return [...this.memories.values()].filter((memory) => memory.userId === userId);
  }

  resolveMemory(userId: string, key: string) {
    return [...this.memories.values()].find(
      (memory) => memory.userId === userId && memory.key.toLowerCase() === key.toLowerCase()
    );
  }

  setVoiceSettings(userId: string, settings: unknown) {
    this.voiceSettings.set(userId, settings);
    return settings;
  }

  getVoiceSettings(userId: string) {
    return this.voiceSettings.get(userId);
  }
}

export const repository = new InMemoryRepository();
