# The Morning Post

Daily national, state and county newsletters for The County Post. This separate SAM stack lives alongside the frontend and reads the existing public news/weather API; it does not change the news API stack or feed filters.

The public introduction is `/morning-post`. Edition-home signup forms use the existing local county/state search index, with delivery timezone settings under a disclosure. Footer forms use the current county or state context automatically and default to national elsewhere. All forms still require email confirmation. Existing `/newsletter#confirm=…`, management, unsubscribe and sponsor URLs remain supported; plain `/newsletter` redirects to the introduction and preserves campaign parameters.

The build emits `morning-post.html` with initial landing-page metadata. Its exact Amplify rewrite (`/morning-post` → `/morning-post.html`, 200) must precede the general SPA rewrite; `/morning-post/` redirects to `/morning-post`.

## Gift invitations

Every signup placement, including the footer, has a **Give the Gift of The Morning Post** button linking to `/morning-post#morning-post-gift`. The destination scrolls to and focuses the gift form heading. Its form collects the sender's name and email, recipient email, and an independently chosen county, state, or national edition. The selected edition and sender's email carry over through browser navigation state, never URL parameters. The direct link also works without navigation state, defaulting to the national edition. Giving a gift does not enroll the sender.

`POST /invite` creates a pending subscription with `invitedBy` attribution and queues the existing confirmation worker. The HTML and plain-text invitation explain The County Post, the free Morning Post edition and delivery time, and identify the sender. The verified County Post sender and reply address remain unchanged. Recipient confirmation uses the existing deliberate POST and immediate first-edition delivery path; link scanners cannot subscribe a recipient with a GET. Invitations expire after 48 hours and can be ignored or declined.

Invitations preserve active subscriptions, opt-outs, suppression records, and unexpired signups from other senders. Responses do not reveal recipient subscription status. Sender limits are five gift requests per day, alongside the existing shared IP, recipient and total signup limits. Retrying an invitation from the same sender uses its original token and send claim to recover a queue failure without duplicate emails. Expired pending records can be renewed only while their previous version still matches.

Deploy the newsletter backend before publishing a frontend that calls `/invite`. No new infrastructure, schedules, or production parameters are required. The gift form is validated with mocked email delivery locally; do not send test invitations to real people without authorization.

Gift backend deployed October 15, 2026 with production sending/address parameters preserved. Verification: 54 backend tests, newsletter browser checks, frontend/backend builds and typechecks, and SAM lint. A live SES simulator invitation remained pending until confirmed, then today's Potter County edition was observed as sent within 0.7 seconds of polling. Duplicate requests retained the same send claims and a subsequent gift respected opt-out. The simulator subscription and tokens were removed; no real recipients were contacted.

## Story pages

Every headline in an edition opens a County Post page for that story, inside the edition that emailed it:

| Edition | Story page |
| --- | --- |
| National | `/story/{id}` |
| State | `/{state}/story/{id}` |
| County | `/{state}/{county}/story/{id}` |

- **Page contents:** the publisher's headline, name and date, plus the feed's short summary and image. A **Read the full story at {publisher}** button opens the original article in a new tab. A short list from the same desk links back to that desk, and the edition's own masthead, advertisers and signup run around it.
- **Saving:** the worker saves each edition's stories, as `STORY#{id}` items in the subscriber table, before storing that edition's snapshot. A snapshot therefore never exists without its story pages.
  - Items expire after 90 days through the table's `expires` TTL, so links in older emails keep working well past the 14-day snapshot window.
  - The ID is 20 hex characters of the SHA-256 of the edition plus the article link. The same article gets a separate page in each edition that runs it.
- **Reading:** `GET /stories/{id}` returns only the fields the page shows. Any other path returns 404, so no other kind of record can be read this way.
- **Safety:** the page shows only what the worker saved. Nobody can build a County Post URL that displays a headline we did not send.
- **Search engines:** story pages are `noindex, follow` (`morningPostStory` in `src/lib/seo.ts`) and carry no `Article` structured data. They are another publisher's reporting, credited and linked, and would be thin duplicates in search.
- **Unavailable stories:** a page for an expired or unknown story, or one opened under another edition's URL, says the story is no longer available and links to that edition's news.

Deploy the frontend first: until it ships, story URLs fall through to the site's 404. Then deploy this stack. No infrastructure or parameter changes are needed, because the API and worker already have read and write access to the table.

## Delivery and consent

- Eight EventBridge Scheduler timezone schedules start the daily run at 06:15 local time, with daylight-saving adjustment. County defaults use its centroid and `tz-lookup`; readers may override the timezone, including in split-zone states/counties. National readers select their timezone.
- A signup creates only a pending subscription. Confirmation requires a deliberate POST from the email landing page; email-link scanners cannot opt readers in using GET. One email address may subscribe separately to several editions.
- Confirming queues the current local day's edition immediately, including after the morning delivery window. Confirmation retries retain the original first-edition date and share the scheduled send claim, so repeated confirmations and the morning run cannot send the same edition twice. Old confirmation links do not trigger new daily sends.
- DynamoDB stores subscribers and consent, confirmation/management tokens, rate counters, delivery claims and aggregate metrics. Pending subscribers expire after seven days. Confirmation tokens expire after 48 hours. Active subscriptions persist; unsubscribe removes them from the active-zone index. Suppression records persist to honor hard bounces and complaints.
- SQS separates signup and daily fan-out from sending. Two workers, each pausing 1.1 seconds after an SES send, keep this service below the inspected 14/second regional quota. A 5,000-message daily budget initially reserves capacity for other PIA applications. Signup limits: 20/IP/hour, 3/address/day and 1,000 total/day. Review these limits as subscriptions grow.
- Daily content is built once per edition/date/timezone and stored in a private S3 bucket for 14 days. A DynamoDB lease prevents concurrent builds. Missing/old stories are never fabricated. General stories are at most 72 hours old; obituaries at most seven days. Forecasts are dated and exclude expired periods. State/national forecasts explicitly identify their county locations.
- Confirmations before 06:15 use a separate early snapshot so they do not freeze the scheduled morning edition's content. That subscriber still receives only one edition that local day.
- Each story links to its own County Post story page (see *Story pages*). County Post originals link to their existing pages, and a feed item without a usable web link falls back to its `#desk-…`. Weather returns to its county weather page. The frontend build generates sponsor artwork and a catalog from the current site ad list; county/state restrictions are retained. PIA placements lead; county editions prefer current local partners. Removed advertisers disappear from the next generated catalog.
- Scheduled delivery starts at 06:15; mailbox arrival depends on queue size and receiving mail servers. Scheduled jobs older than the 08:15 local cutoff are skipped; confirmation-triggered first editions may send any time on their original local date. Scheduling, throttling and shared snapshots avoid a request per subscriber to the upstream news API.
- A permanent daily send claim prevents automatic duplicates. SES has no idempotency key: an ambiguous network timeout is left for manual review in the dead-letter queue, rather than risk a duplicate. Explicit SES throttles/rejections may retry. Never blindly replay ambiguous sends. Content-build and known delivery failures retry through SQS.

## Deploy

Production was activated October 13, 2026 with `SendingEnabled=true` and `MailingAddress=1000 S Jefferson St, Amarillo, TX 79101, United States`. All eight local-time schedules are enabled. The sender and DKIM are verified; live simulator checks passed for signup, queued confirmation, activation and one-click unsubscribe. There were no existing subscriber records at activation; preview recipients were not enrolled. The first scheduled production morning is October 14. The daily scheduled run itself has not yet been observed.

Preserve those production parameter values on subsequent deployments. The template's `false`/empty defaults are for a new installation, not the current production settings. GA4 open-event forwarding remains disabled by choice and is not required for delivery.

Immediate first-edition delivery was deployed October 13, 2026. A live Potter County simulator signup confirmed through the public API and reached SES's daily send in 2.7 seconds. Repeated confirmation retained the same delivery record; one-click unsubscribe and old-link protection passed. The simulator subscription and its tokens were removed afterward. Automated verification: 28 backend tests, typecheck/build, the browser confirmation/unsubscribe test, frontend build/lint (four existing unrelated warnings), and SAM validation.

From the repository root:

```sh
npm ci
npm run build
npm --prefix newsletter ci
npm --prefix newsletter run typecheck
npm --prefix newsletter test
npm --prefix newsletter run build
sam validate --lint --template-file newsletter/template.yaml
sam deploy --template-file newsletter/template.yaml \
  --stack-name county-post-newsletter --resolve-s3 \
  --s3-prefix county-post-newsletter --capabilities CAPABILITY_IAM \
  --profile pia --region us-east-2 \
  --parameter-overrides SendingEnabled=true \
    'MailingAddress="1000 S Jefferson St, Amarillo, TX 79101, United States"'
```

The initial default is `SendingEnabled=false`. The API refuses signup while delivery is disabled; no false success or unconfirmed marketing sends. Add the `NewsletterApiUrl` output as `VITE_NEWSLETTER_API_URL` in Amplify's existing environment map (read/merge, never replace other keys), then deploy the frontend. Existing general SPA rewrites must cover `/newsletter` and `/newsletter/sponsor`.

Before enabling delivery, set `MailingAddress` to the owner's public business address and verify SES `thecountypost.com` reports SUCCESS. The stack adds the sender identity, three DKIM CNAMEs and a non-enforcing DMARC record; it does not change existing MX/SPF records. Sender: `The County Post <newsletters@thecountypost.com>`; replies: `submissions@thecountypost.com`. Update `SendingEnabled=true` to enable all schedules and confirmation sends. Check the regional SES quota before raising `DailySendBudget` or worker concurrency.

AWS SES us-east-2 was inspected October 12, 2026: production access, sending enabled, healthy, 50,000 messages/day and 14 messages/second. County Post's domain was not yet verified at initial inspection.

## Analytics

Current rollout: **click tracking first; connect GA4 opens later** (owner's October 12 choice).

- Links use `utm_source=the_county_post`, `utm_medium=email`, `utm_campaign=morning_post_YYYY-MM-DD`, and edition/placement-specific `utm_content`. SEO canonicals stay clean while GA4 page views retain these campaign parameters.
- Advertisers use `/newsletter/sponsor` with an existing ad ID, not an arbitrary redirect URL. The page records `newsletter_sponsor_click` before continuing to the current advertiser. A 3.5-second fallback still navigates if analytics is blocked. Direct fallback links are visible. Only ads eligible for that edition can be opened.
- GA4 property measurement ID: `G-ZDZY8JLQKQ`. In Reports → Acquisition → Traffic acquisition, filter session source/medium to `the_county_post / email`; compare session campaign and manual ad content. In Explore, register event-scoped dimensions `advertiser_id` and `newsletter_edition` for sponsor clicks. Browser analytics blocking and link scanners affect click counts.
- SES records unique delivery/open/click events in DynamoDB (`METRIC#date#edition`), deduplicated by message/event/placement for 35 days. Opens are estimates affected by image blocking, bots, and privacy proxies. They are not website page views.
- Optional later GA4 integration: create a Measurement Protocol API secret in GA4 Admin → Data streams → County Post → Measurement Protocol API secrets. Store the **plain value** as an AWS Secrets Manager secret (suggested name `county-post-newsletter/ga4` in us-east-2). Supply only its ARN via `GaApiSecretArn`. Never put the value in Git, Amplify browser variables, chat, CLI parameter overrides or logs.
- The bridge emits `newsletter_open`, `newsletter_click`, and `newsletter_delivery`. Event-scoped dimensions: `newsletter_edition`, `newsletter_date`, `newsletter_placement`, `measurement_method`. It sends an opaque per-message client identifier, not recipient addresses, email hashes, IPs, user agents, raw URLs or subscriber tokens. The identifiers do not join email recipients to website users. Advertising personalization and ad user data are denied. Validate one payload with Google's debug endpoint and verify incoming GA4 events before claiming this optional integration is live.
- GA4 Measurement Protocol is best effort; a 2xx means accepted, not guaranteed processing. It must not be used as the delivery ledger. Local metrics remain available if GA is absent or a call fails. Historical metrics are not automatically backfilled when the secret is added.

## Verification and operations

```sh
npm --prefix newsletter test
npm run test:e2e -- tests/e2e/newsletter.spec.ts
aws sesv2 get-email-identity --email-identity thecountypost.com --profile pia --region us-east-2
aws cloudformation describe-stacks --stack-name county-post-newsletter --profile pia --region us-east-2
```

Inspect the `FailedDeliveriesAlarm`, worker errors and SQS queue age before increasing volume. The CloudWatch alarm uses the existing `pia-operations-alerts` SNS topic, whose confirmed email destination is erik@patriotsinaction.com. The SES configuration suppresses hard bounces/complaints; the feedback consumer also blocks that address across all newsletter editions. Subscribers can change delivery timezone or unsubscribe using their email link; changing edition uses unsubscribe plus a newly confirmed signup.

Preview only (no sends): `cd newsletter && npm run build && node dist/preview.mjs`. A preview fetches current national, Texas and Potter County feeds, writes ignored files under `previews/`, and never adds subscribers. Sending requires explicit `--to=… --from=…` flags and a verified SES sender. Use `--saved` to render the previously inspected snapshot without another feed fetch. Headlines link to story pages, which open only once their stories are saved. Sending a preview therefore saves them first and needs `TABLE_NAME` set to the `SubscriberTable` output. `--save-stories` saves them without sending. Previews have no production SES tracking configuration and do not count as daily deliveries.

External references: [SES production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html), [timezone scheduling](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html), [SES unsubscribe headers](https://aws.amazon.com/blogs/messaging-and-targeting/using-one-click-unsubscribe-with-amazon-ses/), [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference).
