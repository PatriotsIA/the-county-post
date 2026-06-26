const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const DEFAULT_CACHE_SECONDS = Number(process.env.CACHE_SECONDS || 300);

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : Array.from(ALLOWED_ORIGINS)[0] || "*";
  const headers = {
    "access-control-allow-origin": corsOrigin,
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };

  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const feedUrl = event.queryStringParameters?.url;
  if (!feedUrl) {
    return {
      statusCode: 400,
      headers,
      body: "Missing url parameter",
    };
  }

  if (!isAllowedFeedUrl(feedUrl)) {
    return {
      statusCode: 400,
      headers,
      body: "Only Google News RSS feeds are allowed",
    };
  }

  try {
    const upstream = await fetch(feedUrl, {
      headers: {
        "user-agent": "TheCountyPost/1.0 (+https://thecountypost.com)",
        accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        headers,
        body: `Upstream RSS failed: ${upstream.statusText}`,
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "content-type": upstream.headers.get("content-type") || "application/rss+xml; charset=utf-8",
        "cache-control": `public, max-age=${DEFAULT_CACHE_SECONDS}`,
      },
      body: await upstream.text(),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: error instanceof Error ? error.message : "Unable to fetch RSS feed",
    };
  }
}

function isAllowedFeedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "news.google.com" && url.pathname.startsWith("/rss/");
  } catch {
    return false;
  }
}
