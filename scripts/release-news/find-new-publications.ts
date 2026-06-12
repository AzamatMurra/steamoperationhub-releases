import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MetadataEntry, NotificationType } from './generate-indexes.js';

export interface PublicationPreviewRequest {
  type: Exclude<NotificationType, 'release'>;
  slug: string;
}

export function findNewPublicationRequests(
  addedFiles: string[],
  metadataEntries: MetadataEntry[],
): PublicationPreviewRequest[] {
  const slugs = new Set<string>();
  for (const filePath of addedFiles) {
    const match = filePath.trim().match(/^news\/(.+)\.(ru|en|uk)\.md$/);
    if (match) slugs.add(match[1]);
  }

  return [...slugs].sort().map(slug => {
    const metadata = metadataEntries.find(entry => entry.slug === slug);
    if (!metadata || metadata.type === 'release') {
      throw new Error(`news metadata not found for new publication "${slug}"`);
    }
    return { type: metadata.type, slug };
  });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function run(): Promise<void> {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const indexPath = path.resolve(rootDir, process.argv[2] ?? 'news/index.json');
  const metadata = JSON.parse(await fs.readFile(indexPath, 'utf8')) as MetadataEntry[];
  const addedFiles = (await readStdin()).split(/\r?\n/).filter(Boolean);

  for (const request of findNewPublicationRequests(addedFiles, metadata)) {
    process.stdout.write(`${JSON.stringify(request)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
