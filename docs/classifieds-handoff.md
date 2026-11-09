# Classifieds public handoff

The November 9 authorized public launch defaults county and state links to
https://classifieds.thecountypost.com. Set VITE_CLASSIFIEDS_ORIGIN to an empty
string for an explicit rollback to the legacy emailed-submission form.
For a private preview, use `https://staging-classifieds.thecountypost.com`.
The only other accepted origin is `https://classifieds.thecountypost.com`; the owner authorized
that origin for the November 9 public marketplace launch.

Links carry county/state FIPS identity instead of assuming the two applications
have identical slugs. County posting preserves the selected market through account
setup. Connecticut's historical county desks retain their own identity.

Existing emailed submissions remain with the news desk. They are not automatically
published, imported, or charged. Marketplace accounts are separate accounts.

Private preview validation:
`VITE_CLASSIFIEDS_ORIGIN=https://staging-classifieds.thecountypost.com npx playwright test tests/e2e/classifieds-handoff.spec.ts`.
