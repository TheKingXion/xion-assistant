export const hashPassword = async (password: string) => {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const verifyPassword = async (password: string, hash: string) =>
  (await hashPassword(password)) === hash;

const base64UrlEncode = (value: Uint8Array | string) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecode = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const signSessionPayload = async (payload: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
};

export const createSessionToken = async (
  userId: string,
  secret = "local-dev-secret-change-me",
  expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30
) => {
  const payload = base64UrlEncode(JSON.stringify({ sub: userId, iat: Date.now(), exp: expiresAt, nonce: crypto.randomUUID() }));
  return `${payload}.${base64UrlEncode(await signSessionPayload(payload, secret))}`;
};

export const verifySessionToken = async (token: string, secret = "local-dev-secret-change-me") => {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return undefined;
    const expected = await signSessionPayload(payload, secret);
    const actual = base64UrlDecode(signature);
    if (expected.length !== actual.length) return undefined;
    let mismatch = 0;
    expected.forEach((byte, index) => { mismatch |= byte ^ (actual[index] ?? 0); });
    if (mismatch !== 0) return undefined;
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { sub?: string; exp?: number };
    if (!parsed.sub || !parsed.exp || parsed.exp <= Date.now()) return undefined;
    return { userId: parsed.sub, expiresAt: new Date(parsed.exp).toISOString() };
  } catch {
    return undefined;
  }
};

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const base64ToBytes = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const deriveAesKey = async (secret: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const encryptToken = async (token: string, secret: string) => {
  if (secret.length < 32) throw new Error("token_encryption_key_too_short");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secret);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token))
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(encrypted)}`;
};

export const decryptToken = async (encryptedToken: string, secret: string) => {
  if (secret.length < 32) throw new Error("token_encryption_key_too_short");
  const [ivPart, dataPart] = encryptedToken.split(".");
  if (!ivPart || !dataPart) throw new Error("invalid_encrypted_token");
  const key = await deriveAesKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivPart) },
    key,
    base64ToBytes(dataPart)
  );
  return new TextDecoder().decode(decrypted);
};
