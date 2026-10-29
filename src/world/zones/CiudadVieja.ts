import { SHIRTS, ZoneDef } from './Zone';

/** Ciudad Vieja: adoquines, calles angostas, faroles y casas coloniales. */
export const CiudadVieja: ZoneDef = {
  id: 'ciudadVieja',
  road: 'cobble',
  sidewalk: '#B9A88E',
  decorate(c) {
    c.sides([{ kind: 'concrete', width: 80 }], [{ kind: 'concrete', width: 80 }]);
    const mid = -c.L / 2;
    // Landmarks repartidos a lo largo de la zona
    if (c.local === 1) c.landmark('puertaCiudadela', -1, mid, 5, 0.35);
    if (c.local === 4) {
      c.landmark('palacioSalvo', 1, mid, 4);
      c.landmark('artigas', -1, mid, 3);
    }
    if (c.local === 7) c.landmark('teatroSolis', -1, mid, 5, 0.25);
    if (c.local === 10) c.landmark('mercadoPuerto', 1, mid, 4, 0.25);
    if (c.local === 1) c.billboard(1, -c.L / 2);
    if (c.local === 3) c.landmark('patioMBC', -1, mid, 1);
    c.row('persona', -1, -(c.edge - 0.9), 9, { colors: SHIRTS, jitter: 2 });
    c.row('persona', 1, c.edge - 0.9, 9, { offset: 4, colors: SHIRTS, jitter: 2 });
    c.street(-1, 'colonial');
    c.street(1, 'colonial');
    c.row('farol', -1, -(c.roadHalf + 0.5), 14);
    c.row('farol', 1, c.roadHalf + 0.5, 14, { offset: 7 });
  },
};
