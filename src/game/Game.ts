import * as THREE from 'three';
import { config, PowerUpType, ZoneId } from '../config';
import { Input } from './Input';
import { Player } from './Player';
import { Chaser } from './Chaser';
import { ChunkManager } from '../world/ChunkManager';
import { Obstacles } from '../world/Obstacles';
import { Collectibles } from '../world/Collectibles';
import { Particles } from '../fx/Particles';
import { ZoneSystem } from '../world/zones';
import { Sky, clockText } from '../world/Sky';
import { PowerUps } from '../world/PowerUps';
import { Audio, Sfx } from '../audio/Audio';
import { Missions } from './Missions';
import { UI } from '../ui/UI';
import * as Save from '../storage/Save';

type State = 'menu' | 'playing' | 'paused' | 'caught' | 'gameover';

const CAM = config.camera;
const SP = config.speed;

/** Loop principal y máquina de estados (menu, playing, paused, caught, gameover). */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  private ui: UI;
  private player = new Player();
  private chaser = new Chaser();
  private zones = new ZoneSystem();
  private particles = new Particles();
  private chunks = new ChunkManager(this.zones, this.particles);
  private coins = new Collectibles();
  private obstacles = new Obstacles(this.coins, this.zones);
  private sky = new Sky(this.zones);
  private fog = new THREE.Fog(0xffffff, config.world.fogNear, config.world.fogFar);
  private zoneId: ZoneId | null = null;
  private clock = '';
  private powerups = new PowerUps();
  private audio = new Audio();
  private missions: Missions;
  private score = 0;
  private passedCentenario = false;

  private state: State = 'menu';
  private speed: number = SP.start;
  private runCoins = 0;
  private accumulator = 0;
  private lastTime = 0;
  private time = 0;
  private shake = 0;
  private save = Save.load();
  /** 0 = cámara de menú (de frente a la birra), 1 = cámara de juego. */
  private camBlend = 0;
  private pendingResult: { score: number; meters: number; coins: number; isNewBest: boolean } | null = null;
  /** Escala de resolución que maneja la calidad adaptativa (1 = máxima). */
  private qualityScale = 1;
  private fpsAvg = 60;
  private fpsLowTime = 0;
  private fpsHighTime = 0;
  /** Bajón de cámara al aterrizar (juice). */
  private camDip = 0;
  private hudTimer = 0;
  private beatBest = false;
  private tmpV = new THREE.Vector3();
  private tmpTarget = new THREE.Vector3();

  constructor(container: HTMLElement, uiRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.targetPixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CAM.fovBase, 1, 0.1, 420);

    // Cielo, luces y niebla los maneja Sky según la zona y la hora
    this.scene.fog = this.fog;
    this.scene.add(this.sky.group, this.sky.hemi, this.sky.sun);

    this.scene.add(this.chunks.group, this.obstacles.group, this.coins.mesh, this.powerups.group, this.player.root, this.chaser.root, this.particles.group);
    this.obstacles.powerSpawner = (lane, s) => this.powerups.spawn(this.powerups.randomType(), lane, s);

    // Skins renombradas en versiones anteriores: se conservan las compras
    const ren = config.skinRenames;
    this.save.skins = [...new Set(this.save.skins.map((id) => ren[id] ?? id))];
    this.save.skin = ren[this.save.skin] ?? this.save.skin;
    // Skins: las gratis vienen desbloqueadas; si la guardada no existe se usa la primera
    for (const k of config.skins) if (k.price === 0 && !this.save.skins.includes(k.id)) this.save.skins.push(k.id);
    if (!config.skins.some((k) => k.id === this.save.skin)) this.save.skin = config.skins[0].id;
    this.player.setSkin(this.skinDef(this.save.skin));
    this.missions = new Missions(this.save);

    this.input = new Input(container);
    this.ui = new UI(uiRoot, {
      onPlay: () => this.start(),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onRestart: () => this.start(),
      onMenu: () => this.toMenu(),
      onShare: () => this.share(),
      onToggleMute: () => this.toggleMute(),
      onFeriado: () => this.useFeriado(),
      onOpenSkins: () => this.openSkins(),
      onOpenMissions: () => this.openMissions(),
      onBack: () => this.backToMenu(),
      onSkin: (id) => this.chooseSkin(id),
      onClick: () => {
        this.audio.unlock();
        this.sfx('click');
      },
    });
    this.audio.setMuted(this.save.muted);
    this.ui.setMuted(this.save.muted);
    this.ui.setMenuStats(this.save.bestScore, this.save.coinsTotal);

    // iOS: el audio se habilita con el primer toque en cualquier lado
    document.addEventListener('touchend', () => this.audio.unlock(), { once: true });
    window.addEventListener('resize', this.onResize);
    this.onResize();
    // Pausa automática al perder el foco
    document.addEventListener('visibilitychange', () => document.hidden && this.pause());
    window.addEventListener('blur', () => this.pause());

    this.resetRun();
    this.toMenu();
    requestAnimationFrame(this.frame);
  }

  // ---------- Estados ----------

  private resetRun(): void {
    this.player.reset();
    this.chaser.reset(this.player.x);
    this.obstacles.reset();
    this.coins.reset();
    this.powerups.reset();
    this.particles.clear();
    this.chunks.reset();
    this.speed = SP.start;
    this.runCoins = 0;
    this.score = 0;
    this.beatBest = false;
    this.camDip = 0;
    this.passedCentenario = false;
    this.shake = 0;
    this.pendingResult = null;
    this.zoneId = null;
    this.ui.setBubble(null);
    this.chunks.update(0);
    this.obstacles.generate(this.lookAheadS(), 0, this.speed);
  }

  private start(): void {
    this.audio.unlock();
    this.missions.refresh();
    this.resetRun();
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clear();
    this.accumulator = 0;
    this.ui.show('playing');
    this.audio.startMusic();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.ui.show('paused');
    this.audio.stopMusic();
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clear();
    this.ui.show('playing');
    this.audio.startMusic();
  }

  private toMenu(): void {
    if (this.state !== 'menu') this.resetRun();
    this.state = 'menu';
    this.input.enabled = false;
    this.audio.stopMusic();
    this.ui.setMenuStats(this.save.bestScore, this.save.coinsTotal);
    this.ui.show('menu');
  }

  // ---------- Menú: skins, misiones, sonido, compartir ----------

  private skinDef(id: string) {
    return config.skins.find((k) => k.id === id) ?? config.skins[0];
  }

  private openSkins(): void {
    this.ui.renderSkins(config.skins, this.save.skins, this.save.skin, this.save.coinsTotal);
    this.ui.show('skins');
  }

  private chooseSkin(id: string): void {
    const k = this.skinDef(id);
    if (!this.save.skins.includes(id)) {
      if (this.save.coinsTotal < k.price) {
        this.ui.notice(config.texts.notEnough);
        return;
      }
      this.save.coinsTotal -= k.price;
      this.save.skins.push(id);
      this.sfx('powerup');
    }
    this.save.skin = id;
    this.player.setSkin(k);
    Save.save(this.save);
    this.openSkins();
  }

  private openMissions(): void {
    this.missions.refresh();
    this.ui.renderMissions(this.missions.view());
    this.ui.show('missions');
  }

  private backToMenu(): void {
    this.ui.setMenuStats(this.save.bestScore, this.save.coinsTotal);
    this.ui.show('menu');
  }

  private toggleMute(): void {
    this.save.muted = !this.save.muted;
    this.audio.setMuted(this.save.muted);
    this.ui.setMuted(this.save.muted);
    Save.save(this.save);
  }

  /** Web Share API; si no está, copia el texto al portapapeles. */
  private share(): void {
    const meters = Math.floor(this.pendingResult?.meters ?? this.player.s);
    const text = config.share.text.replace('{m}', meters.toLocaleString('es-UY'));
    const url = location.href.split('#')[0];
    if (typeof navigator.share === 'function') {
      navigator.share({ text, url }).catch(() => undefined);
      return;
    }
    const full = text + ' ' + url;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(full).then(
        () => this.ui.notice(config.texts.copied),
        () => this.ui.notice(full, 5000),
      );
    } else {
      this.ui.notice(full, 5000);
    }
  }

  private sfx(s: Sfx): void {
    this.audio.play(s);
  }

  /** Suma a las misiones y avisa las que se cumplieron. */
  private track(stat: Parameters<Missions['track']>[0], v: number): void {
    for (const text of this.missions.track(stat, v)) {
      this.ui.notice(config.texts.missionDone.replace('{n}', String(config.missions.reward)) + ' · ' + text, 3200);
      this.sfx('mission');
    }
  }

  // ---------- Power-ups ----------

  private onPowerUp(type: PowerUpType): void {
    const r = this.powerups.apply(type);
    this.sfx('powerup');
    this.track('powerups', 1);
    const name = config.texts.powerups[type];
    this.ui.notice(r === 'stored' ? name + ' · ' + config.texts.feriadoHint : name, 1600);
    if (type === 'feriado' && r === 'active') this.chaser.pushAway();
    const p = this.player;
    for (let i = 0; i < 4; i++) this.particles.sparkle(p.x, p.y + 1, -p.s);
    this.shake = Math.max(this.shake, 0.12);
    this.hudTimer = 0;
  }

  /** Activa el Feriado guardado: escudo y el Lunes se aleja. */
  private useFeriado(): void {
    if (this.state !== 'playing' || !this.powerups.useStored()) return;
    this.chaser.pushAway();
    this.sfx('shield');
  }

  /** Te agarró: se guarda el resultado y arranca la animación del Lunes saltándote encima. */
  private gameOver(): void {
    this.state = 'caught';
    this.input.enabled = false;
    const meters = this.player.s;
    const score = Math.floor(this.score);
    const isNewBest = score > this.save.bestScore;
    if (isNewBest) this.save.bestScore = score;
    this.save.best = Math.max(this.save.best, meters);
    this.save.coinsTotal += this.runCoins;
    this.track('runMeters', meters);
    Save.save(this.save);
    this.pendingResult = { score, meters, coins: this.runCoins, isNewBest };
    this.shake = 0.4;
    this.chaser.startCatch();
    this.ui.show('caught');
    this.audio.stopMusic();
    this.sfx('crash');
    window.setTimeout(() => this.state === 'caught' && this.sfx('caught'), 500);
  }

  private finishGameOver(): void {
    const r = this.pendingResult;
    if (!r) return;
    this.state = 'gameover';
    this.ui.setBubble(null);
    this.ui.showGameOver({ ...r, bestScore: this.save.bestScore });
  }

  // ---------- Loop ----------

  private frame = (t: number): void => {
    requestAnimationFrame(this.frame);
    // Si cambia el zoom / devicePixelRatio no siempre llega un resize
    if (Math.abs(this.targetPixelRatio() - this.renderer.getPixelRatio()) > 0.01) this.onResize();
    const raw = (t - (this.lastTime || t)) / 1000;
    const dt = Math.min(0.1, raw);
    this.lastTime = t;
    this.time += dt;
    if (this.state === 'playing' && raw > 0) this.adaptQuality(raw);

    // Pausa también se puede pedir con teclado durante el juego
    for (const a of this.input.drain()) {
      if (a === 'pause') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        continue;
      }
      if (this.state === 'playing') this.handleAction(a);
    }

    if (this.state === 'playing') {
      // Delta fijo para la lógica: la dificultad no depende de los fps
      this.accumulator += dt;
      const fixed = config.physics.fixedDt;
      let steps = 0;
      while (this.accumulator >= fixed && steps < config.physics.maxSubSteps && this.state === 'playing') {
        this.step(fixed);
        this.accumulator -= fixed;
        steps++;
      }
      if (steps === config.physics.maxSubSteps) this.accumulator = 0;
      this.ui.updateHud(this.score, this.player.s, this.runCoins, this.powerups.multiplier);
      // Las barras de power-ups no necesitan actualizarse en cada frame
      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.1;
        this.ui.setPowerups(this.powerups.active(), this.powerups.stored, this.powerups.shield);
      }
      // Récord superado en vivo (una vez por partida)
      if (!this.beatBest && this.save.bestScore > 0 && this.score > this.save.bestScore) {
        this.beatBest = true;
        this.ui.notice(config.texts.newBestLive, 2000);
        this.sfx('mission');
      }
    }

    if (this.state === 'caught' && this.chaser.catchDone) this.finishGameOver();

    this.render(dt);
  };

  private handleAction(a: string): void {
    const p = this.player;
    if (a === 'left') p.moveLane(-1);
    else if (a === 'right') p.moveLane(1);
    else if (a === 'jump') p.jump();
    else if (a === 'roll') p.roll();
    else if (a === 'feriado') this.useFeriado();
  }

  private step(dt: number): void {
    const p = this.player;
    this.speed = SP.max - (SP.max - SP.start) * Math.exp(-p.s / SP.rampDistance);

    this.obstacles.step(dt, p.s);
    p.jumpBoost = this.powerups.jumpBoost;
    const s0 = p.s;
    p.step(dt, this.speed, (x, s, y) => this.obstacles.supportAt(x, s, y));
    // Puntaje: metros × multiplicador (las fichitas se suman aparte)
    this.score += (p.s - s0) * this.powerups.multiplier;

    for (const e of p.events) {
      if (e === 'jump') {
        this.particles.foamPuff(p.x, p.foamWorldY, -p.s);
        this.sfx('jump');
        this.track('jumps', 1);
      } else if (e === 'land') {
        this.particles.foamPuff(p.x, p.y + 0.1, -p.s, 4);
        this.camDip = 0.22;
        this.sfx('land');
      } else if (e === 'roll') {
        this.sfx('roll');
        this.track('rolls', 1);
      } else if (e === 'roof') {
        this.track('roofs', 1);
      }
    }
    p.events.length = 0;

    let hit = this.obstacles.collide(p);
    // Feriado activo (o recién usado): el choque no cuenta y el Lunes se aleja
    if (hit !== 'none' && (p.invulnerable > 0 || this.powerups.shield)) {
      if (this.obstacles.lastHit) this.obstacles.lastHit.hit = true;
      if (p.invulnerable <= 0) {
        this.powerups.consumeShield();
        p.invulnerable = config.powerups.invulnerableAfterShield;
        this.chaser.pushAway();
        this.sfx('shield');
        this.shake = 0.2;
        for (let i = 0; i < 4; i++) this.particles.sparkle(p.x, p.y + 1, -p.s);
      }
      hit = 'none';
    }
    if (hit === 'crash') {
      this.gameOver();
      return;
    }
    if (hit === 'stumble') {
      p.stumble();
      this.particles.foamSquirt(p.x, p.foamWorldY, -p.s);
      p.events.length = 0;
      this.shake = 0.25;
      this.sfx('stumble');
      if (this.chaser.onStumble()) {
        this.gameOver();
        return;
      }
    }

    const got = this.coins.step(p, dt, this.powerups.magnet, (x, y, s) => {
      this.particles.sparkle(x, y, -s);
      this.sfx('coin');
    });
    if (got) {
      this.runCoins += got;
      this.score += got * config.score.coinValue;
      this.track('coins', got);
    }
    this.powerups.step(dt, p, (type) => this.onPowerUp(type));
    this.chaser.step(dt);
    this.chunks.update(p.s, dt);
    this.obstacles.generate(this.lookAheadS(), p.s, this.speed);
  }

  private lookAheadS(): number {
    return this.player.s + config.world.chunkLength * config.world.chunksAhead;
  }

  private render(dt: number): void {
    const p = this.player;
    const st = this.state;
    if (st !== 'paused') {
      this.coins.render(dt);
      this.particles.update(dt);
      // En el menú la birra corre en el lugar
      const animSpeed = st === 'menu' ? SP.start : st === 'playing' ? this.speed : 0;
      p.render(dt, animSpeed, this.chaser.isNear && st === 'playing', st === 'caught' || st === 'gameover');
      p.setSquashed(this.chaser.squashAmount);
      p.setShield(st === 'playing' || st === 'caught' ? this.powerups.timers.feriado : 0, this.time);
      if (st !== 'menu') this.chaser.render(dt, p.x, p.s, p.groundY, this.speed, this.particles);
    }
    this.obstacles.render(this.time);
    this.powerups.render(this.time);
    if (st === 'menu') this.chaser.root.visible = false;

    // Cámara: de frente a la birra en el menú; detrás y arriba al jugar
    this.camBlend += ((st === 'menu' ? 0 : 1) - this.camBlend) * Math.min(1, dt * 3.5);
    const b = this.camBlend * this.camBlend * (3 - 2 * this.camBlend);
    const k = (this.speed - SP.start) / (SP.max - SP.start);
    let fov = CAM.fovBase + (CAM.fovMax - CAM.fovBase) * k;
    // En vertical (celular) se abre el FOV para que entren los 3 carriles
    const minV = (2 * Math.atan(Math.tan((CAM.minHorizontalFov * Math.PI) / 360) / this.camera.aspect) * 180) / Math.PI;
    fov = Math.max(fov, minV + (CAM.fovMax - CAM.fovBase) * k);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake * 0.6;
    const gx = p.x * CAM.followX;
    this.camDip = Math.max(0, this.camDip - dt * 1.2);
    const game = this.tmpV.set(gx + (Math.random() - 0.5) * sh, CAM.height + p.y * 0.5 - this.camDip + (Math.random() - 0.5) * sh, -p.s + CAM.distance);
    const look = this.tmpTarget.set(gx, CAM.lookHeight + p.y * 0.6, -p.s - CAM.lookAhead);
    const orbit = Math.sin(this.time * 0.3) * 0.6;
    this.camera.position.set(
      THREE.MathUtils.lerp(p.x + orbit, game.x, b),
      THREE.MathUtils.lerp(1.6, game.y, b),
      THREE.MathUtils.lerp(-p.s - 4.2, game.z, b),
    );
    this.camera.lookAt(
      THREE.MathUtils.lerp(p.x, look.x, b),
      THREE.MathUtils.lerp(1.0, look.y, b),
      THREE.MathUtils.lerp(-p.s, look.z, b),
    );

    // Cielo, niebla y noche según zona y hora; los faroles se prenden
    this.sky.update(this.camera, p.s, this.fog);
    this.chunks.setNight(this.sky.darkness);
    this.updateHudWorld(st);

    // Globo de diálogo del Lunes, proyectado a pantalla
    const text = this.chaser.bubbleText;
    if (text && this.chaser.root.visible && st !== 'menu') {
      const v = this.chaser.headWorld(this.tmpV).project(this.camera);
      this.ui.setBubble(text, ((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight);
    } else {
      this.ui.setBubble(null);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /** Reloj del domingo y cartel al entrar a una zona nueva. */
  private updateHudWorld(st: State): void {
    const s = this.player.s;
    const text = clockText(s);
    if (text !== this.clock) {
      this.clock = text;
      this.ui.setClock(text);
    }
    const info = this.zones.chunkInfo(Math.floor(s / config.world.chunkLength));
    const z = info.zone.id;
    if (z !== this.zoneId) {
      if (st === 'playing') this.ui.toast(config.zones.names[z]);
      this.zoneId = z;
    }
    // Misión "Pasá por el Centenario": el chunk del estadio en Tres Cruces
    if (st === 'playing' && !this.passedCentenario && z === 'tresCruces' && info.local === 6 && !info.transition) {
      this.passedCentenario = true;
      this.track('centenario', 1);
    }
  }

  private targetPixelRatio(): number {
    const Q = config.quality;
    const max = Math.min(window.devicePixelRatio, Q.maxPixelRatio);
    return Math.max(Math.min(Q.minPixelRatio, max), Math.round(max * this.qualityScale * 4) / 4);
  }

  /** Baja (o sube) la resolución interna según los fps promedio. */
  private adaptQuality(frameSec: number): void {
    const Q = config.quality;
    if (!Q.adaptive || frameSec > 0.5) return; // saltos grandes = pestaña en segundo plano
    this.fpsAvg += (1 / frameSec - this.fpsAvg) * 0.05;
    this.fpsLowTime = this.fpsAvg < Q.lowFps ? this.fpsLowTime + frameSec : 0;
    this.fpsHighTime = this.fpsAvg > Q.highFps ? this.fpsHighTime + frameSec : 0;
    const max = Math.min(window.devicePixelRatio, Q.maxPixelRatio);
    if (this.fpsLowTime > 2 && this.targetPixelRatio() > Math.min(Q.minPixelRatio, max)) {
      this.qualityScale = Math.max(0.3, this.qualityScale - Q.step / max);
      this.fpsLowTime = 0;
      this.fpsAvg = 60;
      this.onResize();
    } else if (this.fpsHighTime > 8 && this.qualityScale < 1) {
      this.qualityScale = Math.min(1, this.qualityScale + Q.step / max);
      this.fpsHighTime = 0;
      this.onResize();
    }
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(this.targetPixelRatio());
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
