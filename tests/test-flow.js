import { WebSocket } from 'ws';

const url1 = 'ws://localhost:3000/ws?roomId=arena-teste&playerId=p1&name=Enthony';
const url2 = 'ws://localhost:3000/ws?roomId=arena-teste&playerId=p2&name=Jogador2';

console.log('Testando conexão de 2 jogadores...');

const ws1 = new WebSocket(url1);
let gameStarted = false;

ws1.on('open', () => {
  console.log('P1 conectado. Enviando SET_READY...');
  ws1.send(JSON.stringify({ seq: 2, type: 'SET_READY', payload: { ready: true } }));
});

ws1.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('[P1 recebeu evento]:', msg.type);
  if (msg.type === 'GAME_START') {
    console.log('✔ SUCESSO: P1 recebeu GAME_START!');
    gameStarted = true;
  }
});

setTimeout(() => {
  const ws2 = new WebSocket(url2);
  ws2.on('open', () => {
    console.log('P2 conectado. Enviando SET_READY...');
    ws2.send(JSON.stringify({ seq: 2, type: 'SET_READY', payload: { ready: true } }));
  });

  ws2.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('[P2 recebeu evento]:', msg.type);
    if (msg.type === 'GAME_START') {
      console.log('✔ SUCESSO: P2 recebeu GAME_START!');
      gameStarted = true;
      setTimeout(() => {
        ws1.close();
        ws2.close();
        process.exit(gameStarted ? 0 : 1);
      }, 500);
    }
  });
}, 500);
