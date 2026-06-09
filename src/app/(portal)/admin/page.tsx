import { redirect } from "next/navigation";

// Breadcrumb shells like "Admin / Amie / Packets" generate a link for every
// segment. Without a handler at /admin, the parent click 404s. Land the
// user on the canonical admin entry (AMIE inbox) instead.
export default function AdminIndex() {
  redirect("/admin/amie/packets");
}
