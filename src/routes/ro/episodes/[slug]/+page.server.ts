import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { parse } from 'node-html-parser';

const BASE = 'https://www.reelshort.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const pickText = (n: any) => (n?.textContent || n?.text || '').trim() || null;

export const load: PageServerLoad = async ({ fetch, params, setHeaders }) => {
  const slug = (params.slug || '').trim();
  if (!slug) throw error(400, 'Missing slug');

  setHeaders({ 'cache-control': 'public, max-age=604800, s-maxage=604800' });

  const res = await fetch(`${BASE}/ro/episodes/${slug}`, {
    headers: { 'user-agent': UA, accept: 'text/html' }
  });

  if (!res.ok) throw error(res.status, '');

  const root = parse(await res.text());
  const details = root.querySelector('.relative');
  if (!details) throw error(500, 'Details not found');

  const title = pickText(details.querySelector('h1'));
  const description = pickText(details.querySelector('.rich-text'));

  let m3u8: string | null = null;
  for (const s of root.querySelectorAll('script')) {
    const t = s.text || '';
    const hit = t.match(/https?:\/\/[^"' \n]+\.m3u8(?:\?[^"' \n]+)?/);
    if (hit) {
      m3u8 = hit[0];
      break;
    }
  }

  return {
    slug,
    m3u8,
    episode: { title, description },
    detailsHtml: details.toString()
  };
};
