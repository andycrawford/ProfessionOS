import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Resolve the 32-byte AES key used for at-rest encryption.
 *
 * Key priority:
 *   1. ENCRYPTION_KEY env var — 64 hex characters (= 32 bytes).
 *      Generate with: openssl rand -hex 32
 *   2. AUTH_SECRET fallback — base64-encoded; first 32 bytes are used.
 *      Acceptable for dev/single-server deployments but prefer a dedicated key.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!raw) throw new Error("Missing ENCRYPTION_KEY or AUTH_SECRET env var");

  // Preferred: hex-encoded 32-byte key (64 hex chars)
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // Fallback: base64-encoded (AUTH_SECRET default format) — use first 32 bytes
  const buf = Buffer.from(raw, "base64");
  if (buf.length < 32) {
    throw new Error("ENCRYPTION_KEY / AUTH_SECRET must decode to at least 32 bytes");
  }
  return buf.subarray(0, 32);
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 *
 * Returns a colon-delimited string: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 * The auth tag provides integrity — decryption will throw if the value is tampered.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV is the GCM recommendation
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${data.toString("hex")}`;
}

/**
 * Decrypt a value produced by `encrypt()`.
 * Throws if the value is malformed or the auth tag doesn't match.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value — expected <iv>:<tag>:<data>");
  }
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
