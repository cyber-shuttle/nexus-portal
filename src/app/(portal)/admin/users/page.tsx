import { redirect } from "next/navigation";

export default function UserManagementIndex() {
  redirect("/admin/users/identities");
}
