import { t } from '../i18n';

const POLICY_SECTIONS = [
  {
    title: 'ui.privacy.data.title',
    body: 'ui.privacy.data.body',
  },
  {
    title: 'ui.privacy.use.title',
    body: 'ui.privacy.use.body',
  },
  {
    title: 'ui.privacy.storage.title',
    body: 'ui.privacy.storage.body',
  },
  {
    title: 'ui.privacy.visibility.title',
    body: 'ui.privacy.visibility.body',
  },
  {
    title: 'ui.privacy.choices.title',
    body: 'ui.privacy.choices.body',
  },
] as const;

export class PrivacyPolicyOverlay {
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(onAccept: () => void): void {
    this.root.innerHTML = '';
    this.root.classList.remove('cards-mode', 'cursed-mode');
    this.root.classList.add('privacy-policy-mode');

    const panel = document.createElement('section');
    panel.className = 'panel privacy-policy-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'privacy-policy-title');

    const header = document.createElement('header');
    header.className = 'privacy-policy-header';

    const seal = document.createElement('div');
    seal.className = 'privacy-policy-seal';
    seal.setAttribute('aria-hidden', 'true');
    seal.textContent = 'PP';

    const heading = document.createElement('div');
    heading.className = 'privacy-policy-heading';
    const title = document.createElement('h2');
    title.id = 'privacy-policy-title';
    title.textContent = t('ui.privacy.title');
    const subtitle = document.createElement('p');
    subtitle.textContent = t('ui.privacy.subtitle');
    heading.append(title, subtitle);
    header.append(seal, heading);
    panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'privacy-policy-body';

    const effective = document.createElement('p');
    effective.className = 'privacy-policy-effective';
    effective.textContent = t('ui.privacy.effective');
    body.appendChild(effective);

    const intro = document.createElement('p');
    intro.className = 'privacy-policy-intro';
    intro.textContent = t('ui.privacy.intro');
    body.appendChild(intro);

    for (const sectionDef of POLICY_SECTIONS) {
      const section = document.createElement('section');
      section.className = 'privacy-policy-section';
      const sectionTitle = document.createElement('h3');
      sectionTitle.textContent = t(sectionDef.title);
      const sectionBody = document.createElement('p');
      sectionBody.textContent = t(sectionDef.body);
      section.append(sectionTitle, sectionBody);
      body.appendChild(section);
    }
    panel.appendChild(body);

    const footer = document.createElement('footer');
    footer.className = 'privacy-policy-footer';
    const acknowledgement = document.createElement('p');
    acknowledgement.textContent = t('ui.privacy.acknowledgement');
    const accept = document.createElement('button');
    accept.className = 'privacy-policy-accept';
    accept.type = 'button';
    accept.textContent = t('ui.privacy.accept');
    accept.addEventListener('click', () => {
      accept.disabled = true;
      onAccept();
    }, { once: true });
    footer.append(acknowledgement, accept);
    panel.appendChild(footer);

    this.root.appendChild(panel);
    this.root.classList.add('visible');
    window.requestAnimationFrame(() => accept.focus());
  }

  hide(): void {
    this.root.classList.remove('visible', 'privacy-policy-mode');
    this.root.innerHTML = '';
  }
}
