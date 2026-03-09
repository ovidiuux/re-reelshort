export const BASE = "https://www.reelshort.com";
export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const slugify = (v: any) =>
  s(v)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");


const chapterIdOf = (b: any) =>
  s(b?.chapter_id) ||
  s(b?.chapterId) ||
  s(b?.first_chapter_id) ||
  s(b?.firstChapterId) ||
  s(b?.start_play?.chapter_id) ||
  s(b?.startPlay?.chapterId);

const episodeHrefOf = (b: any) => {
  const book_id = idOf(b);
  const chapter_id = chapterIdOf(b);
  if (!book_id || !chapter_id) return null;

  const base = slugify(titleOf(b));
  if (!base) return null;

  return `/ro/episodes/episode-1-${base}-${book_id}-${chapter_id}`;
};


export type HomeItem = {
  title: string;
  href: string;
  image: string | null;
  chapter_count: number | null;
  collect_count: number | null;
  shelf_id: number | null;
  shelf_name: string | null;
};

export const absUrl = (u?: string | null): string | null => {
  const s = (u ?? "").trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("/")) return `${BASE}${s}`;
  return s;
};

export const extractNextData = (html: string): any | null => {
  const m = html.match(
    /<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!m?.[1]) return null;

  const raw = m[1].trim();
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(
        raw
          .replace(/&quot;|&#34;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
      );
    } catch {
      return null;
    }
  }
};

export const pickBookShelfList = (pageProps: any): any[] => {
  const fb = (pageProps?.fallback ?? {}) as Record<string, any>;
  const v = Object.values(fb).find((x) => Array.isArray(x?.bookShelfList));
  return (v?.bookShelfList as any[]) ?? [];
};

const s = (v: any) => (typeof v === "string" ? v.trim() : "");
const n = (v: any) => (typeof v === "number" ? v : null);

const idOf = (b: any) => s(b?.book_id) || s(b?.bookId) || s(b?.id);
const titleOf = (b: any) => s(b?.book_title) || s(b?.title) || s(b?.bookTitle) || s(b?.name);
const picOf = (b: any) => b?.book_pic ?? b?.pic ?? b?.cover ?? b?.bookPic ?? null;

export const shelvesToItems = (shelves: any[]): HomeItem[] => {
  const seen = new Set<string>();
  const items: HomeItem[] = [];

  for (let si = 0; si < shelves.length; si++) {
    const shelf = shelves[si];
    const shelf_id = typeof shelf?.bs_id === "number" ? shelf.bs_id : null;
    const shelf_name = s(shelf?.bookshelf_name) || null;

    const books = shelf?.books;
    if (!Array.isArray(books)) continue;

    for (let bi = 0; bi < books.length; bi++) {
      const b = books[bi];

      const id = idOf(b);
      if (!id || seen.has(id)) continue;

      const title = titleOf(b);
      if (!title) continue;

      seen.add(id);

      items.push({
        title,
        href: episodeHrefOf(b) ?? `/ro/movie/${encodeURIComponent(id)}`,
        image: absUrl(picOf(b)),
        chapter_count: n(b?.chapter_count ?? b?.chapterCount),
        collect_count: n(b?.collect_count ?? b?.collectCount),
        shelf_id,
        shelf_name,
      });
    }
  }

  return items;
};

export const pickPageList = (pageProps: any): any[] =>
  Array.isArray(pageProps?.list) ? pageProps.list : [];

export const pageListToItems = (pageProps: any): HomeItem[] => {
  const list = pickPageList(pageProps);
  const seen = new Set<string>();
  const items: HomeItem[] = [];

  for (let i = 0; i < list.length; i++) {
    const b = list[i];

    const id = idOf(b); 
    if (!id || seen.has(id)) continue;

    const title = titleOf(b);
    if (!title) continue;

    seen.add(id);

    items.push({
      title,
      href: `/ro/movie/${encodeURIComponent(id)}`,
      image: absUrl(picOf(b)),
      chapter_count: n(b?.chapter_count ?? b?.chapterCount),
      collect_count: n(b?.collect_count ?? b?.collectCount),
      shelf_id: null,
      shelf_name: null
    });
  }

  return items;
};
