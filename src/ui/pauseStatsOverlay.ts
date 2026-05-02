import type { GameState } from '../game/state';
import { CARDS, cardName } from '../data/cards';
import { MUTATOR_BY_ID } from '../data/mutators';
import { CONTRACT_BY_ID } from '../data/contracts';
import { t, tWithFallback } from '../i18n';

/** Pause-menu stats overlay.
 *  Shows all active player and enemy modifiers in a scrollable panel,
 *  inspired by the Reaper Hunt Survivor stats screen. */
export class PauseStatsOverlay {
  private root: HTMLElement;
  private panel: HTMLElement | null = null;
  private onCloseCallback: (() => void) | null = null;

  constructor(root: HTMLElement, opts?: { onClose?: () => void }) {
    this.root = root;
    this.onCloseCallback = opts?.onClose ?? null;
  }

  show(state: GameState): void {
    this.hide();
    const wrap = document.createElement('div');
    wrap.className = 'pause-stats-overlay';

    const inner = document.createElement('div');
    inner.className = 'pause-stats-inner';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
      this.hide();
      if (this.onCloseCallback) this.onCloseCallback();
    });
    inner.appendChild(closeBtn);

    // ── Player stats ──────────────────────────────────────────────────────
    inner.appendChild(this.buildSection(
      tWithFallback('ui.pause.playerTitle', 'Модификаторы игрока'),
      this.playerStats(state),
    ));

    // ── Unique effects from cards ─────────────────────────────────────────
    const uniques = this.uniqueEffects(state);
    if (uniques.length > 0) {
      inner.appendChild(this.buildSection(
        tWithFallback('ui.pause.uniqueTitle', 'Уникальные эффекты'),
        uniques,
        true,
      ));
    }

    // ── Enemy modifiers ───────────────────────────────────────────────────
    inner.appendChild(this.buildSection(
      tWithFallback('ui.pause.enemyTitle', 'Модификаторы врагов'),
      this.enemyStats(state),
    ));

    // ── Run mutators ("dungeon laws") ─────────────────────────────────────
    if (state.activeMutatorIds.length > 0) {
      const mutLines: StatLine[] = state.activeMutatorIds
        .map((id) => MUTATOR_BY_ID[id])
        .filter((def): def is NonNullable<typeof def> => Boolean(def))
        .map((def) => ({
          label: `${def.icon} ${t(def.i18nName)}`,
          value: def.i18nLines.map((k) => t(k)).join(' • '),
          kind: 'debuff' as const,
        }));
      inner.appendChild(this.buildSection(
        tWithFallback('ui.pause.mutatorsTitle', 'Закон подземелья'),
        mutLines,
        true,
      ));
    }

    // ── Run contracts ────────────────────────────────────────────────────
    if (state.activeContractIds.length > 0) {
      const contractLines: StatLine[] = state.activeContractIds
        .map((id) => CONTRACT_BY_ID[id])
        .filter((def): def is NonNullable<typeof def> => Boolean(def))
        .map((def) => {
          const prog = def.progress(state);
          // Pretty-print the goal description with the target number
          // substituted in (descriptions read like "Kill {n} slimes…").
          const desc = t(def.i18nDesc, { n: prog.target });
          // Reward suffix mirrors the contract's payout type (flat
          // currency vs multiplicative bump). Falls through to '' for
          // unknown reward kinds defensively.
          let reward = '';
          switch (def.reward.kind) {
            case 'blue': reward = t('ui.contract.rewardBlue', { n: def.reward.amount }); break;
            case 'ancient': reward = t('ui.contract.rewardAncient', { n: def.reward.amount }); break;
            case 'epicKey': reward = t('ui.contract.rewardEpicKey', { n: def.reward.amount }); break;
            case 'blueMult': reward = t('ui.contract.rewardBlueMult', { n: Math.round(def.reward.amount * 100) }); break;
          }
          let valueLine: string;
          if (prog.failed) {
            valueLine = `${t('ui.contract.failed')} • ${reward}`;
          } else if (prog.done) {
            valueLine = `${t('ui.contract.done')} • ${reward}`;
          } else {
            valueLine = `${prog.current}/${prog.target} • ${reward} • ${desc}`;
          }
          const kind: StatLine['kind'] =
            prog.failed ? 'debuff' : prog.done ? 'buff' : 'unique';
          return {
            label: `${def.icon} ${t(def.i18nName)}`,
            value: valueLine,
            kind,
          };
        });
      inner.appendChild(this.buildSection(
        t('ui.contract.label'),
        contractLines,
        true,
      ));
    }

    // ── Endless modifiers ─────────────────────────────────────────────────
    if (state.endlessModifiers.length > 0) {
      const endlessList: StatLine[] = state.endlessModifiers.map((em) => ({
        label: em.label,
        value: em.desc,
        kind: 'debuff',
      }));
      inner.appendChild(this.buildSection(
        tWithFallback('ui.pause.endlessTitle', 'Бесконечный режим'),
        endlessList,
      ));
    }

    wrap.appendChild(inner);
    this.panel = wrap;
    this.root.appendChild(wrap);
  }

  hide(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  isVisible(): boolean {
    return this.panel !== null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Stat extraction helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private playerStats(state: GameState): StatLine[] {
    const m = state.modifiers;
    const mq = state.mannequin;
    const lines: StatLine[] = [];
    const p = (label: string, mult: number, fmt?: string) => {
      if (Math.abs(mult - 1) < 0.001) return;
      const pct = Math.round((mult - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      lines.push({
        label,
        value: fmt ?? `${sign}${pct}%`,
        kind: pct >= 0 ? 'buff' : 'debuff',
      });
    };
    const flat = (label: string, val: number, base: number) => {
      const diff = val - base;
      if (diff === 0) return;
      const sign = diff >= 0 ? '+' : '';
      lines.push({ label, value: `${sign}${diff}`, kind: diff >= 0 ? 'buff' : 'debuff' });
    };

    // Potion
    p(tWithFallback('ui.pause.stat.potionDamage', 'Урон склянок'), m.potionDamageMult);
    p(tWithFallback('ui.pause.stat.potionRadius', 'Радиус склянок'), m.potionRadiusMult);
    p(tWithFallback('ui.pause.stat.potionCooldown', 'Откат склянок'), m.potionCooldownMult,
      `${Math.round((m.potionCooldownMult - 1) * 100)}%`);

    // Tower
    p(tWithFallback('ui.pause.stat.towerDamage', 'Урон стоек'), m.towerDamageMult);
    p(tWithFallback('ui.pause.stat.towerFireRate', 'Скорострельность'), m.towerFireRateMult);
    p(tWithFallback('ui.pause.stat.towerRange', 'Дальность стоек'), m.towerRangeMult);
    p(tWithFallback('ui.pause.stat.towerCost', 'Стоимость стоек'), m.towerCostMult);

    // Mannequin
    flat(tWithFallback('ui.pause.stat.maxHp', 'Макс. ХП'), mq.maxHp, 200);

    // Economy
    p(tWithFallback('ui.pause.stat.goldDrop', 'Золото с врагов'), m.goldDropMult);
    p(tWithFallback('ui.pause.stat.lootRadius', 'Радиус подбора'), m.lootRadiusMult);

    // Reaction damage
    p(tWithFallback('ui.pause.stat.reactionDamage', 'Урон реакций'), m.reactionDamageMult);

    // Meta stats
    if (state.metaCritChance > 0) {
      lines.push({
        label: tWithFallback('ui.pause.stat.critChance', 'Шанс крита'),
        value: `+${Math.round(state.metaCritChance * 100)}%`,
        kind: 'buff',
      });
    }
    if (state.metaArmorPen > 0) {
      lines.push({
        label: tWithFallback('ui.pause.stat.armorPen', 'Пробитие брони'),
        value: `+${Math.round(state.metaArmorPen * 100)}%`,
        kind: 'buff',
      });
    }
    if (state.metaMannequinArmor > 0) {
      lines.push({
        label: tWithFallback('ui.pause.stat.armor', 'Броня'),
        value: `+${state.metaMannequinArmor}`,
        kind: 'buff',
      });
    }

    return lines;
  }

  private enemyStats(state: GameState): StatLine[] {
    const dm = state.difficultyModifier;
    const lines: StatLine[] = [];

    const addEnemy = (label: string, mult: number) => {
      const pct = Math.round((mult - 1) * 100);
      if (pct === 0) return;
      const sign = pct >= 0 ? '+' : '';
      lines.push({
        label,
        value: `${sign}${pct}%`,
        kind: pct > 0 ? 'debuff' : 'buff',
      });
    };

    addEnemy(tWithFallback('ui.pause.stat.enemyHp', 'ХП врагов'), dm.hpMult);
    addEnemy(tWithFallback('ui.pause.stat.enemySpeed', 'Скорость врагов'), dm.speedMult);
    addEnemy(tWithFallback('ui.pause.stat.enemyDamage', 'Урон врагов'), dm.damageMult);

    // Gold mult from difficulty (inverse — higher = more gold = good)
    if (Math.abs(dm.goldMult - 1) > 0.001) {
      const pct = Math.round((dm.goldMult - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      lines.push({
        label: tWithFallback('ui.pause.stat.goldMult', 'Золото (режим)'),
        value: `${sign}${pct}%`,
        kind: pct >= 0 ? 'buff' : 'debuff',
      });
    }

    // Abilities from difficulty
    if (dm.abilities.length > 0) {
      for (const ab of dm.abilities) {
        lines.push({
          label: abilityLabel(ab),
          value: '✦',
          kind: 'debuff',
        });
      }
    }

    return lines;
  }

  private uniqueEffects(state: GameState): StatLine[] {
    const m = state.modifiers;
    const lines: StatLine[] = [];

    const picked = state.cardChoice.pickedIds;
    for (const id of picked) {
      const card = CARDS.find((c) => c.id === id);
      if (!card || !card.isCursed) continue;
      lines.push({
        label: cardName(card),
        value: '✦',
        kind: 'unique',
      });
    }

    // Boolean modifiers that come from unique effects — now with descriptions
    if (m.potionLeavesFire) lines.push({ label: tWithFallback('ui.pause.effect.fire', 'Горящая лужа'), desc: tWithFallback('ui.pause.effect.fire.desc', 'Склянки оставляют огненную лужу (8 ур/с, 3 с)'), value: '●', kind: 'unique' });
    if (m.potionFrostActive) lines.push({ label: tWithFallback('ui.pause.effect.frost', 'Стихия Мороза'), desc: tWithFallback('ui.pause.effect.frost.desc', 'Склянки наносят урон холодом и замедляют врагов'), value: '●', kind: 'unique' });
    if (m.potionAcidActive) lines.push({ label: tWithFallback('ui.pause.effect.acid', 'Стихия Кислоты'), desc: tWithFallback('ui.pause.effect.acid.desc', 'Склянки снижают броню цели на 50% на 4 сек'), value: '●', kind: 'unique' });
    if (m.potionMercuryActive) lines.push({ label: tWithFallback('ui.pause.effect.mercury', 'Стихия Ртути'), desc: tWithFallback('ui.pause.effect.mercury.desc', 'Склянки замедляют врагов ртутью'), value: '●', kind: 'unique' });
    if (m.potionAetherActive) lines.push({ label: tWithFallback('ui.pause.effect.aether', 'Стихия Эфира'), desc: tWithFallback('ui.pause.effect.aether.desc', 'Склянки наносят урон эфиром и запускают реакции'), value: '●', kind: 'unique' });
    if (m.potionPoisonActive) lines.push({ label: tWithFallback('ui.pause.effect.poison', 'Отравление'), desc: tWithFallback('ui.pause.effect.poison.desc', 'Склянки отравляют цели (4 ур/с, 5 с, игнор брони)'), value: '●', kind: 'unique' });
    if (m.towerBonusVsBurning) lines.push({ label: tWithFallback('ui.pause.effect.crossfire', '+30% урона горящим'), desc: tWithFallback('ui.pause.effect.crossfire.desc', 'Стойки наносят +30% урона горящим врагам'), value: '●', kind: 'unique' });
    if (m.towerMercurySlow) lines.push({ label: tWithFallback('ui.pause.effect.mercSlow', 'Ртутное замедление'), desc: tWithFallback('ui.pause.effect.mercSlow.desc', 'Стойки замедляют врагов на 20%'), value: '●', kind: 'unique' });
    if (m.towerAcidBreak) lines.push({ label: tWithFallback('ui.pause.effect.acidBreak', 'Кислотный слом'), desc: tWithFallback('ui.pause.effect.acidBreak.desc', 'Попадания стоек снижают броню цели на 15%'), value: '●', kind: 'unique' });
    if (m.towerSyncVolley) lines.push({ label: tWithFallback('ui.pause.effect.syncVolley', 'Синхронный залп'), desc: tWithFallback('ui.pause.effect.syncVolley.desc', 'Каждую 4-ю атаку стойка стреляет дважды'), value: '●', kind: 'unique' });
    if (m.thornyShell) lines.push({ label: tWithFallback('ui.pause.effect.thorns', 'Шипастая оболочка'), desc: tWithFallback('ui.pause.effect.thorns.desc', '+8 урон в ответ при касании Манекена'), value: '●', kind: 'unique' });
    if (m.vitalPulseRegen) lines.push({ label: tWithFallback('ui.pause.effect.regen', 'Регенерация ХП'), desc: tWithFallback('ui.pause.effect.regen.desc', '+1 ХП/сек регенерация во время волн'), value: '●', kind: 'unique' });
    if (m.tripleThrowActive) lines.push({ label: tWithFallback('ui.pause.effect.triple', 'Тройной бросок'), desc: tWithFallback('ui.pause.effect.triple.desc', 'Веер из 3 склянок каждые N секунд'), value: `${m.tripleThrowInterval}с`, kind: 'unique' });
    if (m.salamanderActive) lines.push({ label: tWithFallback('ui.pause.effect.salamander', 'Саламандра'), desc: tWithFallback('ui.pause.effect.salamander.desc', 'Все склянки поджигают и оставляют лужу'), value: '●', kind: 'unique' });
    if (m.archmasterActive) lines.push({ label: tWithFallback('ui.pause.effect.archmaster', 'Архимастер'), desc: tWithFallback('ui.pause.effect.archmaster.desc', '+1 стартовый уровень каждой новой стойке'), value: '●', kind: 'unique' });
    if (m.fireRubyActive || m.fireRubyCounter > 0) lines.push({ label: tWithFallback('ui.pause.effect.fireRuby', 'Огненный рубин'), desc: tWithFallback('ui.pause.effect.fireRuby.desc', 'Каждая 5-я склянка поджигает цели'), value: `${m.fireRubyCounter}`, kind: 'unique' });
    if (m.mercuryRingActive) lines.push({ label: tWithFallback('ui.pause.effect.mercRing', 'Ртутный обруч'), desc: tWithFallback('ui.pause.effect.mercRing.desc', '−40% скорость врагов рядом с Манекеном'), value: '●', kind: 'unique' });
    if (m.aetherEngineActive) lines.push({ label: tWithFallback('ui.pause.effect.aetherEngine', 'Эфирный двигатель'), desc: tWithFallback('ui.pause.effect.aetherEngine.desc', '+15 заряд Перегруза за каждую реакцию'), value: '●', kind: 'unique' });

    return lines;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DOM builders
  // ═══════════════════════════════════════════════════════════════════════════

  private buildSection(title: string, lines: StatLine[], uniqueSection = false): HTMLElement {
    const section = document.createElement('div');
    section.className = 'ps-section';
    if (uniqueSection) section.classList.add('ps-unique');
    const h = document.createElement('h3');
    h.className = 'ps-section-title';
    h.textContent = title;
    section.appendChild(h);

    if (lines.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ps-empty';
      empty.textContent = '—';
      section.appendChild(empty);
      return section;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const row = document.createElement('div');
      row.className = `ps-row ps-${line.kind}`;
      const val = document.createElement('span');
      val.className = 'ps-value';
      val.textContent = line.value;
      row.appendChild(val);
      const lab = document.createElement('span');
      lab.className = 'ps-label';
      lab.textContent = line.label;
      row.appendChild(lab);
      section.appendChild(row);
      // Render description below unique effect labels
      if (uniqueSection && line.desc) {
        const descRow = document.createElement('div');
        descRow.className = 'ps-row ps-unique-desc';
        descRow.textContent = line.desc;
        section.appendChild(descRow);
      }
      // Add visual separator between unique effects (not after last)
      if (uniqueSection && i < lines.length - 1) {
        const sep = document.createElement('div');
        sep.className = 'ps-unique-sep';
        section.appendChild(sep);
      }
    }
    return section;
  }
}

interface StatLine {
  label: string;
  value: string;
  kind: 'buff' | 'debuff' | 'unique';
  /** Optional description shown below the label for unique effects. */
  desc?: string;
}

function abilityLabel(ab: string): string {
  switch (ab) {
    case 'split_on_death': return tWithFallback('ui.pause.ability.split', 'Деление при смерти');
    case 'dash_back_on_hit': return tWithFallback('ui.pause.ability.dash', 'Рывок назад при ударе');
    case 'one_hit_shield': return tWithFallback('ui.pause.ability.shield', 'Одноразовый щит');
    case 'explode_on_death': return tWithFallback('ui.pause.ability.explode', 'Взрыв при смерти');
    default: return ab;
  }
}
