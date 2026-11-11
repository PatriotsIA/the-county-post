# Shared Classifieds advertising catalog

`npm run build` exports the canonical ads, feed sponsors and partner creatives
as `dist/classifieds-ads.json` (schema version 1). Artwork is copied to immutable
`dist/shared-ads/<sha256>.<extension>` URLs. The manifest records the build commit,
placements, geography, destination links, Vimeo metadata and artwork hashes.
The existing ad data files remain the source of truth; no second manual list is
required for Classifieds.

Classifieds checks the public manifest hourly in its existing maintenance task.
It validates the complete feed and artwork before activating a new catalog,
stores verified artwork in its own media storage, and retains its last successful
catalog if the source is unavailable. Before its first successful refresh it uses
the bundled ads. It does not send visitor identifiers to this feed.

After changing ads, run the normal build and inspect the export count. Publish
through the existing news-site release. The next Classifieds maintenance run
picks it up; operators can also run `sync_county_post_ads` through the existing
restricted application operations task.
