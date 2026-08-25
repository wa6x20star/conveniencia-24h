import { redirect } from "next/navigation";
import { DriverDashboard } from "@/components/driver-dashboard";
import { getCurrentStaff } from "@/lib/auth";

export default async function DriverPage(){
  const staff=await getCurrentStaff(["driver"]);
  if(staff.configured&&(!staff.user||staff.role!=="driver")) redirect('/entregador/login');
  return <DriverDashboard/>;
}
