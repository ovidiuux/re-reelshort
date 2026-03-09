import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { BASE, extractNextData, pickBookShelfList, shelvesToItems, UA, type HomeItem } from "$lib/reelshort/utils";

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
   setHeaders({ "cache-control": "public, max-age=600, s-maxage=600" });

  const res = await fetch(`${BASE}/ro`, {
    headers: { "user-agent": UA, accept: "text/html", "accept-language": "ro-RO,ro;q=0.9" },
  });
  if (!res.ok) throw error(res.status, "failed");

  const html = await res.text();
  const next = extractNextData(html);
  if (!next) return { items: [] as HomeItem[] };

  const pageProps = next?.props?.pageProps ?? next;
  const shelves = pickBookShelfList(pageProps);
  if (!Array.isArray(shelves) || shelves.length === 0) return { items: [] as HomeItem[] };

  return { items: shelvesToItems(shelves) };
};
