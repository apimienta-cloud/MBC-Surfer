import { config } from '../config';
import * as Save from '../storage/Save';

const T = config.texts;

/**
 * "¿Sos mayor de 18?" antes de mostrar el juego (si config.brand.ageGate está activo).
 * El "sí" se guarda para no preguntar cada vez; el "no" deja un mensaje amable y el juego no se carga.
 */
export function ageGate(root: HTMLElement): Promise<void> {
  if (!config.brand.ageGate) return Promise.resolve();
  const data = Save.load();
  if (data.ageOk) return Promise.resolve();

  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'screen screen-age visible';
    el.innerHTML = `
      <h1 class="title">${T.title}</h1>
      <div class="age-card">
        <h2>${T.ageQuestion}</h2>
        <div class="menu-row">
          <button class="btn primary" data-age="yes">${T.ageYes}</button>
          <button class="btn" data-age="no">${T.ageNo}</button>
        </div>
      </div>
      <footer class="legal">${config.brand.legalText}</footer>`;
    root.appendChild(el);
    el.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-age]');
      if (!btn) return;
      if (btn.dataset.age === 'yes') {
        data.ageOk = true;
        Save.save(data);
        el.remove();
        resolve();
      } else {
        el.querySelector('.age-card')!.innerHTML = `<p class="age-denied">${T.ageDenied}</p>`;
      }
    });
  });
}
