import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain, validateFirmDomain } from "@/lib/tenant-guard";

type CreateFirmPayload = {
  name: string;
  city: string;
  plan: string;
  status: "Trial" | "Active" | "Paused";
  emailDomain?: string;
};

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 503 });
  }

  try {
    const payload = await request.json() as CreateFirmPayload;
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

    const firm = await prisma.firm.create({
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
        id: firm.id,
        name: firm.name,
        city: firm.city ?? city,
        plan,
        status: status,
        emailDomain: firm.emailDomain ?? "",
        onboardingCompleted: true,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to create firm." }, { status: 500 });
  }
}
