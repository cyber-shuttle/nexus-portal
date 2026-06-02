import { redirect } from "next/navigation";

// Same reason as /admin: breadcrumb segment "Amie" otherwise 404s. Packets
// is the canonical AMIE entry — AmieNav surfaces the other sections.
export default function AmieIndex() {
  redirect("/admin/amie/packets");
}
