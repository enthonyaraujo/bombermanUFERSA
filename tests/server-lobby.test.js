import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from '../src/backend/RoomManager.js';
import { WebSocketManager } from '../src/backend/WebSocketManager.js';

describe('Servidor - Lobby em Tempo Real e Salas Among Us', () => {
  let server;
  let port;
  let roomManager;
  let wsManager;

  before(async () => {
    const app = express();
    app.use(express.json());

    roomManager = new RoomManager();
    wsManager = new WebSocketManager();

    app.get('/api/rooms', (req, res) => {
      res.json({ rooms: roomManager.listPublicRooms() });
    });

    app.get('/api/rooms/new-code', (req, res) => {
      res.json({ code: roomManager.generateUniqueCode() });
    });

    app.post('/api/rooms', (req, res) => {
      const { code, name, isPrivate, password } = req.body;
      const room = roomManager.createRoom(code, { name, isPrivate, password });
      res.json({ success: true, room });
    });

    app.post('/api/rooms/verify', (req, res) => {
      const { roomId, password } = req.body;
      const result = roomManager.verifyPassword(roomId, password);
      res.json(result);
    });

    server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const roomId = (url.searchParams.get('roomId') || '').toUpperCase();
      const password = url.searchParams.get('password') || '';

      if (roomId === '__LOBBY__') {
        wsManager.registerLobbyClient(ws);
        ws.send(JSON.stringify({ type: 'ROOMS_UPDATE', payload: { rooms: roomManager.listPublicRooms() } }));
        return;
      }

      const verify = roomManager.verifyPassword(roomId, password);
      if (!verify.valid && verify.reason === 'INVALID_PASSWORD') {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Senha incorreta' }));
        ws.close(4001, 'Senha incorreta');
        return;
      }

      ws.send(JSON.stringify({ type: 'JOIN_SUCCESS', roomId }));
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('Deve gerar código curto de 4 caracteres via /api/rooms/new-code', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/rooms/new-code`);
    const data = await res.json();
    assert.ok(data.code);
    assert.equal(data.code.length, 4);
    assert.match(data.code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  });

  test('Deve criar sala pública e listar no lobby sem expor senha', async () => {
    const createRes = await fetch(`http://127.0.0.1:${port}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'PUB1', name: 'Arena Aberta', isPrivate: false })
    });
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    assert.equal(createData.room.id, 'PUB1');

    const listRes = await fetch(`http://127.0.0.1:${port}/api/rooms`);
    const listData = await listRes.json();
    const found = listData.rooms.find(r => r.id === 'PUB1');
    assert.ok(found);
    assert.equal(found.isPrivate, false);
  });

  test('Deve criar sala privada com senha e verificar validação correta e incorreta', async () => {
    await fetch(`http://127.0.0.1:${port}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SEC1', name: 'Sala Secreta', isPrivate: true, password: '123' })
    });

    // Senha errada
    const wrongRes = await fetch(`http://127.0.0.1:${port}/api/rooms/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'SEC1', password: 'errado' })
    });
    const wrongData = await wrongRes.json();
    assert.equal(wrongData.valid, false);

    // Senha certa
    const correctRes = await fetch(`http://127.0.0.1:${port}/api/rooms/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'SEC1', password: '123' })
    });
    const correctData = await correctRes.json();
    assert.equal(correctData.valid, true);
  });

  test('Deve rejeitar conexão WebSocket em sala privada com senha incorreta e aceitar com senha correta', async () => {
    // 1. Tenta conectar com senha incorreta
    const wsWrong = new WebSocket(`ws://127.0.0.1:${port}/ws?roomId=SEC1&password=errado`);
    const closePromise = new Promise((resolve) => {
      wsWrong.on('close', (code) => resolve(code));
    });
    const closeCode = await closePromise;
    assert.equal(closeCode, 4001);

    // 2. Conecta com senha correta
    const wsCorrect = new WebSocket(`ws://127.0.0.1:${port}/ws?roomId=SEC1&password=123`);
    const messagePromise = new Promise((resolve) => {
      wsCorrect.on('message', (data) => resolve(JSON.parse(data.toString())));
    });
    const msg = await messagePromise;
    assert.equal(msg.type, 'JOIN_SUCCESS');
    assert.equal(msg.roomId, 'SEC1');
    wsCorrect.close();
  });

  test('Deve permitir que 4 jogadores entrem consecutivamente na mesma sala sem apagar nenhum jogador', async () => {
    const { ActionProcessor } = await import('../src/worker/ActionProcessor.js');
    const { EventPublisher } = await import('../src/worker/EventPublisher.js');

    let lastBroadcastPlayers = [];
    const eventPublisher = new EventPublisher(null, (roomId, evt) => {
      if (evt.type === 'ROOM_STATE' && evt.payload.players) {
        lastBroadcastPlayers = evt.payload.players;
      }
    });
    eventPublisher.sqsOnline = false;

    const processor = new ActionProcessor(eventPublisher);

    // Entrada de 4 jogadores consecutivos
    await processor.processDirectAction('ROOM4', 'p1', 1, 'JOIN_ROOM', { name: 'Jogador 1' });
    assert.equal(lastBroadcastPlayers.length, 1);

    await processor.processDirectAction('ROOM4', 'p2', 1, 'JOIN_ROOM', { name: 'Jogador 2' });
    assert.equal(lastBroadcastPlayers.length, 2);

    await processor.processDirectAction('ROOM4', 'p3', 1, 'JOIN_ROOM', { name: 'Jogador 3' });
    assert.equal(lastBroadcastPlayers.length, 3);
    assert.deepEqual(lastBroadcastPlayers.map(p => p.name), ['Jogador 1', 'Jogador 2', 'Jogador 3']);

    await processor.processDirectAction('ROOM4', 'p4', 1, 'JOIN_ROOM', { name: 'Jogador 4' });
    assert.equal(lastBroadcastPlayers.length, 4);
    assert.deepEqual(lastBroadcastPlayers.map(p => p.name), ['Jogador 1', 'Jogador 2', 'Jogador 3', 'Jogador 4']);

    // 5º jogador é rejeitado por sala cheia e lista de 4 se mantém intacta
    const p5Events = await processor.processDirectAction('ROOM4', 'p5', 1, 'JOIN_ROOM', { name: 'Jogador 5' });
    assert.equal(p5Events.length, 0);
    assert.equal(lastBroadcastPlayers.length, 4);
  });
});

