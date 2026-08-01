import { z } from "zod";
import { MAX_CONTENT_LENGTH } from "@/lib/schemas";

const requestSchema = z.object({
  url: z.url(),
});

function parsePullRequestUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "github.com") return null;

  const match = url.pathname.match(
    /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)\/?$/,
  );
  if (!match) return null;

  return {
    owner: match[1],
    repository: match[2],
    number: match[3],
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  const pullRequest = parsed.success
    ? parsePullRequestUrl(parsed.data.url)
    : null;

  if (!parsed.success || !pullRequest) {
    return Response.json(
      { error: "Enter a public GitHub pull request URL." },
      { status: 400 },
    );
  }

  const headers: HeadersInit = {
    accept: "application/vnd.github.v3.diff",
    "user-agent": "HarnessLab",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${pullRequest.owner}/${pullRequest.repository}/pulls/${pullRequest.number}`,
    { headers, cache: "no-store" },
  );

  if (!response.ok) {
    return Response.json(
      {
        error:
          response.status === 404
            ? "The public pull request was not found."
            : `GitHub returned ${response.status}. Try again later.`,
      },
      { status: response.status === 404 ? 404 : 502 },
    );
  }

  const content = await response.text();
  if (!content.trim()) {
    return Response.json({ error: "The pull request has no diff." }, { status: 422 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return Response.json(
      {
        error: `The pull request diff exceeds the ${MAX_CONTENT_LENGTH.toLocaleString()} character MVP limit.`,
      },
      { status: 413 },
    );
  }

  return Response.json({
    content,
    inputType: "diff",
    source: {
      kind: "github-pr",
      url: parsed.data.url,
    },
  });
}
