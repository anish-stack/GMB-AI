"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Table, EmptyRow, Badge, Button, Field, Input, Select, Modal } from "@/components/ui";
import { PermissionChecklist, parsePerms } from "@/components/team-permissions";
import { DEFAULT_MEMBER_PERMISSIONS, ALL_TENANT_PERMISSIONS } from "@/lib/saas/constants.js";
import { ROLE_LABEL } from "@/lib/saas/constants.js";
import { formatDate } from "@/lib/utils";

const EMPTY = { name: "", email: "", password: "", phone: "", role: "MEMBER", department: "SEO", capacity: 40, permissions: [...DEFAULT_MEMBER_PERMISSIONS] };

export function TeamManager({ users, canInvite, canEdit, isOwner = false, limit, used }) {
  const [permUser, setPermUser] = useState(null);
  const [permDraft, setPermDraft] = useState([]);
  const [permBusy, setPermBusy] = useState(false);
  const openPerms = (u) => {
    setPermUser(u);
    setPermDraft(parsePerms(u.permissions, u.role));
  };
  async function savePerms() {
    setPermBusy(true);
    await patch(permUser.id, { permissions: permDraft });
    setPermBusy(false);
    setPermUser(null);
    setMsg(`Permissions updated for ${permUser.name}`);
  }
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const full = Number(limit) >= 0 && used >= Number(limit);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isOwner && form.role !== "OWNER" ? form : { ...form, permissions: undefined }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error || "Could not add the member");
    setForm(EMPTY);
    setOpen(false);
    setMsg("Team member added");
    router.refresh();
  }

  async function patch(id, body) {
    setErr("");
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return setErr(json.error || "Update failed");
    router.refresh();
  }

  async function resetPassword(id) {
    if (!newPassword || newPassword.length < 6) return setErr("Password must be at least 6 characters");
    setErr("");
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const json = await res.json();
    if (!res.ok) return setErr(json.error || "Password change failed");
    setResetId(null);
    setNewPassword("");
    setMsg("Password updated");
    router.refresh();
  }

  async function remove(id, name) {
    if (!confirm(`Remove ${name}? Their account is deleted permanently.`)) return;
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return setErr(json.error || "Delete failed");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{err}</p> : null}
      {msg ? <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{msg}</p> : null}

      <Card>
        <CardHeader
          title={`${users.length} team members`}
          subtitle={`Plan limit: ${Number(limit) < 0 ? "unlimited" : limit}`}
          action={
            canInvite ? (
              <Button onClick={() => setOpen((o) => !o)} disabled={full && !open}>
                <Plus className="h-3.5 w-3.5" /> {open ? "Close" : "Add member"}
              </Button>
            ) : null
          }
        />
        {open ? (
          <CardBody className="border-b border-zinc-100 dark:border-zinc-800">
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Full name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></Field>
              <Field label="Temporary password"><Input value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Role">
                <Select value={form.role} onChange={(e) => set("role", e.target.value)}>
                  <option value="MEMBER">Team member - access you choose below</option>
                  {isOwner ? <option value="OWNER">Owner - full access including billing</option> : null}
                </Select>
              </Field>
              <Field label="Department"><Input value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
              {isOwner && form.role !== "OWNER" ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">What can this member access?</p>
                  <PermissionChecklist value={form.permissions} onChange={(v) => set("permissions", v)} />
                </div>
              ) : null}
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={busy}>{busy ? "Adding..." : "Add member"}</Button>
              </div>
            </form>
          </CardBody>
        ) : null}

        <Table head={["Name", "Email", "Role", "Department", "Clients", "Last login", "Status", ""]}
          empty={!users.length ? <EmptyRow colSpan={8}>No team members yet.</EmptyRow> : null}>
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{u.name}</td>
              <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{u.email}</td>
              <td className="px-4 py-2">
                {isOwner ? (
                  <Select value={u.role === "MANAGER" ? "MEMBER" : u.role} className="!w-36 !py-1 text-xs" onChange={(e) => patch(u.id, { role: e.target.value })}>
                    <option value="MEMBER">Team member</option>
                    <option value="OWNER">Owner</option>
                  </Select>
                ) : (
                  <Badge tone={u.role === "OWNER" ? "indigo" : "slate"}>{ROLE_LABEL[u.role]}</Badge>
                )}
                {u.role !== "OWNER" ? (
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {u.permissions ? `${parsePerms(u.permissions, u.role).length}/${ALL_TENANT_PERMISSIONS.length} permissions` : "Default access"}
                  </p>
                ) : <p className="mt-1 text-[11px] text-zinc-400">Full access</p>}
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{u.department || "-"}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{u.clients || 0}</td>
              <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{u.last_login_at ? formatDate(u.last_login_at, true) : "never"}</td>
              <td className="px-4 py-2">
                <Badge tone={u.active ? "emerald" : "red"}>{u.active ? "Active" : "Disabled"}</Badge>
              </td>
              <td className="px-4 py-2 text-right">
                {canEdit ? (
                  <div className="flex justify-end gap-1.5">
                    {isOwner && u.role !== "OWNER" ? (
                      <Button variant="secondary" className="!py-1 text-xs" onClick={() => openPerms(u)}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Permissions
                      </Button>
                    ) : null}
                    <Button variant="ghost" className="!py-1 text-xs" onClick={() => { setResetId(resetId === u.id ? null : u.id); setNewPassword(""); }}>
                      Reset password
                    </Button>
                    <Button variant="ghost" className="!py-1 text-xs" onClick={() => patch(u.id, { active: !u.active })}>
                      {u.active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" className="!py-1 text-rose-600" onClick={() => remove(u.id, u.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
          {canEdit && resetId
            ? users.filter((u) => u.id === resetId).map((u) => (
                <tr key={`reset-${u.id}`} className="bg-zinc-50 dark:bg-zinc-800/60">
                  <td colSpan={8} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">New password for {u.name}:</span>
                      <Input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={6}
                        className="!w-52 !py-1 text-xs"
                        placeholder="min 6 characters"
                      />
                      <Button className="!py-1 text-xs" onClick={() => resetPassword(u.id)}>Save</Button>
                      <Button variant="ghost" className="!py-1 text-xs" onClick={() => setResetId(null)}>Cancel</Button>
                    </div>
                  </td>
                </tr>
              ))
            : null}
        </Table>
      </Card>

      <Modal open={Boolean(permUser)} onClose={() => setPermUser(null)} size="xl" title={permUser ? `Permissions - ${permUser.name}` : ""}
        footer={<>
          <Button variant="secondary" onClick={() => setPermUser(null)}>Cancel</Button>
          <Button onClick={savePerms} disabled={permBusy}>{permBusy ? "Saving..." : "Save permissions"}</Button>
        </>}>
        <p className="mb-3 text-sm text-zinc-500">Ticked items are allowed. Changes apply on the member&apos;s next click - no re-login needed. Owners always have full access.</p>
        <PermissionChecklist value={permDraft} onChange={setPermDraft} />
      </Modal>
    </div>
  );
}
