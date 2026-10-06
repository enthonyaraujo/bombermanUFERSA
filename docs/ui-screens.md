# Telas de Interface - BombermanUFERSA

Documentação das interfaces de usuário geradas via **Google Stitch (Google Labs)** para o projeto **BombermanUFERSA**, jogo multiplayer distribuído via AWS SQS no bioma da Caatinga.

---

## 📌 Informações do Projeto no Stitch

* **Nome do Projeto**: `BombermanUFERSA`
* **ID do Projeto**: `8004069936669358072`
* **Resource Name**: `projects/8004069936669358072`
* **Design System**: `Sertao Pixel 16-Bit HUD` (`assets/1c6dc352d6f748e18c12509a4d5eb837`)
* **Estilo Visual**: Pixel art 16-bit retrô, bordas espessas de 3px/4px, cores chapadas (sem gradientes ou glassmorphism).
* **Paleta de Cores**:
  * Areia (`#E8C987`)
  * Terracota (`#C65D3B`)
  * Verde Cacto / Mandacaru (`#3F7D4E`)
  * Marrom Solo (`#3B2A20`)
  * Azul Noite (`#1D2B53`)
  * Amarelo Sol / Destaque (`#FFD23F`)
* **Tipografia**: Space Mono / Press Start 2P para títulos e números; sans-serif legível para pequenos rótulos.
* **Idioma da Interface**: Português do Brasil (pt-BR).

---

## 🎮 Telas Criadas

### 1. Tela de Jogo (Arena Principal)
* **Título**: `Tela de Jogo - Caatinga Bomber '94`
* **Screen ID**: `d141628aad5a494b905b515f804030cb`
* **Arquivo HTML**: [`frontend/mockups/screen1-game.html`](../frontend/mockups/screen1-game.html)
* **Screenshot**: [`frontend/mockups/screen1-game.png`](../frontend/mockups/screen1-game.png)
* **Elementos**:
  * HUD superior fino em Azul Noite com timer centralizado ("01:37") e 4 chips de jogadores com vidas e pontuação.
  * Grid 15x13 centralizado com piso de areia, blocos indestrutíveis de cacto Mandacaru, caixas de barro destrutíveis.
  * 4 robôs exploradores posicionados nos cantos (Azul, Vermelho, Amarelo, Verde).
  * 2 bombas com pavio aceso e 1 explosão clássica em cruz.
  * Power-ups colecionáveis no piso (bomba extra e fogo aumentado).
  * Indicador discreto de latência ("42 ms").

---

### 2. Tela de Login
* **Título**: `Tela de Login - BombermanUFERSA`
* **Screen ID**: `62da9dfdac4d459b835e22c88f399ef7`
* **Arquivo HTML**: [`frontend/mockups/screen2-login.html`](../frontend/mockups/screen2-login.html)
* **Screenshot**: [`frontend/mockups/screen2-login.png`](../frontend/mockups/screen2-login.png)
* **Elementos**:
  * Logo em tipografia pixelada `BombermanUFERSA` em amarelo e terracota.
  * Cartão centralizado com moldura espessa e relevo 16-bit.
  * Campo de input com placeholder `"Digite seu apelido"`.
  * Botão de ação `"Entrar"`.
  * Rodapé institucional: `"Sistemas Distribuídos - UFERSA"`.

---

### 3. Tela de Lobby
* **Título**: `Lobby - BombermanUFERSA`
* **Screen ID**: `88a9373816ef479db34de118abd53708`
* **Arquivo HTML**: [`frontend/mockups/screen3-lobby.html`](../frontend/mockups/screen3-lobby.html)
* **Screenshot**: [`frontend/mockups/screen3-lobby.png`](../frontend/mockups/screen3-lobby.png)
* **Elementos**:
  * Cabeçalho com selo de status de rede `"Conectado · 42 ms"`.
  * Lista de salas disponíveis com capacidade (`"2/4"`), nome da sala e status (`"Aguardando"` ou `"Em jogo"`).
  * Botões de ação com relevo tátil arcade: `"Criar Sala"` e `"Entrar na Sala"`.
  * Barra de busca e rodapé de créditos.

---

### 4. Sala de Espera (Waiting Room)
* **Título**: `Sala de Espera - BombermanUFERSA`
* **Screen ID**: `6512a231fdb24e06ad593d31332dddca`
* **Arquivo HTML**: [`frontend/mockups/screen4-waiting-room.html`](../frontend/mockups/screen4-waiting-room.html)
* **Screenshot**: [`frontend/mockups/screen4-waiting-room.png`](../frontend/mockups/screen4-waiting-room.png)
* **Elementos**:
  * 4 slots de jogadores com avatares dos robôs nas 4 cores do bioma.
  * Coroa de pixel dourada no slot do Host (`"Jogador 1 (Host)"`).
  * Indicadores de prontidão (`"Pronto"` em verde e `"Aguardando"` em amarelo).
  * Botões de controle: `"Pronto"`, `"Iniciar Partida"` e `"Sair da Sala"`.
  * Dica de controle no rodapé: `"WASD / Setas: mover · Espaço: bomba"`.

---

### 5. Resultado da Partida (Pódio / Fim de Jogo)
* **Título**: `Resultado da Partida - BombermanUFERSA`
* **Screen ID**: `7dc7b5db14924664b1137207c773e993`
* **Arquivo HTML**: [`frontend/mockups/screen5-match-result.html`](../frontend/mockups/screen5-match-result.html)
* **Screenshot**: [`frontend/mockups/screen5-match-result.png`](../frontend/mockups/screen5-match-result.png)
* **Elementos**:
  * Pódio retrô em blocos de 1º ao 4º colocado (`"1º"`, `"2º"`, `"3º"`, `"4º"`).
  * Destaque para o campeão com troféu de pixel, apelidos e pontuações calculadas.
  * Botões de reinício rápido: `"Jogar Novamente"` e `"Voltar ao Lobby"`.

---

### 6. Componentes de Estado e Notificações (Toasts)
* **Título**: `Componentes de Estado - BombermanUFERSA`
* **Screen ID**: `f58b3798136048fda1ef25e0301f1811`
* **Arquivo HTML**: [`frontend/mockups/screen6-state-components.html`](../frontend/mockups/screen6-state-components.html)
* **Screenshot**: [`frontend/mockups/screen6-state-components.png`](../frontend/mockups/screen6-state-components.png)
* **Elementos**:
  * Toast de alerta: `"Reconectando..."` com ícone de loading retrô e moldura amarela.
  * Toast de desconexão: `"Jogador desconectado"` em faixa de alerta terracota com ícone de plugue/caveira.
  * Badges persistentes de conexão: `"Conectado · 42 ms"` e `"Desconectado"`.
  * Área interativa com disparadores de eventos para teste de interface.

---

## 📁 Estrutura de Arquivos Gerados

```text
frontend/mockups/
├── screen1-game.html
├── screen1-game.png
├── screen2-login.html
├── screen2-login.png
├── screen3-lobby.html
├── screen3-lobby.png
├── screen4-waiting-room.html
├── screen4-waiting-room.png
├── screen5-match-result.html
├── screen5-match-result.png
├── screen6-state-components.html
└── screen6-state-components.png
docs/
└── ui-screens.md
```
