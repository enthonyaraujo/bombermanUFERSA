import { WebSocket } from 'ws';

export class WebSocketManager {
  constructor() {
    // roomId -> Map<playerId, ws>
    this.rooms = new Map();
    // ws -> { roomId, playerId, lastActionTimes: number[] }
    this.clients = new WeakMap();
    // Clientes que estão no Lobby principal escutando atualizações de salas em tempo real
    this.lobbyClients = new Set();
  }

  registerLobbyClient(ws) {
    this.lobbyClients.add(ws);
    console.log(`[WS] Cliente conectado ao Lobby (Total ouvindo lobby: ${this.lobbyClients.size})`);
  }

  unregisterLobbyClient(ws) {
    this.lobbyClients.delete(ws);
  }

  broadcastToLobby(event) {
    const message = JSON.stringify(event);
    for (const ws of this.lobbyClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  registerClient(ws, roomId, playerId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    const room = this.rooms.get(roomId);
    room.set(playerId, ws);

    this.clients.set(ws, {
      roomId,
      playerId,
      actionTimestamps: []
    });

    console.log(`[WS] Jogador ${playerId} conectado na sala ${roomId} (Total na sala: ${room.size})`);
  }

  unregisterClient(ws) {
    this.unregisterLobbyClient(ws);

    const meta = this.clients.get(ws);
    if (!meta) return null;

    const { roomId, playerId } = meta;
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(playerId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    console.log(`[WS] Jogador ${playerId} desconectado da sala ${roomId}`);
    return { roomId, playerId };
  }

  /**
   * Valida rate limit de ações para evitar flood no SQS (ex: máx 8 por segundo).
   */
  checkRateLimit(ws, maxPerSec = 8) {
    const meta = this.clients.get(ws);
    if (!meta) return true;

    const now = Date.now();
    meta.actionTimestamps = meta.actionTimestamps.filter(t => now - t < 1000);

    if (meta.actionTimestamps.length >= maxPerSec) {
      return false;
    }

    meta.actionTimestamps.push(now);
    return true;
  }

  /**
   * Envia evento para todos os jogadores conectados em uma sala.
   */
  broadcastToRoom(roomId, event) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const message = JSON.stringify(event);
    for (const [playerId, ws] of room.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Envia mensagem direta para um jogador específico.
   */
  sendToPlayer(roomId, playerId, event) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const ws = room.get(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /**
   * Fecha ativamente todas as conexões de uma sala encerrada e limpa o mapa.
   */
  closeRoom(roomId, code = 1000, reason = 'Sala fechada') {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const [playerId, ws] of room.entries()) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(code, reason);
        }
      } catch (err) {
        console.warn(`[WS] Erro ao fechar socket de ${playerId}:`, err.message);
      }
    }
    this.rooms.delete(roomId);
  }
}

