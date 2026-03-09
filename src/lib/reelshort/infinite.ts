type KeyFn<T> = (x: T) => string | null | undefined;

const idKey = (s: string) => s.match(/[a-f0-9]{24}/i)?.[0].toLowerCase() ?? s;

export const mergeUnique = <T>(base: T[], next: T[], keyOf: KeyFn<T>) => {
  const seen = new Set<string>();
  const out: T[] = [];

  for (let i = 0; i < base.length; i++) {
    const k = keyOf(base[i]);
    if (!k) continue;
    const key = idKey(k);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(base[i]);
  }

  for (let i = 0; i < next.length; i++) {
    const k = keyOf(next[i]);
    if (!k) continue;
    const key = idKey(k);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next[i]);
  }

  return out;
};

type HitCtx = { unobserve: () => void; observe: () => void };
type HitFn = (ctx: HitCtx) => void | Promise<void>;

export const makeObserver = (
  onHit: HitFn,
  opts: IntersectionObserverInit = { rootMargin: "600px 0px", threshold: 0 }
) => {
  let obs: IntersectionObserver | null = null;
  let node: Element | null = null;

  let enabled = true;
  let locked = false;
  let lastHit = 0;
  const COOLDOWN_MS = 250;

  const observe = () => { if (obs && node) obs.observe(node); };
  const unobserve = () => { if (obs && node) obs.unobserve(node); };

  const action = (el: Element) => {
    node = el;

    obs?.disconnect();
    obs = new IntersectionObserver(async (entries) => {
      if (!enabled || locked) return;

      const hit = entries.some((e) => e.target === node && e.isIntersecting);
      if (!hit) return;

      const now = Date.now();
      if (now - lastHit < COOLDOWN_MS) return;
      lastHit = now;

      locked = true;

      requestAnimationFrame(async () => {
        try {
          await onHit({ unobserve, observe });
        } finally {
          locked = false;
        }
      });
    }, opts);

    observe();

    return {
      destroy() {
        obs?.disconnect();
        obs = null;
        node = null;
      },
      update(v: boolean) {
        enabled = !!v;
        if (!enabled) unobserve();
        else observe();
      }
    };
  };

  return action;
};