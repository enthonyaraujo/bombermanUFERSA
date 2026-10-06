import { test, describe } from 'node:test';
import assert from 'node:assert';
import { BombermanEngine, TILE_TYPE, ROOM_STATUS } from '../src/engine/index.js';

describe('BombermanEngine - Movimento e Colisões', () => {
  test('Deve adicionar jogadores até o limite de 4 no lobby', () => {
    const engine = new BombermanEngine('room-test');
    
    assert.strictEqual(engine.addPlayer('p1', 'Alice').success, true);
    assert.strictEqual(engine.addPlayer('p2', 'Bob').success, true);
    assert.strictEqual(engine.addPlayer('p3', 'Carlos').success, true);
    assert.strictEqual(engine.addPlayer('p4', 'Diana').success, true);

    // 5º jogador deve ser recusado
    const extra = engine.addPlayer('p5', 'Eve');
    assert.strictEqual(extra.success, false);
    assert.strictEqual(extra.reason, 'ROOM_FULL');
  });

  test('Deve bloquear movimento contra paredes indestrutíveis e fora do mapa', () => {
    const engine = new BombermanEngine('room-test');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true); // Inicia partida

    // P1 spawna em (1, 1). Parede indestrutível está em (0, 1) à esquerda e (1, 0) acima.
    const p1 = engine.players.get('p1');
    assert.strictEqual(p1.x, 1);
    assert.strictEqual(p1.y, 1);

    // Tenta mover para a esquerda (colide com parede em x=0)
    const moveLeft = engine.handleAction('p1', 1, 'MOVE', { dir: 'LEFT' });
    assert.strictEqual(p1.x, 1);
    assert.strictEqual(p1.y, 1);
    assert.strictEqual(moveLeft.events.length, 0);

    // Tenta mover para cima (colide com parede em y=0)
    const moveUp = engine.handleAction('p1', 2, 'MOVE', { dir: 'UP' });
    assert.strictEqual(p1.x, 1);
    assert.strictEqual(p1.y, 1);
    assert.strictEqual(moveUp.events.length, 0);
  });

  test('Deve permitir movimento em células livres e atualizar coordenadas', () => {
    const engine = new BombermanEngine('room-test');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    // Como garantimos que as células de spawn e adjacências imediatas são livres:
    // (1, 1) -> (1, 2) é livre para P1!
    const moveDown = engine.handleAction('p1', 1, 'MOVE', { dir: 'DOWN' });
    const p1 = engine.players.get('p1');

    assert.strictEqual(moveDown.success, true);
    assert.strictEqual(p1.x, 1);
    assert.strictEqual(p1.y, 2);
    assert.strictEqual(moveDown.events[0].type, 'PLAYER_MOVED');
  });

  test('Deve ignorar ações duplicadas ou fora de ordem (idempotência por seq)', () => {
    const engine = new BombermanEngine('room-test');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.setPlayerReady('p1', true);
    engine.setPlayerReady('p2', true);

    const first = engine.handleAction('p1', 10, 'MOVE', { dir: 'DOWN' });
    assert.strictEqual(first.success, true);

    // Mesma seq
    const duplicate = engine.handleAction('p1', 10, 'MOVE', { dir: 'UP' });
    assert.strictEqual(duplicate.success, false);
    assert.strictEqual(duplicate.reason, 'DUPLICATE_SEQ');

    // seq anterior
    const older = engine.handleAction('p1', 5, 'MOVE', { dir: 'UP' });
    assert.strictEqual(older.success, false);
    assert.strictEqual(older.reason, 'DUPLICATE_SEQ');
  });
});
