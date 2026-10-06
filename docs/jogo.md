# Bomberman multiplayer web com AWS SQS

## Conceito
Clone de Bomberman jogado no navegador, 2 a 4 jogadores por sala, arena em
grade (ex.: 13x11) com blocos fixos e blocos destrutíveis. Vence o último vivo.
Use nome, sprites e sons originais (ou formas simples/emojis), sem assets oficiais.

## Regras
- Movimento em grade, 4 direções
- Bomba: explode após 2,5 s, explosão em cruz com alcance inicial 2
- Explosão destrói blocos destrutíveis, mata jogadores e detona outras bombas (reação em cadeia)
- Blocos destruídos podem soltar power-ups: +bomba, +alcance, +velocidade
- Partida termina quando resta 1 jogador (ou empate por tempo, 3 min)
- Toques criativos (escolher 1 ou 2): modo "morte súbita" que fecha a arena,
  chuva de bombas aleatórias, bomba chutável, emotes

## Requisitos funcionais
- Apelido, criar sala, entrar por código, lobby com "pronto"
- Renderização em <canvas>, controles: setas/WASD + espaço
- Placar da rodada e botão "jogar novamente"

## Arquitetura com SQS
Navegador --WebSocket--> Backend --SendMessage--> actions.fifo
actions.fifo --long polling--> Worker (game engine) --> events.fifo
events.fifo --> Backend --WebSocket--> navegadores

- O worker é a autoridade do jogo: valida movimento, colisões, timers de bomba, explosões
- O cliente só envia intenções ({type: "move", dir} / {type: "bomb"}), nunca estado
- MessageGroupId = roomId (ordem por sala); MessageDeduplicationId = playerId + seq
- Mensagem: { roomId, playerId, seq, type, payload, ts }
- Eventos publicados: playerMoved, bombPlaced, explosion, blockDestroyed,
  powerUpSpawned, playerDied, gameOver
- DeleteMessage somente após processar; ignorar seq já visto (idempotência)

## Cuidados de desempenho
- SQS não é tempo real: limitar a ~5-8 ações por segundo por jogador
- Enviar eventos (deltas), não snapshots do mapa a cada tick
- Usar SendMessageBatch / ReceiveMessage com até 10 mensagens, WaitTimeSeconds=20
- Cliente faz predição simples do próprio movimento e corrige com o servidor
- Timers das bombas rodam no worker, não nos clientes