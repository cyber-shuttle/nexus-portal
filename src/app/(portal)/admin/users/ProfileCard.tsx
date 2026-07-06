import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Building2, Mail, Pencil } from "lucide-react";
import type { ComponentType } from "react";

const ME_PROFILE = {
  firstName: "Nipuna",
  lastName: "Bandara",
  email: "nipuna@folia.com",
  organization: "Nexus HPC Consortium",
};

function ProfileField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        {value}
      </div>
    </div>
  );
}

export function ProfileCard() {
  return (
    <Card className="w-fit min-w-[24rem] flex-row items-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3">
        <Avatar className="size-28 ring-2 ring-border ring-offset-2 ring-offset-card">
          <AvatarFallback className="bg-brand/10 text-3xl font-semibold text-brand">
            NB
          </AvatarFallback>
        </Avatar>
        <Button variant="outline" size="sm">
          <Pencil data-icon="inline-start" />
          Edit
        </Button>
      </div>
      <div className="h-full self-stretch border-l border-border" />
      <div className="flex flex-col gap-4">
        <div className="flex gap-8">
          <ProfileField label="First Name" value={ME_PROFILE.firstName} />
          <ProfileField label="Last Name" value={ME_PROFILE.lastName} />
        </div>
        <ProfileField label="Email" value={ME_PROFILE.email} icon={Mail} />
        <ProfileField label="Organization" value={ME_PROFILE.organization} icon={Building2} />
      </div>
    </Card>
  );
}
