import { requireTenantContext } from "@/lib/saas/context.js";
import { listTenantUsers } from "@/lib/auth";
import { TeamManager } from "@/components/team-manager";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireTenantContext();
  if (!ctx.can("team.view")) redirect("/dashboard");
  const users = await listTenantUsers(ctx.tenantId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Team</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Owners manage billing and everything else. Managers run clients and publishing. Members review and edit posts.
        </p>
      </div>
      <TeamManager
        users={JSON.parse(JSON.stringify(users))}
        canInvite={ctx.can("team.invite")}
        canEdit={ctx.can("team.edit")}
        limit={ctx.limits.max_team_members}
        used={ctx.ent.live.team_members}
      />
    </div>
  );
}
