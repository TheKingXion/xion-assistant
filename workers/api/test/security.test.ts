import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../src/services/security";

describe("token encryption", () => {
  it("encrypts tokens without storing plaintext and decrypts with the same key", async () => {
    const key = "local-token-encryption-key-32-chars";
    const encrypted = await encryptToken("super-secret-token", key);

    expect(encrypted).not.toContain("super-secret-token");
    await expect(decryptToken(encrypted, key)).resolves.toBe("super-secret-token");
  });
});
