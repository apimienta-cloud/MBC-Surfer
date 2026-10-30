// Teclado + swipe. Las acciones se encolan y el Game las consume en cada paso fijo.

export type Action = 'left' | 'right' | 'jump' | 'roll' | 'feriado' | 'pause';

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'roll',
  KeyS: 'roll',
  KeyE: 'feriado',
  Escape: 'pause',
  KeyP: 'pause',
};

const SWIPE_MIN_PX = 28;
const DOUBLE_TAP_MS = 280;
const TAP_MAX_MOVE_PX = 12;

export class Input {
  private queue: Action[] = [];
  private touchId: number | null = null;
  private startX = 0;
  private startY = 0;
  private swiped = false;
  private lastTapAt = 0;
  /** Si es false, las acciones se descartan (menús). */
  enabled = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', this.onKey);
    target.addEventListener('touchstart', this.onTouchStart, { passive: false });
    target.addEventListener('touchmove', this.onTouchMove, { passive: false });
    target.addEventListener('touchend', this.onTouchEnd);
    target.addEventListener('touchcancel', this.onTouchEnd);
  }

  /** Devuelve y vacía las acciones pendientes. */
  drain(): Action[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  clear(): void {
    this.queue.length = 0;
  }

  private push(a: Action): void {
    if (this.enabled || a === 'pause') this.queue.push(a);
  }

  private onKey = (e: KeyboardEvent): void => {
    const a = KEYMAP[e.code];
    if (!a) return;
    // Escribiendo en un campo (usuario del ranking): las teclas no son del juego
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
    if (e.repeat && a !== 'pause') return;
    e.preventDefault();
    this.push(a);
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    this.touchId = t.identifier;
    this.startX = t.clientX;
    this.startY = t.clientY;
    this.swiped = false;
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    if (this.swiped) return;
    const t = this.findTouch(e.changedTouches);
    if (!t) return;
    const dx = t.clientX - this.startX;
    const dy = t.clientY - this.startY;
    // El swipe se dispara apenas pasa el umbral, sin esperar a levantar el dedo
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    this.swiped = true;
    if (Math.abs(dx) > Math.abs(dy)) this.push(dx > 0 ? 'right' : 'left');
    else this.push(dy > 0 ? 'roll' : 'jump');
  };

  private onTouchEnd = (e: TouchEvent): void => {
    const t = this.findTouch(e.changedTouches);
    if (!t) return;
    this.touchId = null;
    if (this.swiped) return;
    const moved = Math.hypot(t.clientX - this.startX, t.clientY - this.startY);
    if (moved > TAP_MAX_MOVE_PX) return;
    const now = performance.now();
    if (now - this.lastTapAt < DOUBLE_TAP_MS) {
      this.push('feriado');
      this.lastTapAt = 0;
    } else {
      this.lastTapAt = now;
    }
  };

  private findTouch(list: TouchList): Touch | null {
    for (let i = 0; i < list.length; i++) if (list[i].identifier === this.touchId) return list[i];
    return null;
  }
}
