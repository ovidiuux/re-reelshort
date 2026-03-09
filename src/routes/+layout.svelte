<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import "$lib/styles/globals.css";
  import "$lib/styles/index.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>re-ReelShort</title>
  <link rel="icon" type="image/png" href="/favicon.webp" />
</svelte:head>

<div id="__next" data-reactroot="">
  <div class="app">
    <Header />
    <main class="app-main">
      {@render children()}
    </main>
  </div>
</div>
