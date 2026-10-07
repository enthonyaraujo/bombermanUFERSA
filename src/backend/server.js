import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { WebSocketManager } from './WebSocketManager.js';
import { SqsProducer } from './SqsProducer.js';
import { SqsConsumer } from './SqsConsumer.js';
import { RoomManager } from './RoomManager.js';
import { EventPublisher } from '../worker/EventPublisher.js';
import { ActionProcessor } from '../worker/ActionProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const wsManager = new WebSocketManager();
const roomManager = new RoomManager();

// Função para notificar todos os clientes no lobby sobre alterações nas salas em tempo real
function broadcastLobbyRooms() {
  const rooms = roomManager.listPublicRooms(actionProcessor);
  wsManager.broadcastToLobby({
    type: 'ROOMS_UPDATE',
    payload: { rooms }
  });
}

function handleRoomEvent(roomId, evt) {
  if (['GAME_START', 'ROOM_STATE', 'GAME_OVER', 'ROOM_CLOSED'].includes(evt.type)) {
    if (evt.type === 'ROOM_CLOSED') {
      roomManager.deleteRoom(roomId);
      actionProcessor.rooms.delete(roomId);
      setTimeout(() => {
        wsManager.closeRoom(roomId, 4003, 'Sala encerrada');
      }, 300);
    }
    broadcastLobbyRooms();
  }
}

// Cache de eventos recentes despachados localmente para evitar re-broadcast duplicado pelo SQS
const recentlyPublishedEventIds = new Set();
function markEventPublished(eventId) {
  if (!eventId) return;
  recentlyPublishedEventIds.add(eventId);
  if (recentlyPublishedEventIds.size > 2000) {
    const oldest = recentlyPublishedEventIds.values().next().value;
    recentlyPublishedEventIds.delete(oldest);
  }
}

// Instancia Worker da Game Engine integrado ao Backend
const eventPublisher = new EventPublisher(null, (roomId, evt) => {
  markEventPublished(evt.eventId);
  wsManager.broadcastToRoom(roomId, evt);
  handleRoomEvent(roomId, evt);
});
const actionProcessor = new ActionProcessor(eventPublisher, null, roomManager);

// SqsProducer com fallback automático caso o SQS esteja indisponível
const sqsProducer = new SqsProducer(null, actionProcessor);
const sqsConsumer = new SqsConsumer(
  wsManager,
  null,
  (roomId, evt) => {
    handleRoomEvent(roomId, evt);
  },
  (eventId) => recentlyPublishedEventIds.has(eventId)
);

// Inicia polling em background do SQS
let isWorkerRunning = true;
async function runWorkerPolling() {
  while (isWorkerRunning) {
    try {
      await actionProcessor.pollAndProcess();
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
runWorkerPolling();

// Tick loop do servidor (50ms) para timers autônomos de bomba e morte súbita
setInterval(async () => {
  try {
    await actionProcessor.tickActiveRooms();
  } catch (err) {
    console.error('[Server/Worker] Erro no tick loop:', err);
  }
}, 50);

// Arquivos estáticos do frontend Canvas
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.use(express.json());

// Endpoints da API para status e conformidade com critérios de avaliação
app.get('/api/info', (req, res) => {
  const host = req.headers.host || '';
  let resolvedPublicName = config.appPublicName;

  // Se a requisição veio através de um host específico no formato BOMBERMAN-<NOME>.<DOMINIO>
  if (host && host.toLowerCase().includes('bomberman-')) {
    resolvedPublicName = host.split(':')[0].toUpperCase();
  }

  res.json({
    appPublicName: resolvedPublicName,
    groupMembers: config.groupMembers,
    region: config.aws.region,
    actionsQueue: config.sqs.actionsQueueUrl,
    eventsQueue: config.sqs.eventsQueueUrl,
    timestamp: new Date().toISOString()
  });
});

// Suporte à rota direta com o formato do critério de avaliação
app.get('/bomberman-:name', (req, res) => {
  const playerName = encodeURIComponent(req.params.name.toUpperCase());
  res.redirect(`/?player=${playerName}`);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// ==========================================
// ENDPOINTS DO LOBBY & GERENCIAMENTO DE SALAS
// ==========================================

// Retorna lista de salas para o lobby
app.get('/api/rooms', (req, res) => {
  const rooms = roomManager.listPublicRooms(actionProcessor);
  res.json({ rooms });
});

// Gera um novo código curto aleatório (estilo Among Us / Jackbox, ex.: K7QM)
app.get('/api/rooms/new-code', (req, res) => {
  const code = roomManager.generateUniqueCode();
  res.json({ code });
});

// Cria uma nova sala (Pública ou Privada com Senha)
app.post('/api/rooms', (req, res) => {
  try {
    const { code, name, isPrivate, password, hostId } = req.body;
    const roomCode = (code || roomManager.generateUniqueCode()).toUpperCase().trim();

    const room = roomManager.createRoom(roomCode, {
      name: name || `Arena ${roomCode}`,
      isPrivate: Boolean(isPrivate),
      password: isPrivate ? String(password || '').trim() : null,
      hostId: hostId || null
    });

    broadcastLobbyRooms();

    res.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        createdAt: room.createdAt
      }
    });
  } catch (err) {
    console.error('[Server] Erro ao criar sala:', err);
    res.status(500).json({ success: false, message: 'Erro ao criar sala' });
  }
});

// Valida senha de uma sala privada
app.post('/api/rooms/verify', (req, res) => {
  const { roomId, password } = req.body;
  if (!roomId) {
    return res.status(400).json({ valid: false, reason: 'ROOM_REQUIRED' });
  }

  const result = roomManager.verifyPassword(roomId, password);
  res.json(result);
});

// ==========================================
// CONEXÕES WEBSOCKET
// ==========================================
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = (url.searchParams.get('roomId') || '').toUpperCase().trim();
  const playerId = url.searchParams.get('playerId') || `p-${Math.random().toString(36).substring(2, 7)}`;
  const playerName = url.searchParams.get('name') || `Jogador ${playerId}`;
  const password = url.searchParams.get('password') || '';

  // 1. Conexão exclusiva de observador do Lobby (atualizações de salas em tempo real)
  if (roomId === '__LOBBY__') {
    wsManager.registerLobbyClient(ws);
    // Envia imediatamente a lista de salas atual
    const rooms = roomManager.listPublicRooms(actionProcessor);
    ws.send(JSON.stringify({ type: 'ROOMS_UPDATE', payload: { rooms } }));

    ws.on('close', () => {
      wsManager.unregisterLobbyClient(ws);
    });
    return;
  }

  // 2. Conexão com Sala de Jogo
  const targetRoomId = roomId || 'SALA-1';

  // Validação de senha caso a sala seja privada
  const verify = roomManager.verifyPassword(targetRoomId, password);
  if (!verify.valid && verify.reason === 'INVALID_PASSWORD') {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Senha incorreta para esta sala privada.' }));
    ws.close(4001, 'Senha incorreta');
    return;
  }

  // Se a sala ainda não estiver no RoomManager, registra automaticamente
  if (!roomManager.getRoom(targetRoomId)) {
    roomManager.createRoom(targetRoomId, {
      name: `Arena ${targetRoomId}`,
      isPrivate: false
    });
  }

  // Validação se a sala já atingiu o limite de 4 jogadores
  const existingEngine = actionProcessor.rooms.get(targetRoomId);
  if (existingEngine && existingEngine.players.size >= 4 && !existingEngine.players.has(playerId)) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'A sala está cheia (máximo de 4 jogadores).' }));
    ws.close(4002, 'Sala cheia');
    return;
  }

  wsManager.registerClient(ws, targetRoomId, playerId);

  // Se a engine da sala já possui jogadores, envia o estado atual imediatamente para o novo participante
  if (existingEngine && existingEngine.players.size > 0) {
    ws.send(JSON.stringify({
      type: 'ROOM_STATE',
      payload: existingEngine.getRoomStatePayload()
    }));
  }

  // Enfileira automaticamente o JOIN_ROOM (com seq 1)
  sqsProducer.sendAction(targetRoomId, playerId, 1, 'JOIN_ROOM', { name: playerName })
    .then(() => broadcastLobbyRooms())
    .catch(err => console.error('[Server] Erro ao enviar JOIN_ROOM:', err.message));

  ws.on('message', async (data) => {
    try {
      // Proteção de rate limit (máx 8 ações por segundo)
      if (!wsManager.checkRateLimit(ws, config.game.actionRateLimitPerSecond)) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Rate limit excedido' }));
        return;
      }

      const parsed = JSON.parse(data.toString());
      const { seq, type, payload } = parsed;

      if (!type || typeof seq !== 'number') {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'seq e type são obrigatórios' }));
        return;
      }

      // Publica no SQS (ou despacha para engine via fallback)
      await sqsProducer.sendAction(targetRoomId, playerId, seq, type, payload || {});
    } catch (err) {
      console.error('[Server] Erro ao processar mensagem do WebSocket:', err.message);
    }
  });

  ws.on('close', () => {
    const unreg = wsManager.unregisterClient(ws);
    if (unreg) {
      sqsProducer.sendAction(unreg.roomId, unreg.playerId, 999999, 'DISCONNECT', {})
        .then(() => {
          const engine = actionProcessor.rooms.get(unreg.roomId);
          if (!engine || engine.status === 'CLOSED' || engine.players.size === 0) {
            roomManager.deleteRoom(unreg.roomId);
            actionProcessor.rooms.delete(unreg.roomId);
          }
          broadcastLobbyRooms();
        })
        .catch(err => console.error('[Server] Erro ao enviar DISCONNECT:', err.message));
    }
  });

  ws.on('error', (err) => {
    console.error(`[Server] Erro no socket do jogador ${playerId}:`, err.message);
  });
});

// Inicia consumo contínuo de eventos do SQS
sqsConsumer.start();

// Inicia servidor HTTP
server.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`[Backend] Bomberman Server ouvindo em http://0.0.0.0:${config.port}`);
  console.log(`[Backend] Identificador Público: ${config.appPublicName}`);
  console.log(`[Backend] Membros do Grupo: ${config.groupMembers.join(', ')}`);
  console.log(`[Backend] Game Engine & Worker ativos com suporte a SQS FIFO`);
  console.log(`[Backend] Lobby em tempo real e salas Among Us ativas`);
  console.log(`====================================================`);
});
