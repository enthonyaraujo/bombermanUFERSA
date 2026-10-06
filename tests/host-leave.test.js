import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { BombermanEngine } from '../src/engine/BombermanEngine.js';
import { ActionProcessor } from '../src/worker/ActionProcessor.js';
import { EventPublisher } from '../src/worker/EventPublisher.js';
import { RoomManager } from '../src/backend/RoomManager.js';
import { WebSocketManager } from '../src/backend/WebSocketManager.js';

describe('Encerramento de Sala ao Saída do Host', () => {
  test('Deve encerrar a sala e emitir ROOM_CLOSED quando o Host sai da sala', () => {
    const engine = new BombermanEngine('K7QM');
    engine.addPlayer('p-host', 'Host Player');
    engine.addPlayer('p-guest', 'Guest Player');

    assert.equal(engine.hostId, 'p-host');
    assert.equal(engine.players.size, 2);

    // Host sai
    const res = engine.removePlayer('p-host');
    assert.equal(res.success, true);
    assert.equal(res.roomClosed, true);
    assert.equal(engine.status, 'CLOSED');
    assert.equal(engine.players.size, 0);

    const closedEvt = res.events.find(e => e.type === 'ROOM_CLOSED');
    assert.ok(closedEvt);
    assert.equal(closedEvt.payload.reason, 'HOST_LEFT');
  });

  test('Não deve encerrar a sala quando um jogador não-host sai da sala', () => {
    const engine = new BombermanEngine('B4TX');
    engine.addPlayer('p-host', 'Host Player');
    engine.addPlayer('p-guest', 'Guest Player');

    // Convidado sai
    const res = engine.removePlayer('p-guest');
    assert.equal(res.success, true);
    assert.equal(res.roomClosed, false);
    assert.equal(engine.status, 'LOBBY');
    assert.equal(engine.players.size, 1);
    assert.equal(engine.hostId, 'p-host');

    const closedEvt = res.events.find(e => e.type === 'ROOM_CLOSED');
    assert.equal(closedEvt, undefined);

    const stateEvt = res.events.find(e => e.type === 'ROOM_STATE');
    assert.ok(stateEvt);
  });

  test('ActionProcessor deve deletar a sala ao processar DISCONNECT do Host', async () => {
    let publishedEvents = [];
    const eventPublisher = new EventPublisher(null, (roomId, evt) => {
      publishedEvents.push(evt);
    });
    const processor = new ActionProcessor(eventPublisher);

    // Host e Guest entram
    await processor.processDirectAction('ROOM-TEST', 'host-1', 1, 'JOIN_ROOM', { name: 'Host' });
    await processor.processDirectAction('ROOM-TEST', 'guest-1', 1, 'JOIN_ROOM', { name: 'Guest' });
    assert.ok(processor.rooms.has('ROOM-TEST'));

    // Host desconecta
    await processor.processDirectAction('ROOM-TEST', 'host-1', 2, 'DISCONNECT', {});
    assert.equal(processor.rooms.has('ROOM-TEST'), false);

    const closedEvt = publishedEvents.find(e => e.type === 'ROOM_CLOSED');
    assert.ok(closedEvt);
    assert.equal(closedEvt.payload.reason, 'HOST_LEFT');
  });

  test('Desconexão subsequente de convidado após saída do Host não deve ressuscitar a sala nem deixar sala 0/4 no lobby', async () => {
    const roomManager = new RoomManager();
    roomManager.createRoom('MWUJ', { name: 'Arena MWUJ', hostId: 'host-1' });

    let publishedEvents = [];
    const eventPublisher = new EventPublisher(null, (roomId, evt) => {
      publishedEvents.push(evt);
    });
    const processor = new ActionProcessor(eventPublisher, null, roomManager);

    // 1. Host e convidado entram na sala
    await processor.processDirectAction('MWUJ', 'host-1', 1, 'JOIN_ROOM', { name: 'Host' });
    await processor.processDirectAction('MWUJ', 'guest-1', 1, 'JOIN_ROOM', { name: 'Guest' });

    // Lobby lista com 2 jogadores
    let rooms = roomManager.listPublicRooms(processor);
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].playersCount, 2);

    // 2. Host sai da sala
    await processor.processDirectAction('MWUJ', 'host-1', 999999, 'DISCONNECT', {});

    // Sala deve ser fechada na engine e excluída do RoomManager
    assert.equal(processor.rooms.has('MWUJ'), false);
    assert.equal(roomManager.getRoom('MWUJ'), null);

    // 3. Convidado recebe ROOM_CLOSED e seu socket fecha disparando DISCONNECT
    await processor.processDirectAction('MWUJ', 'guest-1', 999999, 'DISCONNECT', {});

    // A engine NÃO deve ser ressuscitada
    assert.equal(processor.rooms.has('MWUJ'), false);

    // O lobby NÃO deve conter sala 0/4 zumbi
    rooms = roomManager.listPublicRooms(processor);
    assert.equal(rooms.length, 0);
  });

  test('Se todos os jogadores saírem de uma sala, ela deve fechar e ser removida do lobby', async () => {
    const roomManager = new RoomManager();
    roomManager.createRoom('EMPTY', { name: 'Arena Vazia', hostId: 'p-1' });

    let publishedEvents = [];
    const eventPublisher = new EventPublisher(null, (roomId, evt) => {
      publishedEvents.push(evt);
    });
    const processor = new ActionProcessor(eventPublisher, null, roomManager);

    await processor.processDirectAction('EMPTY', 'p-1', 1, 'JOIN_ROOM', { name: 'Player 1' });
    assert.equal(processor.rooms.has('EMPTY'), true);

    // Sai o único jogador
    await processor.processDirectAction('EMPTY', 'p-1', 2, 'DISCONNECT', {});
    assert.equal(processor.rooms.has('EMPTY'), false);
    assert.equal(roomManager.listPublicRooms(processor).length, 0);
  });
});
