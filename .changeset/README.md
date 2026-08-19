# Changesets

This directory tracks version bumps and changelog entries for
`@hookengine/webhooks`, the only package in this monorepo that's published to
npm — `apps/api` and `apps/web` are private and excluded via
`ignore` in [`config.json`](./config.json).

Run `npm run changeset` after making a change to the SDK that consumers
should know about, pick a bump type (patch/minor/major), and describe the
change — see [CONTRIBUTING.md](../CONTRIBUTING.md#changing-packageswebhooks)
for the full guidance on when a change is patch vs. minor vs. major.

Full documentation: https://github.com/changesets/changesets
