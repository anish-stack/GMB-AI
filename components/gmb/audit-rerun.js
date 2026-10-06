"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export function AuditRerun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button onClick={() => start(() => router.refresh())} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Run new audit
    </Button>
  );
}
