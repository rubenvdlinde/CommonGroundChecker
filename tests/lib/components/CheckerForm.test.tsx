/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import CheckerForm from "@/components/CheckerForm";

vi.mock("@/lib/apiClient", () => ({
  getRepositories: vi.fn().mockResolvedValue({ repositories: [] }),
  getRepoHistory: vi.fn(),
}));

describe("CheckerForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("gives the branch or tag field a touch target of at least 44px below 1024px", () => {
    render(<CheckerForm onSubmit={vi.fn()} loading={false} />);

    const input = screen.getByLabelText(/Branch or tag to scan/);
    expect(input.className).toContain("min-h-[44px]");
    expect(input.className).toContain("lg:min-h-0");
  });
});
