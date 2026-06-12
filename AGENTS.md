# AGENTS.md — SteamOperationHub Releases

## Назначение

Репозиторий хранит публичные release notes, новости и metadata для
SteamOperationHub. GitHub Releases используется только для версий приложения и
бинарных файлов. GitHub Discussions — публичная хронологическая лента остальных
публикаций.

## Запросы На Публикацию

Фразы пользователя вида:

- `опубликуй новость ...`;
- `опубликуй анонс ...`;
- `опубликуй maintenance ...`;
- `опубликуй roadmap ...`;

означают создание нового комплекта `news/<slug>.ru|en|uk.md` с соответствующим
полем `type`. Используй `templates/news.*.md`, подготовь полноценные переводы и
не добавляй `discussionUrl` вручную.

После подготовки выполни:

```bash
npm run indexes:generate
npm test
npm run indexes:check
```

При публикации в `main` workflow автоматически:

1. создаст локализованную GitHub Discussion;
2. запишет `discussionUrl` обратно в Markdown и JSON-индексы;
3. создаст Telegram admin-preview.

Редактирование существующего slug не создаёт новую Discussion. Для новой
публикации всегда используй новый slug.

## Релизы

Запрос `опубликуй релиз vX.Y.Z` относится к tag-based release flow основного
репозитория SteamOperationHub. Не создавай псевдорелизы или Git-теги для
новостей и анонсов.
