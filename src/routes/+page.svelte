<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import "$lib/styles/grid.css";
  import { makeObserver, mergeUnique } from "$lib/reelshort/infinite";
  import { extractNextData, pageListToItems } from "$lib/reelshort/utils";

  export let data: { items: Item[] };

  type Item = { title: string; href: string; image: string | null };

  const itemKey = (it: Item) => it.href.match(/[a-f0-9]{24}/i)?.[0].toLowerCase() ?? it.href;


  const SHELF = [
    "https://www.reelshort.com/ro/shelf/lansare-nou%C4%83-short-movies-dramas-118663",
    "https://www.reelshort.com/ro/shelf/identitate-ascuns%C4%83-short-movies-dramas-118664",
    "https://www.reelshort.com/ro/shelf/pove%C8%99ti-asiatice-short-movies-dramas-118666",
    "https://www.reelshort.com/ro/shelf/dragoste-t%C3%A2n%C4%83r%C4%83-short-movies-dramas-118665"
  ];

  let items: Item[] = data.items ?? [];
  let page = 0;
  let loading = false;
  let done = false;

  let ctrl: AbortController | null = null;

  const seenImg = new Set<string>();
  const fadeIn = (node: HTMLImageElement) => {
    const key = node.currentSrc || node.src;
    const instant = seenImg.has(key);

    node.style.opacity = instant ? "1" : "0";
    if (!instant) node.style.transition = "opacity 160ms ease";

    const show = () => {
      seenImg.add(key);
      node.style.opacity = "1";
    };

    if (node.complete) show();
    else {
      node.addEventListener("load", show, { once: true, passive: true } as any);
      node.addEventListener("error", show, { once: true, passive: true } as any);
    }

    return { destroy() {} };
  };

  const loadMore = async () => {
    if (loading || done) return;

    if (page >= SHELF.length) {
      done = true;
      return;
    }

    loading = true;
    ctrl?.abort();
    ctrl = new AbortController();

    try {
      const url = SHELF[page];

      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(String(r.status));

      const html = await r.text();
      const nextData = extractNextData(html);
      const pageProps = nextData?.props?.pageProps;

      const nextItems = pageListToItems(pageProps);
      items = mergeUnique(items, nextItems, (x) => x.href);

      page += 1;

      if (!nextItems.length || page >= SHELF.length) done = true;
    } catch (e: any) {
      if (e?.name !== "AbortError") done = true;
    } finally {
      loading = false;
    }
  };

  const infinite = makeObserver(loadMore, {
    rootMargin: "600px 0px 600px 0px",
    threshold: 0
  });

  onMount(() => {
    if (!items.length) loadMore();
    return () => ctrl?.abort();
  });

  onDestroy(() => ctrl?.abort());
</script>

<div class="grid">
  {#each items as item (itemKey(item))}

    <a class="card" href={item.href} aria-label={item.title}>
      <div class="thumb">
        {#if item.image}
          <img
            class="img"
            src={item.image}
            alt={item.title}
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            crossorigin="anonymous"
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

<div use:infinite style="height: 1px;"></div>
