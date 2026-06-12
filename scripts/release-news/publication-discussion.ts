import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { LANGUAGES, type MetadataEntry, type NotificationType } from './generate-indexes.js';

const TYPE_ICONS: Record<Exclude<NotificationType, 'release'>, string> = {
  critical: '🚨',
  maintenance: '🛠',
  announcement: '📰',
  roadmap: '💡',
};

const TYPE_LABELS: Record<Exclude<NotificationType, 'release'>, string> = {
  critical: 'Critical alert',
  maintenance: 'Maintenance',
  announcement: 'Announcement',
  roadmap: 'Roadmap',
};

const LANGUAGE_LABELS = {
  ru: 'Русский',
  en: 'English',
  uk: 'Українська',
} as const;

interface DiscussionDraft {
  type: Exclude<NotificationType, 'release'>;
  slug: string;
  title: string;
  body: string;
}

function splitMarkdown(content: string, filePath: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${filePath}: YAML frontmatter is missing`);
  return {
    frontmatter: parse(match[1]) as Record<string, unknown>,
    body: match[2].trim(),
  };
}

export async function buildDiscussionDraft(
  rootDir: string,
  slug: string,
  metadataEntries: MetadataEntry[],
): Promise<DiscussionDraft> {
  const metadata = metadataEntries.find(entry => entry.slug === slug);
  if (!metadata || metadata.type === 'release') {
    throw new Error(`news metadata not found for discussion "${slug}"`);
  }
  if (metadata.discussionUrl) {
    throw new Error(`discussion already exists for "${slug}"`);
  }

  const sections: string[] = [];
  for (const language of LANGUAGES) {
    const relativePath = `news/${slug}.${language}.md`;
    const content = await fs.readFile(path.join(rootDir, relativePath), 'utf8');
    const { body } = splitMarkdown(content, relativePath);
    sections.push(`## ${LANGUAGE_LABELS[language]}\n\n${body}`);
  }

  const type = metadata.type;
  return {
    type,
    slug,
    title: `${TYPE_ICONS[type]} ${TYPE_LABELS[type]}: ${metadata.translations.ru.title}`,
    body: [
      `<!-- soh-publication:${slug} -->`,
      `> ${TYPE_LABELS[type]} · ${metadata.date}`,
      ...sections,
      '---',
      `_Source: ${slug}_`,
    ].join('\n\n'),
  };
}

export async function setDiscussionUrl(rootDir: string, slug: string, discussionUrl: string): Promise<void> {
  const parsedUrl = new URL(discussionUrl);
  if (
    parsedUrl.protocol !== 'https:'
    || parsedUrl.hostname !== 'github.com'
    || !parsedUrl.pathname.startsWith('/AzamatMurra/steamoperationhub-releases/discussions/')
  ) {
    throw new Error('discussion URL must belong to the steamoperationhub-releases repository');
  }

  for (const language of LANGUAGES) {
    const relativePath = `news/${slug}.${language}.md`;
    const filePath = path.join(rootDir, relativePath);
    const { frontmatter, body } = splitMarkdown(await fs.readFile(filePath, 'utf8'), relativePath);
    frontmatter.discussionUrl = discussionUrl;
    await fs.writeFile(filePath, `---\n${stringify(frontmatter).trimEnd()}\n---\n\n${body}\n`);
  }
}

async function run(): Promise<void> {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const [command, slug, value] = process.argv.slice(2);
  if (!slug || !['draft', 'link'].includes(command)) {
    throw new Error('Usage: publication-discussion.ts <draft|link> <slug> [discussion-url]');
  }

  if (command === 'link') {
    if (!value) throw new Error('Discussion URL is required');
    await setDiscussionUrl(rootDir, slug, value);
    return;
  }

  const metadata = JSON.parse(
    await fs.readFile(path.join(rootDir, 'news/index.json'), 'utf8'),
  ) as MetadataEntry[];
  process.stdout.write(`${JSON.stringify(await buildDiscussionDraft(rootDir, slug, metadata))}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
