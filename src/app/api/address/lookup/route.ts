import { NextRequest, NextResponse } from "next/server";
import { lookupBrazilianPostalCode } from "@/lib/shipping-server";
import { checkRateLimit, digitsOnly, sameOriginOrNoOrigin } from "@/lib/security-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  const rate = await checkRateLimit(request, "address-lookup", 30, 600, 900);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "too_many_lookups" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } },
    );
  }

  const postalCode = digitsOnly(request.nextUrl.searchParams.get("cep"), 8);
  if (postalCode.length !== 8) return NextResponse.json({ error: "invalid_postal_code" }, { status: 400 });

  const lookup = await lookupBrazilianPostalCode(postalCode);
  if (!lookup.found || !lookup.address) {
    return NextResponse.json({ found: false, postalCode }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    {
      found: true,
      source: lookup.source,
      address: lookup.address,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
