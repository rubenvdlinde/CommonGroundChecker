/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import ResultCard from "@/components/ResultCard";
import { PUBLICCODE_PROFILE_PATH } from "@/lib/publiccodeProfile";

function renderCard(id: string) {
  render(<ResultCard id={id} title={id} description="" status="info" message="Message" />);
  fireEvent.click(screen.getByRole("button"));
}

function renderFailingCard(props: Partial<Parameters<typeof ResultCard>[0]> = {}) {
  return render(
    <ResultCard
      id="complexity"
      title="Cyclomatic complexity (Lizard)"
      description="Tracks cyclomatic complexity."
      status="fail"
      message="Average CCN above the threshold."
      {...props}
    />
  );
}

describe("ResultCard", () => {
  afterEach(() => cleanup());

  it("links a publiccode-related criterion to the profile", () => {
    renderCard("maintenance");
    expect(
      screen.getByRole("link", { name: "How to fill publiccode.yml for this criterion" }).getAttribute("href")
    ).toBe(PUBLICCODE_PROFILE_PATH);
  });

  it("does not link other criteria to the profile", () => {
    renderCard("docker");
    expect(screen.queryByRole("link", { name: "How to fill publiccode.yml for this criterion" })).toBeNull();
  });

  it("links a criterion to its page in the rating guide", () => {
    renderCard("docker");
    expect(screen.getByRole("link", { name: "How this is checked" }).getAttribute("href")).toBe("/docs/criteria/docker");
  });

  it("does not link a result that has no criterion page", () => {
    renderCard("unknown");
    expect(screen.queryByRole("link", { name: "How this is checked" })).toBeNull();
  });

  it("shows a failing informative criterion as information, without a red fail badge", () => {
    const { container } = renderFailingCard({ requirementLevel: "informative" });

    expect(screen.queryByText("Fail")).toBeNull();
    expect(screen.getByText("Info")).toBeTruthy();
    expect(container.querySelector(".bg-red-50, .border-red-300")).toBeNull();
    expect((container.firstElementChild as HTMLElement).className).toContain("bg-blue-50");
  });

  it("keeps the fail badge for a recommended or mandatory criterion", () => {
    renderFailingCard({ requirementLevel: "recommended" });

    expect(screen.getByText("Fail")).toBeTruthy();
  });
});
