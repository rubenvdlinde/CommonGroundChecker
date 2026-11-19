/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import FollowControl from "@/components/FollowControl";
import { putRepositoryFollow } from "@/lib/apiClient";

vi.mock("@/lib/apiClient", () => ({
  putRepositoryFollow: vi.fn(),
}));

const mockedPut = putRepositoryFollow as unknown as ReturnType<typeof vi.fn>;

describe("FollowControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("saves the follow setting with the chosen interval and admin token", async () => {
    mockedPut.mockResolvedValueOnce({
      id: "repo-id",
      followed: true,
      checkIntervalHours: 24,
      lastCheckedAt: "2026-11-01T10:00:00.000Z",
      nextCheckAt: "2026-11-02T10:00:00.000Z",
    });

    render(
      <FollowControl
        repoId="repo-id"
        initialFollowed={false}
        initialCheckIntervalHours={null}
        initialNextCheckAt={null}
      />
    );

    expect(screen.getByText(/It is not followed now/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Follow"));
    fireEvent.change(screen.getByLabelText("Check interval"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("Following. Next check:");
    });
    expect(mockedPut).toHaveBeenCalledWith(
      "repo-id",
      { followed: true, checkIntervalHours: 24 },
      "secret"
    );
  });

  it("offers daily, weekly and monthly intervals, defaulting to weekly", () => {
    render(
      <FollowControl
        repoId="repo-id"
        initialFollowed={false}
        initialCheckIntervalHours={null}
        initialNextCheckAt={null}
      />
    );

    const select = screen.getByLabelText("Check interval") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      "Daily",
      "Weekly",
      "Monthly",
    ]);
    expect(select.value).toBe("168");
  });

  it("shows the next check of a followed repository", () => {
    render(
      <FollowControl
        repoId="repo-id"
        initialFollowed
        initialCheckIntervalHours={720}
        initialNextCheckAt="2026-12-01T10:00:00.000Z"
      />
    );

    expect(screen.getByText(/Next check:/)).toBeTruthy();
    expect((screen.getByLabelText("Follow") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Check interval") as HTMLSelectElement).value).toBe("720");
  });

  it("explains a rejected admin token", async () => {
    mockedPut.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));

    render(
      <FollowControl
        repoId="repo-id"
        initialFollowed={false}
        initialCheckIntervalHours={null}
        initialNextCheckAt={null}
      />
    );

    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("The admin token is not valid.");
    });
  });
});
