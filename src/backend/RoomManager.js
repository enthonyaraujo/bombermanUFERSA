/**
 * Gerenciador de Salas de Jogo com Códigos Curtos (Estilo Among Us / Jackbox)
 * Suporta salas públicas e privadas com senha.
 */

// Conjunto de caracteres legíveis sem ambiguidade visual (sem 0/O ou 1/I)
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateShortRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export class RoomManager {
  constructor() {
    // roomId (uppercase) -> { id, name, isPrivate, password, createdAt }
    this.rooms = new Map();
  }

  /**
   * Gera um código de 4 caracteres único.
   */
  generateUniqueCode() {
    let code;
    let attempts = 0;
    do {
      code = generateShortRoomCode();
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }

  /**
   * Cria ou registra uma nova sala.
   */
  createRoom(roomId, options = {}) {
    const id = (roomId || this.generateUniqueCode()).toUpperCase().trim();
    const isPrivate = Boolean(options.isPrivate);
    const password = isPrivate ? String(options.password || '').trim() : null;
    const name = options.name ? options.name.trim() : `Arena ${id}`;
    const hostId = options.hostId || null;

    const room = {
      id,
      name,
      isPrivate,
      password,
      hostId,
      createdAt: Date.now()
    };

    this.rooms.set(id, room);
    return room;
  }

  /**
   * Obtém os dados de uma sala.
   */
  getRoom(roomId) {
    if (!roomId) return null;
    return this.rooms.get(roomId.toUpperCase().trim()) || null;
  }

  /**
   * Remove uma sala do registro.
   */
  deleteRoom(roomId) {
    if (!roomId) return false;
    return this.rooms.delete(roomId.toUpperCase().trim());
  }

  /**
   * Valida a senha para entrar em uma sala privada.
   */
  verifyPassword(roomId, inputPassword) {
    const room = this.getRoom(roomId);
    if (!room) return { valid: false, reason: 'ROOM_NOT_FOUND' };
    if (!room.isPrivate) return { valid: true };

    const valid = room.password === String(inputPassword || '').trim();
    return {
      valid,
      reason: valid ? null : 'INVALID_PASSWORD'
    };
  }

  /**
   * Retorna a lista de salas públicas e privadas para exibição no lobby.
   * Não expõe a senha real das salas privadas.
   * Descarta e limpa automaticamente salas vazias ou encerradas.
   */
  listPublicRooms(actionProcessor = null) {
    const list = [];
    const now = Date.now();

    // Garante que salas ativas na engine também apareçam se não cadastradas
    if (actionProcessor && actionProcessor.rooms) {
      for (const [roomId, engine] of actionProcessor.rooms.entries()) {
        if (engine.status === 'CLOSED' || engine.players.size === 0) {
          actionProcessor.rooms.delete(roomId);
          this.rooms.delete(roomId);
        } else if (!this.rooms.has(roomId) && roomId !== '__LOBBY__') {
          this.rooms.set(roomId, {
            id: roomId,
            name: `Arena ${roomId}`,
            isPrivate: false,
            password: null,
            hostId: engine.hostId || null,
            createdAt: now
          });
        }
      }
    }

    const roomsToDelete = [];

    for (const room of this.rooms.values()) {
      let playersCount = 0;
      let status = 'LOBBY';

      if (actionProcessor && actionProcessor.rooms) {
        const engine = actionProcessor.rooms.get(room.id);
        if (engine) {
          if (engine.status === 'CLOSED' || engine.players.size === 0) {
            roomsToDelete.push(room.id);
            continue;
          }
          playersCount = engine.players.size;
          status = engine.status || 'LOBBY';
        } else {
          // Engine ainda não existe. Se passou de 10s sem ninguém conectar, sala expirou/abandonada
          if (now - room.createdAt > 10000) {
            roomsToDelete.push(room.id);
            continue;
          }
        }
      }

      list.push({
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        playersCount,
        maxPlayers: 4,
        status, // 'LOBBY' ou 'PLAYING'
        createdAt: room.createdAt
      });
    }

    // Limpa salas encerradas e zumbis identificadas
    for (const id of roomsToDelete) {
      this.deleteRoom(id);
      if (actionProcessor && actionProcessor.rooms) {
        actionProcessor.rooms.delete(id);
      }
    }

    // Ordena mais recentes primeiro
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }
}
