import { DIRECTION } from './Constants.js';

export class InputHandler {
  constructor(onMove, onBomb, onEmote) {
    this.onMove = onMove;
    this.onBomb = onBomb;
    this.onEmote = onEmote;

    this.lastMoveTime = 0;
    this.lastDir = null;
    this.moveCooldownMs = 110; // ~9 passos por segundo, movimentação ágil e fluida

    this.keysDown = new Set();
    this.init();
  }

  init() {
    window.addEventListener('keydown', (e) => {
      // Ignora se estiver digitando em campos de input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      // Previne rolagem de página por padrão do navegador
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      this.keysDown.add(e.code);

      // Soltar bomba
      if (e.code === 'Space') {
        if (this.onBomb) this.onBomb();
        return;
      }

      // Emotes (1: gg, 2: bomb, 3: cry, 4: fire)
      if (e.code === 'Digit1') { this.onEmote('gg'); return; }
      if (e.code === 'Digit2') { this.onEmote('bomb'); return; }
      if (e.code === 'Digit3') { this.onEmote('cry'); return; }
      if (e.code === 'Digit4') { this.onEmote('fire'); return; }

      // Movimentação imediata se não estiver em cooldown
      this.checkMovement(true);
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
  }

  checkMovement(isInitialPress = false) {
    const now = performance.now();

    let dir = null;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) dir = DIRECTION.UP;
    else if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) dir = DIRECTION.DOWN;
    else if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) dir = DIRECTION.LEFT;
    else if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) dir = DIRECTION.RIGHT;

    if (!dir) return;

    // Se mudou de direção ou pressionou nova tecla, resposta mais imediata (60ms)
    const requiredCooldown = (isInitialPress && dir !== this.lastDir) ? 60 : this.moveCooldownMs;
    if (now - this.lastMoveTime < requiredCooldown) return;

    if (this.onMove) {
      this.lastMoveTime = now;
      this.lastDir = dir;
      this.onMove(dir);
    }
  }

  // Chamado a cada quadro no game loop para movimento contínuo ao segurar tecla
  update() {
    this.checkMovement();
  }
}
