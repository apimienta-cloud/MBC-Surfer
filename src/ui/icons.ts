import type { PowerUpType } from '../config';

// Íconos SVG simples para el HUD (originales, sin marcas)

export const POWER_ICONS: Record<PowerUpType, string> = {
  // Hoja de calendario tachada
  feriado: `<svg viewBox="0 0 32 32"><rect x="5" y="6" width="22" height="22" rx="3" fill="#fff"/><rect x="5" y="6" width="22" height="7" rx="3" fill="#E63946"/><path d="M9 16l14 9M23 16L9 25" stroke="#E63946" stroke-width="3" stroke-linecap="round"/></svg>`,
  // Reloj con chopp
  happyHour: `<svg viewBox="0 0 32 32"><circle cx="13" cy="14" r="10" fill="#fff" stroke="#1E3A5F" stroke-width="2.5"/><path d="M13 8v6h5" stroke="#1E3A5F" stroke-width="2.5" fill="none" stroke-linecap="round"/><rect x="20" y="18" width="8" height="11" rx="2" fill="#F2B134"/><ellipse cx="24" cy="18" rx="4.5" ry="2.5" fill="#FFF8E7"/></svg>`,
  // Dos choppitos
  choppDoble: `<svg viewBox="0 0 32 32"><rect x="4" y="11" width="10" height="16" rx="2" fill="#F2B134"/><ellipse cx="9" cy="11" rx="5.5" ry="3" fill="#FFF8E7"/><rect x="17" y="9" width="10" height="16" rx="2" fill="#F2B134"/><ellipse cx="22" cy="9" rx="5.5" ry="3" fill="#FFF8E7"/></svg>`,
  // Tapita con alitas
  tapitaTurbo: `<svg viewBox="0 0 32 32"><path d="M2 12c4-2 7-1 9 2M3 17c3-1 6-1 8 1M30 12c-4-2-7-1-9 2M29 17c-3-1-6-1-8 1" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="16" cy="16" r="7" fill="#F2B134" stroke="#C88A12" stroke-width="2" stroke-dasharray="2 1.5"/></svg>`,
};

export const SOUND_ON = `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
export const SOUND_OFF = `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
