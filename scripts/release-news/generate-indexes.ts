import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const LANGUAGES = ['ru', 'en', 'uk'] as const;
export const NOTIFICATION_TYPES = [
  'release',
  'critical',
  'maintenance',
  'announcement',
  'roadmap',
] as const;

type Language = typeof LANGUAGES[number];
type NotificationType = typeof NOTIFICATION_TYPES[number];
type Collection = 'releases' | 'news';

interface Frontmatter {
  type: NotificationType;
  version?: string;
  slug?: string;
  title: string;
  date: string;
  lang: Language;
  summary: string;
  critical: boolean;
  telegramTitle: string;
  telegramSummary: string[];
}

interface Translation {
  lang: Language;
  title: string;
  summary: string;
  telegramTitle: string;
  telegramSummary: string[];
  url: string;
}

export interface MetadataEntry {
  type: NotificationType;
  version?: string;
  slug?: string;
  date: string;
  critical: boolean;
  releaseUrl?: string;
  translations: Record<Language, Translation>;
}

const REPOSITORY_URL = 'https://github.com/AzamatMurra/steamoperationhub-releases';

function assertString(
  value: unknown,
  field: string,
  filePath: string,
  maxLength = Number.POSITIVE_INFINITY,
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${filePath}: field "${field}" must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${filePath}: field "${field}" must be at most ${maxLength} characters`);
  }
  return normalized;
}

function parseFrontmatter(content: string, filePath: string): Frontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`${filePath}: YAML frontmatter is missing`);
  }

  const raw = parse(match[1]) as Record<string, unknown>;
  const type = assertString(raw.type, 'type', filePath);
  const lang = assertString(raw.lang, 'lang', filePath);
  const date = assertString(raw.date, 'date', filePath);

  if (!NOTIFICATION_TYPES.includes(type as NotificationType)) {
    throw new Error(`${filePath}: unsupported notification type "${type}"`);
  }
  if (!LANGUAGES.includes(lang as Language)) {
    throw new Error(`${filePath}: unsupported language "${lang}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${filePath}: field "date" must use YYYY-MM-DD`);
  }
  if (typeof raw.critical !== 'boolean') {
    throw new Error(`${filePath}: field "critical" must be boolean`);
  }
  if (!Array.isArray(raw.telegramSummary) || raw.telegramSummary.length === 0 || raw.telegramSummary.length > 5) {
    throw new Error(`${filePath}: field "telegramSummary" must contain 1-5 items`);
  }

  return {
    type: type as NotificationType,
    version: raw.version === undefined ? undefined : assertString(raw.version, 'version', filePath),
    slug: raw.slug === undefined ? undefined : assertString(raw.slug, 'slug', filePath),
    title: assertString(raw.title, 'title', filePath, 200),
    date,
    lang: lang as Language,
    summary: assertString(raw.summary, 'summary', filePath, 500),
    critical: raw.critical,
    telegramTitle: assertString(raw.telegramTitle, 'telegramTitle', filePath, 160),
    telegramSummary: raw.telegramSummary.map((item, index) =>
      assertString(item, `telegramSummary[${index}]`, filePath, 240)),
  };
}

function validateIdentity(
  collection: Collection,
  metadata: Frontmatter,
  baseName: string,
  filePath: string,
): string {
  if (collection === 'releases') {
    if (metadata.type !== 'release' || !metadata.version || metadata.slug) {
      throw new Error(`${filePath}: release requires type=release and version without slug`);
    }
    if (metadata.version !== baseName) {
      throw new Error(`${filePath}: filename must match version "${metadata.version}"`);
    }
    return metadata.version;
  }

  if (metadata.type === 'release' || !metadata.slug || metadata.version) {
    throw new Error(`${filePath}: news requires non-release type and slug without version`);
  }
  if (metadata.slug !== baseName) {
    throw new Error(`${filePath}: filename must match slug "${metadata.slug}"`);
  }
  return metadata.slug;
}

async function readCollection(rootDir: string, collection: Collection): Promise<MetadataEntry[]> {
  const directory = path.join(rootDir, collection);
  const files = (await fs.readdir(directory)).filter(file => file.endsWith('.md')).sort();
  const grouped = new Map<string, {
    common: Omit<MetadataEntry, 'translations'>;
    translations: Partial<Record<Language, Translation>>;
  }>();

  for (const filename of files) {
    const nameMatch = filename.match(/^(.+)\.(ru|en|uk)\.md$/);
    if (!nameMatch) {
      throw new Error(`${collection}/${filename}: expected <id>.<ru|en|uk>.md`);
    }

    const [, baseName, filenameLanguage] = nameMatch;
    const relativePath = `${collection}/${filename}`;
    const metadata = parseFrontmatter(
      await fs.readFile(path.join(directory, filename), 'utf8'),
      relativePath,
    );
    if (metadata.lang !== filenameLanguage) {
      throw new Error(`${relativePath}: filename language and frontmatter language differ`);
    }

    const declaredIdentity = collection === 'releases' ? metadata.version : metadata.slug;
    if (declaredIdentity && grouped.get(declaredIdentity)?.translations[metadata.lang]) {
      throw new Error(`${relativePath}: duplicate "${metadata.lang}" translation for "${declaredIdentity}"`);
    }

    const identity = validateIdentity(collection, metadata, baseName, relativePath);
    const common = {
      type: metadata.type,
      version: metadata.version,
      slug: metadata.slug,
      date: metadata.date,
      critical: metadata.critical,
      releaseUrl: metadata.version
        ? `${REPOSITORY_URL}/releases/tag/${encodeURIComponent(metadata.version)}`
        : undefined,
    };
    const current = grouped.get(identity) ?? { common, translations: {} };

    if (JSON.stringify(current.common) !== JSON.stringify(common)) {
      throw new Error(`${relativePath}: shared fields differ between translations`);
    }
    current.translations[metadata.lang] = {
      lang: metadata.lang,
      title: metadata.title,
      summary: metadata.summary,
      telegramTitle: metadata.telegramTitle,
      telegramSummary: metadata.telegramSummary,
      url: `${REPOSITORY_URL}/blob/main/${relativePath}`,
    };
    grouped.set(identity, current);
  }

  return [...grouped.entries()].map(([identity, group]) => {
    for (const language of LANGUAGES) {
      if (!group.translations[language]) {
        throw new Error(`${collection}/${identity}: missing "${language}" translation`);
      }
    }
    return {
      ...group.common,
      translations: Object.fromEntries(
        LANGUAGES.map(language => [language, group.translations[language]]),
      ) as Record<Language, Translation>,
    };
  }).sort((left, right) => {
    const dateOrder = right.date.localeCompare(left.date);
    if (dateOrder !== 0) return dateOrder;
    return (right.version ?? right.slug ?? '').localeCompare(left.version ?? left.slug ?? '');
  });
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function buildIndexes(rootDir: string): Promise<Record<string, string>> {
  const releases = await readCollection(rootDir, 'releases');
  const news = await readCollection(rootDir, 'news');
  if (releases.length === 0 || news.length === 0) {
    throw new Error('Both releases and news collections must contain at least one entry');
  }

  return {
    'latest-release.json': serialize(releases[0]),
    'latest-news.json': serialize(news[0]),
    'releases/index.json': serialize(releases),
    'news/index.json': serialize(news),
  };
}

async function run(): Promise<void> {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const indexes = await buildIndexes(rootDir);
  const isCheck = process.argv.includes('--check');

  for (const [relativePath, content] of Object.entries(indexes)) {
    const outputPath = path.join(rootDir, relativePath);
    if (isCheck) {
      const current = await fs.readFile(outputPath, 'utf8').catch(() => '');
      if (current !== content) {
        throw new Error(`${relativePath} is stale; run npm run indexes:generate`);
      }
      continue;
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
