import { TREE_GREENS, ZoneDef } from './Zone';

/** 18 de Julio / Centro: avenida con edificios altos, Intendencia, Fuente de los Candados y el Legislativo al fondo. */
export const Centro: ZoneDef = {
  id: 'centro',
  road: 'asphalt',
  sidewalk: '#BDB4A6',
  horizon: { id: 'palacioLegislativo', x: 0, z: -300, scale: 1.3 },
  decorate(c) {
    c.sides([{ kind: 'concrete', width: 80 }], [{ kind: 'concrete', width: 80 }]);
    if (c.local === 5) {
      c.landmark('palacioMunicipal', 1, -c.L / 2, 10, 0.2);
      c.landmark('fuenteCandados', 1, -c.L / 2 + 14, 1.2);
    }
    if (c.local === 2) c.billboard(1, -c.L / 2);
    if (c.local === 9) c.billboard(-1, -c.L / 2);
    c.street(-1, ['office', 'office', 'colonial']);
    c.street(1, ['office', 'colonial', 'office']);
    // Plátanos y faroles en las veredas
    c.row('arbol', -1, -(c.roadHalf + 1.4), 10, { colors: TREE_GREENS, scale: 0.8 });
    c.row('arbol', 1, c.roadHalf + 1.4, 10, { offset: 5, colors: TREE_GREENS, scale: 0.8 });
    c.row('farol', -1, -(c.roadHalf + 0.5), 20, { offset: 5 });
    c.row('farol', 1, c.roadHalf + 0.5, 20, { offset: 15 });
  },
};
