"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardBody, CardHeader, Table, EmptyRow, Badge, Button, Field, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export function UserManager({ users }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const rows = users.filter((u) => {
    if (role && u.role !== role) return false;
    if (status === "active" && !u.active) return false;
    if (status === "inactive" && u.active) return false;
    if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error);
    setForm({ name: "", email: "", password: "" });
    setOpen(false);
    router.refresh();
  }

  async function toggle(u) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    });
    router.refresh();
  }

  return (
    <Card>
      {err ? <p className="m-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}
      <CardHeader
        title={`${rows.length} of ${users.length} users`}
        subtitle="Platform super admins have no tenant. Tenant users are managed inside their workspace."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-40 !py-1.5" />
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="!w-32">
              <option value="">All roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="OWNER">Owner</option>
              <option value="MANAGER">Manager</option>
              <option value="MEMBER">Member</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-32">
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Disabled</option>
            </Select>
            <Button onClick={() => setOpen((o) => !o)}><Plus className="h-3.5 w-3.5" /> {open ? "Close" : "New super admin"}</Button>
          </div>
        }
      />
      {open ? (
        <CardBody className="border-b border-zinc-100 dark:border-zinc-800">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label="Password"><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></Field>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create super admin"}</Button>
            </div>
          </form>
        </CardBody>
      ) : null}
      <Table head={["Name", "Email", "Tenant", "Role", "Last login", "Status", ""]}
        empty={!rows.length ? <EmptyRow colSpan={7}>No users match this filter.</EmptyRow> : null}>
        {rows.map((u) => (
          <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
            <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{u.name}</td>
            <td className="px-4 py-2 text-xs text-zinc-500">{u.email}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{u.tenant_name || "platform"}</td>
            <td className="px-4 py-2"><Badge tone={u.role === "SUPER_ADMIN" ? "indigo" : "slate"}>{u.role}</Badge></td>
            <td className="px-4 py-2 text-xs text-zinc-500">{u.last_login_at ? formatDate(u.last_login_at, true) : "never"}</td>
            <td className="px-4 py-2"><Badge tone={u.active ? "emerald" : "red"}>{u.active ? "Active" : "Disabled"}</Badge></td>
            <td className="px-4 py-2 text-right">
              <Button variant="ghost" className="!py-1 text-xs" onClick={() => toggle(u)}>{u.active ? "Disable" : "Enable"}</Button>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
