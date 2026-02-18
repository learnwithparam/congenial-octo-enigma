import { describe, it, expect } from "vitest";
import type { EmailJobData, ReportJobData } from "../src/types.js";

describe("types", () => {
  it("should define valid EmailJobData", () => {
    const data: EmailJobData = {
      to: "test@example.com",
      subject: "Hello",
      html: "<p>World</p>",
    };

    expect(data.to).toBe("test@example.com");
    expect(data.subject).toBe("Hello");
    expect(data.html).toBe("<p>World</p>");
  });

  it("should define valid ReportJobData", () => {
    const data: ReportJobData = {
      reportType: "daily",
      userId: "user-123",
    };

    expect(data.reportType).toBe("daily");
    expect(data.userId).toBe("user-123");
  });

  it("should allow ReportJobData without userId", () => {
    const data: ReportJobData = {
      reportType: "weekly",
    };

    expect(data.reportType).toBe("weekly");
    expect(data.userId).toBeUndefined();
  });
});
