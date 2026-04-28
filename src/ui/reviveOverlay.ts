import { t } from '../i18n';

export class ReviveOverlay {
  private root: HTMLElement;
  private visible = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    onRevive: () => void;
    onGiveUp: () => void;
  }): void {
    this.visible = true;
    this.root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'revive-overlay';

    const panel = document.createElement('div');
    panel.className = 'revive-panel';

    const title = document.createElement('div');
    title.className = 'revive-title';
    title.textContent = t('ui.revive.title');
    panel.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'revive-desc';
    desc.textContent = t('ui.revive.desc');
    panel.appendChild(desc);

    const reviveBtn = document.createElement('button');
    reviveBtn.className = 'revive-btn revive-ad';
    reviveBtn.innerHTML = `<span class="revive-ad-icon"></span>${t('ui.revive.adButton')}`;
    reviveBtn.addEventListener('click', () => {
      reviveBtn.disabled = true;
      giveUpBtn.disabled = true;
      opts.onRevive();
    });
    panel.appendChild(reviveBtn);

    const giveUpBtn = document.createElement('button');
    giveUpBtn.className = 'revive-btn revive-give-up';
    giveUpBtn.textContent = t('ui.revive.giveUp');
    giveUpBtn.addEventListener('click', () => {
      reviveBtn.disabled = true;
      giveUpBtn.disabled = true;
      opts.onGiveUp();
    });
    panel.appendChild(giveUpBtn);

    wrap.appendChild(panel);
    this.root.appendChild(wrap);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.visible = false;
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }

  isVisible(): boolean {
    return this.visible;
  }
}
