import { test, describe } from 'node:test';
import assert from 'node:assert';
import { BombermanEngine, ROOM_STATUS, TILE_TYPE } from '../src/engine/index.js';

describe('BombermanEngine - Vitória e Morte Súbita', () => {
  test('Deve declarar vitória quando resta apenas 1 jogador vivo', () => {
    const engine = new BombermanEngine('room-test', { bombTimerMs: 1000 });
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    assert.strictEqual(engine.status, ROOM_STATUS.PLAYING);

    // Mata p2 diretamente
    const p2 = engine.players.get('p2');
    p2.alive = false;

    // Tick deve detectar vitória
    const events = engine.tick(Date.now());
    const gameOverEvent = events.find(e => e.type === 'GAME_OVER');

    assert.ok(gameOverEvent, 'Deve emitir GAME_OVER');
    assert.strictEqual(gameOverEvent.payload.winnerId, 'p1');
    assert.strictEqual(gameOverEvent.payload.winnerName, 'Alice');
    assert.strictEqual(gameOverEvent.payload.reason, 'LAST_SURVIVOR');
    assert.strictEqual(engine.status, ROOM_STATUS.FINISHED);
  });

  test('Deve ativar o modo Morte Súbita e fechar a arena com blocos indestrutíveis', () => {
    // Configura Morte Súbita para iniciar após 100ms
    const engine = new BombermanEngine('room-test', {
      suddenDeathStartMs: 100,
      suddenDeathIntervalMs: 50
    });
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    const startTime = engine.matchStartTime;

    // Antes de 100ms: nenhum bloco cai
    let events = engine.tick(startTime + 50);
    assert.strictEqual(events.filter(e => e.type === 'SUDDEN_DEATH_TILE').length, 0);

    // Após 100ms: bloco da espiral cai
    events = engine.tick(startTime + 120);
    const sdEvent = events.find(e => e.type === 'SUDDEN_DEATH_TILE');
    assert.ok(sdEvent, 'Deve emitir SUDDEN_DEATH_TILE');

    const { x, y } = sdEvent.payload;
    assert.strictEqual(engine.map[y][x], TILE_TYPE.INDESTRUCTIBLE, 'Tile deve se tornar indestrutível');
  });

  test('Deve declarar empate se todos morrerem ao mesmo tempo', () => {
    const engine = new BombermanEngine('room-test');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    // Ambos morrem
    engine.players.get('p1').alive = false;
    engine.players.get('p2').alive = false;

    const events = engine.tick(Date.now());
    const gameOverEvent = events.find(e => e.type === 'GAME_OVER');

    assert.ok(gameOverEvent, 'Deve emitir GAME_OVER');
    assert.strictEqual(gameOverEvent.payload.winnerId, null);
    assert.strictEqual(gameOverEvent.payload.reason, 'DRAW');
  });

  test('Deve permitir reiniciar a partida e voltar ao lobby após o término', () => {
    const engine = new BombermanEngine('room-test');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    // Finaliza a partida
    engine.players.get('p2').alive = false;
    engine.tick(Date.now());
    assert.strictEqual(engine.status, ROOM_STATUS.FINISHED);

    // Ação de reiniciar partida (RESTART_GAME)
    const restartRes = engine.handleAction('p1', 100, 'RESTART_GAME', {});
    assert.strictEqual(restartRes.success, true);
    assert.strictEqual(engine.status, ROOM_STATUS.LOBBY);

    const roomState = restartRes.events.find(e => e.type === 'ROOM_STATE');
    assert.ok(roomState, 'Deve emitir ROOM_STATE ao resetar para o lobby');
    assert.strictEqual(roomState.payload.status, ROOM_STATUS.LOBBY);

    // Jogadores devem estar vivos e com ready=false
    assert.strictEqual(engine.players.get('p1').alive, true);
    assert.strictEqual(engine.players.get('p2').alive, true);
    assert.strictEqual(engine.players.get('p1').ready, false);
    assert.strictEqual(engine.players.get('p2').ready, false);

    // Ambos dão pronto novamente e nova partida deve começar com sucesso
    engine.setPlayerReady('p1', true);
    const readyRes = engine.setPlayerReady('p2', true);
    assert.strictEqual(readyRes.success, true);
    assert.strictEqual(engine.status, ROOM_STATUS.PLAYING);
    assert.ok(readyRes.events.some(e => e.type === 'GAME_START'));
  });
});
