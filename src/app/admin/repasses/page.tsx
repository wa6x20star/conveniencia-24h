import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { PayoutsPanel } from "@/components/payouts-panel";

export default async function PayoutsPage() {
  const staff = await getCurrentStaff(["admin"]);
  if (staff.configured && (!staff.user || staff.role !== "admin")) redirect("/admin");
  return <PayoutsPanel />;
}
