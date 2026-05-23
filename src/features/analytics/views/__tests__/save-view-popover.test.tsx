import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveViewPopover } from "../components/SaveViewPopover";
import { SAVED_VIEW_LIMIT_PER_PERSONA, type CreateSavedViewPayload } from "../types";

const SAMPLE_BUILD = (form: { name: string; is_default: boolean }): CreateSavedViewPayload => ({
  name: form.name,
  persona: "researcher",
  range: {
    from: "2026-05-01T00:00:00Z",
    to: "2026-05-08T00:00:00Z",
    preset: "7d",
  },
  group_by: ["resource", "all"],
  is_default: form.is_default,
});

function openPopover() {
  const trigger = screen.getByTestId("analytics-save-view-trigger");
  fireEvent.click(trigger);
}

describe("SaveViewPopover", () => {
  it("submits a payload built from the form fields", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <SaveViewPopover
        buildPayload={SAMPLE_BUILD}
        onCreate={onCreate}
        currentCount={1}
      />,
    );
    openPopover();

    const input = await screen.findByTestId("analytics-save-view-name");
    fireEvent.change(input, { target: { value: "Weekly review" } });
    const defaultCheckbox = screen.getByTestId("analytics-save-view-default");
    fireEvent.click(defaultCheckbox);
    fireEvent.click(screen.getByTestId("analytics-save-view-submit"));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledWith({
      name: "Weekly review",
      persona: "researcher",
      range: SAMPLE_BUILD({ name: "Weekly review", is_default: true }).range,
      group_by: ["resource", "all"],
      is_default: true,
    });
  });

  it("disables the submit button until a non-blank name is entered", async () => {
    const onCreate = vi.fn();
    render(
      <SaveViewPopover
        buildPayload={SAMPLE_BUILD}
        onCreate={onCreate}
        currentCount={0}
      />,
    );
    openPopover();

    const submit = (await screen.findByTestId("analytics-save-view-submit")) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const input = screen.getByTestId("analytics-save-view-name");
    fireEvent.change(input, { target: { value: "   " } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "Quarterly" } });
    expect(submit.disabled).toBe(false);
  });

  it("blocks creation and shows a cap message when at the persona limit", async () => {
    const onCreate = vi.fn();
    render(
      <SaveViewPopover
        buildPayload={SAMPLE_BUILD}
        onCreate={onCreate}
        currentCount={SAVED_VIEW_LIMIT_PER_PERSONA}
      />,
    );
    openPopover();

    const limit = await screen.findByTestId("analytics-save-view-limit");
    expect(limit).toBeInTheDocument();

    const input = screen.getByTestId("analytics-save-view-name");
    fireEvent.change(input, { target: { value: "Another" } });
    const submit = screen.getByTestId("analytics-save-view-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("surfaces a server error and keeps the popover open", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("name_conflict"));
    render(
      <SaveViewPopover
        buildPayload={SAMPLE_BUILD}
        onCreate={onCreate}
        currentCount={1}
      />,
    );
    openPopover();

    const input = await screen.findByTestId("analytics-save-view-name");
    fireEvent.change(input, { target: { value: "Existing" } });
    fireEvent.click(screen.getByTestId("analytics-save-view-submit"));

    const err = await screen.findByTestId("analytics-save-view-error");
    expect(err).toHaveTextContent("name_conflict");
  });
});
