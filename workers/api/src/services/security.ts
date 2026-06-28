export const hashPassword = async (password: string) => {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const verifyPassword = async (password: string, hash: string) =>
  (await hashPassword(password)) === hash;

export const createSessionToken = async (userId: string, secret = "local-dev-secret-change-me") => {
  const payload = `${userId}.${Date.now()}`;
  const signatureData = new TextEncoder().encode(`${payload}.${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", signatureData);
  const signature = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return `${btoa(payload)}.${signature}`;
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
