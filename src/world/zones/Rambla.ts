import type { ZoneDef } from './Zone';

/** Rambla: murito de un lado y el río del otro, pescadores, faro y el Cerro en el horizonte. */
export const Rambla: ZoneDef = {
  id: 'rambla',
  road: 'asphalt',
  sidewalk: '#C9BFAE',
  horizon: { id: 'cerro', x: -150, z: -250, rotY: 0.5 },
  decorate(c) {
    c.sides([{ kind: 'concrete', width: 0.9 }, { kind: 'water', width: 220, y: -0.7 }], [{ kind: 'concrete', width: 80 }]);
    // Murito continuo y pescadores sentados arriba
    c.row('muro', -1, -(c.edge + 0.45), 6, { offset: 3 });
    for (let i = 0; i < 2; i++) if (c.rnd() < 0.7) c.prop('pescador', -(c.edge + 0.45), 1.05, -5 - c.rnd() * (c.L - 10), 0);
    if (c.local === 6) c.landmark('faro', -1, -c.L / 2, 9);
    c.row('farol', -1, -(c.edge - 0.5), 18, { offset: 4 });
    c.row('palmera', 1, c.roadHalf + 1.2, 12, { offset: 6, jitter: 1 });
    if (c.local === 1) c.billboard(1, -c.L / 2);
    c.street(1, ['apartment', 'apartment', 'colonial'], 3);
  },
};
