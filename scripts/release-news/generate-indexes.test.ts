import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildIndexes, LANGUAGES } from './generate-indexes.js';

function frontmatter(kind: 'release' | 'news', language: string): string {
  const identity = kind === 'release' ? 'version: v1.0.0' : 'slug: first-news';
  const type = kind === 'release' ? 'release' : 'announcement';
  return `---
type: ${type}
${identity}
title: Title ${language}
date: 2026-06-10
lang: ${language}
summary: Summary ${language}
critical: false
telegramTitle: Telegram ${language}
telegramSummary:
  - First ${language}
---

# Body
`;
}

function frontmatterWithDiscussion(language: string): string {
  return frontmatter('news', language).replace(
    'critical: false',
    'critical: false\ndiscussionUrl: https://github.com/AzamatMurra/steamoperationhub-releases/discussions/1',
  );
}

async function createFixture(): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'release-indexes-'));
  await fs.mkdir(path.join(rootDir, 'releases'));
  await fs.mkdir(path.join(rootDir, 'news'));
  for (const language of LANGUAGES) {
    await fs.writeFile(path.join(rootDir, 'releases', `v1.0.0.${language}.md`), frontmatter('release', language));
    await fs.writeFile(path.join(rootDir, 'news', `first-news.${language}.md`), frontmatter('news', language));
  }
  return rootDir;
}

test('groups complete translations into deterministic indexes', async () => {
  const rootDir = await createFixture();
  const indexes = await buildIndexes(rootDir);

  assert.deepEqual(Object.keys(indexes).sort(), [
    'latest-news.json',
    'latest-release.json',
    'news/index.json',
    'releases/index.json',
  ]);
  assert.deepEqual(
    Object.keys(JSON.parse(indexes['latest-release.json']).translations).sort(),
    [...LANGUAGES].sort(),
  );
});

test('rejects an incomplete translation set', async () => {
  const rootDir = await createFixture();
  await fs.rm(path.join(rootDir, 'news', 'first-news.uk.md'));

  await assert.rejects(buildIndexes(rootDir), /missing "uk" translation/);
});

test('rejects a duplicate translated publication declaration', async () => {
  const rootDir = await createFixture();
  await fs.writeFile(
    path.join(rootDir, 'releases', 'zz-duplicate.ru.md'),
    frontmatter('release', 'ru'),
  );

  await assert.rejects(buildIndexes(rootDir), /duplicate "ru" translation for "v1.0.0"/);
});

test('rejects invalid YAML frontmatter', async () => {
  const rootDir = await createFixture();
  await fs.writeFile(path.join(rootDir, 'news', 'first-news.ru.md'), '---\ntype: [\n---\n');

  await assert.rejects(buildIndexes(rootDir));
});

test('rejects notification metadata that is too long for Telegram', async () => {
  const rootDir = await createFixture();
  const invalid = frontmatter('news', 'ru').replace('Telegram ru', 'x'.repeat(161));
  await fs.writeFile(path.join(rootDir, 'news', 'first-news.ru.md'), invalid);

  await assert.rejects(buildIndexes(rootDir), /at most 160 characters/);
});

test('uses one shared Discussion URL for every news translation', async () => {
  const rootDir = await createFixture();
  for (const language of LANGUAGES) {
    await fs.writeFile(path.join(rootDir, 'news', `first-news.${language}.md`), frontmatterWithDiscussion(language));
  }

  const indexes = await buildIndexes(rootDir);
  const metadata = JSON.parse(indexes['latest-news.json']);
  assert.equal(metadata.discussionUrl, 'https://github.com/AzamatMurra/steamoperationhub-releases/discussions/1');
  for (const language of LANGUAGES) {
    assert.equal(metadata.translations[language].url, metadata.discussionUrl);
  }
});
