import { redirect } from "next/navigation";
import { auth } from "@/shared/auth/auth";

export default async function MarketingHome() {
  const session = await auth();
  if (session?.user) redirect("/home");
  redirect("/sign-in");
}
