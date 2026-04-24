import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

type TwilioParams = Record<string, string>;

function buildValidationUrl(request: NextRequest) {
  const configuredBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;

  if (!configuredBaseUrl) {
    return request.url;
  }

  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, configuredBaseUrl);
  return url.toString();
}

function computeTwilioSignature(url: string, params: TwilioParams, authToken: string) {
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url);

  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function parseTwilioFormParams(rawBody: string): TwilioParams {
  const searchParams = new URLSearchParams(rawBody);
  const params: TwilioParams = {};

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  return params;
}

export function isValidTwilioSignature(
  request: NextRequest,
  params: TwilioParams,
  signatureHeader: string | null
) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!signatureHeader || !authToken) {
    return false;
  }

  const validationUrl = buildValidationUrl(request);
  const expectedSignature = computeTwilioSignature(validationUrl, params, authToken);

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildTwimlMessage(message: string, withHangup = true) {
  const safeMessage = escapeXml(message);
  const hangup = withHangup ? "<Hangup/>" : "";

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-ES" voice="alice">${safeMessage}</Say>${hangup}</Response>`;
}
