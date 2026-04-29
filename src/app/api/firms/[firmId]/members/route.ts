import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain, validateUserForFirm } from "@/lib/tenant-guard";

type CreateMemberPayload = {
  name: string;
  email: string;
  firmRole: "Firm Admin" | "Partner" | "Manager" | "Article/Staff";
};

export async function POST(request: Request, context: { params: Promise<{ firmId: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 503 });
  }

  try {
    const { firmId } = await context.params;
    const payload = await request.json() as CreateMemberPayload;
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const firmRole = payload.firmRole;
    if (!name || !email || !firmRole) {
      return NextResponse.json({ ok: false, message: "Name, email, and role are required." }, { status: 400 });
    }

    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: { id: true, emailDomain: true },
    });

    if (!firm) {
      return NextResponse.json({ ok: false, message: "Firm not found." }, { status: 404 });
    }

    const validation = validateUserForFirm(email, normalizeDomain(firm.emailDomain ?? ""), false);
    if (!validation.ok) {
      return NextResponse.json(validation, { status: 422 });
    }

    const member = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existingUser = await tx.platformUser.findUnique({
        where: { email },
      });

      const user = existingUser ?? await tx.platformUser.create({
        data: {
          name,
          email,
          passwordHash: "",
          platformRole: "STANDARD",
          isActive: true,
        },
      });

      await tx.firmMember.upsert({
        where: { firmId_userId: { firmId: firm.id, userId: user.id } },
        create: {
          firmId: firm.id,
          userId: user.id,
          firmRole: firmRole.toUpperCase().replace("/", "_"),
          isActive: true,
        },
        update: {
          firmRole: firmRole.toUpperCase().replace("/", "_"),
          isActive: true,
        },
      });

      return user;
    });

    return NextResponse.json({
      ok: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        firmRole,
        role: firmRole,
        platformRole: "Standard",
        lastActive: "Invited",
        isActive: true,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to create member." }, { status: 500 });
  }
}
