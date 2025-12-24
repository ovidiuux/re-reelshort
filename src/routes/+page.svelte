<script lang="ts">
  export let data: {
    items: { title: string; href: string; image: string | null }[];
  };

  function fadeIn(node: HTMLImageElement) {
    const show = () => requestAnimationFrame(() => (node.style.opacity = '1'));

    const onLoad = () => show();
    const onError = () => (node.style.opacity = '1');

    node.addEventListener('load', onLoad);
    node.addEventListener('error', onError);

    if (node.complete && node.naturalWidth > 0) show();

    return {
      destroy() {
        node.removeEventListener('load', onLoad);
        node.removeEventListener('error', onError);
      }
    };
  }
</script>

<div
  style="
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  "
>
  {#each data.items as item}
    <a
      href={item.href}
      style="
        display: block;
        color: white;
        text-decoration: none;
      "
    >
      <div
        style="
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 4;
          background: #222;
          overflow: hidden;
          border-radius: 6px;
        "
      >
        {#if item.image}
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            decoding="async"
            use:fadeIn
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;

              opacity: 0;
              transition: opacity 300ms ease;
              will-change: opacity;
            "
          />
        {/if}
      </div>

      <h3
        style="
          margin-top: 8px;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.3;
        "
      >
        {item.title}
      </h3>
    </a>
  {/each}
</div>
