import { UA } from "$lib/reelshort/utils";
import type { PageServerLoad } from "./$types";
import { redirect, error } from "@sveltejs/kit";

const WEEK = 604800;

const RX_EP1 =
  /"urlTemplate"\s*:\s*"(https?:\/\/[^"]*\/episodes\/episode-1[^"]*)"/i;

const MAX_BUF = 326 * 1024;

const norm = (s: string) => {
  try { return decodeURIComponent((s ?? "").trim()); }
  catch { return (s ?? "").trim(); }
};

const toRoPath = (abs: string) => {
  let p = abs.replace(/^https?:\/\/[^/]+/i, "");
  if (!p.startsWith("/")) p = "/" + p;
  if (p.startsWith("/episodes/")) p = "/ro" + p;
  return encodeURI(p);
};

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  const slug = norm(params.slug);
  if (!slug) throw error(400);

  setHeaders({ "cache-control": `public, max-age=${WEEK}, s-maxage=${WEEK}` });

  const res = await fetch(
    `https://www.reelshort.com/ro/movie/${encodeURIComponent(slug)}`,
    { headers: { "user-agent": UA } }
  );

  if (!res.ok || !res.body) throw error(res.status);

  const r = res.body.getReader();
  const d = new TextDecoder();
  let buf = "";

  for (; ;) {
    const { value, done } = await r.read();
    if (done) break;

    buf += d.decode(value, { stream: true });

    const m = RX_EP1.exec(buf);
    if (m?.[1]) {
      r.cancel();

      throw redirect(302, toRoPath(m[1]));
    }

    if (buf.length >= MAX_BUF) break;
  }

  throw redirect(302, toRoPath("/ro/episodes/episode-trailer-" + slug + "-0000"));
};
