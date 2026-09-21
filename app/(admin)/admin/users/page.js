import { query } from "@/lib/db";
import { UserManager } from "@/components/admin/user-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await query(
    `SELECT u.id,u.name,u.email,u.role,u.active,u.last_login_at,u.created_at,t.name AS tenant_name
       FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id ORDER BY u.tenant_id IS NOT NULL, u.id`
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Users</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Everyone with a login across the platform.</p>
      </div>
      <UserManager users={JSON.parse(JSON.stringify(users))} />
    </div>
  );
}
