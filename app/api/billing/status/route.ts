import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkUserAccess } from "@/lib/billing/subscription-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    // Guests are a normal state, not an error: a 401 here produced false
    // error noise in the browser console on public pages such as /pricing.
    return NextResponse.json({ authenticated: false, hasAccess: false });
  }

  const access = await checkUserAccess(session.userId, session.email);
  return NextResponse.json({ authenticated: true, ...access });
}
