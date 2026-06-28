import type { MemoryRecord, UserRecord, VoiceSettingsRecord } from "../types";
import { createId } from "../utils/id";

export type Repository = {
  createUser(input: { email: string; displayName: string; passwordHash?: string }): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  createMemory(input: Omit<MemoryRecord, "id" | "createdAt">): Promise<MemoryRecord>;
  listMemoriesForUser(userId: string): Promise<MemoryRecord[]>;
  resolveMemory(userId: string, key: string): Promise<MemoryRecord | undefined>;
  setVoiceSettings(userId: string, settings: VoiceSettingsRecord): Promise<VoiceSettingsRecord>;
  getVoiceSettings(userId: string): Promise<VoiceSettingsRecord | undefined>;
};

export class InMemoryRepository implements Repository {
  private users = new Map<string, UserRecord>();
  private memories = new Map<string, MemoryRecord>();
  private voiceSettings = new Map<string, VoiceSettingsRecord>();

  async createUser(input: { email: string; displayName: string; passwordHash?: string }) {
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

  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email);
  }

  async createMemory(input: Omit<MemoryRecord, "id" | "createdAt">) {
    const memory: MemoryRecord = {
      ...input,
      id: createId("mem"),
      createdAt: new Date().toISOString()
    };
    this.memories.set(memory.id, memory);
    return memory;
  }

  async listMemoriesForUser(userId: string) {
    return [...this.memories.values()].filter((memory) => memory.userId === userId);
  }

  async resolveMemory(userId: string, key: string) {
    return [...this.memories.values()].find(
      (memory) => memory.userId === userId && memory.key.toLowerCase() === key.toLowerCase()
    );
  }

  async setVoiceSettings(userId: string, settings: VoiceSettingsRecord) {
    this.voiceSettings.set(userId, settings);
    return settings;
  }

  async getVoiceSettings(userId: string) {
    return this.voiceSettings.get(userId);
  }
}

type DbUserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
  created_at: string;
};

type DbMemoryRow = {
  id: string;
  user_id: string;
  memory_type: string;
  key: string;
  value: string;
  confirmed: number;
  confidence: number;
  created_at: string;
};

type DbVoiceSettingsRow = {
  user_id: string;
  tts_enabled: number;
  stt_enabled: number;
  wake_word_enabled: number;
  selected_voice_id: string;
  language: string;
  speed: number;
  pitch: number;
  volume: number;
  auto_play_responses: number;
};

export class D1Repository implements Repository {
  constructor(private readonly db: D1Database) {}

  async createUser(input: { email: string; displayName: string; passwordHash?: string }) {
    const existing = await this.findUserByEmail(input.email);
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

    await this.db
      .prepare(
        `INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(user.id, user.email, user.displayName, user.passwordHash ?? null, user.createdAt, user.createdAt)
      .run();

    return user;
  }

  async findUserByEmail(email: string) {
    const row = await this.db
      .prepare(
        `SELECT id, email, display_name, password_hash, created_at
         FROM users
         WHERE email = ?
         LIMIT 1`
      )
      .bind(email)
      .first<DbUserRow>();

    return row ? mapUser(row) : undefined;
  }

  async createMemory(input: Omit<MemoryRecord, "id" | "createdAt">) {
    const memory: MemoryRecord = {
      ...input,
      id: createId("mem"),
      createdAt: new Date().toISOString()
    };

    await this.db
      .prepare(
        `INSERT INTO assistant_memories
           (id, user_id, memory_type, key, value, confirmed, confidence, source, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'user_confirmation', 1, ?, ?)`
      )
      .bind(
        memory.id,
        memory.userId,
        memory.memoryType,
        memory.key,
        memory.value,
        memory.confirmed ? 1 : 0,
        memory.confidence,
        memory.createdAt,
        memory.createdAt
      )
      .run();

    return memory;
  }

  async listMemoriesForUser(userId: string) {
    const result = await this.db
      .prepare(
        `SELECT id, user_id, memory_type, key, value, confirmed, confidence, created_at
         FROM assistant_memories
         WHERE user_id = ? AND is_active = 1
         ORDER BY created_at DESC`
      )
      .bind(userId)
      .all<DbMemoryRow>();

    return result.results.map(mapMemory);
  }

  async resolveMemory(userId: string, key: string) {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, memory_type, key, value, confirmed, confidence, created_at
         FROM assistant_memories
         WHERE user_id = ? AND lower(key) = lower(?) AND is_active = 1
         ORDER BY confirmed DESC, confidence DESC, created_at DESC
         LIMIT 1`
      )
      .bind(userId, key)
      .first<DbMemoryRow>();

    return row ? mapMemory(row) : undefined;
  }

  async setVoiceSettings(userId: string, settings: VoiceSettingsRecord) {
    const id = createId("vset");
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO voice_settings
           (id, user_id, tts_enabled, stt_enabled, wake_word_enabled, selected_voice_id, language, speed, pitch, volume, auto_play_responses, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           tts_enabled = excluded.tts_enabled,
           stt_enabled = excluded.stt_enabled,
           wake_word_enabled = excluded.wake_word_enabled,
           selected_voice_id = excluded.selected_voice_id,
           language = excluded.language,
           speed = excluded.speed,
           pitch = excluded.pitch,
           volume = excluded.volume,
           auto_play_responses = excluded.auto_play_responses,
           updated_at = excluded.updated_at`
      )
      .bind(
        id,
        userId,
        settings.ttsEnabled ? 1 : 0,
        settings.sttEnabled ? 1 : 0,
        settings.wakeWordEnabled ? 1 : 0,
        settings.selectedVoiceId,
        settings.language,
        settings.speed,
        settings.pitch,
        settings.volume,
        settings.autoPlayResponses ? 1 : 0,
        now,
        now
      )
      .run();

    return settings;
  }

  async getVoiceSettings(userId: string) {
    const row = await this.db
      .prepare(
        `SELECT user_id, tts_enabled, stt_enabled, wake_word_enabled, selected_voice_id, language, speed, pitch, volume, auto_play_responses
         FROM voice_settings
         WHERE user_id = ?
         LIMIT 1`
      )
      .bind(userId)
      .first<DbVoiceSettingsRow>();

    return row ? mapVoiceSettings(row) : undefined;
  }
}

const memoryRepository = new InMemoryRepository();

export const createRepository = (db?: D1Database): Repository => (db ? new D1Repository(db) : memoryRepository);

const mapUser = (row: DbUserRow): UserRecord => {
  const user: UserRecord = {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at
  };
  if (row.password_hash) {
    user.passwordHash = row.password_hash;
  }
  return user;
};

const mapMemory = (row: DbMemoryRow): MemoryRecord => ({
  id: row.id,
  userId: row.user_id,
  memoryType: row.memory_type,
  key: row.key,
  value: row.value,
  confirmed: row.confirmed === 1,
  confidence: row.confidence,
  createdAt: row.created_at
});

const mapVoiceSettings = (row: DbVoiceSettingsRow): VoiceSettingsRecord => ({
  userId: row.user_id,
  ttsEnabled: row.tts_enabled === 1,
  sttEnabled: row.stt_enabled === 1,
  wakeWordEnabled: row.wake_word_enabled === 1,
  selectedVoiceId: row.selected_voice_id,
  language: row.language,
  speed: row.speed,
  pitch: row.pitch,
  volume: row.volume,
  autoPlayResponses: row.auto_play_responses === 1
});
