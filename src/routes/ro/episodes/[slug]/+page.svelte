<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";

  export let data: {
    slug: string;
    m3u8: string | null;
    episodes: any[];
    episode: { title: string | null; description: string | null };
    detailsHtml: string;
  };

  let videoEl: HTMLVideoElement | null = null;

  let episodes: {
    number: number;
    slug: string;
    active: boolean;
  }[] = data.episodes ?? [];

  let loadingEpisodes = false;
  let pageProgress = "";

  const END_EPS = 0.35;

  const CACHE_PREFIX = "reelshort:episodes:";
  const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 ore
  const CACHE_VER = 1;

  const norm = (s: string) => {
    try {
      return decodeURIComponent((s ?? "").trim());
    } catch {
      return (s ?? "").trim();
    }
  };

  function canPlayNativeHls(v: HTMLVideoElement) {
    return !!(
      v.canPlayType("application/vnd.apple.mpegurl") ||
      v.canPlayType("application/x-mpegURL")
    );
  }

  async function loadAndPlay(nextUrl?: string | null) {
    if (!videoEl) return;
    const u = (nextUrl ?? data.m3u8 ?? "").trim();
    if (!u || !canPlayNativeHls(videoEl)) return;

    try {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
    } catch {}

    videoEl.src = u;
    try {
      await videoEl.play();
    } catch {}
  }

  function markActive(list: typeof episodes, currentSlug: string) {
    const cur = norm(currentSlug);
    return (list ?? []).map((e) => ({ ...e, active: norm(e.slug) === cur }));
  }

  $: if (episodes?.length) episodes = markActive(episodes, data.slug);
  $: if (videoEl && data.m3u8) loadAndPlay(data.m3u8);

  function selectEpisode(ep: { slug: string }) {
    goto(`/ro/episodes/${encodeURIComponent(norm(ep.slug))}`);
  }

  function uniqBySlug<T extends { slug: string }>(list: T[]) {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const it of list) {
      const k = norm(String(it.slug ?? ""));
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ ...(it as any), slug: k });
    }
    return out;
  }

  function extractShowSlugFromEpisodeSlug(slug: string): string | null {
    const s = norm(slug);
    const hash = s.match(/[a-f0-9]{24}/i)?.[0];
    if (!hash) return null;

    let beforeHash = s.slice(0, s.indexOf(hash));
    beforeHash = beforeHash
      .replace(/^episode-\d+-/i, "")
      .replace(/^trailer-/, "")
      .replace(/^subtitrat-/, "")
      .replace(/-$/, "");

    if (!beforeHash) return null;
    return `${beforeHash}-${hash}`;
  }

  function extractShowSlugFromEpisodeHtml(html: string): string | null {
    if (!html?.trim()) return null;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const a = doc.querySelector(
      'a[href^="/ro/full-episodes/"], a[href^="/full-episodes/"]',
    );
    if (!a) return null;
    const href = a.getAttribute("href")!;
    return norm(
      href
        .replace(/^\/ro\/full-episodes\//, "")
        .replace(/^\/full-episodes\//, "")
        .trim(),
    );
  }

  function getMaxPageFromHtml(html: string): number {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pageNums = Array.from(
      doc.querySelectorAll('a[href*="/full-episodes/"]'),
    )
      .map((a) => a.getAttribute("href") ?? "")
      .map((href) => {
        const m = href.match(/\/(\d+)\s*$/);
        return m ? Number(m[1]) : NaN;
      })
      .filter((n) => Number.isFinite(n)) as number[];
    return pageNums.length ? Math.max(...pageNums) : 1;
  }

  function parseEpisodesFromFullEpisodesHtml(
    html: string,
    currentEpisodeSlug: string,
  ) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    let links = Array.from(
      doc.querySelectorAll('a.cover-bg[href^="/ro/episodes/"]'),
    );
    if (!links.length)
      links = Array.from(doc.querySelectorAll('a[href^="/ro/episodes/"]'));

    const cur = norm(currentEpisodeSlug);

    return links.map((a) => {
      const href = a.getAttribute("href")!;
      const raw = href.replace("/ro/episodes/", "");
      const slug = norm(raw);

      const lower = slug.toLowerCase();
      const number = lower.startsWith("trailer-")
        ? 0
        : Number(slug.match(/episode-(\d+)/i)?.[1] ?? NaN);

      return {
        number: Number.isFinite(number) ? number : 0,
        slug,
        active: slug === cur,
      };
    });
  }

  async function fetchAllEpisodes(
    showSlug: string,
    currentEpisodeSlug: string,
  ) {
    const baseRO = `https://www.reelshort.com/ro/full-episodes/${encodeURIComponent(norm(showSlug))}`;

    const first = await fetch(baseRO, { headers: { accept: "text/html" } });
    if (!first.ok) return [];

    const html1 = await first.text();
    let all = parseEpisodesFromFullEpisodesHtml(html1, currentEpisodeSlug);

    const maxPage = getMaxPageFromHtml(html1);
    if (maxPage > 1) {
      for (let p = 2; p <= maxPage; p++) {
        pageProgress = `${p}/${maxPage}`;
        const r = await fetch(`${baseRO}/${p}`, {
          headers: { accept: "text/html" },
        });
        if (r.status === 404) break;
        if (!r.ok) continue;
        all = all.concat(
          parseEpisodesFromFullEpisodesHtml(await r.text(), currentEpisodeSlug),
        );
      }
    }

    all = uniqBySlug(all).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

    const seenNum = new Set<number>();
    all = all.filter((ep) => {
      const n = ep.number ?? 0;
      if (n !== 0) {
        if (seenNum.has(n)) return false;
        seenNum.add(n);
      }
      return true;
    });

    const cur = norm(currentEpisodeSlug);
    return all.map((e) => ({ ...e, active: norm(e.slug) === cur }));
  }

  function cacheKey(showSlug: string) {
    return `${CACHE_PREFIX}${CACHE_VER}:${norm(showSlug)}`;
  }

  function loadCachedEpisodes(showSlug: string) {
    try {
      const raw = localStorage.getItem(cacheKey(showSlug));
      if (!raw)
        return null as null | {
          list: { number: number; slug: string }[];
          fresh: boolean;
        };
      const obj = JSON.parse(raw) as {
        t: number;
        list: { number: number; slug: string }[];
      };
      if (!obj?.t || !Array.isArray(obj.list)) return null;
      const age = Date.now() - Number(obj.t);
      return { list: obj.list, fresh: age >= 0 && age <= CACHE_TTL_MS };
    } catch {
      return null;
    }
  }

  function saveCachedEpisodes(
    showSlug: string,
    list: { number: number; slug: string }[],
  ) {
    try {
      const payload = JSON.stringify({ t: Date.now(), list });
      localStorage.setItem(cacheKey(showSlug), payload);
    } catch {}
  }

  function stripActive(list: typeof episodes) {
    return (list ?? []).map((e) => ({
      number: e.number ?? 0,
      slug: norm(e.slug),
    }));
  }

  function getNextEpisodeSlug(): string | null {
    if (!episodes?.length) return null;

    const cur = norm(data.slug);
    const sorted = [...episodes].sort(
      (a, b) => (a.number ?? 0) - (b.number ?? 0),
    );
    const idx = sorted.findIndex((e) => norm(e.slug) === cur);
    if (idx < 0) return null;

    for (let i = idx + 1; i < sorted.length; i++) {
      const e = sorted[i];
      if (norm(e.slug) !== cur) return e.slug;
    }
    return null;
  }

  let advancing = false;
  async function goNextEpisode() {
    if (advancing) return;
    const nextSlug = getNextEpisodeSlug();
    if (!nextSlug) return;
    advancing = true;
    try {
      await goto(`/ro/episodes/${encodeURIComponent(norm(nextSlug))}`);
    } finally {
      setTimeout(() => (advancing = false), 200);
    }
  }

  function shouldAutoAdvance(v: HTMLVideoElement) {
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) return v.ended;
    return v.ended || v.currentTime >= d - END_EPS;
  }

  let detach: (() => void) | null = null;
  $: if (videoEl) {
    detach?.();
    const v = videoEl;

    const onEnded = () => goNextEpisode();
    const onTimeUpdate = () => {
      if (shouldAutoAdvance(v)) goNextEpisode();
    };

    v.addEventListener("ended", onEnded);
    v.addEventListener("timeupdate", onTimeUpdate);

    detach = () => {
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("timeupdate", onTimeUpdate);
    };
  }

  onDestroy(() => detach?.());

  onMount(async () => {
    if (episodes?.length) return;

    const showSlug =
      extractShowSlugFromEpisodeHtml(data.detailsHtml) ??
      extractShowSlugFromEpisodeSlug(data.slug);

    if (!showSlug) return;

    const cached = loadCachedEpisodes(showSlug);
    if (cached?.list?.length) {
      episodes = markActive(
        cached.list.map((e) => ({ ...e, active: false })),
        data.slug,
      );
      if (cached.fresh) return;
    }

    loadingEpisodes = true;
    pageProgress = "1/1";
    try {
      const fresh = await fetchAllEpisodes(showSlug, data.slug);
      episodes = fresh;
      saveCachedEpisodes(showSlug, stripActive(fresh));
    } finally {
      loadingEpisodes = false;
      pageProgress = "";
    }
  });
</script>

<svelte:head>
  <title>{data.episode.title} | re-ReelShort</title>
</svelte:head>

<div class="player-layout">
  <div class="player-left">
    <video
      bind:this={videoEl}
      playsinline
      autoplay
      controls
      preload="auto"
      class="video"
    ></video>
  </div>

  <div class="player-right">
    {#if data.episode.title}
      <h1 class="video-title">{data.episode.title}</h1>
    {/if}

    {#if loadingEpisodes}
      <div class="episodes-loading">
        Se încarcă episoadele... {#if pageProgress}<span>{pageProgress}</span
          >{/if}
      </div>
    {/if}

    {#if episodes?.length}
      <div class="episodes">
        {#each episodes as ep (ep.slug)}
          <button
            class="ep {ep.number === 0 ? 'trailer' : ''} {ep.active
              ? 'active'
              : ''}"
            on:click={() => selectEpisode(ep)}
          >
            {ep.number === 0 ? "✪" : ep.number}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
