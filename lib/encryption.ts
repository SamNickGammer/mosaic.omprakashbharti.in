import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for API keys at rest.
 *
 * Stored format: `iv:tag:ciphertext` (all hex).
 *
 * NOTE: Never log plaintext keys or the ENCRYPTION_KEY anywhere.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32",
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 32-byte (64 hex char) string for AES-256.",
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString(
    "hex",
  )}`;
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Malformed ciphertext: expected iv:tag:ciphertext");
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return (
    decipher.update(Buffer.from(encryptedHex, "hex")).toString("utf8") +
    decipher.final("utf8")
  );
}

/**
 * Returns a masked preview of a key for safe display in the UI,
 * e.g. "sk-ant-…last4". Never returns the full key.
 */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 8) return "••••";
  return `${plaintext.slice(0, 3)}…${plaintext.slice(-4)}`;
}
