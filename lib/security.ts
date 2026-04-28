import crypto from "crypto";

const DEFAULT_KEY_MATERIAL =
  process.env.APP_AES_SECRET || "clinic-demo-secret-key-material-32-bytes";

function getAesKey() {
  return crypto.createHash("sha256").update(DEFAULT_KEY_MATERIAL).digest();
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string) {
  return sha256(`clinic-password:${password}`);
}

export function encryptPHI(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPHI(payload: string) {
  if (!payload) {
    return "";
  }

  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getAesKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export function encryptJson(value: unknown) {
  return encryptPHI(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decryptPHI(payload)) as T;
}

export function tryDecryptPHI(payload: string | null | undefined) {
  if (!payload) {
    return "";
  }

  try {
    return decryptPHI(payload);
  } catch {
    return "";
  }
}

export function maskPhi(value: string) {
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 2)}${"*".repeat(Math.max(3, value.length - 4))}${value.slice(-2)}`;
}
