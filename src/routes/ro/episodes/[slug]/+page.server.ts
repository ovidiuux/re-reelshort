import { BASE, UA } from "$lib/reelshort/utils";
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";

const WEEK = 604800;
const RX_M3U8 = /"contentUrl"\s*:\s*"([^"]+\.m3u8[^"]*)"/i;
const RX_TITLE = /"name"\s*:\s*"([^"]+)"/i;
const MAX_BUF = 32 * 1024;

export const load: PageServerLoad = async ({ fetch, params, setHeaders }) => {
  const slug = params.slug?.trim();
  if (!slug) throw error(400);

  setHeaders({ "cache-control": `public, max-age=${WEEK}, s-maxage=${WEEK}` });

  const res = await fetch(`${BASE}/ro/episodes/${encodeURIComponent(slug)}`, {
    headers: { "user-agent": UA, accept: "text/html" }
  });
  if (!res.ok || !res.body) throw error(res.status);

  const r = res.body.getReader();
  const d = new TextDecoder();
  let buf = "", m3u8: string | null = null, title: string | null = null;

  for (;;) {
    const { value, done } = await r.read();
    if (done) break;

    buf += d.decode(value, { stream: true });

    if (!m3u8) m3u8 = RX_M3U8.exec(buf)?.[1] ?? null;
    if (!title) title = RX_TITLE.exec(buf)?.[1] ?? null;

    if (m3u8 && title) { r.cancel(); break; }
    if (buf.length >= MAX_BUF) break;
  }

  if (!m3u8) throw error(500);

  return { slug, m3u8, episode: { title } };
};
