import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { DomainError } from "@/domain/money";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export function encryptionKeyFromHex(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new DomainError("Bank encryption key must be 32 bytes of hex.");
  }
  return Buffer.from(hexKey, "hex");
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new DomainError("Encryption key must be 32 bytes.");
  }
  const initialisationVector = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, initialisationVector);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    initialisationVector.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [vectorPart, tagPart, encryptedPart] = payload.split(".");
  if (!vectorPart || !tagPart || !encryptedPart) {
    throw new DomainError("Encrypted bank field is malformed.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(vectorPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskAccountNumber(last4: string): string {
  if (!/^\d{4}$/.test(last4)) {
    return "••••";
  }
  return `•••• ${last4}`;
}

export function lastFourDigits(accountNumber: string): string | null {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) {
    return null;
  }
  return digits.slice(-4);
}
