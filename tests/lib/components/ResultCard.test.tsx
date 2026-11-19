/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import ResultCard from "@/components/ResultCard";
import { PUBLICCODE_PROFILE_PATH } from "@/lib/publiccodeProfile";

function renderCard(id: string) {
  render(<ResultCard id={id} title={id} description="" status="info" message="Message" />);
  fireEvent.click(screen.getByRole("button"));
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
});
