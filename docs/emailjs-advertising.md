# Advertising inquiry notification

The advertiser branch uses the consolidated PIA EmailJS account: service
`service_o3lsjkm`, template `template_countypost`, and that account's public key.
The template fixes To Email to `erik@patriotsinaction.com`, Cc to
`dan@patriotsinaction.com`, and Reply-To to `{{reply_to}}`.

After creating a checkout session, the form emails its submitted campaign details
before navigating to Stripe. The email records coverage, placement, cadence,
quoted amount, contact details, referral, and the private creative asset key when
present. It states that payment is not confirmed. Email failure retains the form
and allows retry without navigating to checkout. Public contact links and Stripe
pricing are independent of this routing.

Use Node 22 for lint, build, and the seven Playwright tests. Set a unique
`PLAYWRIGHT_PORT` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` where needed. Tests use fake
EmailJS configuration and intercept email, population, and checkout calls.
