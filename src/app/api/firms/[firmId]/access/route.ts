import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain, validateUserForFirm } from "@/lib/tenant-guard";

type AccessPayload = {
  userId: string;
};

export async function POST(request: Request, context: { params: Promise<{ firmId: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 503 });
  }

  try {
    const { firmId } = await context.params;
    const payload = await request.json() as AccessPayload;
    if (!payload.userId) {
      return NextResponse.json({ ok: false, message: "userId is required." }, { status: 400 });
    }

    const record = await prisma.firmMember.findFirst({
      where: { firmId, userId: payload.userId, isActive: true },
      select: {
        firm: { select: { emailDomain: true } },
        user: { select: { email: true, platformRole: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ ok: false, message: "User does not belong to this firm." }, { status: 403 });
    }

    const isOwner = record.user.platformRole === "PLATFORM_OWNER";
    const validation = validateUserForFirm(
      record.user.email,
      normalizeDomain(record.firm.emailDomain ?? ""),
      isOwner,
    );
    if (!validation.ok) {
      return NextResponse.json(validation, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to verify access." }, { status: 500 });
  }
}
