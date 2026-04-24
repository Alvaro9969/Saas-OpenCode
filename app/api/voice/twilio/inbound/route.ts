import { prisma } from "@/lib/prisma";
import {
  buildTwimlMessage,
  isValidTwilioSignature,
  parseTwilioFormParams,
} from "@/lib/voice/twilioWebhook";
import { NextRequest, NextResponse } from "next/server";

type CallStatus =
  | "initiated"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "busy"
  | "canceled";

const TWILIO_XML_HEADERS = {
  "Content-Type": "text/xml; charset=utf-8",
};

function mapTwilioCallStatus(callStatus: string | undefined): CallStatus {
  switch (callStatus) {
    case "queued":
      return "initiated";
    case "ringing":
      return "ringing";
    case "in-progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "busy":
      return "busy";
    case "no-answer":
      return "no_answer";
    case "canceled":
      return "canceled";
    default:
      return "initiated";
  }
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
    const fromPhoneE164 = params.From ?? "unknown";
    const toPhoneE164 = params.To;

    if (!callSid || !toPhoneE164) {
      return NextResponse.json({ error: "Missing CallSid or To" }, { status: 400 });
    }

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        phoneE164: toPhoneE164,
        isActive: true,
      },
    });

    if (!phoneNumber) {
      const xml = buildTwimlMessage(
        "Lo sentimos, este numero no esta configurado en el sistema.",
        true
      );
      return new NextResponse(xml, { status: 200, headers: TWILIO_XML_HEADERS });
    }

    const mappedStatus = mapTwilioCallStatus(params.CallStatus);
    const now = new Date();

    await prisma.call.upsert({
      where: {
        providerCallSid: callSid,
      },
      update: {
        restaurantId: phoneNumber.restaurantId,
        phoneNumberId: phoneNumber.id,
        fromPhoneE164,
        toPhoneE164,
        status: mappedStatus,
        startedAt: mappedStatus === "in_progress" ? now : undefined,
      },
      create: {
        restaurantId: phoneNumber.restaurantId,
        phoneNumberId: phoneNumber.id,
        provider: "twilio",
        providerCallSid: callSid,
        fromPhoneE164,
        toPhoneE164,
        status: mappedStatus,
        startedAt: mappedStatus === "in_progress" ? now : undefined,
      },
    });

    const agentConfig = await prisma.agentConfig.findUnique({
      where: {
        restaurantId: phoneNumber.restaurantId,
      },
    });

    const welcomeMessage =
      agentConfig?.welcomeMessage ??
      "Hola, gracias por llamar. Estamos conectando con el asistente de reservas. Por favor espere un momento.";

    const xml = buildTwimlMessage(welcomeMessage, true);
    return new NextResponse(xml, { status: 200, headers: TWILIO_XML_HEADERS });
  } catch (error) {
    console.error("Error handling inbound Twilio webhook:", error);
    const xml = buildTwimlMessage(
      "Ha ocurrido un problema tecnico. Intente llamar de nuevo en unos minutos.",
      true
    );

    return new NextResponse(xml, { status: 200, headers: TWILIO_XML_HEADERS });
  }
}
