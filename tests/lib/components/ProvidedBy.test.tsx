/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ProvidedBy from "@/components/ProvidedBy";

afterEach(cleanup);

describe("ProvidedBy", () => {
  it("links the repository owner to its provider page", () => {
    render(<ProvidedBy repoUrl="https://gitlab.com/digilab.overheid.nl/ecosystem/ftv/open-ftv" />);
    expect(screen.getByText(/Provided by/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "digilab.overheid.nl/ecosystem/ftv" }).getAttribute("href")).toBe(
      "/providers/gitlab--digilab-overheid-nl--ecosystem--ftv"
    );
  });

  it("shows nothing for a URL that names no repository", () => {
    const { container } = render(<ProvidedBy repoUrl="not a url" />);
    expect(container.innerHTML).toBe("");
  });
});
