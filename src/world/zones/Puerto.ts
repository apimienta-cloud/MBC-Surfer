import type { ZoneDef } from './Zone';

const CONTAINERS = ['#C8402F', '#2F6DB5', '#3E8E41', '#F26B1D', '#7A8288', '#B98B2C'] as const;

/** Puerto / Aguada: grúas, contenedores, depósitos y la Torre de Antel. */
export const Puerto: ZoneDef = {
  id: 'puerto',
  road: 'asphalt',
  sidewalk: '#ADA697',
  horizon: { id: 'torreAntel', x: -70, z: -250, rotY: 0.5 },
  decorate(c) {
    c.sides([{ kind: 'lot', width: 46 }, { kind: 'water', width: 220, y: -1 }], [{ kind: 'concrete', width: 80 }]);
    // Pilas de contenedores en el playón
    for (let i = 0; i < 6; i++) {
      const x = -(c.edge + 6 + c.rnd() * 30);
      const z = -6 - c.rnd() * (c.L - 12);
      const stack = 1 + Math.floor(c.rnd() * 3);
      for (let h = 0; h < stack; h++) c.prop('contenedor', x, h * 2.6, z, 0, 1, c.pick(CONTAINERS));
    }
    if (c.local % 4 === 2) c.landmark('grua', -1, -c.L / 2, 4);
    if (c.local === 7) c.landmark('torreAntel', 1, -c.L / 2, 6);
    c.street(1, ['warehouse', 'warehouse', 'office'], 2);
    c.row('farol', 1, c.roadHalf + 0.5, 20);
    c.row('farol', -1, -(c.roadHalf + 0.5), 20, { offset: 10 });
  },
};
