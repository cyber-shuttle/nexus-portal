import { describe, expect, it } from "vitest";
import {
  allocationStatusSchema,
  changeRequestStatusSchema,
  membershipStatusSchema,
  projectStatusSchema,
  userStatusSchema,
} from "../domain";

describe("shared domain enums", () => {
  it("allocation status accepts ACTIVE / INACTIVE / DELETED", () => {
    expect(allocationStatusSchema.parse("ACTIVE")).toBe("ACTIVE");
    expect(allocationStatusSchema.parse("INACTIVE")).toBe("INACTIVE");
    expect(allocationStatusSchema.parse("DELETED")).toBe("DELETED");
    expect(() => allocationStatusSchema.parse("PENDING")).toThrow();
  });

  it("project status mirrors allocation status", () => {
    expect(projectStatusSchema.parse("ACTIVE")).toBe("ACTIVE");
    expect(() => projectStatusSchema.parse("SUSPENDED")).toThrow();
  });

  it("user status accepts the four lifecycle states", () => {
    for (const value of ["ACTIVE", "INACTIVE", "SUSPENDED", "MERGED"] as const) {
      expect(userStatusSchema.parse(value)).toBe(value);
    }
    expect(() => userStatusSchema.parse("DELETED")).toThrow();
  });

  it("membership status reuses the allocation status enum", () => {
    expect(membershipStatusSchema.options).toEqual(allocationStatusSchema.options);
  });

  it("change-request status accepts PENDING / APPROVED / REJECTED", () => {
    for (const value of ["PENDING", "APPROVED", "REJECTED"] as const) {
      expect(changeRequestStatusSchema.parse(value)).toBe(value);
    }
    expect(() => changeRequestStatusSchema.parse("PROCESSED")).toThrow();
  });
});
