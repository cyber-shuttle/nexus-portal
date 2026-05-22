import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PacketsTrendChart } from "../components/PacketsTrendChart";

describe("PacketsTrendChart", () => {
  it("renders an empty-state message when there are no buckets", () => {
    const { getByText } = render(<PacketsTrendChart buckets={[]} />);
    expect(getByText(/No packet activity/i)).toBeInTheDocument();
  });

  it("renders the chart container and legend when buckets exist", () => {
    const { getByLabelText, getByText } = render(
      <PacketsTrendChart
        buckets={[
          { date: "2026-05-20", status: "PROCESSED", type: "request_project_create", count: 5 },
          { date: "2026-05-20", status: "FAILED", type: "request_account_create", count: 1 },
          { date: "2026-05-21", status: "PROCESSED", type: "request_project_create", count: 7 },
        ]}
      />,
    );
    expect(getByLabelText(/AMIE packets per day/i)).toBeInTheDocument();
    expect(getByText("PROCESSED")).toBeInTheDocument();
    expect(getByText("FAILED")).toBeInTheDocument();
  });
});
