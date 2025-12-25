import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { parse } from 'node-html-parser';

const WEEK = 60 * 60 * 24 * 7;

const norm = (s: string) => {
  try { return decodeURIComponent((s ?? '').trim()); }
  catch { return (s ?? '').trim(); }
};

function parseEpisodeHref(html: string): string | null {
  const root = parse(html);

  const links = root.querySelectorAll(
    'a[href^="/ro/episodes/"], a[href^="/episodes/"]'
  );

  if (!links.length) return null;

  const eps = links
    .map((a) => (a.getAttribute('href') ?? '').trim())
    .filter(Boolean)
    .map((href) => {
      const ro = href.startsWith('/ro/') ? href : `/ro${href}`;
      const slug = ro.replace(/^\/ro\/episodes\//, '');
      const m = slug.match(/episode-(\d+)/i);
      const n = m ? Number(m[1]) : 0;
      const isTrailer = slug.toLowerCase().startsWith('trailer-');
      return { ro, n, isTrailer };
    })
    .filter((e) => !e.isTrailer && e.n > 0)
    .sort((a, b) => a.n - b.n);

  return eps[0]?.ro ?? null;
}

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  const slug = norm(params.slug);
  if (!slug) throw error(400, 'Missing slug');

  const url =
    `https://www.reelshort.com/ro/full-episodes/${encodeURIComponent(slug)}/1`;

  const res = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    }
  });

  if (res.status === 404) throw error(404);
  if (!res.ok) throw error(res.status);

  const html = await res.text();
  const href = parseEpisodeHref(html);

  if (!href) throw error(404, 'No episodes');

  setHeaders({
    'cache-control': `public, max-age=${WEEK}, s-maxage=${WEEK}`
  });

  throw redirect(302, href);
};
