import { createHash, createHmac } from "node:crypto";

export function sha256Base64Url(value: string) {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

export function kakaoFirebaseUid(secret: string, kakaoMemberId: string) {
  const subject = createHmac("sha256", secret).update(`kakao:${kakaoMemberId}`, "utf8").digest("base64url");
  return `kakao_${subject}`;
}

export function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/report";
  try {
    const parsed = new URL(value, "https://foodsick.invalid");
    if (parsed.origin !== "https://foodsick.invalid") return "/report";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/report";
  }
}

