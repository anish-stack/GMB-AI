import { TicketView } from "@/components/support/client-support";

export const metadata = { title: "Support ticket" };

export default async function TicketPage({ params }) {
  const { id } = await params;
  return <TicketView id={Number(id)} />;
}
