import type { GameState } from '../game/state';
import { totalWaves } from '../game/wave';

export interface HudHandlers {
  onPause(): void;
  onSkipPause(): void;
  onActivateOverload(): void;
}

export class Hud {
  private root: HTMLElement;
  private handlers: HudHandlers;
  private hpFill!: HTMLDivElement;
  private overloadFill!: HTMLDivElement;
  private waveLabel!: HTMLSpanElement;
  private waveTimer!: HTMLSpanElement;
  private goldLabel!: HTMLSpanElement;
  private hpLabel!: HTMLSpanElement;
  private skipBtn!: HTMLButtonElement;
  private overloadBtn!: HTMLButtonElement;
  private hint!: HTMLDivElement;

  constructor(root: HTMLElement, handlers: HudHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.build();
  }

  private build(): void {
    this.root.innerHTML = '';

    const top = document.createElement('div');
    top.className = 'hud-top';

    const left = document.createElement('div');
    left.className = 'hud-left';
    left.appendChild(this.row('HP', (this.hpLabel = span('hud-value'))));
    const hpBar = document.createElement('div');
    hpBar.className = 'bar hp';
    this.hpFill = document.createElement('div');
    hpBar.appendChild(this.hpFill);
    left.appendChild(hpBar);
    left.appendChild(this.row('Overload', span('hud-value')));
    const olBar = document.createElement('div');
    olBar.className = 'bar overload';
    this.overloadFill = document.createElement('div');
    olBar.appendChild(this.overloadFill);
    left.appendChild(olBar);

    const right = document.createElement('div');
    right.className = 'hud-right';
    right.appendChild(this.row('Волна', (this.waveLabel = span('hud-value hud-wave'))));
    right.appendChild(this.row('Таймер', (this.waveTimer = span('hud-value'))));
    right.appendChild(this.row('Золото', (this.goldLabel = span('hud-value hud-gold'))));

    top.appendChild(left);
    top.appendChild(right);

    const bottom = document.createElement('div');
    bottom.className = 'hud-bottom';
    this.skipBtn = document.createElement('button');
    this.skipBtn.textContent = 'Начать волну';
    this.skipBtn.addEventListener('click', () => this.handlers.onSkipPause());

    this.overloadBtn = document.createElement('button');
    this.overloadBtn.textContent = 'Overload (Q)';
    this.overloadBtn.addEventListener('click', () => this.handlers.onActivateOverload());

    bottom.appendChild(this.skipBtn);
    bottom.appendChild(this.overloadBtn);

    this.hint = document.createElement('div');
    this.hint.style.position = 'absolute';
    this.hint.style.bottom = '70px';
    this.hint.style.left = '50%';
    this.hint.style.transform = 'translateX(-50%)';
    this.hint.style.color = 'var(--fg-dim)';
    this.hint.style.fontSize = '13px';
    this.hint.style.pointerEvents = 'none';
    this.hint.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';

    this.root.appendChild(top);
    this.root.appendChild(bottom);
    this.root.appendChild(this.hint);
  }

  private row(labelText: string, value: HTMLSpanElement): HTMLElement {
    const row = document.createElement('div');
    row.className = 'hud-row';
    const l = document.createElement('span');
    l.className = 'hud-label';
    l.textContent = labelText;
    row.appendChild(l);
    row.appendChild(value);
    return row;
  }

  update(state: GameState): void {
    const m = state.mannequin;
    this.hpFill.style.width = `${(m.hp / m.maxHp) * 100}%`;
    this.hpLabel.textContent = `${Math.max(0, Math.round(m.hp))} / ${m.maxHp}`;
    const o = state.overload;
    this.overloadFill.style.width = `${(o.charge / o.maxCharge) * 100}%`;
    this.goldLabel.textContent = `${state.gold}`;

    const ws = state.waveState;
    const idx = ws.currentIndex;
    const total = totalWaves();
    if (idx < 0) {
      this.waveLabel.textContent = `0 / ${total}`;
      this.waveTimer.textContent = '—';
    } else {
      this.waveLabel.textContent = `${idx + 1} / ${total}`;
      if (state.phase === 'wave') {
        this.waveTimer.textContent = `${ws.timeInWave.toFixed(1)} с`;
      } else if (state.phase === 'preparing') {
        this.waveTimer.textContent = `пауза ${Math.max(0, ws.pauseDurationLeft).toFixed(1)} с`;
      } else {
        this.waveTimer.textContent = '—';
      }
    }

    this.skipBtn.disabled = state.phase !== 'preparing';
    this.skipBtn.textContent = idx < 0 ? 'Начать первую волну' : 'Начать следующую волну';
    this.overloadBtn.disabled = state.overload.charge < state.overload.maxCharge;

    if (state.phase === 'preparing') {
      const next = idx + 1;
      this.hint.textContent = next === 0
        ? 'Кликни по руне, чтобы поставить стойку. Готов? Жми «Начать волну».'
        : `Готовься к волне ${next + 1}. Покупай и улучшай стойки на рунах.`;
    } else if (state.phase === 'wave') {
      this.hint.textContent = 'ЛКМ — точный бросок склянки. Q — Overload. Авто-бросок включён.';
    } else {
      this.hint.textContent = '';
    }
  }
}

function span(cls: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  return s;
}
