import { SHIRTS, TREE_GREENS, ZoneDef } from './Zone';

/**
 * Paseo MBC: la primera zona de cada vuelta. Calle con los locales de MBC (casa, galpón, escenario),
 * patios cerveceros, guirnaldas cruzando la calle, carteles redondos en poste y gigantografías.
 * El chunk -1 (detrás de la largada) es lo que se ve en el menú: la Casa MBC y el galpón.
 */
export const PaseoMBC: ZoneDef = {
  id: 'paseoMBC',
  road: 'asphalt',
  sidewalk: '#BEB3A3',
  decorate(c) {
    c.sides([{ kind: 'concrete', width: 80 }], [{ kind: 'concrete', width: 80 }]);
    const mid = -c.L / 2;
    const l = c.local;

    if (l < 0) {
      // Fondo del menú: la birra arranca frente a la Casa MBC
      c.landmark('casaMBC', 1, mid + 6, 2);
      c.landmark('galponMBC', -1, mid, 2);
    } else {
      // Los locales se van alternando de lado a lo largo de la zona
      const venues = ['patioMBC', 'escenarioMBC', 'patioMBC', 'galponMBC', 'patioMBC', 'casaMBC'] as const;
      const v = venues[l % venues.length];
      const side = l % 2 ? 1 : -1;
      const angle = v === 'patioMBC' ? 0 : 0.25;
      c.landmark(v, side, mid, v === 'patioMBC' ? 1 : 3, angle);
      // Del otro lado: gigantografía cada dos chunks
      if (l % 2 === 0) c.billboard(side === 1 ? -1 : 1, mid + 12);
    }

    // Guirnaldas cruzando la calle y carteles redondos en poste en las veredas
    c.row('guirnalda', -1, 0, 15, { offset: 7 });
    c.row('cartelMBC', -1, -(c.edge - 0.4), 30, { offset: 4 });
    c.row('cartelMBC', 1, c.edge - 0.4, 30, { offset: 19 });
    // Mucha gente en las veredas, yendo y viniendo de los locales
    c.row('persona', -1, -(c.edge - 1.0), 5, { colors: SHIRTS, jitter: 1.6 });
    c.row('persona', 1, c.edge - 1.0, 5, { offset: 2.5, colors: SHIRTS, jitter: 1.6 });
    c.row('arbol', -1, -(c.roadHalf + 1.4), 20, { offset: 12, colors: TREE_GREENS, scale: 0.8 });
    c.row('arbol', 1, c.roadHalf + 1.4, 20, { offset: 2, colors: TREE_GREENS, scale: 0.8 });

    // El resto de la cuadra: casonas blancas y galpones de chapa
    c.street(-1, ['colonial', 'corten', 'colonial']);
    c.street(1, ['corten', 'colonial', 'colonial']);
  },
};
