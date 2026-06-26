# Amplify RSS Feeds

The app cannot fetch Google News RSS directly from the browser in production because RSS responses do not include browser CORS headers. Local development uses Vite middleware at `/api/rss`, but Amplify static hosting does not deploy that middleware.

For a one-step static Amplify deploy, the client falls back to `rss2json` in production. Do not send `count` to `rss2json` unless you also provide an API key; the public endpoint returns `422` for that parameter without a key.

## Static Amplify Setup

No backend is required for the default setup.

Optional Amplify Hosting environment variables:

```text
VITE_RSS2JSON_API_KEY=
VITE_RSS_PROVIDER_URL=https://api.rss2json.com/v1/api.json
```

If `VITE_RSS2JSON_API_KEY` is blank, the app still uses the public `rss2json` endpoint but does not request custom item counts.

## Optional Dedicated Proxy

1. Create an AWS Lambda function using `aws/rss-proxy-lambda.mjs`.
2. Use Node.js 20+ for the Lambda runtime.
3. Enable a Lambda Function URL with CORS.
4. Set Lambda environment variables:

```text
ALLOWED_ORIGINS=https://main.d2z6lt4e5q50in.amplifyapp.com
CACHE_SECONDS=300
```

5. In Amplify Hosting, add this environment variable:

```text
VITE_RSS_LOCAL_PROXY_URL=https://YOUR_LAMBDA_FUNCTION_URL
```

6. Redeploy the Amplify app so Vite bakes the environment variable into the client bundle.

## Validation

Open this URL in a browser after deployment:

```text
https://YOUR_LAMBDA_FUNCTION_URL?url=https%3A%2F%2Fnews.google.com%2Frss%2Fsearch%3Fq%3DUnited%2520States%2520news%26hl%3Den-US%26gl%3DUS%26ceid%3DUS%3Aen
```

You should see XML, not a `404`, `422`, or CORS error.

## Why This Is Needed

Amplify static hosting serves files from `dist/`. It does not include Vite dev server middleware, so `/api/rss` returns `404` after deployment unless you explicitly route it to a backend. The static setup avoids calling `/api/rss` in production unless `VITE_RSS_LOCAL_PROXY_URL` is configured.
