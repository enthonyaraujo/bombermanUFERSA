import { TILE_SIZE, TILE_TYPE, EMOTE_ICONS } from './Constants.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.fillStyle = '#011038';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Renderiza toda a arena: piso de terra/areia da Caatinga, Cactos Mandacaru e Caixas de Barro.
   */
  drawMap(map) {
    if (!map || map.length === 0) return;

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const tile = map[y][x];

        // 1. Piso de Areia do Sertão (Sand / Terracotta Ground)
        this.drawGroundTile(px, py, x, y);

        // 2. Blocos Indestrutíveis (Cacto Mandacaru) e Destrutíveis (Caixa de Barro)
        if (tile === TILE_TYPE.INDESTRUCTIBLE) {
          this.drawMandacaruCactus(px, py);
        } else if (tile === TILE_TYPE.DESTRUCTIBLE) {
          this.drawClayCrate(px, py);
        }
      }
    }
  }

  /**
   * Piso de terra/areia com variação sutil e textura pixelada retrô.
   */
  drawGroundTile(px, py, x, y) {
    // Cor base do solo da Caatinga
    const isAlt = (x + y) % 2 === 0;
    this.ctx.fillStyle = isAlt ? '#E8C987' : '#DFBE7C';
    this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // Borda sutil entre os ladrilhos
    this.ctx.fillStyle = 'rgba(59, 42, 32, 0.08)';
    this.ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
    this.ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);

    // Grãos de areia / cascalho em padrão determinístico por coordenadas
    const hash = ((x * 37) ^ (y * 53)) % 7;
    if (hash === 1) {
      this.ctx.fillStyle = '#C8A663';
      this.ctx.fillRect(px + 10, py + 14, 2, 2);
      this.ctx.fillRect(px + 28, py + 32, 2, 2);
    } else if (hash === 3) {
      this.ctx.fillStyle = '#C8A663';
      this.ctx.fillRect(px + 34, py + 10, 2, 2);
      this.ctx.fillRect(px + 14, py + 34, 2, 2);
    } else if (hash === 5) {
      this.ctx.fillStyle = '#FFF5D6';
      this.ctx.fillRect(px + 22, py + 22, 2, 2);
    }
  }

  /**
   * Bloco Indestrutível: Cacto Mandacaru 16-Bit.
   */
  drawMandacaruCactus(px, py) {
    const ctx = this.ctx;

    // Sombra do cacto no chão de areia
    ctx.fillStyle = 'rgba(59, 42, 32, 0.35)';
    ctx.fillRect(px + 10, py + 38, 28, 8);

    // Tronco principal do cacto
    const trunkX = px + 15;
    const trunkY = py + 6;
    const trunkW = 18;
    const trunkH = 36;

    // Borda externa escura
    ctx.fillStyle = '#3B2A20';
    ctx.fillRect(trunkX - 2, trunkY - 2, trunkW + 4, trunkH + 4);

    // Corpo verde mandacaru
    ctx.fillStyle = '#3F7D4E';
    ctx.fillRect(trunkX, trunkY, trunkW, trunkH);

    // Nervuras / Ribs verticais do cacto (luz e sombra)
    ctx.fillStyle = '#5EA86F'; // Luz à esquerda
    ctx.fillRect(trunkX + 2, trunkY + 2, 3, trunkH - 4);

    ctx.fillStyle = '#2B5835'; // Sombra central/direita
    ctx.fillRect(trunkX + 7, trunkY + 2, 3, trunkH - 4);
    ctx.fillRect(trunkX + 13, trunkY + 2, 3, trunkH - 4);

    // Braço Esquerdo do Mandacaru
    ctx.fillStyle = '#3B2A20';
    ctx.fillRect(px + 4, py + 16, 12, 16);
    ctx.fillRect(px + 4, py + 10, 8, 12);

    ctx.fillStyle = '#3F7D4E';
    ctx.fillRect(px + 6, py + 18, 9, 12);
    ctx.fillRect(px + 6, py + 12, 6, 10);

    ctx.fillStyle = '#5EA86F';
    ctx.fillRect(px + 7, py + 13, 2, 7);

    // Braço Direito do Mandacaru
    ctx.fillStyle = '#3B2A20';
    ctx.fillRect(px + 32, py + 20, 12, 14);
    ctx.fillRect(px + 36, py + 14, 8, 12);

    ctx.fillStyle = '#3F7D4E';
    ctx.fillRect(px + 33, py + 22, 9, 10);
    ctx.fillRect(px + 37, py + 16, 6, 8);

    ctx.fillStyle = '#2B5835';
    ctx.fillRect(px + 40, py + 17, 2, 6);

    // Espinhos pontiagudos de pixel art (amarelo/creme)
    ctx.fillStyle = '#FFFDF5';
    // Espinhos do tronco
    ctx.fillRect(trunkX - 1, py + 12, 2, 2);
    ctx.fillRect(trunkX - 1, py + 24, 2, 2);
    ctx.fillRect(trunkX + trunkW - 1, py + 16, 2, 2);
    ctx.fillRect(trunkX + trunkW - 1, py + 28, 2, 2);
    // Espinhos nos braços
    ctx.fillRect(px + 4, py + 12, 2, 2);
    ctx.fillRect(px + 42, py + 16, 2, 2);

    // Flor amarela/vermelha no topo do mandacaru
    ctx.fillStyle = '#FFD23F';
    ctx.fillRect(trunkX + 6, py + 2, 6, 4);
    ctx.fillStyle = '#C65D3B';
    ctx.fillRect(trunkX + 8, py + 4, 2, 2);
  }

  /**
   * Bloco Destrutível: Caixa de Argila / Barro da Caatinga.
   */
  drawClayCrate(px, py) {
    const ctx = this.ctx;

    // Sombra da caixa
    ctx.fillStyle = 'rgba(59, 42, 32, 0.4)';
    ctx.fillRect(px + 4, py + 42, 40, 4);

    // Borda exterior marrom grossa de pixel
    ctx.fillStyle = '#3B2A20';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Face de terracota / barro cozido
    ctx.fillStyle = '#C65D3B';
    ctx.fillRect(px + 5, py + 5, TILE_SIZE - 10, TILE_SIZE - 10);

    // Chanfro superior e esquerdo (iluminação)
    ctx.fillStyle = '#DC7554';
    ctx.fillRect(px + 5, py + 5, TILE_SIZE - 10, 3);
    ctx.fillRect(px + 5, py + 5, 3, TILE_SIZE - 10);

    // Chanfro inferior e direito (sombra)
    ctx.fillStyle = '#8D3F27';
    ctx.fillRect(px + 5, py + TILE_SIZE - 8, TILE_SIZE - 10, 3);
    ctx.fillRect(px + TILE_SIZE - 8, py + 5, 3, TILE_SIZE - 10);

    // Ripas de amarração / travessa de madeira sertaneja (X central)
    ctx.fillStyle = '#3B2A20';
    ctx.fillRect(px + 10, py + 10, TILE_SIZE - 20, 2);
    ctx.fillRect(px + 10, py + TILE_SIZE - 12, TILE_SIZE - 20, 2);
    ctx.fillRect(px + 10, py + 10, 2, TILE_SIZE - 20);
    ctx.fillRect(px + TILE_SIZE - 12, py + 10, 2, TILE_SIZE - 20);

    // Cruz diagonal de reforço
    ctx.fillStyle = '#8D3F27';
    for (let i = 0; i < 18; i += 3) {
      ctx.fillRect(px + 14 + i, py + 14 + i, 3, 3);
      ctx.fillRect(px + 32 - i, py + 14 + i, 3, 3);
    }

    // Tachas de fixação nos cantos
    ctx.fillStyle = '#FFD23F';
    ctx.fillRect(px + 8, py + 8, 2, 2);
    ctx.fillRect(px + TILE_SIZE - 10, py + 8, 2, 2);
    ctx.fillRect(px + 8, py + TILE_SIZE - 10, 2, 2);
    ctx.fillRect(px + TILE_SIZE - 10, py + TILE_SIZE - 10, 2, 2);
  }

  /**
   * Renderiza itens de power-up coletáveis com borda pixelada e ícone temático.
   */
  drawPowerUps(powerUps) {
    if (!powerUps) return;

    const now = Date.now();
    const bobbing = Math.sin(now / 160) * 2;

    for (const p of powerUps.values()) {
      const px = p.x * TILE_SIZE + 8;
      const py = p.y * TILE_SIZE + 8 + bobbing;
      const size = 32;

      this.ctx.save();

      // Sombra projetada
      this.ctx.fillStyle = 'rgba(59, 42, 32, 0.4)';
      this.ctx.fillRect(px + 2, p.y * TILE_SIZE + 34, size - 4, 4);

      // Borda do cartão de power-up
      this.ctx.fillStyle = '#3B2A20';
      this.ctx.fillRect(px, py, size, size);

      // Fundo do ícone conforme o tipo
      let bgColor = '#1D2B53';
      let icon = '💣';
      let tag = 'B';

      if (p.type === 'BOMB') {
        bgColor = '#C65D3B';
        icon = '💣';
        tag = '+1B';
      } else if (p.type === 'FIRE') {
        bgColor = '#FFD23F';
        icon = '🔥';
        tag = '+F';
      } else if (p.type === 'SPEED') {
        bgColor = '#3F7D4E';
        icon = '⚡';
        tag = 'VEL';
      }

      this.ctx.fillStyle = bgColor;
      this.ctx.fillRect(px + 2, py + 2, size - 4, size - 4);

      // Borda interna de realce
      this.ctx.strokeStyle = '#FFFDF5';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(px + 3, py + 3, size - 6, size - 6);

      // Ícone do power-up
      this.ctx.font = '16px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(icon, px + size / 2, py + size / 2 + 1);

      this.ctx.restore();
    }
  }

  /**
   * Renderiza bombas 16-Bit com pavio aceso e faíscas incandescentes piscando.
   */
  drawBombs(bombs, now) {
    if (!bombs) return;

    for (const b of bombs.values()) {
      const cx = b.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = b.y * TILE_SIZE + TILE_SIZE / 2;

      // Animação de pulsação mecânica
      const pulse = 1 + Math.sin(now / 90) * 0.08;
      const radius = 16 * pulse;

      this.ctx.save();

      // Sombra da bomba
      this.ctx.fillStyle = 'rgba(59, 42, 32, 0.45)';
      this.ctx.beginPath();
      this.ctx.ellipse(cx, cy + 14, 16, 5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Borda escura de pixel
      this.ctx.fillStyle = '#0E1D45';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy + 3, radius + 2, 0, Math.PI * 2);
      this.ctx.fill();

      // Corpo da bomba de ferro fundido escuro
      this.ctx.fillStyle = '#1D2233';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy + 3, radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Brilho metálico pixelado (alto-contraste 16-bit)
      this.ctx.fillStyle = '#6B7280';
      this.ctx.fillRect(cx - radius * 0.55, cy - radius * 0.35, 4, 4);
      this.ctx.fillStyle = '#FFFDF5';
      this.ctx.fillRect(cx - radius * 0.45, cy - radius * 0.25, 2, 2);

      // Bocal de metal da bomba
      this.ctx.fillStyle = '#3B2A20';
      this.ctx.fillRect(cx - 3, cy - radius - 1, 6, 4);

      // Pavio de fibra retorcida
      this.ctx.strokeStyle = '#C8A663';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy - radius);
      this.ctx.quadraticCurveTo(cx + 4, cy - radius - 5, cx + 7, cy - radius - 8);
      this.ctx.stroke();

      // Faísca incandescente piscante (amarelo e laranja alternando)
      const sparkFlicker = Math.sin(now / 50) > 0;
      this.ctx.fillStyle = sparkFlicker ? '#FFD23F' : '#FF5722';
      this.ctx.fillRect(cx + 6, cy - radius - 10, 4, 4);

      this.ctx.fillStyle = '#FFFDF5';
      this.ctx.fillRect(cx + 7, cy - radius - 9, 2, 2);

      this.ctx.restore();
    }
  }

  /**
   * Renderiza fogo da explosão no estilo cruz pixelada arcade.
   */
  drawFlames(flames) {
    if (!flames || flames.length === 0) return;

    for (const flame of flames) {
      for (const cell of flame.cells) {
        const px = cell.x * TILE_SIZE;
        const py = cell.y * TILE_SIZE;

        this.ctx.save();

        // 1. Camada externa terracota / vermelho fogo
        this.ctx.fillStyle = '#C65D3B';
        this.ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

        // 2. Camada intermediária laranja vivo
        this.ctx.fillStyle = '#FF7A00';
        this.ctx.fillRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);

        // 3. Núcleo incandescente amarelo sertanejo
        this.ctx.fillStyle = '#FFD23F';
        this.ctx.fillRect(px + 12, py + 12, TILE_SIZE - 24, TILE_SIZE - 24);

        // 4. Centro branco puro (calor extremo)
        this.ctx.fillStyle = '#FFFDF5';
        this.ctx.fillRect(px + 18, py + 18, TILE_SIZE - 36, TILE_SIZE - 36);

        // Faíscas pontiagudas nos 4 eixos
        this.ctx.fillStyle = '#FFD23F';
        this.ctx.fillRect(px + 2, py + TILE_SIZE / 2 - 2, 4, 4);
        this.ctx.fillRect(px + TILE_SIZE - 6, py + TILE_SIZE / 2 - 2, 4, 4);
        this.ctx.fillRect(px + TILE_SIZE / 2 - 2, py + 2, 4, 4);
        this.ctx.fillRect(px + TILE_SIZE / 2 - 2, py + TILE_SIZE - 6, 4, 4);

        this.ctx.restore();
      }
    }
  }

  /**
   * Renderiza os jogadores como Robôs Exploradores 16-Bit ("Robôs Sertanejos").
   */
  drawPlayers(players, localPlayerId) {
    if (!players) return;

    const now = Date.now();

    for (const p of players.values()) {
      const px = p.visualX * TILE_SIZE + TILE_SIZE / 2;
      const py = p.visualY * TILE_SIZE + TILE_SIZE / 2;

      this.ctx.save();

      if (!p.alive) {
        // Jogador Eliminado: Robô sucata acinzentado com X nos olhos
        this.drawDeadRobot(px, py, p.name);
      } else {
        // Robô Explorador Ativo
        this.drawLiveRobot(px, py, p, localPlayerId, now);
      }

      // Balão de Emote (se ativo)
      if (p.activeEmote && p.activeEmote.expiresAt > now) {
        const icon = EMOTE_ICONS[p.activeEmote.id] || '😎';
        this.drawEmoteBubble(px, py - 38, icon);
      }

      this.ctx.restore();
    }
  }

  /**
   * Desenha o Robô Explorador vivo com sua cor oficial, antena e viseira iluminada.
   */
  drawLiveRobot(cx, cy, player, localPlayerId, now) {
    const isMe = player.id === localPlayerId;
    const bodyColor = player.color || '#2E6FDF';

    // 1. Sombra circular sólida no chão de areia
    this.ctx.fillStyle = 'rgba(59, 42, 32, 0.40)';
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy + 18, 15, 5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 2. Indicador flutuante de "VOCÊ" (seta dourada apontando para a cabeça do jogador local)
    if (isMe) {
      const arrowBob = Math.sin(now / 150) * 2;
      const arrowY = cy - 34 + arrowBob;

      this.ctx.fillStyle = '#FFD23F';
      this.ctx.beginPath();
      this.ctx.moveTo(cx, arrowY + 6);
      this.ctx.lineTo(cx - 5, arrowY);
      this.ctx.lineTo(cx + 5, arrowY);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.strokeStyle = '#3B2A20';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    // 3. Antena do Robô (haste e lâmpada piscante)
    this.ctx.fillStyle = '#3B2A20';
    this.ctx.fillRect(cx - 1, cy - 22, 2, 7);

    const bulbGlow = Math.sin(now / 100) > 0;
    this.ctx.fillStyle = bulbGlow ? '#FFD23F' : bodyColor;
    this.ctx.fillRect(cx - 3, cy - 25, 6, 4);

    // 4. Borda externa do robô
    this.ctx.fillStyle = '#3B2A20';
    this.ctx.fillRect(cx - 16, cy - 16, 32, 32);

    // 5. Cabeça/Chassi principal com a cor do robô
    this.ctx.fillStyle = bodyColor;
    this.ctx.fillRect(cx - 14, cy - 14, 28, 28);

    // 6. Chapéu de Explorador / Aba superior de proteção
    this.ctx.fillStyle = '#3B2A20';
    this.ctx.fillRect(cx - 18, cy - 16, 36, 4);
    this.ctx.fillStyle = '#C8A663';
    this.ctx.fillRect(cx - 16, cy - 14, 32, 2);

    // 7. Viseira óptica horizontal escura
    this.ctx.fillStyle = '#000B2E';
    this.ctx.fillRect(cx - 10, cy - 6, 20, 10);

    // 8. Sensores oculares / Olhos pixelados acesos
    this.ctx.fillStyle = '#00F0FF'; // Ciano neon retrô
    this.ctx.fillRect(cx - 8, cy - 4, 6, 6);
    this.ctx.fillRect(cx + 2, cy - 4, 6, 6);

    // Brilho do visor
    this.ctx.fillStyle = '#FFFDF5';
    this.ctx.fillRect(cx - 7, cy - 4, 2, 2);
    this.ctx.fillRect(cx + 3, cy - 4, 2, 2);

    // 9. Detalhe metálico inferior (grade / boca do robô)
    this.ctx.fillStyle = '#3B2A20';
    this.ctx.fillRect(cx - 6, cy + 8, 12, 2);
    this.ctx.fillRect(cx - 4, cy + 8, 2, 2);
    this.ctx.fillRect(cx + 2, cy + 8, 2, 2);

    // 10. Tag com o Apelido do Jogador
    this.ctx.font = 'bold 10px "Space Mono", monospace';
    this.ctx.textAlign = 'center';

    // Contorno escuro para legibilidade máxima no piso arenoso
    this.ctx.strokeStyle = '#3B2A20';
    this.ctx.lineWidth = 3;
    this.ctx.strokeText(player.name, cx, cy - 25);

    this.ctx.fillStyle = isMe ? '#FFD23F' : '#FFFDF5';
    this.ctx.fillText(player.name, cx, cy - 25);
  }

  /**
   * Desenha o Robô Eliminado (desativado).
   */
  drawDeadRobot(cx, cy, name) {
    this.ctx.globalAlpha = 0.55;

    // Chassi cinza de sucata
    this.ctx.fillStyle = '#3B2A20';
    this.ctx.fillRect(cx - 14, cy - 14, 28, 28);
    this.ctx.fillStyle = '#4B5563';
    this.ctx.fillRect(cx - 12, cy - 12, 24, 24);

    // Viseira apagada
    this.ctx.fillStyle = '#111827';
    this.ctx.fillRect(cx - 9, cy - 5, 18, 9);

    // X vermelho nos sensores
    this.ctx.strokeStyle = '#D9383A';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 6, cy - 3); this.ctx.lineTo(cx - 2, cy + 1);
    this.ctx.moveTo(cx - 2, cy - 3); this.ctx.lineTo(cx - 6, cy + 1);
    this.ctx.moveTo(cx + 2, cy - 3); this.ctx.lineTo(cx + 6, cy + 1);
    this.ctx.moveTo(cx + 6, cy - 3); this.ctx.lineTo(cx + 2, cy + 1);
    this.ctx.stroke();

    this.ctx.globalAlpha = 1.0;

    // Nome riscado
    this.ctx.font = '9px "Space Mono", monospace';
    this.ctx.fillStyle = '#9CA3AF';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(name + ' 💀', cx, cy - 22);
  }

  /**
   * Balão de Emote 16-Bit.
   */
  drawEmoteBubble(x, y, icon) {
    this.ctx.save();

    // Sombra do balão
    this.ctx.fillStyle = 'rgba(59, 42, 32, 0.4)';
    this.ctx.fillRect(x - 12, y - 10, 28, 24);

    // Fundo branco e borda grossa marrom
    this.ctx.fillStyle = '#3B2A20';
    this.ctx.fillRect(x - 14, y - 12, 28, 24);

    this.ctx.fillStyle = '#FFFDF5';
    this.ctx.fillRect(x - 12, y - 10, 24, 20);

    // Ponta do balão apontando para o robô
    this.ctx.fillStyle = '#3B2A20';
    this.ctx.fillRect(x - 3, y + 12, 6, 4);
    this.ctx.fillStyle = '#FFFDF5';
    this.ctx.fillRect(x - 2, y + 12, 4, 2);

    this.ctx.font = '15px Arial, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(icon, x, y);

    this.ctx.restore();
  }
}
