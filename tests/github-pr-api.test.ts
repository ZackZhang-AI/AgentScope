import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/github/pr/route";

function request(url: string) {
  return new Request("http://localhost/api/github/pr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

describe("POST /api/github/pr", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects non-GitHub URLs before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request("https://example.com/acme/repo/pull/1"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("imports a public pull request diff through the GitHub API", async () => {
    const fetchMock = vi.fn(async () => new Response("diff --git a/a.ts b/a.ts"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request("https://github.com/acme/repo/pull/42"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.inputType).toBe("diff");
    expect(payload.content).toContain("diff --git");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/repo/pulls/42",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
