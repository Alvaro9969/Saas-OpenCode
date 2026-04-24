import { prisma } from "@/lib/prisma";
import {
  isValidTwilioSignature,
  parseTwilioFormParams,
} from "@/lib/voice/twilioWebhook";
import { CallStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function mapTwilioCallStatus(callStatus: string | undefined): CallStatus {
  switch (callStatus) {
    case "queued":
      return CallStatus.initiated;
    case "ringing":
      return CallStatus.ringing;
    case "in-progress":
      return CallStatus.in_progress;
    case "completed":
      return CallStatus.completed;
    case "failed":
      return CallStatus.failed;
    case "busy":
      return CallStatus.busy;
    case "no-answer":
      return CallStatus.no_answer;
    case "canceled":
      return CallStatus.canceled;
    default:
      return CallStatus.initiated;
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

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const params = parseTwilioFormParams(rawBody);
    const signature = request.headers.get("x-twilio-signature");

    if (!isValidTwilioSignature(request, params, signature)) {
      return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
    }

    const callSid = params.CallSid;
    const toPhoneE164 = params.To;
    const fromPhoneE164 = params.From ?? "unknown";

    if (!callSid || !toPhoneE164) {
      return NextResponse.json({ error: "Missing CallSid or To" }, { status: 400 });
    }

    const mappedStatus = mapTwilioCallStatus(params.CallStatus);
    const durationSec = Number.parseInt(params.CallDuration ?? "", 10);
    const errorCode = params.ErrorCode;
    const errorMessage = params.ErrorMessage;

    const existingCall = await prisma.call.findUnique({
      where: {
        providerCallSid: callSid,
      },
    });

    if (existingCall) {
      await prisma.call.update({
        where: {
          id: existingCall.id,
        },
        data: {
          status: mappedStatus,
          durationSec: Number.isNaN(durationSec) ? undefined : durationSec,
          endedAt: isTerminalStatus(mappedStatus) ? new Date() : undefined,
          errorCode,
          errorMessage,
        },
      });

      return NextResponse.json({ ok: true });
    }

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        phoneE164: toPhoneE164,
        isActive: true,
      },
    });

    if (!phoneNumber) {
      return NextResponse.json({ ok: true });
    }

    const now = new Date();
    await prisma.call.create({
      data: {
        restaurantId: phoneNumber.restaurantId,
        phoneNumberId: phoneNumber.id,
        provider: "twilio",
        providerCallSid: callSid,
        fromPhoneE164,
        toPhoneE164,
        status: mappedStatus,
        startedAt: mappedStatus === CallStatus.in_progress ? now : undefined,
        endedAt: isTerminalStatus(mappedStatus) ? now : undefined,
        durationSec: Number.isNaN(durationSec) ? undefined : durationSec,
        errorCode,
        errorMessage,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error handling Twilio status webhook:", error);
    return NextResponse.json({ ok: true });
  }
}
