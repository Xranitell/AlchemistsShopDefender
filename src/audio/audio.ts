/**
 * AudioEngine: procedural WebAudio-based sound system for the game.
 *
 * Design goals (PR-7 / GDD §16):
 *  - No external audio assets — every SFX is synthesised from oscillators,
 *    short noise buffers and envelopes, every music track is built from a
 *    handful of pulse / square / triangle voices on top of a generated bass.
 *  - Lazy-init: AudioContext is created on the first user gesture so the
 *    Yandex Games / Chrome autoplay policy doesn't choke us at boot.
 *  - Three independent gain nodes (master / sfx / music) with persisted
 *    user-controllable volumes wired straight through `MetaSave`.
 *  - Tab-pause resilient: when the document becomes hidden we don't try to
 *    schedule against a suspended context; on visibility return we resume
 *    the context. This avoids the well-known "AudioContext stuck" bug after
 *    long inactive periods.
 *  - Burst rate-limit: the same SFX cannot play more than 6 times in 100ms,
 *    which matters during reaction storms or heavy tower volleys.
 */

export type SfxId =
  | 'throwPotion'
  | 'potionImpact'
  | 'towerFire'
  | 'enemyHit'
  | 'enemyDeath'
  | 'goldPickup'
  | 'reactionFire'
  | 'reactionFreeze'
  | 'reactionAcid'
  | 'overloadActivate'
  | 'bossSpawn'
  | 'waveStart'
  | 'waveWin'
  | 'runDefeat'
  | 'cardPick'
  | 'uiClick'
  | 'uiHover'
  | 'levelUp';

export type MusicTrack = 'menu' | 'battle' | 'boss' | null;

interface SfxOptions {
  /** 0..1, multiplied with the per-id default and the global SFX gain. */
  volume?: number;
  /** Frequency multiplier — useful for randomising hit pitches. */
  detune?: number;
}

const RATE_LIMIT_WINDOW_MS = 100;
const RATE_LIMIT_PER_ID = 6;

/** Linear-amplitude cap applied at the music slider's max position.
 *
 * The procedurally-generated menu / battle MP3 tracks are mastered at a
 * conservative peak (~-2.5 dB), but a raw 1.0 gain on top of
 * `masterGain = 0.85` would still drown SFX during dense combat.
 * Capping at 0.22 keeps the music bed comfortably below the SFX mix;
 * the player perceives 100 % on the slider as "comfortable max". */
const MUSIC_MAX_GAIN = 0.22;

/** Map a 0..1 slider value to the actual gain node value. Linear scaling
 *  capped at `MUSIC_MAX_GAIN` so the slider behaves like a real volume
 *  knob: 0 % silent, 50 % half-volume, 100 % comfortable max — never
 *  earsplitting. Kept as a free function so both `applyGains()` and the
 *  initial gain assignment in `ensureStarted()` agree. */
function musicSliderToGain(slider: number): number {
  return MUSIC_MAX_GAIN * clamp01(slider);
}

/** SFX ids that route through the dedicated UI gain channel rather than
 *  the gameplay SFX channel. Lets the player tune UI clicks separately
 *  from in-game sounds. Keep in sync with the runtime check in
 *  `playSfx()`. */
const UI_SFX_IDS: ReadonlySet<SfxId> = new Set<SfxId>(['uiClick', 'uiHover']);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  /** Gameplay SFX channel: shots, enemy hits, drops, reactions … */
  private sfxGain: GainNode | null = null;
  /** UI SFX channel: button clicks, hover ticks. Routed separately so
   *  the settings panel can expose an independent volume slider. */
  private uiSfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  /** Persisted user volumes (0..1). Apply on top of the per-channel gain.
   *  These represent the slider's raw position; the music slider goes
   *  through `musicSliderToGain()` before being written to the gain node
   *  so the bundled ambient track stays inside a comfortable amplitude
   *  range even at slider = 100 %. Default music slider is 1.0 — with
   *  `MUSIC_MAX_GAIN = 0.22` that lands close to the previous (loudest
   *  comfortable) listening position; players who want it quieter just
   *  drag the slider down. */
  private sfxVolume = 0.6;
  private uiSfxVolume = 0.6;
  private musicVolume = 1.0;
  private muted = false;

  /** Currently scheduled music: source nodes + the track id. Switching a
   *  track tears these down before starting a new schedule. */
  private music: { track: MusicTrack; nodes: AudioNode[]; stopAt: number } | null = null;
  private musicLoopTimer: ReturnType<typeof setTimeout> | null = null;

  /** Decoded AudioBuffer cache keyed by *concrete* track filename
   *  (e.g. `'menu_a'`, `'menu_b'`, `'battle_a'`, `'battle_b'`). Loaded
   *  lazily and reused so switching variants doesn't retrigger network
   *  I/O. Buffer-source playback gives sample-accurate looping with no
   *  encoder-padding gap — that's why we don't use HTMLAudioElement
   *  here any more.  */
  private sampleBuffers: Map<string, AudioBuffer> = new Map();
  /** In-flight decode promises so concurrent plays of the same variant
   *  don't kick off duplicate fetches. */
  private samplePending: Map<string, Promise<AudioBuffer | null>> = new Map();
  /** The currently scheduled music source + which logical track + which
   *  variant is playing. */
  private currentSample: {
    track: 'menu' | 'battle';
    variant: string;
    node: AudioBufferSourceNode;
  } | null = null;
  /** Generation counter — incremented each time `playMusic` is called so
   *  in-flight decodes that lose the race can detect they were
   *  superseded and bail out before starting a stale source. */
  private musicGen = 0;

  /** Recent fire times per SFX id (ms since context start) for rate-limiting. */
  private recentFires: Map<SfxId, number[]> = new Map();

  /** Pre-generated short white-noise buffer, reused for hi-hat / hiss SFX. */
  private noiseBuffer: AudioBuffer | null = null;

  setVolumes(opts: { sfxVolume?: number; uiSfxVolume?: number; musicVolume?: number }): void {
    if (typeof opts.sfxVolume === 'number') {
      this.sfxVolume = clamp01(opts.sfxVolume);
    }
    if (typeof opts.uiSfxVolume === 'number') {
      this.uiSfxVolume = clamp01(opts.uiSfxVolume);
    }
    if (typeof opts.musicVolume === 'number') {
      this.musicVolume = clamp01(opts.musicVolume);
    }
    this.applyGains();
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = clamp01(v);
    this.applyGains();
  }

  setUiSfxVolume(v: number): void {
    this.uiSfxVolume = clamp01(v);
    this.applyGains();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = clamp01(v);
    this.applyGains();
  }

  mute(value = true): void {
    this.muted = value;
    this.applyGains();
  }

  /** Initialise the AudioContext. Safe to call repeatedly; subsequent calls
   *  just resume() if the context is suspended. Must be called from inside a
   *  user-gesture handler (click, keydown) to satisfy autoplay policy. */
  ensureStarted(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    type WindowWithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
    const w = window as WindowWithWebkit;
    const Ctx: typeof AudioContext | undefined = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.uiSfxGain = ctx.createGain();
    this.uiSfxGain.gain.value = this.uiSfxVolume;
    this.uiSfxGain.connect(this.masterGain);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = musicSliderToGain(this.musicVolume);
    this.musicGain.connect(this.masterGain);

    this.noiseBuffer = makeNoiseBuffer(ctx, 0.4);

    // Resume if the engine was created in a suspended state (some browsers).
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Lifecycle helpers — kept private to discourage callers from forgetting
   *  the user-gesture rule. */
  private onVisibilityChange = (): void => {
    if (!this.ctx) return;
    if (document.hidden) {
      void this.ctx.suspend().catch(() => {});
    } else {
      void this.ctx.resume().catch(() => {});
    }
  };

  /** Play a one-shot SFX. No-op if the engine has not been started yet. */
  playSfx(id: SfxId, opts: SfxOptions = {}): void {
    if (this.muted || !this.ctx || !this.sfxGain || !this.uiSfxGain) return;
    if (!this.allowFire(id)) return;
    const now = this.ctx.currentTime;
    // Route UI SFX through their dedicated gain so the player can dial
    // them down independently of gameplay sounds.
    const out = UI_SFX_IDS.has(id) ? this.uiSfxGain : this.sfxGain;
    const detune = opts.detune ?? 1;
    const volume = opts.volume ?? 1;
    try {
      switch (id) {
        case 'throwPotion':
          this.synthThrowPotion(now, out, detune, volume);
          break;
        case 'potionImpact':
          this.synthPotionImpact(now, out, detune, volume);
          break;
        case 'towerFire':
          this.synthTowerFire(now, out, detune, volume);
          break;
        case 'enemyHit':
          this.synthEnemyHit(now, out, detune, volume);
          break;
        case 'enemyDeath':
          this.synthEnemyDeath(now, out, detune, volume);
          break;
        case 'goldPickup':
          this.synthGoldPickup(now, out, detune, volume);
          break;
        case 'reactionFire':
          this.synthReactionFire(now, out, detune, volume);
          break;
        case 'reactionFreeze':
          this.synthReactionFreeze(now, out, detune, volume);
          break;
        case 'reactionAcid':
          this.synthReactionAcid(now, out, detune, volume);
          break;
        case 'overloadActivate':
          this.synthOverload(now, out, detune, volume);
          break;
        case 'bossSpawn':
          this.synthBossSpawn(now, out, detune, volume);
          break;
        case 'waveStart':
          this.synthWaveStart(now, out, detune, volume);
          break;
        case 'waveWin':
          this.synthWaveWin(now, out, detune, volume);
          break;
        case 'runDefeat':
          this.synthRunDefeat(now, out, detune, volume);
          break;
        case 'cardPick':
          this.synthCardPick(now, out, detune, volume);
          break;
        case 'uiClick':
          this.synthUiClick(now, out, detune, volume);
          break;
        case 'uiHover':
          this.synthUiHover(now, out, detune, volume);
          break;
        case 'levelUp':
          this.synthLevelUp(now, out, detune, volume);
          break;
      }
    } catch {
      // If WebAudio refuses to schedule (e.g. context died) just swallow —
      // we don't want a sound bug to crash the game loop.
    }
  }

  /** Switch the ambient music loop. Pass null to stop.
   *
   *  Track routing:
   *    - 'menu'   → buffer-looped MP3 (one of two soft lo-fi variants),
   *      randomly picked each time we (re)enter the menu state for
   *      variety.
   *    - 'battle' → buffer-looped MP3 (one of two combat lo-fi variants).
   *    - 'boss'   → procedural synth loop (kept for contrast — we still
   *      want a tense, dissonant track during boss waves).
   *    - null     → stop everything. */
  playMusic(track: MusicTrack): void {
    if (!this.ctx || !this.musicGain) return;
    this.musicGen++;
    if (track === null) {
      this.stopProceduralMusic();
      this.stopSampleMusic();
      return;
    }
    if (track === 'boss') {
      // Boss waves swap to the procedural track. Stop the sample first so
      // we don't double-stack.
      this.stopSampleMusic();
      if (this.music && this.music.track === 'boss') return;
      this.stopProceduralMusic();
      this.music = { track: 'boss', nodes: [], stopAt: 0 };
      this.scheduleMusicLoop('boss');
      return;
    }
    // menu / battle → sample-based ambient. Pick a fresh variant every
    // time we enter the state so the player doesn't hear the same loop
    // back-to-back across menu ↔ battle transitions.
    this.stopProceduralMusic();
    void this.startSampleMusic(track);
  }

  stopMusic(): void {
    this.stopProceduralMusic();
    this.stopSampleMusic();
  }

  private stopProceduralMusic(): void {
    if (this.musicLoopTimer !== null) {
      clearTimeout(this.musicLoopTimer);
      this.musicLoopTimer = null;
    }
    if (this.music) {
      for (const n of this.music.nodes) {
        try {
          // OscillatorNode / AudioBufferSourceNode both support stop().
          (n as OscillatorNode).stop?.();
        } catch {
          // already stopped
        }
        try {
          n.disconnect();
        } catch {
          // ignore
        }
      }
      this.music = null;
    }
  }

  private stopSampleMusic(): void {
    if (this.currentSample) {
      try { this.currentSample.node.stop(); } catch { /* already stopped */ }
      try { this.currentSample.node.disconnect(); } catch { /* ignore */ }
      this.currentSample = null;
    }
  }

  /** Per-logical-track variant pool. Each menu/battle entry into
   *  `playMusic()` randomly picks one of these so the player hears
   *  different lo-fi grooves between sessions / state transitions. */
  private static readonly SAMPLE_VARIANTS: Record<'menu' | 'battle', readonly string[]> = {
    menu: ['menu_a', 'menu_b'],
    battle: ['battle_a', 'battle_b'],
  };

  /** Concrete filename for a variant id. Files are bundled under
   *  `public/audio/<variant>.mp3`. */
  private static fileForVariant(variant: string): string {
    return `audio/${variant}.mp3`;
  }

  /** Decode (and cache) the MP3 backing a given variant. Returns null
   *  on any failure — e.g. user offline, asset missing, decode error —
   *  so callers can silently degrade rather than crash. */
  private async loadSampleBuffer(variant: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    const cached = this.sampleBuffers.get(variant);
    if (cached) return cached;
    const inflight = this.samplePending.get(variant);
    if (inflight) return inflight;
    const ctx = this.ctx;
    const promise = (async () => {
      try {
        const res = await fetch(AudioEngine.fileForVariant(variant));
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);
        this.sampleBuffers.set(variant, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.samplePending.delete(variant);
      }
    })();
    this.samplePending.set(variant, promise);
    return promise;
  }

  /** Pick a fresh variant for the requested track, biased away from the
   *  one we just played so consecutive entries (menu → battle → menu)
   *  rarely repeat. */
  private pickVariant(track: 'menu' | 'battle'): string {
    const pool = AudioEngine.SAMPLE_VARIANTS[track];
    if (pool.length === 0) return track;
    const recent = this.currentSample?.variant;
    const candidates = pool.length > 1 && recent && pool.includes(recent)
      ? pool.filter((v) => v !== recent)
      : pool.slice();
    return candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0]!;
  }

  /** Start a buffer-sourced loop for the requested track. Looping via
   *  `AudioBufferSourceNode.loop = true` is sample-accurate, so the
   *  encoder-padding silence that HTMLAudioElement's `loop` attribute
   *  exposes between iterations is avoided entirely — the track now
   *  loops seamlessly. */
  private async startSampleMusic(track: 'menu' | 'battle'): Promise<void> {
    if (!this.ctx || !this.musicGain) return;
    const myGen = this.musicGen;
    const variant = this.pickVariant(track);
    const buf = await this.loadSampleBuffer(variant);
    if (!buf) return;
    // Bail if `playMusic` was called again while we were decoding —
    // otherwise we'd start a stale loop on top of the new one.
    if (myGen !== this.musicGen) return;
    if (!this.ctx || !this.musicGain) return;
    // Tear down any prior source before scheduling the new one.
    this.stopSampleMusic();
    const node = this.ctx.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    node.connect(this.musicGain);
    try { node.start(0); } catch { /* context died */ return; }
    this.currentSample = { track, variant, node };
  }

  // ---------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------

  private applyGains(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.uiSfxGain || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const masterTarget = this.muted ? 0 : 0.85;
    this.masterGain.gain.cancelScheduledValues(t);
    this.masterGain.gain.setTargetAtTime(masterTarget, t, 0.02);
    this.sfxGain.gain.cancelScheduledValues(t);
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume, t, 0.02);
    this.uiSfxGain.gain.cancelScheduledValues(t);
    this.uiSfxGain.gain.setTargetAtTime(this.uiSfxVolume, t, 0.02);
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(musicSliderToGain(this.musicVolume), t, 0.02);
  }

  private allowFire(id: SfxId): boolean {
    const now = performance.now();
    const list = this.recentFires.get(id) ?? [];
    // Drop entries older than the rate-limit window.
    while (list.length > 0 && now - list[0]! > RATE_LIMIT_WINDOW_MS) list.shift();
    if (list.length >= RATE_LIMIT_PER_ID) return false;
    // UI clicks are special: a single press tends to reach the engine
    // multiple times (the global delegated `click` listener + an
    // existing in-component handler that still calls `playSfx`
    // directly). When two ticks land within the same animation frame
    // their square waves stack and the click sounds rasping / tripled.
    // A 70 ms hard floor on `uiClick`/`uiHover` collapses the storm to
    // a single, clean tick without affecting how often gameplay SFX
    // can fire.
    if (UI_SFX_IDS.has(id) && list.length > 0 && now - list[list.length - 1]! < 70) {
      return false;
    }
    list.push(now);
    this.recentFires.set(id, list);
    return true;
  }

  // -- SFX synthesis --------------------------------------------------------

  private synthThrowPotion(t: number, out: AudioNode, detune: number, vol: number): void {
    // Quick whoosh: short noise burst with a downward sweep + faint clink.
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.18 * vol, t + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800 * detune, t);
    bp.frequency.exponentialRampToValueAtTime(700 * detune, t + 0.18);
    bp.Q.value = 1.4;
    noise.connect(bp).connect(noiseGain).connect(out);
    noise.start(t);
    noise.stop(t + 0.22);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(540 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(220 * detune, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.12 * vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private synthPotionImpact(t: number, out: AudioNode, detune: number, vol: number): void {
    // Glass shatter + thud: bright noise crackle + low body.
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.45 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500 * detune;
    noise.connect(hp).connect(ng).connect(out);
    noise.start(t);
    noise.stop(t + 0.34);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(60 * detune, t + 0.18);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.32 * vol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(og).connect(out);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private synthTowerFire(t: number, out: AudioNode, detune: number, vol: number): void {
    // Crisp blip with a tiny chirp — different tower kinds get pitch detune.
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(420 * detune, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.18 * vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private synthEnemyHit(t: number, out: AudioNode, detune: number, vol: number): void {
    // Soft thud: tight noise tap + sub.
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.22 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    noise.connect(lp).connect(ng).connect(out);
    noise.start(t);
    noise.stop(t + 0.1);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(130 * detune, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.2 * vol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og).connect(out);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private synthEnemyDeath(t: number, out: AudioNode, detune: number, vol: number): void {
    // Squelchy descending squeak.
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(80 * detune, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  private synthGoldPickup(t: number, out: AudioNode, detune: number, vol: number): void {
    // Two-note arpeggio — bright square voices.
    const ctx = this.ctx!;
    const notes = [880, 1320];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq * detune;
      const g = ctx.createGain();
      const start = t + i * 0.06;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.14 * vol, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  private synthReactionFire(t: number, out: AudioNode, detune: number, vol: number): void {
    // Crackling burst: filtered noise wave + low boom.
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.4 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400 * detune, t);
    bp.frequency.exponentialRampToValueAtTime(900 * detune, t + 0.4);
    bp.Q.value = 0.7;
    noise.connect(bp).connect(ng).connect(out);
    noise.start(t);
    noise.stop(t + 0.5);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(60 * detune, t + 0.3);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18 * vol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(og).connect(out);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  private synthReactionFreeze(t: number, out: AudioNode, detune: number, vol: number): void {
    // Crystalline shiver: high triangle + slight detune chorus, bright noise.
    const ctx = this.ctx!;
    [1, 1.005].forEach((d, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1760 * detune * d, t);
      osc.frequency.exponentialRampToValueAtTime(880 * detune * d, t + 0.36);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07 * vol, t + 0.03 + i * 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.42);
    });

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.07 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    noise.connect(hp).connect(ng).connect(out);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  private synthReactionAcid(t: number, out: AudioNode, detune: number, vol: number): void {
    // Hissing sizzle: filtered noise wobble + low gurgle.
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.32 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200 * detune, t);
    bp.Q.value = 4;
    // Wobble.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 600;
    lfo.connect(lfoGain).connect(bp.frequency);
    lfo.start(t);
    lfo.stop(t + 0.55);
    noise.connect(bp).connect(ng).connect(out);
    noise.start(t);
    noise.stop(t + 0.55);
  }

  private synthOverload(t: number, out: AudioNode, detune: number, vol: number): void {
    // Big charge release: rising sweep + thud + zap noise.
    const ctx = this.ctx!;
    const sweep = ctx.createOscillator();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(120 * detune, t);
    sweep.frequency.exponentialRampToValueAtTime(900 * detune, t + 0.25);
    sweep.frequency.exponentialRampToValueAtTime(180 * detune, t + 0.7);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.28 * vol, t + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    sweep.connect(sg).connect(out);
    sweep.start(t);
    sweep.stop(t + 0.78);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18 * vol, t + 0.18);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    noise.connect(hp).connect(ng).connect(out);
    noise.start(t + 0.18);
    noise.stop(t + 0.6);
  }

  private synthBossSpawn(t: number, out: AudioNode, detune: number, vol: number): void {
    // Ominous descending chord on triangle + sub.
    const ctx = this.ctx!;
    const freqs = [110, 138.59, 207.65]; // A2, C#3, G#3 (minor warning)
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * detune * 1.2, t);
      osc.frequency.linearRampToValueAtTime(f * detune * 0.95, t + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16 * vol, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 1.32);
    });
  }

  private synthWaveStart(t: number, out: AudioNode, detune: number, vol: number): void {
    // Drum + horn motif: short rising 3-note fanfare on square.
    const ctx = this.ctx!;
    const notes = [392, 523.25, 659.25]; // G4, C5, E5
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f * detune;
      const g = ctx.createGain();
      const start = t + i * 0.09;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18 * vol, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  private synthWaveWin(t: number, out: AudioNode, detune: number, vol: number): void {
    // Cheerful 4-note major arpeggio.
    const ctx = this.ctx!;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f * detune;
      const g = ctx.createGain();
      const start = t + i * 0.08;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.22 * vol, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  }

  private synthRunDefeat(t: number, out: AudioNode, detune: number, vol: number): void {
    // Sad 3-note descent on saw.
    const ctx = this.ctx!;
    const notes = [349.23, 277.18, 196.0]; // F4 C#4 G3
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f * detune;
      const g = ctx.createGain();
      const start = t + i * 0.18;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18 * vol, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  private synthCardPick(t: number, out: AudioNode, detune: number, vol: number): void {
    // Magical chime: 2 high triangles, slight delay.
    const ctx = this.ctx!;
    const notes = [987.77, 1318.51]; // B5 E6
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f * detune;
      const g = ctx.createGain();
      const start = t + i * 0.05;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18 * vol, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  private synthUiClick(t: number, out: AudioNode, detune: number, vol: number): void {
    // Soft, warm tick. Triangle (only odd harmonics, but at -9 dB vs
    // square so the timbre reads as woody rather than buzzy), short
    // attack ramp to avoid the click-pop of an instant gain step, and
    // a low-pass filter that rolls off the harshness on top. Pitch
    // glides 900 → 520 Hz so the hit lands somewhere between a "tap"
    // and a "tock" without ever sounding metallic.
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(520 * detune, t + 0.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    lp.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.11 * vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  private synthUiHover(t: number, out: AudioNode, detune: number, vol: number): void {
    // Subtle, slightly wooden tick — sine + light low-pass. Quieter
    // than the click so cursor sweeps don't dominate the mix.
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(560 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(480 * detune, t + 0.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  private synthLevelUp(t: number, out: AudioNode, detune: number, vol: number): void {
    // Triumphant 3-note rising — square + triangle pad.
    const ctx = this.ctx!;
    const notes = [523.25, 659.25, 987.77];
    notes.forEach((f, i) => {
      const sq = ctx.createOscillator();
      sq.type = 'square';
      sq.frequency.value = f * detune;
      const g = ctx.createGain();
      const start = t + i * 0.07;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.16 * vol, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      sq.connect(g).connect(out);
      sq.start(start);
      sq.stop(start + 0.34);
    });
  }

  // -- Music synthesis ------------------------------------------------------

  /**
   * Schedule one full pass of the active loop and queue the next pass with a
   * setTimeout slightly before it ends, giving us seamless wrap-around. Each
   * track is just a 16-bar pattern over a fixed mode/tempo:
   *  - menu:  slow, mystical, sparse (~70 BPM, A minor pentatonic)
   *  - battle: driving, ~110 BPM, D minor pentatonic with a steady bass
   *  - boss:  faster (~125 BPM), heavy bass + dissonant pad
   */
  private scheduleMusicLoop(track: MusicTrack): void {
    if (!this.ctx || !this.musicGain || track === null) return;
    const ctx = this.ctx;
    const out = this.musicGain;
    const startAt = Math.max(ctx.currentTime, this.music?.stopAt ?? ctx.currentTime);
    const config = MUSIC_TRACKS[track];
    const beatSec = 60 / config.bpm;
    const totalSec = config.melody.length * beatSec;
    const created: AudioNode[] = [];

    // 1) Lead melody on a pulse-ish square voice with a soft envelope.
    config.melody.forEach((step, i) => {
      if (step === null) return;
      const t = startAt + i * beatSec;
      const dur = beatSec * 0.9;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = step;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.04);
      g.gain.linearRampToValueAtTime(0.06, t + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      created.push(osc);
    });

    // 2) Bass line on a triangle one octave below. Skipping every fourth slot
    //    creates a simple groove.
    config.bass.forEach((step, i) => {
      if (step === null) return;
      const t = startAt + i * beatSec;
      const dur = beatSec * 1.6;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = step;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      created.push(osc);
    });

    // 3) Soft sustained pad — two detuned sine voices, low gain, throughout.
    [config.padFreq * 0.5, config.padFreq * 0.5 * 1.005].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, startAt);
      g.gain.linearRampToValueAtTime(0.04, startAt + 0.6);
      g.gain.linearRampToValueAtTime(0.04, startAt + totalSec - 0.6);
      g.gain.exponentialRampToValueAtTime(0.0008, startAt + totalSec);
      osc.connect(g).connect(out);
      osc.start(startAt);
      osc.stop(startAt + totalSec + 0.05);
      created.push(osc);
    });

    if (this.music) {
      this.music.nodes.push(...created);
      this.music.stopAt = startAt + totalSec;
    }

    // Schedule the next pass slightly before this one ends so the new bar
    // can start exactly when the current one runs out (seamless loop).
    const lookaheadMs = Math.max(0, (totalSec - 0.4) * 1000);
    this.musicLoopTimer = setTimeout(() => {
      if (!this.music || this.music.track !== track) return;
      // Drop oscillators that already finished playing.
      this.music.nodes = this.music.nodes.filter((n) => {
        try {
          (n as OscillatorNode).disconnect?.();
        } catch {
          // ignore
        }
        return false;
      });
      this.scheduleMusicLoop(track);
    }, lookaheadMs);
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function makeNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buf = ctx.createBuffer(1, length, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

interface MusicConfig {
  bpm: number;
  /** One slot per beat: target frequency in Hz, or null for a rest. */
  melody: (number | null)[];
  bass: (number | null)[];
  padFreq: number;
}

// Frequencies (Hz) for a small palette of notes used by the loops.
const NOTE = {
  A2: 110.0,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
} as const;

// Each track is 16 beats long. Tempo determines absolute duration:
// 70 BPM → ~13.7s, 110 BPM → ~8.7s, 125 BPM → ~7.7s.
const MUSIC_TRACKS: Record<NonNullable<MusicTrack>, MusicConfig> = {
  // Slow, mystical — A minor pentatonic, sparse melody, low pad.
  menu: {
    bpm: 70,
    melody: [
      NOTE.A4, null, NOTE.C5, null,
      NOTE.E5, null, NOTE.D5, null,
      NOTE.C5, null, NOTE.A4, null,
      NOTE.G4, null, NOTE.E4, null,
    ],
    bass: [
      NOTE.A2, null, null, null,
      NOTE.A2, null, null, null,
      NOTE.G3, null, null, null,
      NOTE.E3, null, null, null,
    ],
    padFreq: NOTE.A4,
  },
  // Driving, slightly tense — D minor pentatonic, steady bass, more notes.
  battle: {
    bpm: 110,
    melody: [
      NOTE.D5, NOTE.F4, NOTE.A4, NOTE.D5,
      NOTE.C5, NOTE.A4, NOTE.G4, NOTE.A4,
      NOTE.D5, NOTE.F4, NOTE.A4, NOTE.C5,
      NOTE.D5, NOTE.A4, NOTE.G4, NOTE.F4,
    ],
    bass: [
      NOTE.D3, null, NOTE.D3, null,
      NOTE.A2, null, NOTE.A2, null,
      NOTE.F3, null, NOTE.F3, null,
      NOTE.G3, null, NOTE.A2, null,
    ],
    padFreq: NOTE.D4,
  },
  // Heavier, faster, dissonant pad.
  boss: {
    bpm: 125,
    melody: [
      NOTE.F4, NOTE.G4, NOTE.A4, NOTE.G4,
      NOTE.F4, NOTE.E4, NOTE.D4, NOTE.E4,
      NOTE.F4, NOTE.A4, NOTE.C5, NOTE.A4,
      NOTE.G4, NOTE.F4, NOTE.E4, NOTE.D4,
    ],
    bass: [
      NOTE.D3, NOTE.D3, null, NOTE.D3,
      NOTE.D3, NOTE.D3, null, NOTE.D3,
      NOTE.F3, NOTE.F3, null, NOTE.F3,
      NOTE.A2, NOTE.A2, null, NOTE.A2,
    ],
    padFreq: NOTE.D4,
  },
};

/** Singleton shared across the whole app. */
export const audio = new AudioEngine();
