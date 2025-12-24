import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { parse } from 'node-html-parser';

const BASE = 'https://reelshort.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const isAbs = (u: string) => u.startsWith('http://') || u.startsWith('https://');
const isDataImage = (u?: string | null) => !!u && u.startsWith('data:image/');
const absUrl = (u: string) =>
  !u ? u : isAbs(u) ? u : u.startsWith('//') ? `https:${u}` : u.startsWith('/') ? `${BASE}${u}` : u;

const decodeWeirdHref = (href: string) => {
  let d = href;
  try {
    d = decodeURIComponent(href);
  } catch {}
  return d.replace(/^\/ro\/episodes\/\/episodes\//, '/ro/episodes/');
};

const pickImgSrc = (node: any) =>
  (node?.getAttribute?.('src') || node?.getAttribute?.('data-src') || '').trim();

const extractImage = (card: any): string | null => {
  const s1 = pickImgSrc(card.querySelector('.BookItem_cover__qlmBl img'));
  if (s1 && !isDataImage(s1)) return absUrl(s1);

  const nos = card.querySelector('.BookItem_cover__qlmBl noscript')?.innerHTML?.trim();
  if (nos) {
    const s2 = pickImgSrc(parse(nos).querySelector('img'));
    if (s2 && !isDataImage(s2)) return absUrl(s2);
  }

  const s3 = pickImgSrc(card.querySelector('.BookItem_poster__CsSCp img'));
  if (s3 && !isDataImage(s3)) return absUrl(s3);

  return null;
};

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
  setHeaders({ 'cache-control': 'public, max-age=604800, s-maxage=604800' });

  const res = await fetch(`${BASE}/ro`, {
    headers: {
      'user-agent': UA,
      accept: 'text/html',
      'accept-language': 'ro-RO,ro;q=0.9'
    }
  });

  if (!res.ok) throw error(res.status, 'Fetch failed');

  const root = parse(await res.text());
  const seen = new Set<string>();

  const items = root.querySelectorAll('.Slider_item__28DWA').reduce(
    (acc, card) => {
      const a = card.querySelector('h3.BookItem_title__E6dtd a');
      if (!a) return acc;

      const title = a.text.trim();
      const href = decodeWeirdHref((a.getAttribute('href') || '').trim());
      if (!title || !href) return acc;

      const key = `${title}@@${href}`;
      if (seen.has(key)) return acc;
      seen.add(key);

      acc.push({ title, href, image: extractImage(card) });
      return acc;
    },
    [] as { title: string; href: string; image: string | null }[]
  );

  return { items };
};
