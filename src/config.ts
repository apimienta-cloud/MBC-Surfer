// Todo lo tuneable del juego vive acá: números, textos, colores y datos de marca.
// Unidades: metros, segundos, metros/segundo.

export type ObstacleKind = 'low' | 'high' | 'block' | 'bondi';
export type SkinShape = 'porron' | 'lata' | 'chopp' | 'litro';
export type PowerUpType = 'feriado' | 'happyHour' | 'choppDoble' | 'tapitaTurbo';
export type MissionStat = 'coins' | 'rolls' | 'jumps' | 'powerups' | 'roofs' | 'runMeters' | 'centenario';
export interface MissionDef {
  id: string;
  text: string; // {n} se reemplaza por el objetivo
  stat: MissionStat;
  target: number;
}
export type ZoneId = 'ciudadVieja' | 'rambla' | 'pocitos' | 'centro' | 'tresCruces' | 'puerto' | 'tristanNarvaja';

/** Variantes visuales de obstáculos (ver world/ObstacleModels.ts). */
export type ObstacleVariant =
  | 'contenedor' | 'cajon' | 'conitos' | 'mateTermo'
  | 'vallaElevada' | 'cartel' | 'gaviotas'
  | 'puesto' | 'chorizos' | 'vallaObra'
  | 'bondi';

interface ZoneObstacles {
  weights?: Partial<Record<ObstacleKind, number>>;
  variants: Record<Exclude<ObstacleKind, 'bondi'>, ObstacleVariant[]>;
}
export interface SkinDef {
  id: string;
  name: string;
  shape: SkinShape;
  price: number;
  color: string;
}

export const config = {
  brand: {
    name: 'MBC',
    // Si está en true se pregunta "¿Sos mayor de 18?" antes de mostrar el juego (el "sí" se recuerda)
    ageGate: true,
    legalText: 'Tomá con moderación. Prohibida su venta a menores de 18 años.',
    // Rutas relativas a public/. Si el archivo no existe se usa un placeholder neutro.
    logoUrl: 'assets/brand/mbc-logo.png',
    fichaUrl: 'assets/brand/ficha-mbc.png',
    // Fracción del lado corto de la imagen que se recorta (centrado) para la cara de la fichita.
    // El archivo actual es 1920x1080 con fondo naranja, así que un recorte cuadrado central alcanza.
    fichaCropScale: 0.95,
    // TODO(brand): confirmar hex oficiales de MBC. Si se cargan acá, tienen prioridad sobre la paleta.
    colors: {} as Partial<Record<keyof typeof palette, string>>,
  },

  lanes: {
    count: 3,
    width: 2.6,
    changeTime: 0.12, // tween de cambio de carril
  },

  player: {
    width: 0.8,
    depth: 0.7,
    height: 1.6,
    rollHeight: 0.75,
    gravity: 42,
    fastFallGravity: 150,
    jumpVelocity: 13.5,
    rollDuration: 0.65,
    inputBuffer: 0.15, // si saltás justo antes de aterrizar, salta igual
    stepUp: 0.35, // cuánto puede "subir" de golpe (rampas)
    stumbleCooldown: 0.6, // invulnerabilidad a tropiezos tras uno
  },

  speed: {
    start: 13,
    max: 30,
    // Distancia característica de la curva: speed = max - (max - start) * e^(-d / rampDistance)
    rampDistance: 2600,
  },

  chaser: {
    nearGap: 2.6, // distancia detrás de la birra cuando te está por agarrar
    farGap: 18, // fuera de cámara
    introTime: 3, // al arrancar está pegado y en ~3 s se queda atrás
    nearTime: 6, // tras un tropiezo se queda cerca ~6 s
    approachRate: 6, // suavizado del acercamiento/alejamiento
    // Tamaño del calendario (m)
    sideOffset: 1.4, // corrimiento lateral respecto a la birra mientras persigue
    sheetWidth: 1.7,
    sheetHeight: 1.75,
    legLength: 0.6,
    // 'auto' = el número del próximo lunes; o un número fijo
    dayNumber: 'auto' as 'auto' | number,
    // Globos de diálogo cuando está cerca
    bubbleTime: 2.2,
    bubbleCooldown: 1.0,
    // Animación de captura: alcanza, salta y cae arriba de la birra
    catchRunTime: 0.35,
    catchJumpTime: 0.6,
    catchJumpHeight: 3.2,
    catchHoldTime: 0.55,
    sheetParticlesPerSecond: 7,
  },

  birra: {
    legLength: 0.35,
    limbColor: '#3A2A1A',
    glovesColor: '#FFF8E7',
    lean: 0.14, // inclinación hacia adelante al correr
    runCycle: 2.4, // pasos por metro / (2π), escala la frecuencia con la velocidad
    glanceEvery: [2.2, 4] as [number, number], // mira para atrás si el Lunes está cerca
    glanceTime: 0.55,
  },

  // Skins desbloqueables. Nombres y precios los define la marca.
  // TODO(brand): reemplazar nombres por las variedades reales de MBC.
  skins: [
    { id: 'porron', name: 'Porrón', shape: 'porron', price: 0, color: '#C8862B' },
    { id: 'lata', name: 'Lata', shape: 'lata', price: 300, color: '#B9C3CB' },
    { id: 'chopp', name: 'Chopp', shape: 'chopp', price: 700, color: '#F2B134' },
    { id: 'litro', name: 'Botella de litro', shape: 'litro', price: 1200, color: '#8E5A1E' },
  ] as SkinDef[],

  particles: {
    foamPool: 160,
    sheetPool: 60,
    sparklePool: 120,
    smokePool: 60,
    foamOnJump: 6,
    foamOnStumble: 16,
    sparklesOnCoin: 5,
  },

  world: {
    chunkLength: 60,
    chunksAhead: 4,
    chunksBehind: 1,
    sidewalkWidth: 3,
    fogNear: 40,
    fogFar: 170,
    spawnStart: 45, // primera fila de obstáculos
  },

  obstacles: {
    // Tiempo entre filas (s): se multiplica por la velocidad. Baja con la distancia.
    rowGapTimeStart: 1.05,
    rowGapTimeMin: 0.62,
    rowGapMinMeters: 11,
    difficultyDistance: 3000, // a esta distancia la dificultad llega al tope
    // Probabilidad de que un carril (no protegido) tenga algo, al inicio y al tope
    fillChanceStart: 0.35,
    fillChanceMax: 0.75,
    // Pesos relativos de cada tipo
    weights: { low: 3, high: 2, block: 2, bondi: 2 } as Record<ObstacleKind, number>,
    low: { width: 1.9, height: 0.95, depth: 0.9 },
    high: { width: 2.4, bottom: 1.2, height: 0.9, depth: 0.5 },
    block: { width: 2.3, height: 2.6, depth: 1.6 },
    bondi: {
      width: 2.3,
      height: 3.0,
      length: 12,
      rampLength: 5,
      rampChance: 0.55,
      movingChance: 0.25, // ómnibus que viene de frente
      movingSpeed: 6,
      activateDistance: 70, // empieza a moverse cuando la birra está a esta distancia
    },
    // Margen de "roce": si el solapamiento lateral es menor, es tropiezo y no choque
    grazeOverlap: 0.35,
    lowGrazeHeight: 0.3,
  },

  coins: {
    poolSize: 400,
    radius: 0.42,
    thickness: 0.09,
    spacing: 1.8,
    height: 0.9,
    spinSpeed: 3.2,
    pickupRadius: 1.0,
    lineChance: 0.7,
    laneChangeChance: 0.4, // probabilidad de que la línea de fichitas cambie de carril en cada fila
    zigzagLength: 9, // metros que tarda la línea en cruzar al carril de al lado
    roofChance: 0.6,
  },

  camera: {
    height: 5.0,
    distance: 7.5,
    lookAhead: 9,
    lookHeight: 1.1,
    followX: 0.65,
    fovBase: 62,
    fovMax: 72,
    minHorizontalFov: 50, // garantiza ver los 3 carriles en pantallas verticales
  },

  // Calidad adaptativa: si los fps caen, se baja la resolución interna (pixel ratio)
  quality: {
    maxPixelRatio: 2,
    minPixelRatio: 1,
    adaptive: true,
    lowFps: 48, // por debajo de esto (promedio de ~2 s) baja un escalón
    highFps: 58, // por encima de esto por ~8 s sube un escalón
    step: 0.25,
  },

  physics: {
    fixedDt: 1 / 120,
    maxSubSteps: 10,
  },

  colors: {
    laneLine: '#E8E4DA',
    // Colores genéricos de ómnibus (sin empresas reales): carrocería y franja
    bondiLiveries: [
      { body: '#ECE4C8', stripe: '#2E7D4F' },
      { body: '#F4F4F4', stripe: '#D33F3F' },
      { body: '#F2C230', stripe: '#3A3A3A' },
      { body: '#E6EEF5', stripe: '#2F6DB5' },
    ],
  },

  // Montevideo por zonas: cada ~800 m cambia, con un chunk de transición entre medio
  zones: {
    lengthMeters: 800,
    order: ['ciudadVieja', 'rambla', 'pocitos', 'centro', 'tresCruces', 'puerto', 'tristanNarvaja'] as ZoneId[],
    names: {
      ciudadVieja: 'Ciudad Vieja',
      rambla: 'Rambla',
      pocitos: 'Pocitos · Parque Rodó',
      centro: '18 de Julio',
      tresCruces: 'Tres Cruces · Parque Batlle',
      puerto: 'Puerto · Aguada',
      tristanNarvaja: 'Tristán Narvaja',
    } as Record<ZoneId, string>,
    // Cielo de cada zona: arriba y horizonte (la niebla usa el horizonte)
    sky: {
      ciudadVieja: { top: '#6FA8DC', horizon: '#F6D8A8' },
      rambla: { top: '#5B3A8C', horizon: '#F28C38' }, // atardecer naranja-violeta
      pocitos: { top: '#5E9FD6', horizon: '#F9C98E' },
      centro: { top: '#6C9BD2', horizon: '#EBD3B0' },
      tresCruces: { top: '#5F9ED8', horizon: '#E8E0B0' },
      puerto: { top: '#6A8FB8', horizon: '#E2C6A6' },
      tristanNarvaja: { top: '#76AEE0', horizon: '#F3DDB4' },
    } as Record<ZoneId, { top: string; horizon: string }>,
    night: { top: '#0E1630', horizon: '#3B2F5C', maxDarkness: 0.72 },
    obstacles: {
      ciudadVieja: {
        variants: { low: ['contenedor', 'cajon', 'conitos'], high: ['vallaElevada', 'cartel'], block: ['chorizos', 'vallaObra'] },
      },
      rambla: {
        weights: { high: 3 },
        variants: { low: ['conitos', 'mateTermo'], high: ['gaviotas', 'gaviotas', 'cartel'], block: ['chorizos', 'vallaObra'] },
      },
      pocitos: {
        variants: { low: ['mateTermo', 'cajon', 'conitos'], high: ['gaviotas', 'vallaElevada'], block: ['chorizos', 'vallaObra'] },
      },
      centro: {
        weights: { bondi: 3.5 }, // mucho tránsito
        variants: { low: ['contenedor', 'conitos', 'cajon'], high: ['cartel', 'vallaElevada'], block: ['vallaObra', 'chorizos'] },
      },
      tresCruces: {
        variants: { low: ['contenedor', 'mateTermo'], high: ['cartel', 'vallaElevada'], block: ['chorizos', 'vallaObra'] },
      },
      puerto: {
        variants: { low: ['cajon', 'conitos', 'contenedor'], high: ['vallaElevada', 'cartel'], block: ['vallaObra'] },
      },
      tristanNarvaja: {
        weights: { block: 3 },
        variants: { low: ['cajon', 'mateTermo'], high: ['cartel'], block: ['puesto', 'puesto', 'chorizos'] },
      },
    } as Record<ZoneId, ZoneObstacles>,
  },

  powerups: {
    firstAt: 160, // primer power-up
    spacingMin: 240, // metros entre power-ups
    spacingMax: 420,
    height: 1.1,
    pickupRadius: 1.2,
    weights: { feriado: 1, happyHour: 1.2, choppDoble: 1.2, tapitaTurbo: 1 } as Record<PowerUpType, number>,
    feriado: { duration: 12 }, // escudo: dura esto o hasta absorber un choque
    happyHour: { duration: 10, range: 10, pullSpeed: 28 }, // imán
    choppDoble: { duration: 15, multiplier: 2 },
    tapitaTurbo: { duration: 10, jumpBoost: 1.45 }, // supersalto (multiplica la velocidad de salto)
    invulnerableAfterShield: 1.2,
    colors: { feriado: '#E63946', happyHour: '#F2B134', choppDoble: '#C8862B', tapitaTurbo: '#7FC4E8' } as Record<PowerUpType, string>,
  },

  score: {
    coinValue: 1, // puntaje = metros × multiplicador + fichitas
  },

  // Misiones diarias (3 por día elegidas del pool, el progreso se acumula en el día)
  missions: {
    perDay: 3,
    reward: 50,
    pool: [
      { id: 'coins', text: 'Juntá {n} fichitas', stat: 'coins', target: 100 },
      { id: 'rolls', text: 'Rodá {n} veces', stat: 'rolls', target: 10 },
      { id: 'centenario', text: 'Pasá por el Centenario', stat: 'centenario', target: 1 },
      { id: 'run', text: 'Corré {n} m en una partida', stat: 'runMeters', target: 1000 },
      { id: 'powerups', text: 'Agarrá {n} power-ups', stat: 'powerups', target: 3 },
      { id: 'roofs', text: 'Subite a {n} bondis', stat: 'roofs', target: 5 },
      { id: 'jumps', text: 'Saltá {n} veces', stat: 'jumps', target: 30 },
    ] as MissionDef[],
  },

  audio: {
    sfxVolume: 0.5,
    musicVolume: 0.22,
    musicTempo: 112,
    // Si existe el archivo se usa en vez de la música sintetizada. TODO(brand): jingle opcional de la marca
    musicFile: 'assets/audio/musica.mp3',
  },

  share: {
    text: 'Le escapé al lunes {m} metros por Montevideo 🍺',
  },

  // Reloj del HUD: arranca el domingo a las 18:00 y avanza con la distancia hasta 23:59 (nunca llega el lunes)
  clock: {
    dayName: 'Domingo',
    startMinutes: 18 * 60,
    endMinutes: 23 * 60 + 59,
    metersPerMinute: 15,
  },

  texts: {
    title: 'Escapale al Lunes',
    play: 'Jugá',
    pause: 'Pausa',
    resume: 'Seguir',
    restart: 'Reiniciar',
    menu: 'Menú',
    gameOver: 'Te agarró el lunes',
    rematch: '¿Revancha?',
    best: 'Récord',
    newBest: '¡Nuevo récord!',
    meters: 'm',
    coins: 'fichitas',
    controlsDesktop: '← → cambiar carril · ↑ / Espacio saltar · ↓ rodar · Esc pausa',
    controlsMobile: 'Deslizá para moverte, saltar y rodar',
    chaserCatchLine: '¡Buen lunes!',
    ageQuestion: '¿Sos mayor de 18?',
    ageYes: 'Sí',
    ageNo: 'No',
    ageDenied: '¡Gracias por la sinceridad! Este juego es para mayores de 18. Volvé cuando seas grande y disfrutá el domingo.',
    newBestLive: '¡Superaste tu récord!',
    score: 'puntos',
    totalCoins: 'Tus fichitas',
    share: 'Compartir',
    copied: '¡Copiado! Pegalo donde quieras',
    skins: 'Skins',
    missions: 'Misiones',
    back: 'Volver',
    use: 'Usar',
    inUse: 'En uso',
    buy: 'Comprar',
    notEnough: 'Te faltan fichitas',
    missionDone: '¡Misión cumplida! +{n} fichitas',
    missionsTitle: 'Misiones de hoy',
    missionsHint: 'Se renuevan todos los días',
    sound: 'Sonido',
    feriadoButton: 'Feriado',
    feriadoHint: 'Doble tap o E',
    powerups: {
      feriado: 'Feriado',
      happyHour: 'Happy Hour',
      choppDoble: 'Chopp doble',
      tapitaTurbo: 'Tapita turbo',
    } as Record<PowerUpType, string>,
    feriaBanner: 'FERIA DEL DOMINGO',
    chaserLines: [
      '¿Arrancamos la semana?',
      'Tenés reunión a las 9',
      '¿Me mandás eso hoy?',
      'Se terminó el finde, campeón',
      'Ya puse la alarma',
    ],
  },
};

// Paleta base (sección 11 de la spec)
export const palette = {
  amber: '#C8862B',
  gold: '#F2B134',
  foam: '#FFF8E7',
  celeste: '#7FC4E8',
  deepBlue: '#1E3A5F',
  lunesRed: '#E63946',
};

/** Color de la paleta con prioridad para los colores de marca. */
export function color(key: keyof typeof palette): string {
  return config.brand.colors[key] ?? palette[key];
}

/** X del centro de un carril (0 = izquierda). */
export function laneX(lane: number): number {
  return (lane - (config.lanes.count - 1) / 2) * config.lanes.width;
}
