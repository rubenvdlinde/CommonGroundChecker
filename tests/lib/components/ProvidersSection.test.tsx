/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import ProvidersSection from "@/components/ProvidersSection";

afterEach(cleanup);

describe("ProvidersSection", () => {
  it("lists each provider with its services, link, contact and date", () => {
    render(
      <ProvidersSection
        listUrl="https://github.com/o/r/blob/main/config/repositories.yml"
        providers={[
          { name: "Maykin", services: ["maintenance", "hosting"], url: "https://maykinmedia.nl", contact: "info@maykinmedia.nl", since: "2024-01-01" },
          { name: "Example", services: ["training"], contact: "https://example.org/contact" },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "Maykin" }).getAttribute("href")).toBe("https://maykinmedia.nl");
    const services = within(screen.getByRole("list", { name: "Services of Maykin" })).getAllByRole("listitem");
    expect(services.map((item) => item.textContent)).toEqual(["Maintenance", "Hosting"]);
    expect(screen.getByRole("link", { name: "info@maykinmedia.nl" }).getAttribute("href")).toBe("mailto:info@maykinmedia.nl");
    expect(screen.getByText(/Listed since 2024-01-01/)).toBeTruthy();
    expect(screen.getByText("Example").tagName).toBe("P");
    expect(screen.getByRole("link", { name: "https://example.org/contact" })).toBeTruthy();
  });

  it("says when no provider is listed and links to the component list", () => {
    render(<ProvidersSection providers={[]} listUrl="https://github.com/o/r/blob/main/config/repositories.yml" />);
    expect(screen.getByText("No service providers listed.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "component list" }).getAttribute("href")).toMatch(/config\/repositories\.yml$/);
  });
});
