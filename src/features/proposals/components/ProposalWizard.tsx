"use client";

import * as React from "react";
import { useForm, useFieldArray, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ApiError } from "@shared/api/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { useCreateProposal } from "../queries";
import { createProposalPayloadSchema } from "../schemas";
import type { CreateProposalPayload } from "../schemas";
import { ProposalWizardStepper } from "./ProposalWizardStepper";

// Derive from the wire schema so wizard validation never drifts from what the
// API ultimately re-validates. `requester_id` is injected by the container and
// `status` is stamped on submit, so the wizard form itself only handles the
// remaining authored fields.
const wizardSchema = createProposalPayloadSchema
  .omit({ requester_id: true, status: true })
  .required({ cascade_to_sub_projects: true, child_allocations: true });

export type ProposalWizardValues = z.infer<typeof wizardSchema>;

type ProjectOption = {
  id: string;
  title: string;
  children?: { id: string; title: string }[];
};

type ResourceOption = {
  id: string;
  name: string;
  resource_type: string;
};

export type ProposalWizardProps = {
  projectOptions: ProjectOption[];
  resourceOptions: ResourceOption[];
  requesterId: string;
  onCancel?: () => void;
};

const STEPS = [
  { id: "basic", label: "Basic info", description: "Project and title" },
  { id: "resources", label: "Resources & duration", description: "What and how long" },
  { id: "justification", label: "Justification", description: "Why this matters" },
  { id: "cascade", label: "Cascade", description: "Apply to sub-projects" },
  { id: "review", label: "Review & submit", description: "Final pass" },
] as const;

const STEP_FIELDS: Record<number, Array<keyof ProposalWizardValues>> = {
  0: ["project_id", "project_title", "title", "abstract"],
  1: ["resources", "start_date", "end_date"],
  2: ["justification"],
  3: ["cascade_to_sub_projects", "child_allocations"],
  4: [],
};

export function ProposalWizard({
  projectOptions,
  resourceOptions,
  requesterId,
  onCancel,
}: ProposalWizardProps) {
  const router = useRouter();
  const createMutation = useCreateProposal();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [completed, setCompleted] = React.useState<Set<number>>(new Set());

  const form = useForm<ProposalWizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      project_id: "",
      project_title: "",
      title: "",
      abstract: "",
      resources: [],
      start_date: "",
      end_date: "",
      justification: "",
      cascade_to_sub_projects: false,
      child_allocations: [],
    },
    mode: "onBlur",
  });

  const projectId = form.watch("project_id");
  const cascade = form.watch("cascade_to_sub_projects");
  const selectedProject = projectOptions.find((p) => p.id === projectId);

  React.useEffect(() => {
    if (selectedProject) {
      form.setValue("project_title", selectedProject.title);
      if (cascade && form.getValues("child_allocations").length === 0) {
        const children = selectedProject.children ?? [];
        if (children.length > 0) {
          const evenSplit = Math.floor(100 / children.length);
          const remainder = 100 - evenSplit * children.length;
          form.setValue(
            "child_allocations",
            children.map((c, i) => ({
              project_id: c.id,
              project_title: c.title,
              su_split_percent: i === 0 ? evenSplit + remainder : evenSplit,
            })),
          );
        }
      }
    }
  }, [selectedProject, cascade, form]);

  React.useEffect(() => {
    if (!cascade) form.setValue("child_allocations", []);
  }, [cascade, form]);

  async function goNext() {
    const fields = STEP_FIELDS[stepIndex] ?? [];
    const ok = fields.length === 0 ? true : await form.trigger(fields);
    if (!ok) return;
    setCompleted((prev) => new Set(prev).add(stepIndex));
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goPrev() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function goTo(index: number) {
    if (index <= stepIndex || completed.has(index)) setStepIndex(index);
  }

  async function submit(status: "DRAFT" | "SUBMITTED") {
    const ok = await form.trigger();
    if (!ok) {
      toast.error("Fix validation errors before submitting.");
      return;
    }
    const values = form.getValues();
    const childAllocations = values.cascade_to_sub_projects ? values.child_allocations : [];
    if (values.cascade_to_sub_projects) {
      const total = childAllocations.reduce((acc, c) => acc + c.su_split_percent, 0);
      if (total !== 100) {
        toast.error(`Sub-project split must total 100% (currently ${total}%).`);
        return;
      }
    }
    const payload: CreateProposalPayload = {
      ...values,
      requester_id: requesterId,
      child_allocations: childAllocations,
      status,
    };
    try {
      const created = await createMutation.mutateAsync(payload);
      toast.success(
        status === "DRAFT"
          ? "Draft saved"
          : `Proposal submitted (#${created.id})`,
      );
      router.push(`/proposals/${created.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Failed to submit";
      toast.error(msg);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <ProposalWizardStepper
          steps={STEPS as unknown as { id: string; label: string; description?: string }[]}
          currentIndex={stepIndex}
          completedIndices={completed}
          onSelect={goTo}
        />
      </aside>

      <Card className="p-6">
        {stepIndex === 0 ? (
          <BasicInfoStep form={form} projectOptions={projectOptions} />
        ) : null}
        {stepIndex === 1 ? (
          <ResourcesStep form={form} resourceOptions={resourceOptions} />
        ) : null}
        {stepIndex === 2 ? <JustificationStep form={form} /> : null}
        {stepIndex === 3 ? (
          <CascadeStep form={form} selectedProject={selectedProject} />
        ) : null}
        {stepIndex === 4 ? <ReviewStep form={form} /> : null}

        <div className="mt-8 flex items-center justify-between gap-3 border-t pt-4">
          <div className="flex gap-2">
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Save & exit
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => submit("DRAFT")}
              disabled={createMutation.isPending}
            >
              Save as draft
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={goPrev} disabled={stepIndex === 0}>
              Back
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => submit("SUBMITTED")}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Submitting…" : "Submit proposal"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function BasicInfoStep({
  form,
  projectOptions,
}: {
  form: UseFormReturn<ProposalWizardValues>;
  projectOptions: ProjectOption[];
}) {
  const projectId = form.watch("project_id");
  const errors = form.formState.errors;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-lg font-semibold">Basic info</h2>
        <p className="text-sm text-muted-foreground">
          Tell us which project this proposal is for and summarize the intent.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="proposal-project">Project</Label>
        <select
          id="proposal-project"
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={projectId}
          onChange={(e) => form.setValue("project_id", e.currentTarget.value, { shouldValidate: true })}
        >
          <option value="">Select a project…</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        {errors.project_id ? (
          <p className="text-xs text-destructive">{errors.project_id.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-title">Title</Label>
        <Input
          id="proposal-title"
          placeholder="e.g. BayesPrism integration scale-up — Phase 2"
          {...form.register("title")}
        />
        {errors.title ? (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-abstract">Abstract</Label>
        <textarea
          id="proposal-abstract"
          rows={4}
          placeholder="1–2 paragraphs framing what you'll do with this allocation."
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...form.register("abstract")}
        />
        {errors.abstract ? (
          <p className="text-xs text-destructive">{errors.abstract.message}</p>
        ) : null}
      </div>
    </div>
  );
}

function ResourcesStep({
  form,
  resourceOptions,
}: {
  form: UseFormReturn<ProposalWizardValues>;
  resourceOptions: ResourceOption[];
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "resources",
  });
  const errors = form.formState.errors;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-lg font-semibold">Resources & duration</h2>
        <p className="text-sm text-muted-foreground">
          List the resources you need. Site conversion rates are visible to the right.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="proposal-start">Start date</Label>
          <Input id="proposal-start" type="date" {...form.register("start_date")} />
          {errors.start_date ? (
            <p className="text-xs text-destructive">{errors.start_date.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="proposal-end">End date</Label>
          <Input id="proposal-end" type="date" {...form.register("end_date")} />
          {errors.end_date ? (
            <p className="text-xs text-destructive">{errors.end_date.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Resource requests</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const first = resourceOptions[0];
              append({
                resource_id: first?.id ?? "",
                resource_name: first?.name ?? "",
                resource_type: first?.resource_type ?? "cpu",
                requested_su_amount: 10000,
              });
            }}
          >
            Add resource
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            No resources yet. Add at least one to continue.
          </p>
        ) : (
          <ol className="space-y-3">
            {fields.map((field, index) => (
              <li key={field.id} className="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-[1fr_140px_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor={`res-${index}`}>Resource</Label>
                  <select
                    id={`res-${index}`}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={form.watch(`resources.${index}.resource_id`)}
                    onChange={(e) => {
                      const opt = resourceOptions.find((r) => r.id === e.currentTarget.value);
                      if (!opt) return;
                      form.setValue(`resources.${index}.resource_id`, opt.id);
                      form.setValue(`resources.${index}.resource_name`, opt.name);
                      form.setValue(`resources.${index}.resource_type`, opt.resource_type);
                    }}
                  >
                    {resourceOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.resource_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`res-${index}-su`}>SU amount</Label>
                  <Input
                    id={`res-${index}-su`}
                    type="number"
                    min={0}
                    {...form.register(`resources.${index}.requested_su_amount`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {errors.resources ? (
          <p className="text-xs text-destructive">
            {(errors.resources.root ?? errors.resources)?.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function JustificationStep({ form }: { form: UseFormReturn<ProposalWizardValues> }) {
  const errors = form.formState.errors;
  const value = form.watch("justification") ?? "";
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-lg font-semibold">Justification</h2>
        <p className="text-sm text-muted-foreground">
          Explain the scientific case, schedule, deliverables, and why the requested capacity is
          appropriate. 500–2000 characters.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="proposal-justification">Justification</Label>
        <textarea
          id="proposal-justification"
          rows={10}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...form.register("justification")}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{value.length} / 2000</span>
          {errors.justification ? (
            <span className="text-destructive">{errors.justification.message}</span>
          ) : null}
        </div>
      </div>

      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        Attachments arrive in Phase 7. The upload control is intentionally disabled below.
      </div>
      <div className="space-y-1.5 opacity-60" aria-disabled>
        <Label htmlFor="proposal-attachments">Attachments</Label>
        <Input id="proposal-attachments" type="file" disabled />
      </div>
    </div>
  );
}

function CascadeStep({
  form,
  selectedProject,
}: {
  form: UseFormReturn<ProposalWizardValues>;
  selectedProject: ProjectOption | undefined;
}) {
  const cascade = form.watch("cascade_to_sub_projects");
  const children = form.watch("child_allocations") ?? [];
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-lg font-semibold">Cascade to sub-projects</h2>
        <p className="text-sm text-muted-foreground">
          Apply this allocation as parent and split SUs to child projects. Inspired by
          sam-queries' hierarchical cascade pattern.
        </p>
      </header>

      <label className="flex items-start gap-3 rounded-md border bg-muted/20 p-3 text-sm">
        <input
          type="checkbox"
          checked={cascade}
          onChange={(e) => form.setValue("cascade_to_sub_projects", e.currentTarget.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium">Apply to sub-projects</span>
          <span className="block text-xs text-muted-foreground">
            Children inherit the allocation; you can override the SU split below.
          </span>
        </span>
      </label>

      {cascade ? (
        children.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            {selectedProject
              ? "No sub-projects registered for this project yet."
              : "Pick a project first."}
          </p>
        ) : (
          <ol className="space-y-3">
            {children.map((child, index) => (
              <li
                key={child.project_id}
                className="grid items-center gap-3 rounded-md border bg-card p-3 md:grid-cols-[1fr_140px]"
              >
                <div>
                  <p className="text-sm font-medium">{child.project_title}</p>
                  <p className="text-xs text-muted-foreground">{child.project_id}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`child-${index}`}>Split %</Label>
                  <Input
                    id={`child-${index}`}
                    type="number"
                    min={0}
                    max={100}
                    {...form.register(`child_allocations.${index}.su_split_percent`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </li>
            ))}
            <li className="flex justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Total split</span>
              <span className="font-medium">
                {children.reduce((acc, c) => acc + (c.su_split_percent || 0), 0)}%
              </span>
            </li>
          </ol>
        )
      ) : null}
    </div>
  );
}

function ReviewStep({ form }: { form: UseFormReturn<ProposalWizardValues> }) {
  const v = form.watch();
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-lg font-semibold">Review & submit</h2>
        <p className="text-sm text-muted-foreground">
          Last chance to edit. Submitting flips the proposal to SUBMITTED status; admins receive
          it in their review queue.
        </p>
      </header>

      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Project</dt>
          <dd className="font-medium">{v.project_title || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Title</dt>
          <dd className="font-medium">{v.title || "—"}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Abstract</dt>
          <dd>{v.abstract || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Start</dt>
          <dd>{v.start_date || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">End</dt>
          <dd>{v.end_date || "—"}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Resources</dt>
          <dd>
            <ul className="space-y-1">
              {(v.resources ?? []).map((r) => (
                <li key={r.resource_id}>
                  <span className="font-medium">{r.resource_name}</span>{" "}
                  <span className="text-muted-foreground">({r.resource_type})</span>:{" "}
                  {r.requested_su_amount.toLocaleString()} SU
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Justification</dt>
          <dd className="whitespace-pre-wrap">{v.justification || "—"}</dd>
        </div>
        {v.cascade_to_sub_projects ? (
          <div className="md:col-span-2">
            <dt className="text-xs uppercase text-muted-foreground">Cascade</dt>
            <dd>
              <ul className="space-y-1">
                {(v.child_allocations ?? []).map((c) => (
                  <li key={c.project_id}>
                    {c.project_title} — {c.su_split_percent}%
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
