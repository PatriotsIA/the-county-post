# Classifieds handoff (prepared, disabled for public launch)

`VITE_CLASSIFIEDS_ORIGIN` enables county and state marketplace links at build time.
It is unset by default: the live emailed-classified submission form stays in place.
For a private preview, use `https://staging-classifieds.thecountypost.com`.
The only other accepted origin is `https://classifieds.thecountypost.com`; activating
that origin requires the separately authorized public marketplace launch.

Links carry county/state FIPS identity instead of assuming the two applications
have identical slugs. County posting preserves the selected market through account
setup. Connecticut's historical county desks retain their own identity.

Existing emailed submissions remain with the news desk. They are not automatically
published, imported, or charged. Marketplace accounts are separate accounts.

Private preview validation:
`VITE_CLASSIFIEDS_ORIGIN=https://staging-classifieds.thecountypost.com npx playwright test tests/e2e/classifieds-handoff.spec.ts`.
