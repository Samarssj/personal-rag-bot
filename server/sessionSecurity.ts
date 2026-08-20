import crypto from "node:crypto";

export function hashDeleteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hasMatchingDeleteToken(expectedHash: string, suppliedToken: string) {
  const suppliedHash = hashDeleteToken(suppliedToken);
  const expected = Buffer.from(expectedHash, "utf8");
  const supplied = Buffer.from(suppliedHash, "utf8");
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}
