# SteamOperationHub Releases

This repository is the public source of truth for SteamOperationHub downloads,
release notes, and news.

## Structure

- `releases/<version>.<lang>.md` contains localized release notes.
- `news/<slug>.<lang>.md` contains localized announcements and roadmaps.
- `latest-release.json` and `latest-news.json` power Telegram bot shortcuts.
- `releases/index.json` and `news/index.json` contain the complete metadata indexes.
- `PRODUCT.md` contains the product overview synchronized from the private source repository.

Every publication must include `ru`, `en`, and `uk` Markdown files with matching
shared metadata. Telegram notifications use only `telegramTitle`,
`telegramSummary`, and the link to the full Markdown publication.

## Publishing

```bash
npm ci
npm run generate
npm test
npm run check
```

Commit the publication files and generated JSON indexes together. Telegram
broadcasts are never automatic: the manual workflow only requests an
administrator preview in `@SteamOperationHubBot`.
