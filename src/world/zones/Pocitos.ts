import { AWNINGS, TREE_GREENS, ZoneDef } from './Zone';

/** Pocitos / Parque Rodó: edificios altos frente a la playa, sombrillas, letras de MONTEVIDEO y el castillito. */
export const Pocitos: ZoneDef = {
  id: 'pocitos',
  road: 'asphalt',
  sidewalk: '#D2C6B0',
  decorate(c) {
    const park = c.local >= 7 && c.local <= 9;
    c.sides([{ kind: 'sand', width: 28 }, { kind: 'water', width: 220, y: -0.4 }], [{ kind: park ? 'grass' : 'concrete', width: 80 }]);
    // Playa con sombrillas
    for (let i = 0; i < 7; i++) {
      c.prop('sombrilla', -(c.edge + 4 + c.rnd() * 20), 0, -c.rnd() * c.L, 0, 1, c.pick(AWNINGS));
    }
    if (c.local === 3) c.landmark('letrasMontevideo', -1, -c.L / 2, 9, 0.6);
    c.row('palmera', -1, -(c.edge - 0.6), 15, { offset: 5 });
    c.row('farol', 1, c.roadHalf + 0.5, 16);
    if (c.local === 1) c.billboard(1, -c.L / 2);
    // Casa MBC con su patio cervecero
    if (c.local === 5) c.landmark('casaMBC', 1, -c.L / 2, 3, 0.32);
    if (park) {
      // Parque Rodó: el castillito entre árboles y un escenario de MBC
      if (c.local === 8) c.landmark('castillito', 1, -c.L / 2, 7);
      if (c.local === 9) c.landmark('escenarioMBC', 1, -c.L / 2, 5, 0.35);
      for (let i = 0; i < 14; i++) {
        const z = -c.rnd() * c.L;
        if ((c.local === 8 || c.local === 9) && Math.abs(z + c.L / 2) < 10) continue;
        c.prop('arbol', c.edge + 3 + c.rnd() * 30, 0, z, c.rnd() * 6, 0.9 + c.rnd() * 0.5, c.pick(TREE_GREENS));
      }
    } else {
      // Antes de la Casa MBC, casas bajas para que la fachada se vea de lejos
      c.street(1, c.local === 4 ? 'house' : 'apartment', 2);
    }
  },
};
