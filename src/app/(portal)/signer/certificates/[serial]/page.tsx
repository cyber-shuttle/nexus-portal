import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import type { Metadata } from "next";
import { CertificateDetailContainer } from "./CertificateDetailContainer";

export const metadata: Metadata = {
  title: "Certificate · Nexus Portal",
};

type Props = {
  params: Promise<{ serial: string }>;
};

export default async function CertificateDetailPage({ params }: Props) {
  const { serial } = await params;
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Signer", href: "/signer/certificates" },
          { label: "Certificates", href: "/signer/certificates" },
          { label: `Serial ${serial}` },
        ]}
      />
      <CertificateDetailContainer serial={serial} />
    </div>
  );
}
