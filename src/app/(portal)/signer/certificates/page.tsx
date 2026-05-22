import type { Metadata } from "next";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import { CertificatesContainer } from "./CertificatesContainer";

export const metadata: Metadata = {
  title: "SSH certificates · Nexus Portal",
};

export default function CertificatesPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Signer", href: "/signer/certificates" }, { label: "Certificates" }]} />
      <CertificatesContainer />
    </div>
  );
}
