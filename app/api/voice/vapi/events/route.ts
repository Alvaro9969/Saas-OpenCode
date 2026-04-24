import { prisma } from "@/lib/prisma";
import { isValidVapiSignature } from "@/lib/voice/vapiWebhook";
import { CallStatus, TranscriptSpeaker } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseStatus(status: string | null): CallStatus {
  switch (status) {
    case "queued":
      return CallStatus.initiated;
    case "ringing":
      return CallStatus.ringing;
    case "in-progress":
    case "in_progress":
    case "ongoing":
      return CallStatus.in_progress;
    case "completed":
    case "ended":
      return CallStatus.completed;
    case "failed":
    case "error":
      return CallStatus.failed;
    case "no-answer":
    case "no_answer":
      return CallStatus.no_answer;
    case "busy":
      return CallStatus.busy;
    case "cancelled":
    case "canceled":
      return CallStatus.canceled;
    default:
      return CallStatus.initiated;
  }
}

function parseSpeaker(value: string | null): TranscriptSpeaker {
  switch (value) {
    case "assistant":
    case "bot":
    case "agent":
      return TranscriptSpeaker.assistant;
    case "caller":
    case "customer":
    case "user":
      return TranscriptSpeaker.caller;
    case "tool":
      return TranscriptSpeaker.tool;
    case "system":
      return TranscriptSpeaker.system;
    default:
      return TranscriptSpeaker.system;
  }
}

function isTerminalStatus(status: CallStatus) {
  return (
    status === CallStatus.completed ||
    status === CallStatus.failed ||
    status === CallStatus.no_answer ||
    status === CallStatus.busy ||
    status === CallStatus.canceled
  );
}

function extractRootPayload(payload: UnknownRecord) {
  const message = asRecord(payload.message) ?? payload;
  const call = asRecord(message.call) ?? asRecord(payload.call) ?? {};
  const metadata =
    asRecord(message.metadata) ??
    asRecord(call.metadata) ??
    asRecord(payload.metadata) ??
    {};

  const assistant = asRecord(message.assistant) ?? asRecord(call.assistant) ?? {};

  const callId =
    asString(call.id) ??
    asString(message.callId) ??
    asString(payload.callId) ??
    asString(message.id);

  const fromPhone =
    asString(call.fromNumber) ??
    asString(call.from) ??
    asString(message.fromNumber) ??
    asString(message.from) ??
    asString(payload.fromNumber) ??
    asString(payload.from) ??
    "unknown";

  const toPhone =
    asString(call.toNumber) ??
    asString(call.to) ??
    asString(message.toNumber) ??
    asString(message.to) ??
    asString(payload.toNumber) ??
    asString(payload.to);

  const status = parseStatus(
    asString(call.status) ?? asString(message.status) ?? asString(payload.status)
  );

  const eventType =
    asString(message.type) ?? asString(payload.type) ?? "unknown_event";

  const restaurantId =
    asString(metadata.restaurantId) ?? asString(payload.restaurantId);

  const assistantId =
    asString(assistant.id) ?? asString(message.assistantId) ?? asString(payload.assistantId);

  const startedAt =
    asDate(call.startedAt) ?? asDate(message.startedAt) ?? asDate(payload.startedAt);

  const endedAt =
    asDate(call.endedAt) ?? asDate(message.endedAt) ?? asDate(payload.endedAt);

  const durationSecRaw =
    (typeof call.durationSeconds === "number" ? call.durationSeconds : null) ??
    (typeof message.durationSeconds === "number" ? message.durationSeconds : null) ??
    (typeof payload.durationSeconds === "number" ? payload.durationSeconds : null);

  const durationSec =
    typeof durationSecRaw === "number" && Number.isFinite(durationSecRaw)
      ? Math.max(0, Math.floor(durationSecRaw))
      : null;

  const finalResult =
    asString(message.finalResult) ??
    asString(payload.finalResult) ??
    asString(message.outcome) ??
    asString(payload.outcome);

  const finalIntent =
    asString(message.finalIntent) ?? asString(payload.finalIntent);

  return {
    message,
    callId,
    fromPhone,
    toPhone,
    status,
    eventType,
    restaurantId,
    assistantId,
    startedAt,
    endedAt,
    durationSec,
    finalResult,
    finalIntent,
  };
}

function extractTranscriptLines(message: UnknownRecord) {
  const lines: Array<{ speaker: TranscriptSpeaker; content: string }> = [];

  const transcriptEntries = Array.isArray(message.transcript)
    ? message.transcript
    : Array.isArray(message.messages)
      ? message.messages
      : null;

  if (transcriptEntries) {
    for (const entry of transcriptEntries) {
      const row = asRecord(entry);

      if (!row) {
        continue;
      }

      const content = asString(row.text) ?? asString(row.content) ?? asString(row.message);

      if (!content) {
        continue;
      }

      const role = asString(row.role) ?? asString(row.speaker);
      lines.push({
        speaker: parseSpeaker(role),
        content,
      });
    }
  }

  const singleTranscript = asString(message.transcript) ?? asString(message.text);
  if (singleTranscript) {
    const role = asString(message.role) ?? asString(message.speaker);
    lines.push({
      speaker: parseSpeaker(role),
      content: singleTranscript,
    });
  }

  return lines;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    if (!isValidVapiSignature(request, rawBody)) {
      return NextResponse.json({ error: "Invalid Vapi signature" }, { status: 403 });
    }

    let payload: UnknownRecord;

    try {
      const parsed = JSON.parse(rawBody);
      const parsedRecord = asRecord(parsed);

      if (!parsedRecord) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      payload = parsedRecord;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const extracted = extractRootPayload(payload);

    if (!extracted.callId) {
      return NextResponse.json({ error: "Missing call id" }, { status: 400 });
    }

    let restaurantId = extracted.restaurantId;

    if (!restaurantId && extracted.toPhone) {
      const phone = await prisma.phoneNumber.findFirst({
        where: {
          phoneE164: extracted.toPhone,
          isActive: true,
        },
      });

      restaurantId = phone?.restaurantId ?? null;
    }

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant context not found" }, { status: 404 });
    }

    const now = new Date();
    const endedAt = extracted.endedAt ?? (isTerminalStatus(extracted.status) ? now : null);

    const call = await prisma.call.upsert({
      where: {
        providerCallSid: extracted.callId,
      },
      update: {
        restaurantId,
        provider: "vapi",
        fromPhoneE164: extracted.fromPhone,
        toPhoneE164: extracted.toPhone ?? "unknown",
        status: extracted.status,
        startedAt:
          extracted.startedAt ??
          (extracted.status === CallStatus.in_progress ? now : undefined),
        endedAt: endedAt ?? undefined,
        durationSec: extracted.durationSec ?? undefined,
        finalIntent: extracted.finalIntent ?? undefined,
        finalResult: extracted.finalResult ?? undefined,
      },
      create: {
        restaurantId,
        provider: "vapi",
        providerCallSid: extracted.callId,
        fromPhoneE164: extracted.fromPhone,
        toPhoneE164: extracted.toPhone ?? "unknown",
        status: extracted.status,
        startedAt:
          extracted.startedAt ??
          (extracted.status === CallStatus.in_progress ? now : undefined),
        endedAt: endedAt ?? undefined,
        durationSec: extracted.durationSec ?? undefined,
        finalIntent: extracted.finalIntent ?? undefined,
        finalResult: extracted.finalResult ?? undefined,
      },
    });

    const transcriptLines = extractTranscriptLines(extracted.message);

    if (transcriptLines.length > 0) {
      await prisma.callTranscript.createMany({
        data: transcriptLines.map((line) => ({
          restaurantId,
          callId: call.id,
          speaker: line.speaker,
          content: line.content,
        })),
      });
    }

    return NextResponse.json({
      ok: true,
      callId: call.id,
      eventType: extracted.eventType,
      transcriptsStored: transcriptLines.length,
    });
  } catch (error) {
    console.error("Error handling Vapi webhook:", error);
    return NextResponse.json({ error: "Unable to process Vapi webhook" }, { status: 500 });
  }
}
