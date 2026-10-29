// Herramienta de desarrollo: saca capturas del juego en distintas distancias (para revisar zonas y landmarks).
// Uso en la consola con `npm run dev`:
//   const m = await import('/src/dev/snap.ts'); await m.grid([0, 900, 1800, 2600])
// Cada entrada puede ser una distancia o [distancia, x de la birra]. Para cerrar: m.close()

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyGame = any;

function game(): AnyGame {
  return (window as unknown as { __game: AnyGame }).__game;
}

/** Ubica la birra en `s` sin obstáculos cerca y devuelve la imagen renderizada. */
export function shot(s: number, x?: number): string {
  const g = game();
  g.start();
  g.state = 'playing';
  g.obstacles.reset();
  g.coins.reset();
  g.player.s = g.player.prevS = s;
  if (x !== undefined) g.player.x = x;
  g.obstacles.nextRowS = s + 25;
  g.chaser.pushAway();
  g.chaser.gap = 30;
  g.chunks.update(s);
  g.obstacles.generate(s + 240, s, 20);
  g.camBlend = 1;
  for (let i = 0; i < 90; i++) g.render(0.016);
  const url = g.renderer.domElement.toDataURL('image/jpeg', 0.8);
  g.state = 'paused';
  return url;
}

/** Hasta 4 capturas en una grilla 2x2 superpuesta a la pantalla. */
export async function grid(list: (number | [number, number])[]): Promise<string[]> {
  const g = game();
  const W = g.renderer.domElement.width / 2;
  const H = g.renderer.domElement.height / 2;
  const cv = document.createElement('canvas');
  cv.width = W * 2;
  cv.height = H * 2;
  const ctx = cv.getContext('2d')!;
  const labels: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const [s, x] = Array.isArray(list[i]) ? (list[i] as [number, number]) : [list[i] as number, undefined];
    const img = new Image();
    img.src = shot(s, x);
    await new Promise((r) => (img.onload = r));
    const label = `${g.zones.zoneAt(s).id} @${s}`;
    labels.push(label);
    ctx.drawImage(img, (i % 2) * W, Math.floor(i / 2) * H, W, H);
    ctx.fillStyle = '#000';
    ctx.font = '28px sans-serif';
    ctx.fillText(label, (i % 2) * W + 10, Math.floor(i / 2) * H + 34);
  }
  let el = document.getElementById('__snap') as HTMLImageElement | null;
  if (!el) {
    el = document.createElement('img');
    el.id = '__snap';
    el.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99;pointer-events:none';
    document.body.appendChild(el);
  }
  el.src = cv.toDataURL('image/jpeg', 0.85);
  return labels;
}

export function close(): void {
  document.getElementById('__snap')?.remove();
}
