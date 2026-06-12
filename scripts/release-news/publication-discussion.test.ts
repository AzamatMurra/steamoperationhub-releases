import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LANGUAGES, type MetadataEntry } from './generate-indexes.js';
import { buildDiscussionDraft, setDiscussionUrl } from './publication-discussion.js';

test('builds one localized Discussion draft for a publication', async () => {
  const rootDir = await createFixture();
  const draft = await buildDiscussionDraft(rootDir, 'first-news', [metadata()]);

  assert.equal(draft.type, 'announcement');
  assert.match(draft.title, /Announcement: Заголовок ru/);
  assert.match(draft.body, /## Русский/);
  assert.match(draft.body, /## English/);
  assert.match(draft.body, /## Українська/);
  assert.match(draft.body, /<!-- soh-publication:first-news -->/);
});

test('writes one Discussion URL to every translation frontmatter', async () => {
  const rootDir = await createFixture();
  const url = 'https://github.com/AzamatMurra/steamoperationhub-releases/discussions/1';
  await setDiscussionUrl(rootDir, 'first-news', url);

  for (const language of LANGUAGES) {
    const content = await fs.readFile(path.join(rootDir, `news/first-news.${language}.md`), 'utf8');
    assert.match(content, new RegExp(`discussionUrl: ${url}`));
    assert.match(content, new RegExp(`# Body ${language}`));
  }
});

test('rejects non-GitHub Discussion URLs', async () => {
  const rootDir = await createFixture();
  await assert.rejects(
    setDiscussionUrl(rootDir, 'first-news', 'https://example.com/discussions/1'),
    /steamoperationhub-releases repository/,
  );
});

async function createFixture(): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'publication-discussion-'));
  await fs.mkdir(path.join(rootDir, 'news'));
  for (const language of LANGUAGES) {
    await fs.writeFile(path.join(rootDir, `news/first-news.${language}.md`), `---
type: announcement
slug: first-news
title: Заголовок ${language}
date: 2026-06-12
lang: ${language}
summary: Summary ${language}
critical: false
telegramTitle: Telegram ${language}
telegramSummary:
  - Item ${language}
---

# Body ${language}
`);
  }
  return rootDir;
}

function metadata(): MetadataEntry {
  return {
    type: 'announcement',
    slug: 'first-news',
    date: '2026-06-12',
    critical: false,
    translations: Object.fromEntries(LANGUAGES.map(language => [language, {
      lang: language,
      title: `Заголовок ${language}`,
      summary: `Summary ${language}`,
      telegramTitle: `Telegram ${language}`,
      telegramSummary: [`Item ${language}`],
      url: `https://example.com/${language}`,
    }])) as MetadataEntry['translations'],
  };
}
