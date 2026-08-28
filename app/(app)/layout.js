import { requireSession } from "@/lib/auth";
import { providerInfo } from "@/lib/ai/index.js";
import { gmbProviderInfo } from "@/lib/gmb/provider.js";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }) {
  const session = await requireSession();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar session={session} aiProvider={providerInfo()} gmbProvider={gmbProviderInfo()} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
