<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import "$lib/styles/grid.css";

  export let data: {
    items: { title: string; href: string; image: string | null }[];
  };

  type Item = { title: string; href: string; image: string | null };

  const SHELF_BASE =
    "https://www.reelshort.com/ro/shelf/lansare-nou%C4%83-short-movies-dramas-118663";

  let items: Item[] = data.items ?? [];
  let page = 1;
  let loading = false;
  let done = false;

  let sentinel: HTMLDivElement | null = null;
  let obs: IntersectionObserver | null = null;

  function fadeIn(node: HTMLImageElement) {
    const show = () => requestAnimationFrame(() => (node.style.opacity = "1"));
    const onLoad = () => show();
    const onError = () => (node.style.opacity = "1");

    node.addEventListener("load", onLoad);
    node.addEventListener("error", onError);

    if (node.complete && node.naturalWidth > 0) show();

    return {
      destroy() {
        node.removeEventListener("load", onLoad);
        node.removeEventListener("error", onError);
      }
    };
  }

  function uniqMerge(prev: Item[], next: Item[]) {
    const seen = new Set(prev.map((x) => x.href));
    const out = [...prev];
    for (const it of next) {
      if (!it?.href || seen.has(it.href)) continue;
      seen.add(it.href);
      out.push(it);
    }
    return out;
  }

  function extractNextDataJson(html: string): any | null {
    // rapid + stabil: ia strict conținutul scriptului __NEXT_DATA__
    const m = html.match(
      /<script[^>]*id="__NEXT_DATA__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (!m?.[1]) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }

  function mapShelfListToItems(list: any[]): Item[] {
    const out: Item[] = [];
    for (const b of list ?? []) {
      const title = String(b?.book_title ?? "").trim();
      const pic = (b?.book_pic ? String(b.book_pic).trim() : "") || null;
      const slug = String(b?.book_id ?? "").trim(); // ex: "691698e59d31f12dd603e162"

      if (!title || !slug) continue;

      out.push({
        title,
        image: pic,
        href: `/ro/movie/${encodeURIComponent(slug)}`
      });
    }
    return out;
  }

  async function fetchShelfPage(p: number): Promise<Item[]> {
    const res = await fetch(`${SHELF_BASE}/${p}`, {
      headers: { accept: "text/html" }
    });

    if (res.status === 404) return [];
    if (!res.ok) return [];

    const html = await res.text();
    const nd = extractNextDataJson(html);
    const list = nd?.props?.pageProps?.list;

    if (!Array.isArray(list)) return [];
    return mapShelfListToItems(list);
  }

  async function loadMore() {
    if (loading || done) return;
    loading = true;
    try {
      const nextPage = page + 1;
      const nextItems = await fetchShelfPage(nextPage);

      if (!nextItems.length) {
        done = true;
        return;
      }

      items = uniqMerge(items, nextItems);
      page = nextPage;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "700px 0px" }
    );

    if (sentinel) obs.observe(sentinel);
  });

  onDestroy(() => obs?.disconnect());
</script>

<div class="grid">
  {#each items as item (item.href)}
    <a class="card" href={item.href}>
      <div class="thumb">
        {#if item.image}
          <img
            class="img"
            src={item.image}
            alt={item.title}
            loading="lazy"
            decoding="async"
            use:fadeIn
          />
        {:else}
          <div class="ph" aria-hidden="true"></div>
        {/if}
      </div>

      <div class="meta">
        <h3 class="title">{item.title}</h3>
      </div>
    </a>
  {/each}
</div>

<div bind:this={sentinel} style="height: 1px"></div>

{#if loading}
  <div class="loading">Se încarcă…</div>
{/if}
