import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain, validateFirmDomain } from "@/lib/tenant-guard";

type UpdateFirmPayload = {
  name: string;
  city: string;
  plan: string;
  status: "Trial" | "Active" | "Paused";
  emailDomain?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ firmId: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 503 });
  }

  try {
    const { firmId } = await context.params;
    const payload = await request.json() as UpdateFirmPayload;
    const name = payload.name?.trim();
    const city = payload.city?.trim();
    const plan = payload.plan?.trim();
    const emailDomain = normalizeDomain(payload.emailDomain ?? "");
    const status = payload.status ?? "Trial";

    if (!name || !city || !plan) {
      return NextResponse.json({ ok: false, message: "Firm name, city, and plan are required." }, { status: 400 });
    }

    const domainCheck = validateFirmDomain(emailDomain);
    if (!domainCheck.ok) {
      return NextResponse.json(domainCheck, { status: 422 });
    }

    const updated = await prisma.firm.update({
      where: { id: firmId },
      data: {
        name,
        city,
        status: status.toUpperCase(),
        emailDomain: emailDomain || null,
      },
    });

    return NextResponse.json({
      ok: true,
      firm: {
        id: updated.id,
        name: updated.name,
        city: updated.city ?? city,
        plan,
        status,
        emailDomain: updated.emailDomain ?? "",
        onboardingCompleted: true,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to update firm." }, { status: 500 });
  }
}
