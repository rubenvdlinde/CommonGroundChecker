import { describe, expect, it } from "vitest";
import { toSlaIssue } from "@/lib/projectActivity/slaGithub";

type Node = Parameters<typeof toSlaIssue>[0];

function node(overrides: Partial<Node> = {}): Node {
  return {
    title: "Crash on start",
    url: "https://github.com/org/repo/issues/5",
    createdAt: "2026-11-02T09:00:00Z",
    closedAt: null,
    stateReason: null,
    author: { login: "reporter" },
    issueType: { name: "Bug" },
    labels: { nodes: [{ name: "Bug" }, { name: "Priority: Critical" }] },
    comments: { nodes: [] },
    timelineItems: { nodes: [] },
    ...overrides,
  };
}

describe("toSlaIssue", () => {
  it("keeps lower case labels and the issue type", () => {
    expect(toSlaIssue(node())).toMatchObject({ labels: ["bug", "priority: critical"], issueType: "Bug" });
  });

  it("takes the first comment or label by a maintainer, not by the author, a bot or an outsider", () => {
    const issue = toSlaIssue(
      node({
        comments: {
          nodes: [
            { createdAt: "2026-11-02T09:05:00Z", authorAssociation: "OWNER", author: { __typename: "User", login: "reporter" } },
            { createdAt: "2026-11-02T09:10:00Z", authorAssociation: "MEMBER", author: { __typename: "Bot", login: "helper" } },
            { createdAt: "2026-11-02T09:15:00Z", authorAssociation: "NONE", author: { __typename: "User", login: "user" } },
            { createdAt: "2026-11-04T09:00:00Z", authorAssociation: "COLLABORATOR", author: { __typename: "User", login: "dev" } },
          ],
        },
        timelineItems: {
          nodes: [
            { __typename: "LabeledEvent", createdAt: "2026-11-02T09:20:00Z", actor: { __typename: "Bot", login: "labeler[bot]" } },
            { __typename: "LabeledEvent", createdAt: "2026-11-03T09:00:00Z", actor: { __typename: "User", login: "triager" } },
          ],
        },
      })
    );
    expect(issue.firstResponseAt).toBe("2026-11-03T09:00:00.000Z");
  });

  it("reads when the closing pull request was merged, or the closing commit made", () => {
    const closedByPr = toSlaIssue(
      node({
        closedAt: "2026-11-05T09:00:00Z",
        stateReason: "COMPLETED",
        timelineItems: { nodes: [{ __typename: "ClosedEvent", closer: { __typename: "PullRequest", mergedAt: "2026-11-05T08:59:00Z" } }] },
      })
    );
    expect(closedByPr).toMatchObject({ stateReason: "COMPLETED", closingChangeAt: "2026-11-05T08:59:00Z" });

    const closedByCommit = toSlaIssue(
      node({
        closedAt: "2026-11-05T09:00:00Z",
        stateReason: "COMPLETED",
        timelineItems: { nodes: [{ __typename: "ClosedEvent", closer: { __typename: "Commit", committedDate: "2026-11-04T12:00:00Z" } }] },
      })
    );
    expect(closedByCommit.closingChangeAt).toBe("2026-11-04T12:00:00Z");
  });

  it("has no closing change for an issue closed by hand, or one reopened since", () => {
    expect(toSlaIssue(node({ closedAt: "2026-11-05T09:00:00Z", stateReason: "COMPLETED" })).closingChangeAt).toBeNull();
    const reopened = toSlaIssue(
      node({ timelineItems: { nodes: [{ __typename: "ClosedEvent", closer: { __typename: "PullRequest", mergedAt: "2026-11-05T08:59:00Z" } }] } })
    );
    expect(reopened).toMatchObject({ closingChangeAt: null, stateReason: null });
  });
});
