import { createHmac } from "node:crypto";

export function createDedupeKey(secret: string, ownerUid: string, restaurantId: string, mealDate: string) {
  if (secret.length < 32) throw new Error("DEDUPE_HMAC_SECRET must be at least 32 characters.");
  return createHmac("sha256", secret)
    .update([ownerUid.trim(), restaurantId.trim(), mealDate.trim()].join("\u001f"))
    .digest("hex");
}

export function rateLimitBucket(now: Date, durationMinutes: number) {
  const bucket = Math.floor(now.getTime() / (durationMinutes * 60_000));
  return bucket.toString(36);
}
