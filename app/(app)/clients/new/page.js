import { ClientForm } from "@/components/client-form";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">New client</h1>
        <p className="text-sm text-slate-500">A mock GMB profile is created automatically.</p>
      </div>
      <ClientForm />
    </div>
  );
}
