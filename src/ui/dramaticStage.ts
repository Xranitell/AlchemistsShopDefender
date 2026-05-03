// Shared "danger / glory stage" decoration used by run-start overlays
// (modifier preview, blessing/curse picker, …).
//
// Returns a positioned-absolute backdrop with a slowly-rotating ray ring,
// drifting embers, and a pulsing pixel sigil. The host element must
// `position: relative; isolation: isolate; overflow: hidden;` and pull
// its own `--mp-edge` / `--mp-glow` colour variables from CSS — those
// drive the gradient stops, ember colours, and sigil tint, so a single
// helper covers both the "danger" tone (epic / curse) and the "glory"
// tone (blessing) without DOM changes.

export interface DramaticStageOpts {
  /** "dense" packs in more particles for the higher-stakes screens
   *  (Ancient dungeon, curse step). Defaults to "standard". */
  density?: 'standard' | 'dense';
  /** Adds an extra class so callers can layer their own tint (e.g. the
   *  curse step uses this to push the rays redder). */
  variant?: string;
}

export function buildDramaticStage(opts: DramaticStageOpts = {}): HTMLElement {
  const stage = document.createElement('div');
  stage.className = 'mp-stage';
  if (opts.variant) stage.classList.add(`mp-stage-${opts.variant}`);

  const rays = document.createElement('div');
  rays.className = 'mp-rays';
  stage.appendChild(rays);

  const sparkLayer = document.createElement('div');
  sparkLayer.className = 'mp-sparks';
  const sparkCount = opts.density === 'dense' ? 18 : 12;
  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement('span');
    spark.className = 'mp-spark';
    spark.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
    spark.style.setProperty('--delay', `${(Math.random() * 2.4).toFixed(2)}s`);
    spark.style.setProperty('--dur', `${(2.2 + Math.random() * 1.6).toFixed(2)}s`);
    spark.style.setProperty('--scale', `${(0.6 + Math.random() * 0.9).toFixed(2)}`);
    sparkLayer.appendChild(spark);
  }
  stage.appendChild(sparkLayer);

  const sigil = document.createElement('div');
  sigil.className = 'mp-sigil';
  sigil.setAttribute('aria-hidden', 'true');
  stage.appendChild(sigil);

  return stage;
}

/** Wrap a single line of text into per-character spans so each letter
 *  can run the `mp-title-glitch` animation independently. Spaces are
 *  preserved as text nodes so word breaks stay natural. */
export function appendGlitchTitleChars(parent: HTMLElement, text: string): void {
  for (const ch of Array.from(text)) {
    if (ch === ' ') {
      parent.appendChild(document.createTextNode(' '));
      continue;
    }
    const span = document.createElement('span');
    span.className = 'mp-title-char';
    span.textContent = ch;
    span.dataset.char = ch;
    span.style.animationDelay = `${(Math.random() * 0.6).toFixed(2)}s`;
    parent.appendChild(span);
  }
}
