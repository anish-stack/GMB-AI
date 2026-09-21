import { listInvoices } from "@/lib/saas/billing.js";
import { InvoiceList } from "@/components/admin/invoice-list";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  const invoices = await listInvoices({ limit: 300 });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Invoices</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Marking an invoice paid activates the subscription. Credit-pack invoices release credits on payment.
        </p>
      </div>
      <InvoiceList invoices={JSON.parse(JSON.stringify(invoices))} />
    </div>
  );
}
