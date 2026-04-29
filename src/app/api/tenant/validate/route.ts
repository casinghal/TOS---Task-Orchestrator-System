import { NextResponse } from "next/server";
import { validateFirmDomain, validateUserForFirm } from "@/lib/tenant-guard";

type UserPayload = {
  email: string;
  firmDomain: string;
  isPlatformOwner?: boolean;
};

type DomainPayload = {
  domain: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as
      | { kind: "user"; payload: UserPayload }
      | { kind: "domain"; payload: DomainPayload };

    if (body.kind === "user") {
      const result = validateUserForFirm(
        body.payload.email,
        body.payload.firmDomain,
        Boolean(body.payload.isPlatformOwner),
      );
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }

    if (body.kind === "domain") {
      const result = validateFirmDomain(body.payload.domain);
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }

    return NextResponse.json({ ok: false, message: "Unsupported validation request." }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid validation payload." }, { status: 400 });
  }
}
