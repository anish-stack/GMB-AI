import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listClients, createClient } from "@/lib/repo/clients.js";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ clients: await listClients() });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.business_name || !body.business_category) {
      return NextResponse.json({ error: "Business name and category are required" }, { status: 400 });
    }
    const id = await createClient(body);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
