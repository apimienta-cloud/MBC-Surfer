import './style.css';
import { Game } from './game/Game';
import { ageGate } from './ui/AgeGate';

const ui = document.getElementById('ui')!;

// El juego (y el canvas) recién se crea después del age gate
ageGate(ui).then(() => {
  const game = new Game(document.getElementById('game')!, ui);
  // Acceso para depurar desde la consola en desarrollo
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
});
