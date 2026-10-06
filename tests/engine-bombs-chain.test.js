import { test, describe } from 'node:test';
import assert from 'node:assert';
import { BombermanEngine, TILE_TYPE } from '../src/engine/index.js';

describe('BombermanEngine - Bombas e Explosões em Cadeia', () => {
  test('Deve plantar bomba respeitando o estoque máximo (bombsMax)', () => {
    const engine = new BombermanEngine('room-test', { bombTimerMs: 2000 });
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    const p1 = engine.players.get('p1');
    assert.strictEqual(p1.bombsActive, 0);
    assert.strictEqual(p1.bombsMax, 1);

    // 1ª bomba: sucesso
    const plant1 = engine.handleAction('p1', 1, 'PLACE_BOMB');
    assert.strictEqual(plant1.success, true);
    assert.strictEqual(p1.bombsActive, 1);
    assert.strictEqual(engine.bombs.size, 1);

    // 2ª bomba no mesmo lugar ou sem estoque: deve falhar
    const plant2 = engine.handleAction('p1', 2, 'PLACE_BOMB');
    assert.strictEqual(plant2.events.length, 0);
    assert.strictEqual(engine.bombs.size, 1);
  });

  test('Deve explodir bomba após expirar o timer e destruir tijolos', () => {
    const engine = new BombermanEngine('room-test', { bombTimerMs: 1000 });
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    // Coloca um tijolo em (1, 2)
    engine.map[2][1] = TILE_TYPE.DESTRUCTIBLE;

    // Planta bomba em (1, 1)
    engine.handleAction('p1', 1, 'PLACE_BOMB');
    const bomb = Array.from(engine.bombs.values())[0];
    const plantTime = bomb.createdAt;

    // Antes de 1000ms: nada explode
    let events = engine.tick(plantTime + 500);
    assert.strictEqual(events.length, 0);
    assert.strictEqual(engine.bombs.size, 1);

    // Após 1000ms: deve explodir, destruir o bloco em (1, 2) e liberar bomba para p1
    events = engine.tick(plantTime + 1050);
    const explosionEvent = events.find(e => e.type === 'EXPLOSION');
    const blockDestroyedEvent = events.find(e => e.type === 'BLOCK_DESTROYED');

    assert.ok(explosionEvent, 'Deve emitir EXPLOSION');
    assert.ok(blockDestroyedEvent, 'Deve emitir BLOCK_DESTROYED');
    assert.strictEqual(engine.map[2][1], TILE_TYPE.EMPTY, 'Bloco deve ser transformado em vazio');
    assert.strictEqual(engine.bombs.size, 0, 'Bomba deve ser removida');
    assert.strictEqual(engine.players.get('p1').bombsActive, 0, 'Estoque deve ser restaurado');
  });

  test('Deve detonar bombas em cadeia imediatamente quando atingidas por chamas', () => {
    const engine = new BombermanEngine('room-test', { bombTimerMs: 5000 });
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    // Remove qualquer obstáculo no caminho entre (1,1) e (1,2)
    engine.map[2][1] = TILE_TYPE.EMPTY;

    // Aumenta estoque temporário de p1 para plantar 2 bombas para o teste
    const p1 = engine.players.get('p1');
    p1.bombsMax = 2;

    // Bomba A em (1, 1)
    engine.handleAction('p1', 1, 'PLACE_BOMB');
    const bombA = Array.from(engine.bombs.values())[0];

    // Move para (1, 2) e planta Bomba B
    engine.handleAction('p1', 2, 'MOVE', { dir: 'DOWN' });
    engine.handleAction('p1', 3, 'PLACE_BOMB');
    assert.strictEqual(engine.bombs.size, 2);

    // Simula que a Bomba A atingiu seu tempo limite
    const now = bombA.createdAt + 5100;
    // Bomba B foi plantada depois e seu tempo ainda seria daqui a 4900ms!
    // Porém, como a Bomba A atinge (1, 2), a Bomba B deve explodir EM CADEIA no mesmo tick!
    const events = engine.tick(now);

    const explosions = events.filter(e => e.type === 'EXPLOSION');
    assert.strictEqual(explosions.length, 2, 'Ambas as bombas devem ter explodido por reação em cadeia');
    assert.strictEqual(engine.bombs.size, 0, 'Todas as bombas detonadas devem sair do mapa');
  });

  test('Deve eliminar jogador atingido pela chama da explosão', () => {
    const engine = new BombermanEngine('room-test', { bombTimerMs: 1000 });
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    // Garante caminho livre
    engine.map[2][1] = TILE_TYPE.EMPTY;

    // P2 é colocado manualmente em (1, 2) no raio da bomba de P1
    const p2 = engine.players.get('p2');
    p2.x = 1;
    p2.y = 2;

    // P1 planta bomba em (1, 1)
    engine.handleAction('p1', 1, 'PLACE_BOMB');
    const bomb = Array.from(engine.bombs.values())[0];

    // Tick que faz a bomba explodir
    const events = engine.tick(bomb.createdAt + 1050);

    const deathEvent = events.find(e => e.type === 'PLAYER_DIED' && e.payload.playerId === 'p2');
    assert.ok(deathEvent, 'P2 deve morrer pela explosão');
    assert.strictEqual(p2.alive, false);
  });
});
