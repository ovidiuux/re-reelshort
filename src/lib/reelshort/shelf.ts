import { json, error } from "@sveltejs/kit";
import { UA, extractNextData, pickBookShelfList, shelvesToItems } from "$lib/reelshort/utils";

const SHELF_BASE =
  "https://www.reelshort.com/ro/shelf/lansare-nou%C4%83-short-movies-dramas-118663";

const toInt = (v: string | null, d: number) => {
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const GET = async ({ fetch, url, setHeaders }: any) => {
  const page = Math.min(500, toInt(url.searchParams.get("page"), 1));
  const shelfUrl = `${SHELF_BASE}/${page}`;

  const r = await fetch(shelfUrl, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ro-RO,ro;q=0.9,en;q=0.8"
    }
  });

  if (!r.ok) throw error(r.status, "Shelf fetch failed");

  const html = await r.text();
  const next = extractNextData(html);
  const pageProps = next?.props?.pageProps;

  const shelves = pickBookShelfList(pageProps);
  const items = shelvesToItems(shelves);

  setHeaders({
    "cache-control": "public, max-age=120"
  });

  return json({
    page,
    items,
    done: items.length === 0
  });
};
