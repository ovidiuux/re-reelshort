<script lang="ts">
  const LOGO_ICON =
    "https://v-mps.crazymaplestudios.com/images/211d3420-d721-11f0-84ad-6b5693b490dc.png";

  const LOGO_TEXT =
    "https://v-mps.crazymaplestudios.com/images/ba889a60-b5d9-11ef-a2d6-41216ff1602c.png";
</script>

<header class="header">
  <div class="header-inner">
    <a class="brand" href="/" aria-label="re-ReelShort">
      <img class="brand-icon" src={LOGO_ICON} alt="logo" width="38" height="38" loading="eager" />
      <img class="brand-text" src={LOGO_TEXT} alt="ReelShort" width="240" height="36" loading="eager" />
    </a>
  </div>
</header>

<style>
    .header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0);
  backdrop-filter: saturate(120%) blur(1px);
  -webkit-backdrop-filter: saturate(120%) blur(1px);
}

/* container fluid + safe-area */
.header-inner {
  height: 64px;
  display: flex;
  align-items: center;

  padding-left: max(12px, env(safe-area-inset-left));
  padding-right: max(12px, env(safe-area-inset-right));

  padding-inline: clamp(12px, 3vw, 32px);

  max-width: 1400px;
  margin: 0 auto;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.2vw, 12px);
  text-decoration: none;
  user-select: none;
  min-width: 0; /* important pt text responsive */
  -webkit-tap-highlight-color: transparent;
}

.brand-icon {
  width: clamp(34px, 4.2vw, 38px);
  height: clamp(34px, 4.2vw, 38px);
  display: block;
  object-fit: contain;
  flex: 0 0 auto;
}

.brand-text {
  height: clamp(18px, 2.2vw, 22px);
  width: auto;
  display: block;
  object-fit: contain;

  opacity: 0;
  transform: translateY(1px);
  transition: opacity 160ms ease, transform 160ms ease;
  max-width: min(52vw, 260px);
  flex: 0 1 auto;
}

@media (min-width: 720px) {
  .brand-text {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 360px) {
  .brand-text {
    display: none;
  }
}

</style>
