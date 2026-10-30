import { config, SkinDef } from '../config';
import { POWER_ICONS, SOUND_OFF, SOUND_ON } from './icons';
import type { ActivePower } from '../world/PowerUps';
import type { MissionView } from '../game/Missions';
import type { RankEntry } from '../net/Ranking';

const T = config.texts;

export interface UIHandlers {
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onShare: () => void;
  onToggleMute: () => void;
  onFeriado: () => void;
  onOpenSkins: () => void;
  onOpenMissions: () => void;
  onBack: () => void;
  onSkin: (id: string) => void;
  onClick: () => void;
  onOpenRanking: () => void;
  onRankingJoin: (raw: string) => void;
  onRankingChange: () => void;
}

export type Screen = 'menu' | 'playing' | 'paused' | 'caught' | 'gameover' | 'skins' | 'missions' | 'ranking';

export interface GameOverInfo {
  score: number;
  meters: number;
  coins: number;
  bestScore: number;
  isNewBest: boolean;
}

const fmt = (n: number): string => Math.floor(n).toLocaleString('es-UY');
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** HUD y menús en HTML/CSS superpuestos al canvas. */
export class UI {
  private root: HTMLElement;
  private hud: HTMLElement;
  private screens: Record<Exclude<Screen, 'playing' | 'caught'>, HTMLElement>;
  private bubble: HTMLElement;
  private bubbleText: string | null = null;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  private noticeEl: HTMLElement;
  private noticeTimer = 0;
  private powersEl: HTMLElement;
  private feriadoBtn: HTMLButtonElement;
  private hudCache = { score: -1, meters: -1, coins: -1, mult: -1 };

  constructor(root: HTMLElement, h: UIHandlers) {
    this.root = root;
    const isTouch = matchMedia('(pointer: coarse)').matches;

    // ---------- HUD ----------
    this.hud = this.el('div', 'hud');
    this.hud.innerHTML = `
      <div class="hud-stats">
        <div class="hud-pill score"><span data-id="score">0</span><b class="mult" data-id="mult">x2</b></div>
        <div class="hud-row">
          <div class="hud-pill small"><span data-id="meters">0</span><small>${T.meters}</small></div>
          <div class="hud-pill small coins"><span class="coin-dot"></span><span data-id="coins">0</span></div>
        </div>
      </div>
      <div class="hud-clock" data-id="clock"></div>
      <div class="hud-right">
        <button class="hud-pause" data-act="pause" aria-label="${T.pause}">❚❚</button>
        <div class="hud-powers" data-id="powers"></div>
        <button class="feriado-btn" data-act="feriado" aria-label="${T.feriadoButton}">
          ${POWER_ICONS.feriado}<span>${T.feriadoButton}</span><small>${isTouch ? 'Doble tap' : 'E'}</small>
        </button>
      </div>`;
    this.powersEl = this.q(this.hud, 'powers');
    this.feriadoBtn = this.hud.querySelector('.feriado-btn')!;

    this.bubble = this.el('div', 'bubble');
    this.toastEl = this.el('div', 'zone-toast');
    this.noticeEl = this.el('div', 'notice');

    // ---------- Menú ----------
    const menu = this.panel('menu');
    menu.innerHTML = `
<div class="brand-head">
        <img class="brand-logo" src="${config.brand.logoWhiteUrl}" alt="MBC">
        <h1 class="title"><img class="title-img" src="${config.brand.titleImage}" alt="${T.title}" onerror="this.replaceWith(this.alt)"></h1>
      </div>
      <div class="menu-bottom">
        <button class="btn primary" data-act="play">${T.play}</button>
        <div class="menu-stats">
          <span>${T.best}: <b data-id="best">0</b></span>
          <span class="coins"><span class="coin-dot"></span><b data-id="total">0</b></span>
        </div>
        <div class="menu-row">
          <button class="btn small" data-act="skins">${T.skins}</button>
          <button class="btn small" data-act="missions">${T.missions}</button>
          <button class="btn small" data-act="ranking">${T.ranking}</button>
          <button class="btn icon" data-act="mute" aria-label="${T.sound}"></button>
        </div>
        <p class="hint">${isTouch ? T.controlsMobile : T.controlsDesktop}</p>
      </div>
      <footer class="legal">${config.brand.legalText}</footer>`;

    // ---------- Pausa ----------
    const pause = this.panel('pause');
    pause.innerHTML = `
      <h2>${T.pause}</h2>
      <button class="btn primary" data-act="resume">${T.resume}</button>
      <button class="btn" data-act="restart">${T.restart}</button>
      <button class="btn" data-act="menu">${T.menu}</button>
      <button class="btn icon" data-act="mute" aria-label="${T.sound}"></button>`;

    // ---------- Game over ----------
    const over = this.panel('gameover');
    over.innerHTML = `
      <div class="calendar-sheet"><div class="ring"></div><div class="ring"></div>
        <div class="sheet-day">LUNES</div>
        <h2>${T.gameOver}</h2>
        <p class="big-score" data-id="score"></p>
        <p class="stats" data-id="stats"></p>
        <p class="muted" data-id="best"></p>
        <p class="rank-line" data-id="rank"></p>
        <div class="confetti" data-id="confetti"></div>
      </div>
      <button class="btn small rank-cta" data-act="ranking" data-id="rankCta">${T.rankingCta}</button>
      <button class="btn primary" data-act="restart">${T.rematch}</button>
      <div class="menu-row">
        <button class="btn small" data-act="share">${T.share}</button>
        <button class="btn small" data-act="menu">${T.menu}</button>
      </div>`;

    // ---------- Skins ----------
    const skins = this.panel('skins');
    skins.innerHTML = `
      <h2>${T.skins}</h2>
      <p class="wallet"><span class="coin-dot"></span><b data-id="total">0</b> ${T.coins}</p>
      <div class="skin-list" data-id="list"></div>
      <button class="btn" data-act="back">${T.back}</button>`;

    // ---------- Misiones ----------
    const missions = this.panel('missions');
    missions.innerHTML = `
      <h2>${T.missionsTitle}</h2>
      <div class="mission-list" data-id="list"></div>
      <p class="hint">${T.missionsHint} · +${config.missions.reward} ${T.coins} c/u</p>
      <button class="btn" data-act="back">${T.back}</button>`;

    // ---------- Ranking ----------
    const ranking = this.panel('ranking');
    ranking.innerHTML = `
      <h2>${T.ranking}</h2>
      <form class="rank-join" data-id="join" novalidate>
        <label for="rank-ig">${T.rankingJoin}</label>
        <div class="rank-input"><span>@</span><input id="rank-ig" data-id="ig" maxlength="80" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="${T.rankingPlaceholder}"></div>
        <button class="btn small primary" type="submit">${T.rankingSave}</button>
        <small>${T.rankingPublic}</small>
        <p class="rank-msg" data-id="joinMsg"></p>
      </form>
      <p class="rank-me" data-id="me"></p>
      <p class="hint" data-id="status"></p>
      <ol class="rank-list" data-id="list"></ol>
      <button class="btn" data-act="back">${T.back}</button>`;
    ranking.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      h.onClick();
      h.onRankingJoin((this.q(ranking, 'ig') as HTMLInputElement).value);
    });

    this.screens = { menu, paused: pause, gameover: over, skins, missions, ranking };

    const acts: Record<string, () => void> = {
      play: h.onPlay,
      pause: h.onPause,
      resume: h.onResume,
      restart: h.onRestart,
      menu: h.onMenu,
      share: h.onShare,
      mute: h.onToggleMute,
      feriado: h.onFeriado,
      skins: h.onOpenSkins,
      missions: h.onOpenMissions,
      back: h.onBack,
      ranking: h.onOpenRanking,
      rankChange: h.onRankingChange,
    };
    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-skin]');
      if (!btn) return;
      if (btn.dataset.act !== 'feriado' && btn.dataset.act !== 'pause') h.onClick();
      if (btn.dataset.skin) h.onSkin(btn.dataset.skin);
      else acts[btn.dataset.act!]?.();
    });
  }

  show(screen: Screen): void {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('visible', k === screen);
    this.hud.classList.toggle('visible', screen === 'playing' || screen === 'paused' || screen === 'caught');
  }

  setMuted(m: boolean): void {
    this.root.querySelectorAll<HTMLElement>('[data-act="mute"]').forEach((b) => (b.innerHTML = m ? SOUND_OFF : SOUND_ON));
  }

  setMenuStats(bestScore: number, coinsTotal: number): void {
    this.q(this.screens.menu, 'best').textContent = fmt(bestScore);
    this.q(this.screens.menu, 'total').textContent = fmt(coinsTotal);
    this.q(this.screens.skins, 'total').textContent = fmt(coinsTotal);
  }

  updateHud(score: number, meters: number, coins: number, mult: number): void {
    const c = this.hudCache;
    if (Math.floor(score) !== c.score) this.q(this.hud, 'score').textContent = fmt((c.score = Math.floor(score)));
    if (Math.floor(meters) !== c.meters) this.q(this.hud, 'meters').textContent = String((c.meters = Math.floor(meters)));
    if (coins !== c.coins) {
      this.q(this.hud, 'coins').textContent = String((c.coins = coins));
      // Rebote del contador al juntar
      const pill = this.hud.querySelector<HTMLElement>('.hud-pill.coins')!;
      pill.classList.remove('bump');
      void pill.offsetWidth;
      if (coins > 0) pill.classList.add('bump');
    }
    if (mult !== c.mult) {
      c.mult = mult;
      const m = this.q(this.hud, 'mult');
      m.textContent = `x${mult}`;
      m.classList.toggle('visible', mult > 1);
    }
  }

  /** Power-ups activos con barra de duración y el Feriado guardado. */
  setPowerups(list: ActivePower[], stored: boolean, shield: boolean): void {
    const key = list.map((p) => p.type).join(',');
    if (this.powersEl.dataset.key !== key) {
      this.powersEl.dataset.key = key;
      this.powersEl.innerHTML = list
        .map(
          (p) => `<div class="power" data-type="${p.type}" style="--c:${config.powerups.colors[p.type]}">
            ${POWER_ICONS[p.type]}<div class="bar"><i></i></div></div>`,
        )
        .join('');
    }
    for (const p of list) {
      const bar = this.powersEl.querySelector<HTMLElement>(`[data-type="${p.type}"] i`);
      if (bar) bar.style.transform = `scaleX(${p.remaining / p.total})`;
    }
    this.feriadoBtn.classList.toggle('visible', stored);
    this.hud.classList.toggle('shielded', shield);
  }

  setClock(text: string): void {
    this.q(this.hud, 'clock').textContent = text;
  }

  /** Cartel con el nombre de la zona al entrar. */
  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('visible');
    void this.toastEl.offsetWidth; // reinicia la animación
    this.toastEl.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), 2200);
  }

  /** Aviso chiquito abajo (misión cumplida, power-up, copiado...). */
  notice(text: string, ms = 2400): void {
    this.noticeEl.textContent = text;
    this.noticeEl.classList.add('visible');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => this.noticeEl.classList.remove('visible'), ms);
  }

  /** Globo de diálogo del Lunes en (x, y) de pantalla; null lo esconde. */
  setBubble(text: string | null, x = 0, y = 0): void {
    if (text !== this.bubbleText) {
      this.bubbleText = text;
      this.bubble.textContent = text ?? '';
      this.bubble.classList.toggle('visible', text !== null);
    }
    if (text === null) return;
    // Que no se salga de la pantalla
    const w = this.bubble.offsetWidth;
    const cx = Math.min(window.innerWidth - w / 2 - 12, Math.max(w / 2 + 12, x));
    const cy = Math.min(window.innerHeight - 140, Math.max(90, y));
    this.bubble.style.transform = `translate(${cx - w / 2}px, ${cy - this.bubble.offsetHeight - 14}px)`;
  }

  showGameOver(r: GameOverInfo): void {
    const s = this.screens.gameover;
    this.q(s, 'score').textContent = `${fmt(r.score)} ${T.score}`;
    this.q(s, 'stats').textContent = `${fmt(r.meters)} ${T.meters} · ${r.coins} ${T.coins}`;
    const best = this.q(s, 'best');
    best.textContent = r.isNewBest ? `🎉 ${T.newBest}` : `${T.best}: ${fmt(r.bestScore)}`;
    best.classList.toggle('new-best', r.isNewBest);
    // Festejo: papelitos de colores si hay récord nuevo
    const conf = this.q(s, 'confetti');
    conf.innerHTML = '';
    if (r.isNewBest) {
      const cols = ['#E63946', '#F2B134', '#7FC4E8', '#3E8E41', '#C8862B'];
      for (let i = 0; i < 40; i++) {
        const p = document.createElement('i');
        p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.4 + Math.random()}s`;
        conf.appendChild(p);
      }
    }
    this.show('gameover');
  }

  renderSkins(skins: SkinDef[], owned: string[], selected: string, total: number): void {
    const s = this.screens.skins;
    this.q(s, 'total').textContent = fmt(total);
    this.q(s, 'list').innerHTML = skins
      .map((k) => {
        const has = owned.includes(k.id);
        const sel = k.id === selected;
        const label = sel ? T.inUse : has ? T.use : `${T.buy} · ${fmt(k.price)}`;
        const cls = sel ? 'selected' : has ? '' : total >= k.price ? 'buyable' : 'locked';
        // Foto del producto real si la hay; si no, silueta CSS del envase
        const pic = k.thumb
          ? `<img class="thumb" src="${config.productsPath}${k.thumb}" alt="">`
          : `<span class="swatch ${k.shape}" style="--c:${k.color}"></span>`;
        return `<button class="skin-card ${cls}" data-skin="${k.id}">
          ${pic}
          <b>${k.name}</b><small>${label}</small></button>`;
      })
      .join('');
  }

  /** Debajo del resultado: el puesto en el ranking, o el botón para anotarse. */
  setGameOverRank(text: string, showCta: boolean): void {
    const s = this.screens.gameover;
    this.q(s, 'rank').textContent = text;
    this.q(s, 'rankCta').classList.toggle('visible', showCta);
  }

  /** Formulario para anotarse o "Jugás como @usuario". */
  setRankingUser(handle: string, msg = ''): void {
    const s = this.screens.ranking;
    this.q(s, 'join').classList.toggle('visible', !handle);
    const me = this.q(s, 'me');
    me.classList.toggle('visible', Boolean(handle));
    me.innerHTML = handle ? `${T.rankingYou} <b>@${esc(handle)}</b> <button class="link" data-act="rankChange">${T.rankingChange}</button>` : '';
    this.q(s, 'joinMsg').textContent = msg;
  }

  setRankingStatus(text: string): void {
    this.q(this.screens.ranking, 'status').textContent = text;
  }

  renderRanking(list: RankEntry[], me: string): void {
    this.q(this.screens.ranking, 'list').innerHTML = list
      .map(
        (r, i) => `<li class="${r.handle === me ? 'me' : ''} ${i > 0 && r.pos > list[i - 1].pos + 1 ? 'gap' : ''}">
          <span class="pos">${r.pos}</span><b>@${esc(r.handle)}</b><span class="pts">${fmt(r.score)}</span></li>`,
      )
      .join('');
  }

  renderMissions(list: MissionView[]): void {
    this.q(this.screens.missions, 'list').innerHTML = list
      .map(
        (m) => `<div class="mission ${m.done ? 'done' : ''}">
          <span class="check">${m.done ? '✓' : ''}</span>
          <div><b>${m.text}</b><div class="bar"><i style="transform:scaleX(${m.progress / m.target})"></i></div></div>
          <small>${m.progress}/${m.target}</small></div>`,
      )
      .join('');
  }

  private el(tag: string, cls: string): HTMLElement {
    const e = document.createElement(tag);
    e.className = cls;
    this.root.appendChild(e);
    return e;
  }

  private panel(name: string): HTMLElement {
    return this.el('div', `screen screen-${name}`);
  }

  private q(parent: HTMLElement, id: string): HTMLElement {
    return parent.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
  }
}
