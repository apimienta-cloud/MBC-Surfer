import { config } from '../../config';
import { AWNINGS, ZoneDef } from './Zone';

/** Tristán Narvaja: la feria del domingo, el último refugio antes del lunes. */
export const TristanNarvaja: ZoneDef = {
  id: 'tristanNarvaja',
  road: 'asphalt',
  sidewalk: '#BFB29C',
  decorate(c) {
    c.sides([{ kind: 'concrete', width: 80 }], [{ kind: 'concrete', width: 80 }]);
    if (c.local === 1) c.banner(config.texts.feriaBanner, -c.L / 2);
    // Puestos con toldos de colores en las dos veredas
    c.row('puestoFeria', -1, -(c.roadHalf + 1.7), 3.2, { colors: AWNINGS, jitter: 0.3 });
    c.row('puestoFeria', 1, c.roadHalf + 1.7, 3.2, { offset: 1.6, colors: AWNINGS, jitter: 0.3 });
    c.street(-1, ['colonial', 'colonial', 'house'], 1);
    c.street(1, ['colonial', 'house'], 1);
  },
};
