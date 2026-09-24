/**
 * Regenerates the "From codepunklab.com" block in README.md from the site's
 * own content feed.
 *
 * Deliberate failure behaviour: every problem here throws. A run that cannot
 * reach the site, or gets a feed it does not recognise, must fail loudly and
 * leave the last good block in place — writing an empty or half-built list
 * would quietly replace real content with nothing.
 */
import { readFile, writeFile } from 'node:fs/promises';

const FEED_URL = process.env.CONTENT_JSON_URL ?? 'https://codepunklab.com/content.json';
const README = new URL('../README.md', import.meta.url);
const START = '<!-- latest:start -->';
const END = '<!-- latest:end -->';
const LIMIT = 5;

const TYPE_LABEL = { 'case-study': 'Case study', pattern: 'Pattern' };

async function fetchItems() {
  const res = await fetch(FEED_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${FEED_URL} responded ${res.status} ${res.statusText}`);

  const feed = await res.json();
  if (!Array.isArray(feed.items)) throw new Error(`${FEED_URL} has no "items" array`);

  const items = feed.items
    .filter((item) => item.locale === 'en' && item.url && item.title)
    .sort((a, b) => new Date(b.datePublished ?? 0) - new Date(a.datePublished ?? 0))
    .slice(0, LIMIT);

  if (items.length === 0) throw new Error(`${FEED_URL} returned no English entries`);
  return items;
}

function render(items) {
  return items
    .map((item) => {
      const label = TYPE_LABEL[item.type] ?? item.type;
      const date = (item.datePublished ?? '').slice(0, 10);
      return `- **[${item.title}](${item.url})** · ${label}${date ? ` · ${date}` : ''}`;
    })
    .join('\n');
}

const readme = await readFile(README, 'utf8');
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1 || end < start) {
  throw new Error(`README.md is missing the ${START} / ${END} markers`);
}

const block = render(await fetchItems());
const next = `${readme.slice(0, start + START.length)}\n${block}\n${readme.slice(end)}`;

if (next === readme) {
  console.log('Block unchanged.');
} else {
  await writeFile(README, next);
  console.log(`Block rewritten with ${block.split('\n').length} entries.`);
}
