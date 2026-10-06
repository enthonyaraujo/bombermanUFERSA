import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager, generateShortRoomCode } from '../src/backend/RoomManager.js';

describe('RoomManager - Gestão de Salas Among Us / Jackbox', () => {
  test('Deve gerar código curto de 4 caracteres legíveis em maiúsculo', () => {
    const code = generateShortRoomCode();
    assert.equal(typeof code, 'string');
    assert.equal(code.length, 4);
    assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  });

  test('Deve criar sala pública com código curto único', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('K7QM', { name: 'Arena do Sertão', isPrivate: false });

    assert.equal(room.id, 'K7QM');
    assert.equal(room.name, 'Arena do Sertão');
    assert.equal(room.isPrivate, false);
    assert.equal(room.password, null);

    const retrieved = manager.getRoom('k7qm'); // Case insensitive
    assert.ok(retrieved);
    assert.equal(retrieved.id, 'K7QM');
  });

  test('Deve criar sala privada com senha e validar acesso', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('B4TX', {
      name: 'Sala Secreta',
      isPrivate: true,
      password: 'caatinga123'
    });

    assert.equal(room.isPrivate, true);
    assert.equal(room.password, 'caatinga123');

    // Validação correta
    const validCheck = manager.verifyPassword('B4TX', 'caatinga123');
    assert.equal(validCheck.valid, true);

    // Validação incorreta
    const invalidCheck = manager.verifyPassword('B4TX', 'senha_errada');
    assert.equal(invalidCheck.valid, false);
    assert.equal(invalidCheck.reason, 'INVALID_PASSWORD');
  });

  test('Deve listar salas sem expor senhas no payload público', () => {
    const manager = new RoomManager();
    manager.createRoom('PUB1', { name: 'Sala Pública', isPrivate: false });
    manager.createRoom('PRIV', { name: 'Sala Privada', isPrivate: true, password: 'segredo' });

    const list = manager.listPublicRooms();
    assert.equal(list.length, 2);

    const privRoom = list.find(r => r.id === 'PRIV');
    assert.ok(privRoom);
    assert.equal(privRoom.isPrivate, true);
    assert.equal(privRoom.password, undefined); // Não expõe senha!
  });
});
