import { SupportAdminTicket } from "@/components/admin/support-admin";

export const metadata = { title: "Ticket" };
export default async function Page({ params }) {
  const { id } = await params;
  return <SupportAdminTicket id={Number(id)} />;
}
