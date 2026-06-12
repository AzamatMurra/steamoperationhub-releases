import assert from 'node:assert/strict';
import test from 'node:test';
import { findNewPublicationRequests } from './find-new-publications.js';
import type { MetadataEntry } from './generate-indexes.js';

const metadata = [
  entry('announcement', 'first-news'),
  entry('maintenance', 'maintenance-window'),
];

test('creates one request for all translations of a new publication', () => {
  assert.deepEqual(findNewPublicationRequests([
    'news/first-news.ru.md',
    'news/first-news.en.md',
    'news/first-news.uk.md',
  ], metadata), [{ type: 'announcement', slug: 'first-news' }]);
});

test('ignores edited files because the workflow passes added files only', () => {
  assert.deepEqual(findNewPublicationRequests([], metadata), []);
});

test('creates typed requests for multiple new publications', () => {
  assert.deepEqual(findNewPublicationRequests([
    'news/maintenance-window.ru.md',
    'news/first-news.ru.md',
  ], metadata), [
    { type: 'announcement', slug: 'first-news' },
    { type: 'maintenance', slug: 'maintenance-window' },
  ]);
});

test('rejects a new publication missing from the generated index', () => {
  assert.throws(
    () => findNewPublicationRequests(['news/missing.ru.md'], metadata),
    /metadata not found/,
  );
});

function entry(type: MetadataEntry['type'], slug: string): MetadataEntry {
  return {
    type,
    slug,
    date: '2026-06-12',
    critical: false,
    translations: {} as MetadataEntry['translations'],
  };
}
