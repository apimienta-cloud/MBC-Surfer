import { TREE_GREENS, ZoneDef } from './Zone';

/** Tres Cruces / Parque Batlle: árboles, explanada y el Estadio Centenario con la Torre de los Homenajes. */
export const TresCruces: ZoneDef = {
  id: 'tresCruces',
  road: 'asphalt',
  sidewalk: '#C4BBA8',
  decorate(c) {
    c.sides([{ kind: 'grass', width: 90 }], [{ kind: 'grass', width: 90 }]);
    const stadium = c.local === 6;
    if (c.local === 1) c.billboard(-1, -c.L / 2);
    if (stadium) c.landmark('centenario', 1, -c.L / 2, 4);
    // Parque: árboles desparramados (menos del lado del estadio)
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      if (stadium && side === 1) continue;
      const x = side * (c.edge + 2 + c.rnd() * 36);
      c.prop('arbol', x, 0, -c.rnd() * c.L, c.rnd() * 6, 0.9 + c.rnd() * 0.7, c.pick(TREE_GREENS));
    }
    c.row('arbol', -1, -(c.roadHalf + 1.4), 12, { colors: TREE_GREENS });
    if (!stadium) c.row('arbol', 1, c.roadHalf + 1.4, 12, { offset: 6, colors: TREE_GREENS });
    c.row('farol', 1, c.roadHalf + 0.5, 24, { offset: 12 });
    if (c.local % 4 === 1) c.street(-1, 'house', 30);
  },
};
