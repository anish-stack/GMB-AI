import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient, updateClient } from "@/lib/repo/clients.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const client = await getClient(Number(id));
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ client });
}

export async function PATCH(request, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  try {
    await updateClient(Number(id), await request.json());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
