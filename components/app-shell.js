"use client";

import { useCallback, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export function AppShell({ session, aiProvider, gmbProvider, workspace, plan, perms, creditsLeft, banner, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={closeMenu}
        gmbMock={gmbProvider?.isMock !== false}
        workspace={workspace}
        plan={plan}
        perms={perms}
        creditsLeft={creditsLeft}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <Topbar
          session={session}
          aiProvider={aiProvider}
          gmbProvider={gmbProvider}
          onMenuClick={() => setMobileOpen(true)}
          creditsLeft={creditsLeft}
        />
        <main className="page-enter flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
