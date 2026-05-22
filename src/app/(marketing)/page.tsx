import { auth } from "@/shared/auth/auth";
import { redirect } from "next/navigation";

export default async function MarketingHome() {
  const session = await auth();
  if (session?.user) redirect("/home");
  redirect("/sign-in");
}
