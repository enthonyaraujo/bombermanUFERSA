import {
  TILE_TYPE,
  DIRECTION,
  DIR_OFFSETS,
  POWERUP_TYPE,
  ROOM_STATUS,
  SPAWN_POSITIONS,
  getSpawnPositions,
  PLAYER_COLORS
} from './Constants.js';
import { MapGenerator } from './MapGenerator.js';

export class BombermanEngine {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.status = ROOM_STATUS.LOBBY;
    this.width = options.width || 17;
    this.height = options.height || 13;
    this.bombTimerMs = options.bombTimerMs || 2500;
    this.flameDurationMs = options.flameDurationMs || 500;
    this.suddenDeathStartMs = options.suddenDeathStartMs || 120000; // 2 min
    this.suddenDeathIntervalMs = options.suddenDeathIntervalMs || 1500; // 1.5s
    this.randomFn = options.randomFn || Math.random;

    this.players = new Map(); // id -> playerData
    this.map = [];
    this.bombs = new Map(); // bombId -> bombData
    this.flames = []; // array de { x, y, expiresAt }
    this.powerUps = new Map(); // `${x},${y}` -> { id, type, x, y }

    this.matchStartTime = 0;
    this.lastSuddenDeathTick = 0;
    this.suddenDeathQueue = [];
    this.suddenDeathIndex = 0;

    this.nextBombId = 1;
    this.nextEventId = 1;
    this.hostId = null;
  }

  generateEventId() {
    return `${Date.now()}-${this.nextEventId++}`;
  }

  /**
   * Adiciona um jogador à sala durante o lobby.
   */
  addPlayer(playerId, name) {
    if (this.status !== ROOM_STATUS.LOBBY) {
      return { success: false, reason: 'GAME_ALREADY_STARTED', events: [] };
    }
    if (this.players.size >= 4) {
      return { success: false, reason: 'ROOM_FULL', events: [] };
    }
    if (this.players.has(playerId)) {
      return { success: true, reason: 'ALREADY_JOINED', events: [] };
    }

    if (!this.hostId) {
      this.hostId = playerId;
    }

    const slotIndex = this.players.size;
    const spawns = getSpawnPositions(this.width, this.height);
    const player = {
      id: playerId,
      name: name || `Jogador ${slotIndex + 1}`,
      slot: slotIndex,
      color: PLAYER_COLORS[slotIndex],
      ready: false,
      alive: true,
      isHost: this.hostId === playerId,
      x: spawns[slotIndex].x,
      y: spawns[slotIndex].y,
      bombsMax: 1,
      bombsActive: 0,
      bombRange: 2,
      speed: 1, // multiplicador de agilidade
      lastSeq: 0
    };

    this.players.set(playerId, player);

    const event = {
      eventId: this.generateEventId(),
      type: 'ROOM_STATE',
      payload: this.getRoomStatePayload()
    };

    return { success: true, events: [event] };
  }

  /**
   * Reseta a sala para o estado de LOBBY permitindo novas partidas consecutivas.
   */
  resetToLobby() {
    this.status = ROOM_STATUS.LOBBY;
    const spawns = getSpawnPositions(this.width, this.height);

    for (const player of this.players.values()) {
      player.ready = false;
      player.alive = true;
      player.bombsActive = 0;
      player.bombsMax = 1;
      player.bombRange = 2;
      player.speed = 1;
      player.x = spawns[player.slot].x;
      player.y = spawns[player.slot].y;
    }

    this.bombs.clear();
    this.flames = [];
    this.powerUps.clear();
    this.matchStartTime = 0;

    return [{
      eventId: this.generateEventId(),
      type: 'ROOM_STATE',
      payload: this.getRoomStatePayload()
    }];
  }

  /**
   * Remove um jogador por desconexão. Se for o Host, encerra a sala imediatamente.
   */
  removePlayer(playerId) {
    if (!this.players.has(playerId)) return { success: false, events: [], roomClosed: false };

    const isHost = (this.hostId === playerId);
    const events = [];

    // Se o anfitrião (Host) sair da sala, a sala inteira é encerrada imediatamente
    if (isHost) {
      this.status = 'CLOSED';
      this.players.clear();
      events.push({
        eventId: this.generateEventId(),
        type: 'ROOM_CLOSED',
        payload: {
          roomId: this.roomId,
          reason: 'HOST_LEFT',
          message: 'O anfitrião saiu da sala. A sala foi encerrada.'
        }
      });
      return { success: true, events, roomClosed: true };
    }

    const player = this.players.get(playerId);

    if (this.status === ROOM_STATUS.LOBBY) {
      this.players.delete(playerId);
      if (this.players.size === 0) {
        this.status = 'CLOSED';
        return { success: true, events: [], roomClosed: true };
      }
      // Reatribui slots e cores para os restantes
      let index = 0;
      const spawns = getSpawnPositions(this.width, this.height);
      for (const p of this.players.values()) {
        p.slot = index;
        p.color = PLAYER_COLORS[index];
        p.x = spawns[index].x;
        p.y = spawns[index].y;
        p.isHost = (p.id === this.hostId);
        index++;
      }
      events.push({
        eventId: this.generateEventId(),
        type: 'ROOM_STATE',
        payload: this.getRoomStatePayload()
      });
    } else if (this.status === ROOM_STATUS.PLAYING) {
      // Se estava em jogo, marca como morto
      if (player.alive) {
        player.alive = false;
        events.push({
          eventId: this.generateEventId(),
          type: 'PLAYER_DIED',
          payload: { playerId, reason: 'DISCONNECTED' }
        });

        const checkWin = this.checkVictoryCondition();
        if (checkWin) events.push(checkWin);
      }
      this.players.delete(playerId);
      if (this.players.size === 0) {
        this.status = 'CLOSED';
        return { success: true, events, roomClosed: true };
      }
    }

    return { success: true, events, roomClosed: false };
  }

  /**
   * Alterna estado de "pronto" do jogador no lobby.
   * Se a partida anterior terminou (FINISHED), redefine automaticamente para LOBBY.
   */
  setPlayerReady(playerId, ready) {
    const events = [];

    if (this.status === ROOM_STATUS.FINISHED) {
      const resetEvents = this.resetToLobby();
      events.push(...resetEvents);
    }

    if (this.status !== ROOM_STATUS.LOBBY) return { success: false, events: [] };
    const player = this.players.get(playerId);
    if (!player) return { success: false, events: [] };

    player.ready = Boolean(ready);
    events.push({
      eventId: this.generateEventId(),
      type: 'ROOM_STATE',
      payload: this.getRoomStatePayload()
    });

    // Se todos estiverem prontos (mínimo de 2 jogadores), inicia partida
    const allReady = this.players.size >= 2 && Array.from(this.players.values()).every(p => p.ready);
    if (allReady) {
      const startEvents = this.startGame();
      events.push(...startEvents);
    }

    return { success: true, events };
  }

  /**
   * Inicia a partida: gera arena e define posições.
   */
  startGame() {
    this.status = ROOM_STATUS.PLAYING;
    this.matchStartTime = Date.now();
    this.map = MapGenerator.generate(this.width, this.height, 0.70, this.randomFn);
    this.bombs.clear();
    this.flames = [];
    this.powerUps.clear();

    const spawns = getSpawnPositions(this.width, this.height);

    // Posiciona jogadores vivos em seus spawns
    for (const player of this.players.values()) {
      player.alive = true;
      player.x = spawns[player.slot].x;
      player.y = spawns[player.slot].y;
      player.bombsActive = 0;
      player.bombsMax = 1;
      player.bombRange = 2;
    }

    // Pré-calcula espiral da Morte Súbita (bordas para o centro)
    this.generateSuddenDeathQueue();
    this.suddenDeathIndex = 0;
    this.lastSuddenDeathTick = 0;

    const gameStartEvent = {
      eventId: this.generateEventId(),
      type: 'GAME_START',
      payload: {
        gridWidth: this.width,
        gridHeight: this.height,
        map: this.map,
        players: Array.from(this.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          color: p.color,
          slot: p.slot,
          x: p.x,
          y: p.y,
          alive: p.alive
        }))
      }
    };

    return [gameStartEvent];
  }

  /**
   * Processa uma ação recebida de um jogador via fila SQS.
   */
  handleAction(playerId, seq, type, payload = {}) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'PLAYER_NOT_FOUND', events: [] };
    }

    // Idempotência estrita: se seq já foi processado, descarta
    if (seq <= player.lastSeq) {
      return { success: false, reason: 'DUPLICATE_SEQ', events: [] };
    }
    player.lastSeq = seq;
    // Se for ação de reiniciar partida, reseta para LOBBY
    if (type === 'RESTART_GAME') {
      return { success: true, events: this.resetToLobby() };
    }

    // Se o jogo não está ativo ou o jogador está morto, ignora ações de gameplay
    if (this.status !== ROOM_STATUS.PLAYING || !player.alive) {
      return { success: false, reason: 'PLAYER_INACTIVE_OR_GAME_NOT_RUNNING', events: [] };
    }

    const events = [];

    switch (type) {
      case 'MOVE': {
        const dir = payload.dir;
        const offset = DIR_OFFSETS[dir];
        if (!offset) break;

        const targetX = player.x + offset.x;
        const targetY = player.y + offset.y;

        // Valida limites e colisão com paredes
        if (this.isWalkable(targetX, targetY)) {
          // Valida colisão com bombas ativas
          const hasBomb = Array.from(this.bombs.values()).some(b => b.x === targetX && b.y === targetY);
          if (!hasBomb) {
            player.x = targetX;
            player.y = targetY;

            events.push({
              eventId: this.generateEventId(),
              type: 'PLAYER_MOVED',
              payload: { playerId, x: player.x, y: player.y, dir, seq }
            });

            // Verifica se pisou em power-up
            const key = `${player.x},${player.y}`;
            if (this.powerUps.has(key)) {
              const powerUp = this.powerUps.get(key);
              this.powerUps.delete(key);
              this.applyPowerUp(player, powerUp.type);

              events.push({
                eventId: this.generateEventId(),
                type: 'POWERUP_COLLECTED',
                payload: { powerUpId: powerUp.id, playerId, type: powerUp.type, x: player.x, y: player.y }
              });
            }
          }
        }
        break;
      }

      case 'PLACE_BOMB': {
        // Valida se jogador possui bombas disponíveis
        if (player.bombsActive >= player.bombsMax) {
          break; // Sem estoque disponível
        }

        // Valida se já existe bomba na coordenada atual
        const existingBomb = Array.from(this.bombs.values()).some(b => b.x === player.x && b.y === player.y);
        if (existingBomb) {
          break;
        }

        const bombId = `bomb-${this.nextBombId++}`;
        const bomb = {
          id: bombId,
          playerId: player.id,
          x: player.x,
          y: player.y,
          range: player.bombRange,
          timerMs: this.bombTimerMs,
          createdAt: Date.now()
        };

        this.bombs.set(bombId, bomb);
        player.bombsActive++;

        events.push({
          eventId: this.generateEventId(),
          type: 'BOMB_PLACED',
          payload: {
            bombId,
            playerId: player.id,
            x: bomb.x,
            y: bomb.y,
            timerMs: bomb.timerMs,
            range: bomb.range
          }
        });
        break;
      }

      case 'TRIGGER_EMOTE': {
        events.push({
          eventId: this.generateEventId(),
          type: 'PLAYER_EMOTE',
          payload: { playerId, emoteId: payload.emoteId || 'gg' }
        });
        break;
      }
    }

    return { success: true, events };
  }

  /**
   * Verifica se a coordenada não possui obstáculo intransponível.
   */
  isWalkable(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const tile = this.map[y][x];
    return tile === TILE_TYPE.EMPTY;
  }

  /**
   * Aplica o efeito do power-up coletado.
   */
  applyPowerUp(player, type) {
    switch (type) {
      case POWERUP_TYPE.BOMB:
        player.bombsMax = Math.min(player.bombsMax + 1, 6);
        break;
      case POWERUP_TYPE.FIRE:
        player.bombRange = Math.min(player.bombRange + 1, 8);
        break;
      case POWERUP_TYPE.SPEED:
        player.speed = Math.min(player.speed + 0.5, 3);
        break;
    }
  }

  /**
   * Game Loop Tick (chamado a cada ~50ms pelo Worker).
   * Atualiza timers de bomba, chamas ativas, Morte Súbita e condição de vitória.
   */
  tick(currentTime = Date.now()) {
    if (this.status !== ROOM_STATUS.PLAYING) return [];
    const events = [];

    // 1. Limpa chamas que já expiraram
    this.flames = this.flames.filter(f => f.expiresAt > currentTime);

    // 2. Detona bombas com tempo esgotado
    const bombsToExplode = [];
    for (const bomb of this.bombs.values()) {
      if (currentTime >= bomb.createdAt + bomb.timerMs) {
        bombsToExplode.push(bomb.id);
      }
    }

    if (bombsToExplode.length > 0) {
      const explosionEvents = this.detonateBombs(bombsToExplode, currentTime);
      events.push(...explosionEvents);
    }

    // 3. Toque Criativo: Modo Morte Súbita (Sudden Death)
    if (currentTime >= this.matchStartTime + this.suddenDeathStartMs) {
      if (this.lastSuddenDeathTick === 0 || currentTime >= this.lastSuddenDeathTick + this.suddenDeathIntervalMs) {
        this.lastSuddenDeathTick = currentTime;
        const suddenDeathEvent = this.dropSuddenDeathTile();
        if (suddenDeathEvent) {
          events.push(suddenDeathEvent);
        }
      }
    }

    // 4. Verifica condição de vitória / fim de partida
    const winEvent = this.checkVictoryCondition();
    if (winEvent) {
      events.push(winEvent);
    }

    return events;
  }

  /**
   * Detonação de bombas com suporte completo a REAÇÃO EM CADEIA!
   */
  detonateBombs(initialBombIds, currentTime) {
    const events = [];
    const queue = [...initialBombIds];
    const detonatedBombIds = new Set();

    while (queue.length > 0) {
      const bombId = queue.shift();
      if (detonatedBombIds.has(bombId)) continue;
      detonatedBombIds.add(bombId);

      const bomb = this.bombs.get(bombId);
      if (!bomb) continue;

      // Restaura estoque de bombas do dono
      const owner = this.players.get(bomb.playerId);
      if (owner && owner.bombsActive > 0) {
        owner.bombsActive--;
      }

      // Remove bomba do mapa
      this.bombs.delete(bombId);

      const affectedCells = [{ x: bomb.x, y: bomb.y, type: 'center' }];
      this.flames.push({ x: bomb.x, y: bomb.y, expiresAt: currentTime + this.flameDurationMs });

      // Expansão nas 4 direções
      const directions = [
        { dir: 'UP', dx: 0, dy: -1 },
        { dir: 'DOWN', dx: 0, dy: 1 },
        { dir: 'LEFT', dx: -1, dy: 0 },
        { dir: 'RIGHT', dx: 1, dy: 0 }
      ];

      for (const { dir, dx, dy } of directions) {
        for (let step = 1; step <= bomb.range; step++) {
          const cx = bomb.x + dx * step;
          const cy = bomb.y + dy * step;

          // Se fora do mapa ou parede indestrutível, a chama é bloqueada
          if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) break;
          if (this.map[cy][cx] === TILE_TYPE.INDESTRUCTIBLE) break;

          affectedCells.push({ x: cx, y: cy, type: dir.toLowerCase() });
          this.flames.push({ x: cx, y: cy, expiresAt: currentTime + this.flameDurationMs });

          // Se atingiu bloco destrutível: destrói o tijolo e para a chama nesta direção
          if (this.map[cy][cx] === TILE_TYPE.DESTRUCTIBLE) {
            this.map[cy][cx] = TILE_TYPE.EMPTY;
            events.push({
              eventId: this.generateEventId(),
              type: 'BLOCK_DESTROYED',
              payload: { x: cx, y: cy }
            });

            // Chance de drop de power-up (35%)
            if (this.randomFn() < 0.35) {
              const types = [POWERUP_TYPE.BOMB, POWERUP_TYPE.FIRE, POWERUP_TYPE.SPEED];
              const selectedType = types[Math.floor(this.randomFn() * types.length)];
              const powerUpId = `pwr-${cx}-${cy}`;
              this.powerUps.set(`${cx},${cy}`, { id: powerUpId, type: selectedType, x: cx, y: cy });

              events.push({
                eventId: this.generateEventId(),
                type: 'POWERUP_SPAWNED',
                payload: { powerUpId, type: selectedType, x: cx, y: cy }
              });
            }
            break; // Chama interrompida pelo tijolo
          }

          // Se atingiu outra bomba: REAÇÃO EM CADEIA!
          for (const [otherId, otherBomb] of this.bombs.entries()) {
            if (otherBomb.x === cx && otherBomb.y === cy && !detonatedBombIds.has(otherId)) {
              queue.push(otherId);
            }
          }
        }
      }

      events.push({
        eventId: this.generateEventId(),
        type: 'EXPLOSION',
        payload: {
          bombId: bomb.id,
          playerId: bomb.playerId,
          cells: affectedCells,
          durationMs: this.flameDurationMs
        }
      });

      // Verifica jogadores atingidos pelas chamas desta explosão
      for (const cell of affectedCells) {
        for (const player of this.players.values()) {
          if (player.alive && player.x === cell.x && player.y === cell.y) {
            player.alive = false;
            events.push({
              eventId: this.generateEventId(),
              type: 'PLAYER_DIED',
              payload: { playerId: player.id, killerId: bomb.playerId }
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Modo Morte Súbita: faz cair um bloco indestrutível na próxima coordenada da espiral.
   */
  dropSuddenDeathTile() {
    if (this.suddenDeathIndex >= this.suddenDeathQueue.length) return null;
    const { x, y } = this.suddenDeathQueue[this.suddenDeathIndex++];

    this.map[y][x] = TILE_TYPE.INDESTRUCTIBLE;

    // Esmaga qualquer jogador que estiver na célula
    for (const player of this.players.values()) {
      if (player.alive && player.x === x && player.y === y) {
        player.alive = false;
      }
    }

    return {
      eventId: this.generateEventId(),
      type: 'SUDDEN_DEATH_TILE',
      payload: { x, y }
    };
  }

  /**
   * Gera a lista de coordenadas para a espiral de Morte Súbita.
   */
  generateSuddenDeathQueue() {
    const queue = [];
    let top = 1, bottom = this.height - 2;
    let left = 1, right = this.width - 2;

    while (top <= bottom && left <= right) {
      for (let x = left; x <= right; x++) queue.push({ x, y: top });
      top++;
      for (let y = top; y <= bottom; y++) queue.push({ x: right, y });
      right--;
      if (top <= bottom) {
        for (let x = right; x >= left; x--) queue.push({ x, y: bottom });
        bottom--;
      }
      if (left <= right) {
        for (let y = bottom; y >= top; y--) queue.push({ x: left, y });
        left++;
      }
    }

    this.suddenDeathQueue = queue;
  }

  /**
   * Verifica se resta 1 sobrevivente ou empate.
   */
  checkVictoryCondition() {
    if (this.status !== ROOM_STATUS.PLAYING) return null;

    const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);

    if (alivePlayers.length <= 1) {
      this.status = ROOM_STATUS.FINISHED;

      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        return {
          eventId: this.generateEventId(),
          type: 'GAME_OVER',
          payload: {
            winnerId: winner.id,
            winnerName: winner.name,
            reason: 'LAST_SURVIVOR'
          }
        };
      } else {
        return {
          eventId: this.generateEventId(),
          type: 'GAME_OVER',
          payload: {
            winnerId: null,
            winnerName: null,
            reason: 'DRAW'
          }
        };
      }
    }

    return null;
  }

  getRoomStatePayload() {
    return {
      status: this.status,
      hostId: this.hostId,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        slot: p.slot,
        color: p.color,
        ready: p.ready,
        alive: p.alive,
        isHost: p.id === this.hostId
      }))
    };
  }
}
