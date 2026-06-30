import type {
  ActionConfirmationRecord,
  AssistantMessageRecord,
  AssistantActionRecord,
  AssistantPlanRecord,
  AssistantPlanStepRecord,
  ContactAliasRecord,
  ContactChannelRecord,
  ContactRecord,
  CommandLearningRecord,
  CommandShortcutRecord,
  CommandUsageRecord,
  MemoryRecord,
  OAuthAccountRecord,
  OAuthAccountSecretRecord,
  OAuthProvider,
  ResolvedContactRecord,
  ReminderRecord,
  SessionRecord,
  UserRecord,
  VoiceSettingsRecord
} from "../types";
import { createId } from "../utils/id";

export type Repository = {
  createUser(input: { email: string; displayName: string; passwordHash?: string }): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(userId: string): Promise<UserRecord | undefined>;
  createSession(input: { userId: string; tokenHash: string; deviceId?: string; expiresAt: string }): Promise<SessionRecord>;
  findActiveSessionByTokenHash(tokenHash: string): Promise<SessionRecord | undefined>;
  createAssistantMessage(input: Omit<AssistantMessageRecord, "id" | "createdAt">): Promise<AssistantMessageRecord>;
  listAssistantMessages(userId: string, limit?: number): Promise<AssistantMessageRecord[]>;
  createContact(input: { userId: string; displayName: string; notes?: string }): Promise<ContactRecord>;
  listContactsForUser(userId: string): Promise<ContactRecord[]>;
  createContactAlias(input: { userId: string; contactId: string; alias: string; confirmed: boolean }): Promise<ContactAliasRecord>;
  createContactChannel(input: { userId: string; contactId: string; channel: string; address: string; isPreferred: boolean }): Promise<ContactChannelRecord>;
  resolveContact(userId: string, query: string): Promise<ResolvedContactRecord | undefined>;
  upsertOAuthAccount(input: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
    encryptedAccessToken?: string;
    encryptedRefreshToken?: string;
    scopes: string[];
    expiresAt?: string;
  }): Promise<OAuthAccountRecord>;
  listOAuthAccountsForUser(userId: string): Promise<OAuthAccountRecord[]>;
  getOAuthAccountSecrets(userId: string, provider: OAuthProvider): Promise<OAuthAccountSecretRecord | undefined>;
  disconnectOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean>;
  createMemory(input: Omit<MemoryRecord, "id" | "createdAt">): Promise<MemoryRecord>;
  listMemoriesForUser(userId: string): Promise<MemoryRecord[]>;
  resolveMemory(userId: string, key: string): Promise<MemoryRecord | undefined>;
  updateMemory(userId: string, memoryId: string, input: Partial<Pick<MemoryRecord, "key" | "value" | "confirmed" | "confidence">>): Promise<MemoryRecord | undefined>;
  deleteMemory(userId: string, memoryId: string): Promise<boolean>;
  setVoiceSettings(userId: string, settings: VoiceSettingsRecord): Promise<VoiceSettingsRecord>;
  getVoiceSettings(userId: string): Promise<VoiceSettingsRecord | undefined>;
  createAction(input: Omit<AssistantActionRecord, "id" | "createdAt" | "updatedAt">): Promise<AssistantActionRecord>;
  getActionForUser(userId: string, actionId: string): Promise<AssistantActionRecord | undefined>;
  updateActionStatus(userId: string, actionId: string, status: AssistantActionRecord["status"], resultJson?: string): Promise<AssistantActionRecord | undefined>;
  createActionConfirmation(input: Omit<ActionConfirmationRecord, "id" | "createdAt">): Promise<ActionConfirmationRecord>;
  createPlanWithSteps(input: Omit<AssistantPlanRecord, "id" | "createdAt" | "updatedAt">, steps: Array<Omit<AssistantPlanStepRecord, "id" | "planId">>): Promise<{ plan: AssistantPlanRecord; steps: AssistantPlanStepRecord[] }>;
  getPlanForUser(userId: string, planId: string): Promise<{ plan: AssistantPlanRecord; steps: AssistantPlanStepRecord[] } | undefined>;
  listCommandShortcuts(userId: string): Promise<CommandShortcutRecord[]>;
  getCommandShortcut(userId: string, shortcut: string): Promise<CommandShortcutRecord | undefined>;
  createCommandShortcut(input: Omit<CommandShortcutRecord, "id" | "createdAt" | "updatedAt">): Promise<CommandShortcutRecord>;
  updateCommandShortcut(userId: string, id: string, input: Partial<Pick<CommandShortcutRecord, "shortcut" | "intent" | "paramsJson" | "confidence" | "confirmed" | "isActive">>): Promise<CommandShortcutRecord | undefined>;
  deleteCommandShortcut(userId: string, id: string): Promise<boolean>;
  createCommandUsage(input: Omit<CommandUsageRecord, "id" | "createdAt">): Promise<CommandUsageRecord>;
  listCommandUsage(userId: string): Promise<CommandUsageRecord[]>;
  createCommandLearning(input: Omit<CommandLearningRecord, "id" | "createdAt">): Promise<CommandLearningRecord>;
  getUserSetting(userId: string, key: string): Promise<string | undefined>;
  setUserSetting(userId: string, key: string, value: string): Promise<void>;
  createReminder(input: { userId: string; title: string; dueAt?: string }): Promise<ReminderRecord>;
  listReminders(userId: string): Promise<ReminderRecord[]>;
};

export class InMemoryRepository implements Repository {
  private users = new Map<string, UserRecord>();
  private sessions = new Map<string, SessionRecord>();
  private contacts = new Map<string, ContactRecord>();
  private contactAliases = new Map<string, ContactAliasRecord>();
  private contactChannels = new Map<string, ContactChannelRecord>();
  private oauthAccounts = new Map<string, OAuthAccountRecord & { encryptedAccessToken?: string; encryptedRefreshToken?: string }>();
  private memories = new Map<string, MemoryRecord>();
  private voiceSettings = new Map<string, VoiceSettingsRecord>();
  private actions = new Map<string, AssistantActionRecord>();
  private confirmations = new Map<string, ActionConfirmationRecord>();
  private plans = new Map<string, AssistantPlanRecord>();
  private planSteps = new Map<string, AssistantPlanStepRecord[]>();
  private commandShortcuts = new Map<string, CommandShortcutRecord>();
  private commandUsage = new Map<string, CommandUsageRecord>();
  private commandLearning = new Map<string, CommandLearningRecord>();
  private userSettings = new Map<string, string>();
  private reminders = new Map<string, ReminderRecord>();
  private messages = new Map<string, AssistantMessageRecord>();

  async createUser(input: { email: string; displayName: string; passwordHash?: string }) {
    const existing = [...this.users.values()].find((user) => user.email === input.email);
    if (existing) return existing;
    const user: UserRecord = {
      id: createId("usr"),
      email: input.email,
      displayName: input.displayName,
      isAdmin: false,
      createdAt: new Date().toISOString()
    };
    if (input.passwordHash) user.passwordHash = input.passwordHash;
    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email);
  }

  async findUserById(userId: string) {
    return this.users.get(userId);
  }

  async createSession(input: { userId: string; tokenHash: string; deviceId?: string; expiresAt: string }) {
    const session: SessionRecord = {
      id: createId("ses"),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString()
    };
    if (input.deviceId) session.deviceId = input.deviceId;
    this.sessions.set(session.id, session);
    return session;
  }

  async findActiveSessionByTokenHash(tokenHash: string) {
    return [...this.sessions.values()].find(
      (session) => session.tokenHash === tokenHash && new Date(session.expiresAt).getTime() > Date.now()
    );
  }

  async createAssistantMessage(input: Omit<AssistantMessageRecord, "id" | "createdAt">) {
    const message: AssistantMessageRecord = { ...input, id: createId("msg"), createdAt: new Date().toISOString() };
    this.messages.set(message.id, message);
    return message;
  }

  async listAssistantMessages(userId: string, limit = 50) {
    return [...this.messages.values()]
      .filter((message) => message.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit);
  }

  async createContact(input: { userId: string; displayName: string; notes?: string }) {
    const now = new Date().toISOString();
    const contact: ContactRecord = {
      id: createId("ctc"),
      userId: input.userId,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now
    };
    if (input.notes) contact.notes = input.notes;
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async listContactsForUser(userId: string) {
    return [...this.contacts.values()].filter((contact) => contact.userId === userId);
  }

  async createContactAlias(input: { userId: string; contactId: string; alias: string; confirmed: boolean }) {
    const contact = this.contacts.get(input.contactId);
    if (!contact || contact.userId !== input.userId) {
      throw new Error("contact_not_found");
    }
    const alias: ContactAliasRecord = {
      id: createId("cal"),
      userId: input.userId,
      contactId: input.contactId,
      alias: input.alias,
      confirmed: input.confirmed,
      createdAt: new Date().toISOString()
    };
    this.contactAliases.set(alias.id, alias);
    return alias;
  }

  async createContactChannel(input: { userId: string; contactId: string; channel: string; address: string; isPreferred: boolean }) {
    const contact = this.contacts.get(input.contactId);
    if (!contact || contact.userId !== input.userId) {
      throw new Error("contact_not_found");
    }
    const channel: ContactChannelRecord = {
      id: createId("cch"),
      userId: input.userId,
      contactId: input.contactId,
      channel: input.channel,
      address: input.address,
      isPreferred: input.isPreferred,
      createdAt: new Date().toISOString()
    };
    this.contactChannels.set(channel.id, channel);
    return channel;
  }

  async resolveContact(userId: string, query: string) {
    const normalized = query.toLowerCase();
    const contact = [...this.contacts.values()].find(
      (item) => item.userId === userId && item.displayName.toLowerCase() === normalized
    );
    const alias = [...this.contactAliases.values()].find(
      (item) => item.userId === userId && item.alias.toLowerCase() === normalized && item.confirmed
    );
    const resolvedContact = alias ? this.contacts.get(alias.contactId) : contact;
    if (!resolvedContact || resolvedContact.userId !== userId) return undefined;
    const preferredChannel =
      [...this.contactChannels.values()].find(
        (item) => item.userId === userId && item.contactId === resolvedContact.id && item.isPreferred
      ) ??
      [...this.contactChannels.values()].find(
        (item) => item.userId === userId && item.contactId === resolvedContact.id
      );
    const resolved: ResolvedContactRecord = { contact: resolvedContact };
    if (alias) resolved.alias = alias;
    if (preferredChannel) resolved.preferredChannel = preferredChannel;
    return resolved;
  }

  async upsertOAuthAccount(input: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
    encryptedAccessToken?: string;
    encryptedRefreshToken?: string;
    scopes: string[];
    expiresAt?: string;
  }) {
    const existing = [...this.oauthAccounts.values()].find(
      (account) => account.userId === input.userId && account.provider === input.provider
    );
    const account: OAuthAccountRecord & { encryptedAccessToken?: string; encryptedRefreshToken?: string } = {
      id: existing?.id ?? createId("oauth"),
      userId: input.userId,
      provider: input.provider,
      providerUserId: input.providerUserId,
      scopes: input.scopes,
      createdAt: existing?.createdAt ?? new Date().toISOString()
    };
    if (input.expiresAt) account.expiresAt = input.expiresAt;
    if (input.encryptedAccessToken) account.encryptedAccessToken = input.encryptedAccessToken;
    if (input.encryptedRefreshToken) account.encryptedRefreshToken = input.encryptedRefreshToken;
    this.oauthAccounts.set(account.id, account);
    return redactOAuthAccount(account);
  }

  async listOAuthAccountsForUser(userId: string) {
    return [...this.oauthAccounts.values()]
      .filter((account) => account.userId === userId)
      .map(redactOAuthAccount);
  }

  async getOAuthAccountSecrets(userId: string, provider: OAuthProvider) {
    return [...this.oauthAccounts.values()].find(
      (account) => account.userId === userId && account.provider === provider
    );
  }

  async disconnectOAuthAccount(userId: string, provider: OAuthProvider) {
    const account = [...this.oauthAccounts.values()].find(
      (item) => item.userId === userId && item.provider === provider
    );
    if (!account) return false;
    return this.oauthAccounts.delete(account.id);
  }

  async createMemory(input: Omit<MemoryRecord, "id" | "createdAt">) {
    const memory: MemoryRecord = { ...input, id: createId("mem"), createdAt: new Date().toISOString() };
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

  async updateMemory(
    userId: string,
    memoryId: string,
    input: Partial<Pick<MemoryRecord, "key" | "value" | "confirmed" | "confidence">>
  ) {
    const memory = this.memories.get(memoryId);
    if (!memory || memory.userId !== userId) return undefined;
    const next = { ...memory, ...input };
    this.memories.set(memoryId, next);
    return next;
  }

  async deleteMemory(userId: string, memoryId: string) {
    const memory = this.memories.get(memoryId);
    if (!memory || memory.userId !== userId) return false;
    return this.memories.delete(memoryId);
  }

  async setVoiceSettings(userId: string, settings: VoiceSettingsRecord) {
    this.voiceSettings.set(userId, settings);
    return settings;
  }

  async getVoiceSettings(userId: string) {
    return this.voiceSettings.get(userId);
  }

  async createAction(input: Omit<AssistantActionRecord, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const action: AssistantActionRecord = { ...input, id: createId("act"), createdAt: now, updatedAt: now };
    this.actions.set(action.id, action);
    return action;
  }

  async getActionForUser(userId: string, actionId: string) {
    const action = this.actions.get(actionId);
    return action?.userId === userId ? action : undefined;
  }

  async updateActionStatus(userId: string, actionId: string, status: AssistantActionRecord["status"], resultJson?: string) {
    const action = await this.getActionForUser(userId, actionId);
    if (!action) return undefined;
    const next: AssistantActionRecord = { ...action, status, updatedAt: new Date().toISOString() };
    if (resultJson) next.resultJson = resultJson;
    this.actions.set(actionId, next);
    return next;
  }

  async createActionConfirmation(input: Omit<ActionConfirmationRecord, "id" | "createdAt">) {
    const confirmation: ActionConfirmationRecord = {
      ...input,
      id: createId("conf"),
      createdAt: new Date().toISOString()
    };
    this.confirmations.set(confirmation.id, confirmation);
    return confirmation;
  }

  async createPlanWithSteps(
    input: Omit<AssistantPlanRecord, "id" | "createdAt" | "updatedAt">,
    steps: Array<Omit<AssistantPlanStepRecord, "id" | "planId">>
  ) {
    const now = new Date().toISOString();
    const plan: AssistantPlanRecord = { ...input, id: createId("plan"), createdAt: now, updatedAt: now };
    const createdSteps = steps.map((step) => ({ ...step, id: createId("step"), planId: plan.id }));
    this.plans.set(plan.id, plan);
    this.planSteps.set(plan.id, createdSteps);
    return { plan, steps: createdSteps };
  }

  async getPlanForUser(userId: string, planId: string) {
    const plan = this.plans.get(planId);
    if (!plan || plan.userId !== userId) return undefined;
    return { plan, steps: this.planSteps.get(planId) ?? [] };
  }

  async listCommandShortcuts(userId: string) {
    return [...this.commandShortcuts.values()].filter((item) => item.userId === userId);
  }

  async getCommandShortcut(userId: string, shortcut: string) {
    const normalized = shortcut.trim().toLowerCase();
    return [...this.commandShortcuts.values()].find(
      (item) => item.userId === userId && item.shortcut.toLowerCase() === normalized && item.confirmed && item.isActive
    );
  }

  async createCommandShortcut(input: Omit<CommandShortcutRecord, "id" | "createdAt" | "updatedAt">) {
    const existing = await this.getCommandShortcut(input.userId, input.shortcut);
    if (existing) {
      return (await this.updateCommandShortcut(input.userId, existing.id, input))!;
    }
    const now = new Date().toISOString();
    const record: CommandShortcutRecord = { ...input, id: createId("cmds"), createdAt: now, updatedAt: now };
    this.commandShortcuts.set(record.id, record);
    return record;
  }

  async updateCommandShortcut(userId: string, id: string, input: Partial<Pick<CommandShortcutRecord, "shortcut" | "intent" | "paramsJson" | "confidence" | "confirmed" | "isActive">>) {
    const current = this.commandShortcuts.get(id);
    if (!current || current.userId !== userId) return undefined;
    const next = { ...current, ...input, updatedAt: new Date().toISOString() };
    this.commandShortcuts.set(id, next);
    return next;
  }

  async deleteCommandShortcut(userId: string, id: string) {
    const current = this.commandShortcuts.get(id);
    if (!current || current.userId !== userId) return false;
    return this.commandShortcuts.delete(id);
  }

  async createCommandUsage(input: Omit<CommandUsageRecord, "id" | "createdAt">) {
    const record: CommandUsageRecord = { ...input, id: createId("cmdu"), createdAt: new Date().toISOString() };
    this.commandUsage.set(record.id, record);
    return record;
  }

  async listCommandUsage(userId: string) {
    return [...this.commandUsage.values()].filter((item) => item.userId === userId);
  }

  async createCommandLearning(input: Omit<CommandLearningRecord, "id" | "createdAt">) {
    const record: CommandLearningRecord = { ...input, id: createId("cmdl"), createdAt: new Date().toISOString() };
    this.commandLearning.set(record.id, record);
    return record;
  }

  async getUserSetting(userId: string, key: string) {
    return this.userSettings.get(`${userId}:${key}`);
  }

  async setUserSetting(userId: string, key: string, value: string) {
    this.userSettings.set(`${userId}:${key}`, value);
  }

  async createReminder(input: { userId: string; title: string; dueAt?: string }) {
    const record: ReminderRecord = { id: createId("rem"), userId: input.userId, title: input.title, status: "active", createdAt: new Date().toISOString(), ...(input.dueAt ? { dueAt: input.dueAt } : {}) };
    this.reminders.set(record.id, record);
    return record;
  }

  async listReminders(userId: string) {
    return [...this.reminders.values()].filter((item) => item.userId === userId && item.status === "active");
  }
}

type DbUserRow = { id: string; email: string; display_name: string; is_admin?: number; password_hash: string | null; created_at: string };
type DbAssistantMessageRow = { id: string; user_id: string; conversation_id: string | null; role: "user" | "assistant" | "system"; content: string; created_at: string };
type DbContactRow = { id: string; user_id: string; display_name: string; notes: string | null; created_at: string; updated_at: string };
type DbContactAliasRow = { id: string; user_id: string; contact_id: string; alias: string; confirmed: number; created_at: string };
type DbContactChannelRow = { id: string; user_id: string; contact_id: string; channel: string; address: string; is_preferred: number; created_at: string };
type DbOAuthRow = { id: string; user_id: string; provider: OAuthProvider; provider_user_id: string; scopes: string; expires_at: string | null; created_at: string };
type DbOAuthSecretRow = DbOAuthRow & { encrypted_access_token: string | null; encrypted_refresh_token: string | null };
type DbMemoryRow = { id: string; user_id: string; memory_type: string; key: string; value: string; confirmed: number; confidence: number; created_at: string };
type DbVoiceSettingsRow = { user_id: string; tts_enabled: number; stt_enabled: number; wake_word_enabled: number; selected_voice_id: string; language: string; speed: number; pitch: number; volume: number; auto_play_responses: number };
type DbActionRow = { id: string; user_id: string; conversation_id: string | null; tool_name: string; risk_level: "low" | "medium" | "high"; status: AssistantActionRecord["status"]; input_json: string; result_json: string | null; created_at: string; updated_at: string };
type DbPlanRow = { id: string; user_id: string; conversation_id: string | null; status: AssistantPlanRecord["status"]; title: string; goal: string; risk_level: "low" | "medium" | "high"; created_at: string; updated_at: string };
type DbPlanStepRow = { id: string; plan_id: string; order_index: number; title: string; description: string | null; tool_name: string | null; status: string; requires_confirmation: number; result_json: string | null };
type DbSessionRow = { id: string; user_id: string; token_hash: string; device_id: string | null; expires_at: string; created_at: string };
type DbCommandShortcutRow = { id: string; user_id: string; shortcut: string; intent: string; params_json: string; confidence: number; confirmed: number; is_active: number; created_at: string; updated_at: string };
type DbCommandUsageRow = { id: string; user_id: string; command_name: string | null; input_text: string; matched_pattern: string | null; confidence: number; used_ai_fallback: number; estimated_tokens_saved: number; status: string; created_at: string };
type DbReminderRow = { id: string; user_id: string; title: string; due_at: string | null; status: string; created_at: string };

export class D1Repository implements Repository {
  constructor(private readonly db: D1Database) {}

  async createUser(input: { email: string; displayName: string; passwordHash?: string }) {
    const existing = await this.findUserByEmail(input.email);
    if (existing) return existing;
    const user: UserRecord = {
      id: createId("usr"),
      email: input.email,
      displayName: input.displayName,
      isAdmin: false,
      createdAt: new Date().toISOString()
    };
    if (input.passwordHash) user.passwordHash = input.passwordHash;
    await this.db
      .prepare(`INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(user.id, user.email, user.displayName, user.passwordHash ?? null, user.createdAt, user.createdAt)
      .run();
    return user;
  }

  async findUserByEmail(email: string) {
    const row = await this.db
      .prepare(`SELECT id, email, display_name, is_admin, password_hash, created_at FROM users WHERE email = ? LIMIT 1`)
      .bind(email)
      .first<DbUserRow>();
    return row ? mapUser(row) : undefined;
  }

  async findUserById(userId: string) {
    const row = await this.db
      .prepare(`SELECT id, email, display_name, is_admin, password_hash, created_at FROM users WHERE id = ? LIMIT 1`)
      .bind(userId)
      .first<DbUserRow>();
    return row ? mapUser(row) : undefined;
  }

  async createSession(input: { userId: string; tokenHash: string; deviceId?: string; expiresAt: string }) {
    const session: SessionRecord = {
      id: createId("ses"),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString()
    };
    if (input.deviceId) session.deviceId = input.deviceId;
    await this.db
      .prepare(`INSERT INTO user_sessions (id, user_id, token_hash, device_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(session.id, session.userId, session.tokenHash, session.deviceId ?? null, session.expiresAt, session.createdAt)
      .run();
    return session;
  }

  async findActiveSessionByTokenHash(tokenHash: string) {
    const row = await this.db
      .prepare(`SELECT id, user_id, token_hash, device_id, expires_at, created_at FROM user_sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1`)
      .bind(tokenHash, new Date().toISOString())
      .first<DbSessionRow>();
    return row ? mapSession(row) : undefined;
  }

  async createAssistantMessage(input: Omit<AssistantMessageRecord, "id" | "createdAt">) {
    const message: AssistantMessageRecord = { ...input, id: createId("msg"), createdAt: new Date().toISOString() };
    await this.db
      .prepare(`INSERT INTO assistant_messages (id, user_id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(message.id, message.userId, message.conversationId ?? null, message.role, message.content, message.createdAt)
      .run();
    return message;
  }

  async listAssistantMessages(userId: string, limit = 50) {
    const result = await this.db
      .prepare(`SELECT id, user_id, conversation_id, role, content, created_at FROM assistant_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
      .bind(userId, limit)
      .all<DbAssistantMessageRow>();
    return result.results.map(mapAssistantMessage).reverse();
  }

  async createContact(input: { userId: string; displayName: string; notes?: string }) {
    const now = new Date().toISOString();
    const contact: ContactRecord = {
      id: createId("ctc"),
      userId: input.userId,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now
    };
    if (input.notes) contact.notes = input.notes;
    await this.db
      .prepare(`INSERT INTO contacts (id, user_id, display_name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(contact.id, contact.userId, contact.displayName, contact.notes ?? null, contact.createdAt, contact.updatedAt)
      .run();
    return contact;
  }

  async listContactsForUser(userId: string) {
    const result = await this.db
      .prepare(`SELECT id, user_id, display_name, notes, created_at, updated_at FROM contacts WHERE user_id = ? ORDER BY display_name ASC`)
      .bind(userId)
      .all<DbContactRow>();
    return result.results.map(mapContact);
  }

  async createContactAlias(input: { userId: string; contactId: string; alias: string; confirmed: boolean }) {
    const contact = (await this.listContactsForUser(input.userId)).find((item) => item.id === input.contactId);
    if (!contact) throw new Error("contact_not_found");
    const record: ContactAliasRecord = {
      id: createId("cal"),
      userId: input.userId,
      contactId: input.contactId,
      alias: input.alias,
      confirmed: input.confirmed,
      createdAt: new Date().toISOString()
    };
    await this.db
      .prepare(`INSERT INTO contact_aliases (id, user_id, contact_id, alias, confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(record.id, record.userId, record.contactId, record.alias, record.confirmed ? 1 : 0, record.createdAt)
      .run();
    return record;
  }

  async createContactChannel(input: { userId: string; contactId: string; channel: string; address: string; isPreferred: boolean }) {
    const contact = (await this.listContactsForUser(input.userId)).find((item) => item.id === input.contactId);
    if (!contact) throw new Error("contact_not_found");
    const record: ContactChannelRecord = {
      id: createId("cch"),
      userId: input.userId,
      contactId: input.contactId,
      channel: input.channel,
      address: input.address,
      isPreferred: input.isPreferred,
      createdAt: new Date().toISOString()
    };
    await this.db
      .prepare(`INSERT INTO contact_channels (id, user_id, contact_id, channel, address, is_preferred, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(record.id, record.userId, record.contactId, record.channel, record.address, record.isPreferred ? 1 : 0, record.createdAt)
      .run();
    return record;
  }

  async resolveContact(userId: string, query: string) {
    const contactRow = await this.db
      .prepare(`SELECT id, user_id, display_name, notes, created_at, updated_at FROM contacts WHERE user_id = ? AND lower(display_name) = lower(?) LIMIT 1`)
      .bind(userId, query)
      .first<DbContactRow>();
    const aliasRow = await this.db
      .prepare(`SELECT id, user_id, contact_id, alias, confirmed, created_at FROM contact_aliases WHERE user_id = ? AND lower(alias) = lower(?) AND confirmed = 1 LIMIT 1`)
      .bind(userId, query)
      .first<DbContactAliasRow>();
    const resolvedContactRow = aliasRow
      ? await this.db
          .prepare(`SELECT id, user_id, display_name, notes, created_at, updated_at FROM contacts WHERE id = ? AND user_id = ? LIMIT 1`)
          .bind(aliasRow.contact_id, userId)
          .first<DbContactRow>()
      : contactRow;
    if (!resolvedContactRow) return undefined;
    const channelRow = await this.db
      .prepare(`SELECT id, user_id, contact_id, channel, address, is_preferred, created_at FROM contact_channels WHERE user_id = ? AND contact_id = ? ORDER BY is_preferred DESC, created_at ASC LIMIT 1`)
      .bind(userId, resolvedContactRow.id)
      .first<DbContactChannelRow>();
    const resolved: ResolvedContactRecord = { contact: mapContact(resolvedContactRow) };
    if (aliasRow) resolved.alias = mapContactAlias(aliasRow);
    if (channelRow) resolved.preferredChannel = mapContactChannel(channelRow);
    return resolved;
  }

  async upsertOAuthAccount(input: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
    encryptedAccessToken?: string;
    encryptedRefreshToken?: string;
    scopes: string[];
    expiresAt?: string;
  }) {
    const existing = (await this.listOAuthAccountsForUser(input.userId)).find(
      (account) => account.provider === input.provider
    );
    const account: OAuthAccountRecord = {
      id: existing?.id ?? createId("oauth"),
      userId: input.userId,
      provider: input.provider,
      providerUserId: input.providerUserId,
      scopes: input.scopes,
      createdAt: existing?.createdAt ?? new Date().toISOString()
    };
    if (input.expiresAt) account.expiresAt = input.expiresAt;
    await this.db
      .prepare(
        `INSERT INTO oauth_accounts
           (id, user_id, provider, provider_user_id, encrypted_access_token, encrypted_refresh_token, scopes, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, provider_user_id) DO UPDATE SET
           user_id = excluded.user_id,
           encrypted_access_token = COALESCE(excluded.encrypted_access_token, oauth_accounts.encrypted_access_token),
           encrypted_refresh_token = COALESCE(excluded.encrypted_refresh_token, oauth_accounts.encrypted_refresh_token),
           scopes = excluded.scopes,
           expires_at = excluded.expires_at`
      )
      .bind(
        account.id,
        account.userId,
        account.provider,
        account.providerUserId,
        input.encryptedAccessToken ?? null,
        input.encryptedRefreshToken ?? null,
        JSON.stringify(input.scopes),
        account.expiresAt ?? null,
        account.createdAt
      )
      .run();
    return account;
  }

  async listOAuthAccountsForUser(userId: string) {
    const result = await this.db
      .prepare(`SELECT id, user_id, provider, provider_user_id, scopes, expires_at, created_at FROM oauth_accounts WHERE user_id = ? ORDER BY provider ASC`)
      .bind(userId)
      .all<DbOAuthRow>();
    return result.results.map(mapOAuthAccount);
  }

  async getOAuthAccountSecrets(userId: string, provider: OAuthProvider) {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, provider, provider_user_id, scopes, expires_at, created_at, encrypted_access_token, encrypted_refresh_token
         FROM oauth_accounts
         WHERE user_id = ? AND provider = ?
         LIMIT 1`
      )
      .bind(userId, provider)
      .first<DbOAuthSecretRow>();
    return row ? mapOAuthAccountSecret(row) : undefined;
  }

  async disconnectOAuthAccount(userId: string, provider: OAuthProvider) {
    const result = await this.db
      .prepare(`DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?`)
      .bind(userId, provider)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  async createMemory(input: Omit<MemoryRecord, "id" | "createdAt">) {
    const memory: MemoryRecord = { ...input, id: createId("mem"), createdAt: new Date().toISOString() };
    await this.db
      .prepare(
        `INSERT INTO assistant_memories
           (id, user_id, memory_type, key, value, confirmed, confidence, source, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'user_confirmation', 1, ?, ?)`
      )
      .bind(memory.id, memory.userId, memory.memoryType, memory.key, memory.value, memory.confirmed ? 1 : 0, memory.confidence, memory.createdAt, memory.createdAt)
      .run();
    return memory;
  }

  async listMemoriesForUser(userId: string) {
    const result = await this.db
      .prepare(`SELECT id, user_id, memory_type, key, value, confirmed, confidence, created_at FROM assistant_memories WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC`)
      .bind(userId)
      .all<DbMemoryRow>();
    return result.results.map(mapMemory);
  }

  async resolveMemory(userId: string, key: string) {
    const row = await this.db
      .prepare(`SELECT id, user_id, memory_type, key, value, confirmed, confidence, created_at FROM assistant_memories WHERE user_id = ? AND lower(key) = lower(?) AND is_active = 1 ORDER BY confirmed DESC, confidence DESC, created_at DESC LIMIT 1`)
      .bind(userId, key)
      .first<DbMemoryRow>();
    return row ? mapMemory(row) : undefined;
  }

  async updateMemory(
    userId: string,
    memoryId: string,
    input: Partial<Pick<MemoryRecord, "key" | "value" | "confirmed" | "confidence">>
  ) {
    const current = (await this.listMemoriesForUser(userId)).find((memory) => memory.id === memoryId);
    if (!current) return undefined;
    const next = { ...current, ...input };
    await this.db
      .prepare(`UPDATE assistant_memories SET key = ?, value = ?, confirmed = ?, confidence = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
      .bind(next.key, next.value, next.confirmed ? 1 : 0, next.confidence, new Date().toISOString(), memoryId, userId)
      .run();
    return next;
  }

  async deleteMemory(userId: string, memoryId: string) {
    const result = await this.db
      .prepare(`UPDATE assistant_memories SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?`)
      .bind(new Date().toISOString(), memoryId, userId)
      .run();
    return (result.meta.changes ?? 0) > 0;
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
      .bind(id, userId, settings.ttsEnabled ? 1 : 0, settings.sttEnabled ? 1 : 0, settings.wakeWordEnabled ? 1 : 0, settings.selectedVoiceId, settings.language, settings.speed, settings.pitch, settings.volume, settings.autoPlayResponses ? 1 : 0, now, now)
      .run();
    return settings;
  }

  async getVoiceSettings(userId: string) {
    const row = await this.db
      .prepare(`SELECT user_id, tts_enabled, stt_enabled, wake_word_enabled, selected_voice_id, language, speed, pitch, volume, auto_play_responses FROM voice_settings WHERE user_id = ? LIMIT 1`)
      .bind(userId)
      .first<DbVoiceSettingsRow>();
    return row ? mapVoiceSettings(row) : undefined;
  }

  async createAction(input: Omit<AssistantActionRecord, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const action: AssistantActionRecord = { ...input, id: createId("act"), createdAt: now, updatedAt: now };
    await this.db
      .prepare(`INSERT INTO assistant_actions (id, user_id, conversation_id, tool_name, risk_level, status, input_json, result_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(action.id, action.userId, action.conversationId ?? null, action.toolName, action.riskLevel, action.status, action.inputJson, action.resultJson ?? null, now, now)
      .run();
    return action;
  }

  async getActionForUser(userId: string, actionId: string) {
    const row = await this.db
      .prepare(`SELECT id, user_id, conversation_id, tool_name, risk_level, status, input_json, result_json, created_at, updated_at FROM assistant_actions WHERE id = ? AND user_id = ? LIMIT 1`)
      .bind(actionId, userId)
      .first<DbActionRow>();
    return row ? mapAction(row) : undefined;
  }

  async updateActionStatus(userId: string, actionId: string, status: AssistantActionRecord["status"], resultJson?: string) {
    await this.db
      .prepare(`UPDATE assistant_actions SET status = ?, result_json = COALESCE(?, result_json), updated_at = ? WHERE id = ? AND user_id = ?`)
      .bind(status, resultJson ?? null, new Date().toISOString(), actionId, userId)
      .run();
    return this.getActionForUser(userId, actionId);
  }

  async createActionConfirmation(input: Omit<ActionConfirmationRecord, "id" | "createdAt">) {
    const confirmation: ActionConfirmationRecord = {
      ...input,
      id: createId("conf"),
      createdAt: new Date().toISOString()
    };
    await this.db
      .prepare(`INSERT INTO action_confirmations (id, user_id, action_id, decision, confirmed_payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(confirmation.id, confirmation.userId, confirmation.actionId, confirmation.decision, confirmation.confirmedPayloadJson ?? null, confirmation.createdAt)
      .run();
    return confirmation;
  }

  async createPlanWithSteps(
    input: Omit<AssistantPlanRecord, "id" | "createdAt" | "updatedAt">,
    steps: Array<Omit<AssistantPlanStepRecord, "id" | "planId">>
  ) {
    const now = new Date().toISOString();
    const plan: AssistantPlanRecord = { ...input, id: createId("plan"), createdAt: now, updatedAt: now };
    await this.db
      .prepare(`INSERT INTO assistant_plans (id, user_id, conversation_id, status, title, goal, risk_level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(plan.id, plan.userId, plan.conversationId ?? null, plan.status, plan.title, plan.goal, plan.riskLevel, now, now)
      .run();
    const createdSteps: AssistantPlanStepRecord[] = [];
    for (const step of steps) {
      const createdStep: AssistantPlanStepRecord = { ...step, id: createId("step"), planId: plan.id };
      await this.db
        .prepare(`INSERT INTO assistant_plan_steps (id, plan_id, order_index, title, description, tool_name, status, requires_confirmation, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(createdStep.id, createdStep.planId, createdStep.orderIndex, createdStep.title, createdStep.description ?? null, createdStep.toolName ?? null, createdStep.status, createdStep.requiresConfirmation ? 1 : 0, createdStep.resultJson ?? null)
        .run();
      createdSteps.push(createdStep);
    }
    return { plan, steps: createdSteps };
  }

  async getPlanForUser(userId: string, planId: string) {
    const planRow = await this.db
      .prepare(`SELECT id, user_id, conversation_id, status, title, goal, risk_level, created_at, updated_at FROM assistant_plans WHERE id = ? AND user_id = ? LIMIT 1`)
      .bind(planId, userId)
      .first<DbPlanRow>();
    if (!planRow) return undefined;
    const steps = await this.db
      .prepare(`SELECT id, plan_id, order_index, title, description, tool_name, status, requires_confirmation, result_json FROM assistant_plan_steps WHERE plan_id = ? ORDER BY order_index ASC`)
      .bind(planId)
      .all<DbPlanStepRow>();
    return { plan: mapPlan(planRow), steps: steps.results.map(mapPlanStep) };
  }

  async listCommandShortcuts(userId: string) {
    const result = await this.db.prepare(`SELECT id, user_id, shortcut, intent, params_json, confidence, confirmed, is_active, created_at, updated_at FROM user_command_shortcuts WHERE user_id = ? ORDER BY shortcut`).bind(userId).all<DbCommandShortcutRow>();
    return result.results.map(mapCommandShortcut);
  }

  async getCommandShortcut(userId: string, shortcut: string) {
    const row = await this.db.prepare(`SELECT id, user_id, shortcut, intent, params_json, confidence, confirmed, is_active, created_at, updated_at FROM user_command_shortcuts WHERE user_id = ? AND lower(shortcut) = lower(?) AND confirmed = 1 AND is_active = 1 LIMIT 1`).bind(userId, shortcut.trim()).first<DbCommandShortcutRow>();
    return row ? mapCommandShortcut(row) : undefined;
  }

  async createCommandShortcut(input: Omit<CommandShortcutRecord, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const record: CommandShortcutRecord = { ...input, id: createId("cmds"), createdAt: now, updatedAt: now };
    await this.db.prepare(`INSERT INTO user_command_shortcuts (id, user_id, shortcut, intent, params_json, confidence, confirmed, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, shortcut) DO UPDATE SET intent = excluded.intent, params_json = excluded.params_json, confidence = excluded.confidence, confirmed = excluded.confirmed, is_active = excluded.is_active, updated_at = excluded.updated_at`).bind(record.id, record.userId, record.shortcut, record.intent, record.paramsJson, record.confidence, record.confirmed ? 1 : 0, record.isActive ? 1 : 0, now, now).run();
    return (await this.getCommandShortcut(record.userId, record.shortcut)) ?? record;
  }

  async updateCommandShortcut(userId: string, id: string, input: Partial<Pick<CommandShortcutRecord, "shortcut" | "intent" | "paramsJson" | "confidence" | "confirmed" | "isActive">>) {
    const current = (await this.listCommandShortcuts(userId)).find((item) => item.id === id);
    if (!current) return undefined;
    const next = { ...current, ...input, updatedAt: new Date().toISOString() };
    await this.db.prepare(`UPDATE user_command_shortcuts SET shortcut = ?, intent = ?, params_json = ?, confidence = ?, confirmed = ?, is_active = ?, updated_at = ? WHERE id = ? AND user_id = ?`).bind(next.shortcut, next.intent, next.paramsJson, next.confidence, next.confirmed ? 1 : 0, next.isActive ? 1 : 0, next.updatedAt, id, userId).run();
    return next;
  }

  async deleteCommandShortcut(userId: string, id: string) {
    const result = await this.db.prepare(`DELETE FROM user_command_shortcuts WHERE id = ? AND user_id = ?`).bind(id, userId).run();
    return (result.meta.changes ?? 0) > 0;
  }

  async createCommandUsage(input: Omit<CommandUsageRecord, "id" | "createdAt">) {
    const record: CommandUsageRecord = { ...input, id: createId("cmdu"), createdAt: new Date().toISOString() };
    await this.db.prepare(`INSERT INTO command_usage_events (id, user_id, command_name, input_text, matched_pattern, confidence, used_ai_fallback, estimated_tokens_saved, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, record.userId, record.commandName ?? null, record.inputText, record.matchedPattern ?? null, record.confidence, record.usedAiFallback ? 1 : 0, record.estimatedTokensSaved, record.status, record.createdAt).run();
    return record;
  }

  async listCommandUsage(userId: string) {
    const result = await this.db.prepare(`SELECT id, user_id, command_name, input_text, matched_pattern, confidence, used_ai_fallback, estimated_tokens_saved, status, created_at FROM command_usage_events WHERE user_id = ? ORDER BY created_at DESC`).bind(userId).all<DbCommandUsageRow>();
    return result.results.map(mapCommandUsage);
  }

  async createCommandLearning(input: Omit<CommandLearningRecord, "id" | "createdAt">) {
    const record: CommandLearningRecord = { ...input, id: createId("cmdl"), createdAt: new Date().toISOString() };
    await this.db.prepare(`INSERT INTO command_learning_events (id, user_id, source_text, suggested_shortcut, intent, params_json, confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(record.id, record.userId, record.sourceText, record.suggestedShortcut, record.intent, record.paramsJson, record.confirmed ? 1 : 0, record.createdAt).run();
    return record;
  }

  async getUserSetting(userId: string, key: string) {
    const row = await this.db.prepare(`SELECT value FROM user_settings WHERE user_id = ? AND key = ? LIMIT 1`).bind(userId, key).first<{ value: string }>();
    return row?.value;
  }

  async setUserSetting(userId: string, key: string, value: string) {
    await this.db.prepare(`INSERT INTO user_settings (id, user_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(createId("set"), userId, key, value, new Date().toISOString()).run();
  }

  async createReminder(input: { userId: string; title: string; dueAt?: string }) {
    const record: ReminderRecord = { id: createId("rem"), userId: input.userId, title: input.title, status: "active", createdAt: new Date().toISOString(), ...(input.dueAt ? { dueAt: input.dueAt } : {}) };
    await this.db.prepare(`INSERT INTO reminders (id, user_id, title, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(record.id, record.userId, record.title, record.dueAt ?? null, record.status, record.createdAt).run();
    return record;
  }

  async listReminders(userId: string) {
    const result = await this.db.prepare(`SELECT id, user_id, title, due_at, status, created_at FROM reminders WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC`).bind(userId).all<DbReminderRow>();
    return result.results.map((row) => ({ id: row.id, userId: row.user_id, title: row.title, status: row.status, createdAt: row.created_at, ...(row.due_at ? { dueAt: row.due_at } : {}) }));
  }
}

const memoryRepository = new InMemoryRepository();

export const createRepository = (db?: D1Database): Repository => (db ? new D1Repository(db) : memoryRepository);

const mapUser = (row: DbUserRow): UserRecord => {
  const user: UserRecord = { id: row.id, email: row.email, displayName: row.display_name, isAdmin: row.is_admin === 1, createdAt: row.created_at };
  if (row.password_hash) user.passwordHash = row.password_hash;
  return user;
};

const mapAssistantMessage = (row: DbAssistantMessageRow): AssistantMessageRecord => {
  const message: AssistantMessageRecord = {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  };
  if (row.conversation_id) message.conversationId = row.conversation_id;
  return message;
};

const mapSession = (row: DbSessionRow): SessionRecord => {
  const record: SessionRecord = { id: row.id, userId: row.user_id, tokenHash: row.token_hash, expiresAt: row.expires_at, createdAt: row.created_at };
  if (row.device_id) record.deviceId = row.device_id;
  return record;
};

const mapCommandShortcut = (row: DbCommandShortcutRow): CommandShortcutRecord => ({ id: row.id, userId: row.user_id, shortcut: row.shortcut, intent: row.intent, paramsJson: row.params_json, confidence: row.confidence, confirmed: row.confirmed === 1, isActive: row.is_active === 1, createdAt: row.created_at, updatedAt: row.updated_at });

const mapCommandUsage = (row: DbCommandUsageRow): CommandUsageRecord => {
  const record: CommandUsageRecord = { id: row.id, userId: row.user_id, inputText: row.input_text, confidence: row.confidence, usedAiFallback: row.used_ai_fallback === 1, estimatedTokensSaved: row.estimated_tokens_saved, status: row.status, createdAt: row.created_at };
  if (row.command_name) record.commandName = row.command_name;
  if (row.matched_pattern) record.matchedPattern = row.matched_pattern;
  return record;
};

const mapContact = (row: DbContactRow): ContactRecord => {
  const contact: ContactRecord = {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (row.notes) contact.notes = row.notes;
  return contact;
};

const mapContactAlias = (row: DbContactAliasRow): ContactAliasRecord => ({
  id: row.id,
  userId: row.user_id,
  contactId: row.contact_id,
  alias: row.alias,
  confirmed: row.confirmed === 1,
  createdAt: row.created_at
});

const mapContactChannel = (row: DbContactChannelRow): ContactChannelRecord => ({
  id: row.id,
  userId: row.user_id,
  contactId: row.contact_id,
  channel: row.channel,
  address: row.address,
  isPreferred: row.is_preferred === 1,
  createdAt: row.created_at
});

const mapOAuthAccount = (row: DbOAuthRow): OAuthAccountRecord => {
  const account: OAuthAccountRecord = {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    scopes: JSON.parse(row.scopes) as string[],
    createdAt: row.created_at
  };
  if (row.expires_at) account.expiresAt = row.expires_at;
  return account;
};

const mapOAuthAccountSecret = (row: DbOAuthSecretRow): OAuthAccountSecretRecord => {
  const account: OAuthAccountSecretRecord = {
    ...mapOAuthAccount(row)
  };
  if (row.encrypted_access_token) account.encryptedAccessToken = row.encrypted_access_token;
  if (row.encrypted_refresh_token) account.encryptedRefreshToken = row.encrypted_refresh_token;
  return account;
};

const redactOAuthAccount = (
  account: OAuthAccountRecord & { encryptedAccessToken?: string; encryptedRefreshToken?: string }
): OAuthAccountRecord => {
  const redacted: OAuthAccountRecord = {
    id: account.id,
    userId: account.userId,
    provider: account.provider,
    providerUserId: account.providerUserId,
    scopes: account.scopes,
    createdAt: account.createdAt
  };
  if (account.expiresAt) redacted.expiresAt = account.expiresAt;
  return redacted;
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

const mapAction = (row: DbActionRow): AssistantActionRecord => {
  const action: AssistantActionRecord = {
    id: row.id,
    userId: row.user_id,
    toolName: row.tool_name,
    riskLevel: row.risk_level,
    status: row.status,
    inputJson: row.input_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (row.conversation_id) action.conversationId = row.conversation_id;
  if (row.result_json) action.resultJson = row.result_json;
  return action;
};

const mapPlan = (row: DbPlanRow): AssistantPlanRecord => {
  const plan: AssistantPlanRecord = {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    title: row.title,
    goal: row.goal,
    riskLevel: row.risk_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (row.conversation_id) plan.conversationId = row.conversation_id;
  return plan;
};

const mapPlanStep = (row: DbPlanStepRow): AssistantPlanStepRecord => {
  const step: AssistantPlanStepRecord = {
    id: row.id,
    planId: row.plan_id,
    orderIndex: row.order_index,
    title: row.title,
    status: row.status,
    requiresConfirmation: row.requires_confirmation === 1
  };
  if (row.description) step.description = row.description;
  if (row.tool_name) step.toolName = row.tool_name;
  if (row.result_json) step.resultJson = row.result_json;
  return step;
};
