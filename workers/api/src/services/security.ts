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
