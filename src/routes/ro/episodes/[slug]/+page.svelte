<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import loading from "$lib/components/loading.png";
  import { goto } from "$app/navigation";

  export let data: {
    slug: string;
    m3u8: string | null;
    episodes: any[];
    episode: { title: string | null; description: string | null };
  };

  let videoLoading = true;

  type Ep = { number: number; slug: string; active: boolean };

  let videoEl: HTMLVideoElement | null = null;

  let playing = false;
  let muted = false;
  let volume = 1;

  let cur = 0;
  let dur = 0;
  let seeking = false;

  let ui = true;
  let uiTimer: any = null;

  const fmt = (t: number) => {
    t = Math.max(0, Number(t) || 0);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  function setSrcLoading() {
    videoLoading = true;
  }
  function clearLoadingOnFirstFrame() {
    videoLoading = false;
  }

  async function togglePlay() {
    const v = videoEl;
    if (!v) return;
    try {
      if (v.paused) await v.play();
      else v.pause();
    } catch {}
  }

  function toggleMute() {
    const v = videoEl;
    if (!v) return;
    v.muted = !v.muted;
    muted = v.muted;
  }

  function setVol(val: number) {
    const v = videoEl;
    if (!v) return;
    const x = Math.min(1, Math.max(0, val));
    v.volume = x;
    volume = x;
    if (x === 0) {
      v.muted = true;
      muted = true;
    } else if (v.muted) {
      v.muted = false;
      muted = false;
    }
  }

  function onTime() {
    const v = videoEl;
    if (!v || seeking) return;
    cur = v.currentTime || 0;
    dur = Number.isFinite(v.duration) ? v.duration : dur;
  }

  function onMeta() {
    const v = videoEl;
    if (!v) return;
    dur = Number.isFinite(v.duration) ? v.duration : 0;
  }

  function onPlayState() {
    const v = videoEl;
    if (!v) return;
    playing = !v.paused;
  }

  function seekTo(ratio: number) {
    const v = videoEl;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    if (!d) return;
    v.currentTime = Math.min(d, Math.max(0, ratio * d));
    cur = v.currentTime || cur;
  }

  function toggleFullscreen() {
    const el = playerEl;
    if (!el) return;

    const doc: any = document;
    if (!doc.fullscreenElement) el.requestFullscreen?.();
    else doc.exitFullscreen?.();
  }

  function showUI() {
    ui = true;
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => (ui = false), 1800);
  }

  function hideUI() {
    clearTimeout(uiTimer);
    ui = false;
  }

  let playerEl: HTMLDivElement | null = null;

  let episodes: Ep[] = (data.episodes ?? []).map((e: any) => ({
    number: Number(e?.number ?? 0) || 0,
    slug: norm(String(e?.slug ?? "")),
    active: false,
  }));

  let loadingEpisodes = false;
  let pageProgress = "";

  const END_EPS = 0.35;

  const CACHE_PREFIX = "reelshort:episodes:";
  const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
  const CACHE_VER = 1;

  const enc = encodeURIComponent;

  function norm(s: string) {
    try {
      return decodeURIComponent((s ?? "").trim());
    } catch {
      return (s ?? "").trim();
    }
  }

  function canPlayNativeHls(v: HTMLVideoElement) {
    return !!(
      v.canPlayType("application/vnd.apple.mpegurl") ||
      v.canPlayType("application/x-mpegURL")
    );
  }

  let lastSrc = "";

  function markActiveInPlace(list: Ep[], currentSlug: string) {
    const cur = norm(currentSlug);
    for (let i = 0; i < list.length; i++) list[i].active = list[i].slug === cur;
    return list;
  }

  $: if (episodes?.length) {
    const cur = norm(data.slug);
    for (let i = 0; i < episodes.length; i++)
      episodes[i].active = episodes[i].slug === cur;
  }

  $: if (videoEl && data.m3u8) loadAndPlay(data.m3u8);

  function selectEpisode(ep: { slug: string }) {
    goto(`/ro/episodes/${enc(norm(ep.slug))}`);
  }

  function uniqAndSort(list: Ep[]) {
    const seenSlug = new Set<string>();
    const seenNum = new Set<number>();
    const out: Ep[] = [];

    for (let i = 0; i < list.length; i++) {
      const slug = norm(list[i]?.slug ?? "");
      if (!slug || seenSlug.has(slug)) continue;
      seenSlug.add(slug);

      const n = Number(list[i]?.number ?? 0) || 0;
      if (n !== 0) {
        if (seenNum.has(n)) continue;
        seenNum.add(n);
      }

      out.push({ number: n, slug, active: false });
    }

    out.sort((a, b) => a.number - b.number);
    return out;
  }

  function extractShowSlugFromEpisodeSlug(slug: string): string | null {
    const s = norm(slug);
    const hash = s.match(/[a-f0-9]{24}/i)?.[0];
    if (!hash) return null;

    let before = s.slice(0, s.indexOf(hash));
    before = before
      .replace(/^episode-\d+-/i, "")
      .replace(/^trailer-/, "")
      .replace(/^subtitrat-/, "")
      .replace(/-$/, "");

    return before ? `${before}-${hash}` : null;
  }

  function getMaxPageFromHtml(html: string) {
    const re = /\/full-episodes\/[^"'\s>]+\/(\d+)(?:["'\s>]|$)/g;
    let m: RegExpExecArray | null;
    let max = 1;
    while ((m = re.exec(html))) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max;
  }

  function parseEpisodesFromHtml(html: string, currentEpisodeSlug: string) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    let links = Array.from(
      doc.querySelectorAll('a.cover-bg[href^="/ro/episodes/"]'),
    );
    if (!links.length)
      links = Array.from(doc.querySelectorAll('a[href^="/ro/episodes/"]'));

    const cur = norm(currentEpisodeSlug);
    const out: Ep[] = new Array(links.length);

    for (let i = 0; i < links.length; i++) {
      const href = (links[i].getAttribute("href") ?? "").trim();
      const raw = href.startsWith("/ro/episodes/")
        ? href.slice("/ro/episodes/".length)
        : href;
      const slug = norm(raw);
      const lower = slug.toLowerCase();

      let number = 0;
      if (!lower.startsWith("trailer-")) {
        const mm = slug.match(/episode-(\d+)/i);
        const n = mm ? Number(mm[1]) : NaN;
        number = Number.isFinite(n) ? n : 0;
      }

      out[i] = { number, slug, active: slug === cur };
    }

    return out;
  }

  async function fetchHtml(url: string) {
    const r = await fetch(url, { headers: { accept: "text/html" } });
    if (!r.ok) return null;
    return await r.text();
  }

  async function fetchAllEpisodes(
    showSlug: string,
    currentEpisodeSlug: string,
  ) {
    const base = `https://www.reelshort.com/ro/full-episodes/${enc(norm(showSlug))}`;

    const html1 = await fetchHtml(base);
    if (!html1) return [] as Ep[];

    let all = parseEpisodesFromHtml(html1, currentEpisodeSlug);
    const maxPage = getMaxPageFromHtml(html1);

    if (maxPage > 1) {
      const concurrency = 4;
      let nextPage = 2;

      const run = async () => {
        while (nextPage <= maxPage) {
          const p = nextPage++;
          pageProgress = `${p}/${maxPage}`;
          const html = await fetchHtml(`${base}/${p}`);
          if (html)
            all = all.concat(parseEpisodesFromHtml(html, currentEpisodeSlug));
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, maxPage - 1) }, run),
      );
    }

    all = uniqAndSort(all);
    markActiveInPlace(all, currentEpisodeSlug);
    return all;
  }

  function cacheKey(showSlug: string) {
    return `${CACHE_PREFIX}${CACHE_VER}:${norm(showSlug)}`;
  }

  async function loadAndPlay(nextUrl?: string | null) {
    const v = videoEl;
    if (!v || !canPlayNativeHls(v)) return;

    const u = norm(String(nextUrl ?? data.m3u8 ?? ""));
    if (!u || u === lastSrc) return;
    lastSrc = u;

    setSrcLoading();

    try {
      v.pause();
      v.removeAttribute("src");
      v.load();
    } catch {}

    v.src = u;
    try {
      await v.play();
    } catch {}
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
      localStorage.setItem(
        cacheKey(showSlug),
        JSON.stringify({ t: Date.now(), list }),
      );
    } catch {}
  }

  function stripActive(list: Ep[]) {
    const out = new Array(list.length);
    for (let i = 0; i < list.length; i++)
      out[i] = { number: list[i].number, slug: list[i].slug };
    return out;
  }

  function getNextEpisodeSlug() {
    if (!episodes?.length) return null;
    const cur = norm(data.slug);
    const idx = episodes.findIndex((e) => e.slug === cur);
    if (idx < 0) return null;
    for (let i = idx + 1; i < episodes.length; i++) {
      const s = episodes[i]?.slug;
      if (s && s !== cur) return s;
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
      await goto(`/ro/episodes/${enc(nextSlug)}`);
    } finally {
      setTimeout(() => (advancing = false), 200);
    }
  }

  function shouldAutoAdvance(v: HTMLVideoElement) {
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) return v.ended;
    return v.ended || v.currentTime >= d - END_EPS;
  }

  let detach: null | (() => void) = null;
  $: if (videoEl) {
    detach?.();
    const v = videoEl;

    const onEnded = () => goNextEpisode();

    let raf = 0;
    const onTimeUpdate = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (shouldAutoAdvance(v)) goNextEpisode();
      });
    };

    v.addEventListener("ended", onEnded);
    v.addEventListener("timeupdate", onTimeUpdate);

    detach = () => {
      if (raf) cancelAnimationFrame(raf);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("timeupdate", onTimeUpdate);
    };
  }

  onDestroy(() => detach?.());

  onMount(async () => {
    if (episodes?.length) return;

    const showSlug = extractShowSlugFromEpisodeSlug(data.slug);
    if (!showSlug) return;

    const cached = loadCachedEpisodes(showSlug);
    if (cached?.list?.length) {
      episodes = uniqAndSort(
        cached.list.map((e) => ({
          number: Number(e.number) || 0,
          slug: norm(e.slug),
          active: false,
        })),
      );
      markActiveInPlace(episodes, data.slug);
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

  function seekRatio(r: number) {
    const v = videoEl;
    if (!v) return;
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    v.currentTime = Math.min(d, Math.max(0, r * d));
    cur = v.currentTime || cur;
  }

  const qualities = ["480P"];
  let qIdx = 0;
  let qualityLabel = qualities[qIdx];
  function cycleQuality() {
    qIdx = (qIdx + 1) % qualities.length;
    qualityLabel = qualities[qIdx];
  }

  onMount(() => {
    showUI();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
        showUI();
      } else if (e.key === "m") {
        toggleMute();
        showUI();
      } else if (e.key === "f") {
        toggleFullscreen();
        showUI();
      } else {
        showUI();
      }
    };

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey as any);
  });

  onDestroy(() => clearTimeout(uiTimer));
</script>

<svelte:head>
  <title>{data.episode.title} | re-ReelShort</title>
</svelte:head>

<div class="player-layout">
  <div class="player-left">
    <div
      class="player"
      bind:this={playerEl}
      role="application"
      aria-label="Player"
      on:pointermove={showUI}
      on:pointerdown={showUI}
      on:touchstart={showUI}
      on:touchmove={showUI}
      on:mouseleave={hideUI}
    >
      <video
        bind:this={videoEl}
        class="video"
        playsinline
        autoplay
        preload="auto"
        on:loadeddata={() => {
          clearLoadingOnFirstFrame();
          onMeta();
          onTime();
          onPlayState();
        }}
        on:timeupdate={onTime}
        on:loadedmetadata={onMeta}
        on:play={onPlayState}
        on:pause={onPlayState}
      ></video>

      {#if videoLoading}
        <div class="v-black">
          <div class="tri-sprite" style="--sprite:url('{loading}')"></div>
        </div>
      {/if}
      <div class="hud" class:hidden={!ui}>
        <div
          class="progress"
          on:pointerdown|stopPropagation={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            seekRatio((e.clientX - r.left) / r.width);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          on:pointermove|stopPropagation={(e) => {
            if (!(e.buttons & 1)) return;
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            seekRatio((e.clientX - r.left) / r.width);
          }}
        >
          <div class="progress-bg"></div>
          <div
            class="progress-fill"
            style="width:{dur ? (cur / dur) * 100 : 0}%"
          ></div>
        </div>

        <div
          class="controls"
          role="button"
          tabindex="0"
          on:pointerdown|stopPropagation
          on:click|stopPropagation
          on:keydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
        >
          <button
            class="icon"
            on:click|stopPropagation={togglePlay}
            aria-label="Play/Pause"
          >
            {#if playing}
              <svg viewBox="0 0 24 24"
                ><path d="M7 5h3v14H7V5zm7 0h3v14h-3V5z" /></svg
              >
            {:else}
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5z" /></svg>
            {/if}
          </button>

          <button class="icon" on:click={goNextEpisode} aria-label="Next">
            <!-- next -->
            <svg viewBox="0 0 24 24"
              ><path d="M6 6v12l9-6-9-6zm10 0h2v12h-2V6z" /></svg
            >
          </button>

          <div class="time">{fmt(cur)} / {fmt(dur)}</div>

          <div class="spacer"></div>

          <!-- <button class="textbtn" on:click={cycleQuality}>{qualityLabel}</button
          > -->

          <button class="icon" on:click={toggleMute} aria-label="Mute">
            {#if muted}
              <svg viewBox="0 0 24 24">
                <path d="M3 10v4h4l5 4V6L7 10H3z" />
                <path
                  d="M16 8l4 4m0-4l-4 4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            {:else}
              <svg viewBox="0 0 24 24"
                ><path
                  d="M3 10v4h4l5 4V6L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"
                /></svg
              >
            {/if}
          </button>

          <button
            class="icon"
            on:click={toggleFullscreen}
            aria-label="Fullscreen"
          >
            <svg viewBox="0 0 24 24">
              <path d="M7 14H5v5h5v-2H7v-3z" />
              <path d="M17 14v3h-3v2h5v-5h-2z" />
              <path d="M7 10V7h3V5H5v5h2z" />
              <path d="M17 10h2V5h-5v2h3v3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
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
            class="ep{ep.number === 0 ? ' trailer' : ''}{ep.active
              ? ' active'
              : ''}"
            on:click={() => selectEpisode(ep)}
          >
            {#if ep.active}
              <img class="ep-spinner" src="/assets/spinner.gif" alt="loading" />
            {:else}
              {ep.number === 0 ? "✪" : ep.number}
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
