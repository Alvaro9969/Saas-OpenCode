import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

function normalizeSignature(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("sha256=")) {
    return trimmed.slice("sha256=".length);
  }

  return trimmed;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isValidVapiSignature(request: NextRequest, rawBody: string) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  if (!secret) {
    return false;
  }

  const headerValue =
    request.headers.get("x-vapi-signature") ??
    request.headers.get("x-vapi-signature-sha256");

  if (!headerValue) {
    return false;
  }

  const receivedSignature = normalizeSignature(headerValue);

  const expectedHex = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBase64 = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return (
    safeCompare(expectedHex, receivedSignature) ||
    safeCompare(expectedBase64, receivedSignature)
  );
}
