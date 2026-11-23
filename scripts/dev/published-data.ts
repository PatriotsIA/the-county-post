import type { Plugin } from "vite";

const edge = "https://d2vo13idhuovzg.cloudfront.net";
const atlasPath = /^\/v1\/counties\/[a-z0-9-]+\/[a-z0-9-]+\/atlas(?:\/[a-z-]+)?$/;
const publishedPaths = [
  atlasPath,
  /^\/v1\/counties\/[a-z0-9-]+\/[a-z0-9-]+\/(?:weather|economic-data|public-notices)$/,
  /^\/v1\/sources\/counties\/[a-z0-9-]+\/[a-z0-9-]+$/,
  /^\/v1\/pages\/(?:national|states\/[a-z0-9-]+|counties\/[a-z0-9-]+\/[a-z0-9-]+)$/,
  /^\/v1\/feeds\/(?:national|states\/[a-z0-9-]+|counties\/[a-z0-9-]+\/[a-z0-9-]+)\/[a-zA-Z-]+$/,
  /^\/v1\/(?:videos\/featured|markets\/(?:metals|cattle))$/,
];

export function publishedDataPreview(allDesks: boolean): Plugin {
  return {
    name: "county-post-published-data-preview",
    apply: "serve",
    config() {
      if (allDesks) return { define: { "import.meta.env.VITE_NEWS_API_URL": "window.location.origin" } };
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const incoming = req.url || "";
        const atlas = incoming.startsWith("/__published-atlas/");
        if (!atlas && !(allDesks && incoming.startsWith("/v1/"))) return next();
        const path = atlas ? incoming.slice("/__published-atlas".length) : incoming;
        const pathname = path.split("?")[0];
        if (req.method !== "GET" || !(atlas ? [atlasPath] : publishedPaths).some((p) => p.test(pathname))) {
          res.writeHead(404).end();
          return;
        }
        const url = new URL(path, edge);
        if ([...url.searchParams.keys()].some((key) => !["sections", "limit", "offset"].includes(key))) {
          res.writeHead(400).end();
          return;
        }
        const client = new AbortController();
        res.once("close", () => client.abort());
        try {
          const response = await fetch(url, {
            redirect: "error",
            signal: AbortSignal.any([client.signal, AbortSignal.timeout(45000)]),
          });
          const body = await response.text();
          if (client.signal.aborted) return;
          for (const header of ["cache-control", "age", "date"]) {
            const value = response.headers.get(header);
            if (value) res.setHeader(header, value);
          }
          res.writeHead(response.status, { "Content-Type": "application/json" }).end(body);
        } catch {
          if (!client.signal.aborted)
            res
              .writeHead(502, { "Content-Type": "application/json" })
              .end(JSON.stringify({ error: "Published data unavailable" }));
        }
      });
    },
  };
}
