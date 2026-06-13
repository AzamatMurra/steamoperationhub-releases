# SteamOperationHub Releases

This repository is the public source of truth for SteamOperationHub downloads,
release notes, and news.

## Structure

- `releases/<version>.<lang>.md` contains localized release notes.
- `news/<slug>.<lang>.md` contains localized announcements and roadmaps.
- `latest-release.json` and `latest-news.json` power Telegram bot shortcuts.
- `releases/index.json` and `news/index.json` contain the complete metadata indexes.
- `templates/` contains localized starting templates for new publications.
- `PRODUCT.md` contains the product overview synchronized from the private source repository.
- GitHub Discussions is the public chronological feed for news, announcements,
  maintenance notices, and roadmaps.

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
release broadcasts start automatically after a successful tag-based desktop
release. A newly added news slug automatically creates one localized GitHub
Discussion, writes its URL back to the publication metadata, and broadcasts the
localized notification through `@SteamOperationHubBot`. Editing an existing
slug does not create another Discussion or broadcast.

Agents can accept natural-language publication requests such as:

```text
Опубликуй новость о новой функции...
Опубликуй анонс о предстоящем обновлении...
Опубликуй maintenance о технических работах...
Опубликуй roadmap о планах развития...
```

The agent creates the `ru/en/uk` Markdown set from `templates/news.*.md` and
updates the indexes. The workflow handles the Discussion and automatic Telegram
broadcast.
