import { redirect } from "next/navigation";
import { getMe } from "@/lib/data";

export default async function Home() {
  const me = await getMe();
  redirect(me.role === "manager" ? "/review" : "/dashboard");
}
