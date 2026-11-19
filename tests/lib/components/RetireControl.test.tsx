/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import RetireControl from "@/components/RetireControl";
import { putRepositoryRetire } from "@/lib/apiClient";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/apiClient", () => ({ putRepositoryRetire: vi.fn() }));

const mockedPut = putRepositoryRetire as unknown as ReturnType<typeof vi.fn>;

describe("RetireControl", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("retires with a reason and the admin token, then reloads the page", async () => {
    mockedPut.mockResolvedValueOnce({ id: "repo-id", retiredAt: "2026-11-19T10:00:00Z", retiredReason: "Replaced", nextCheckAt: null });
    render(<RetireControl repoId="repo-id" initialRetired={false} initialReason={null} />);

    expect(screen.queryByLabelText("Reason")).toBeNull();
    fireEvent.click(screen.getByLabelText("Retired"));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  Replaced " } });
    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Retired. It is no longer rescanned."));
    expect(mockedPut).toHaveBeenCalledWith("repo-id", { retired: true, reason: "Replaced" }, "secret");
    expect(refresh).toHaveBeenCalled();
  });

  it("undoes a retirement without a reason", async () => {
    mockedPut.mockResolvedValueOnce({ id: "repo-id", retiredAt: null, retiredReason: null, nextCheckAt: "2026-11-20T10:00:00Z" });
    render(<RetireControl repoId="repo-id" initialRetired initialReason="Replaced" />);

    expect((screen.getByLabelText("Reason") as HTMLTextAreaElement).value).toBe("Replaced");
    fireEvent.click(screen.getByLabelText("Retired"));
    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("No longer retired."));
    expect(mockedPut).toHaveBeenCalledWith("repo-id", { retired: false }, "secret");
  });

  it("says when the token is wrong or admin actions are off", async () => {
    mockedPut.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    render(<RetireControl repoId="repo-id" initialRetired={false} initialReason={null} />);
    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("The admin token is not valid."));

    mockedPut.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 503 }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("ADMIN_TOKEN is not configured"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
