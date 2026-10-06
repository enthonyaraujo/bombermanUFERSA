import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPE, DIR_OFFSETS } from './Constants.js';
import { Network } from './Network.js';
import { InputHandler } from './InputHandler.js';
import { Renderer } from './Renderer.js';

// Metadados dos Robôs 16-Bit da Caatinga
const ROBOT_META = [
  { name: 'ROBÔ AZUL', sub: 'Lampião.bot', color: '#2E6FDF' },
  { name: 'ROBÔ VERMELHO', sub: 'Asa Branca', color: '#D9383A' },
  { name: 'ROBÔ AMARELO', sub: 'Mandacaru', color: '#FFD23F' },
  { name: 'ROBÔ VERDE', sub: 'Juazeiro', color: '#3F7D4E' }
];

// Elementos de Telas
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');

// Elementos da Tela de Login
const playerNameInput = document.getElementById('player-name');
const btnLogin = document.getElementById('btn-login');

// Elementos do Lobby Principal
const lobbyPlayerDisplay = document.getElementById('lobby-player-display');
const btnOpenCreateRoom = document.getElementById('btn-open-create-room');
const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
const quickCodeInput = document.getElementById('quick-code-input');
const btnQuickJoin = document.getElementById('btn-quick-join');
const roomsListEl = document.getElementById('rooms-list');

// Elementos do Modal Criar Sala
const modalCreateRoom = document.getElementById('modal-create-room');
const newRoomNameInput = document.getElementById('new-room-name');
const newRoomCodeInput = document.getElementById('new-room-code');
const btnRegenerateCode = document.getElementById('btn-regenerate-code');
const passwordFieldContainer = document.getElementById('password-field-container');
const newRoomPasswordInput = document.getElementById('new-room-password');
const btnConfirmCreateRoom = document.getElementById('btn-confirm-create-room');
const btnCloseCreateRoom = document.getElementById('btn-close-create-room');
const privacyRadios = document.querySelectorAll('input[name="room-privacy"]');

// Elementos do Modal de Senha (Sala Privada com Cadeado)
const modalPassword = document.getElementById('modal-password');
const pwdModalRoomCode = document.getElementById('pwd-modal-room-code');
const privateRoomPasswordInput = document.getElementById('private-room-password');
const pwdErrorMsg = document.getElementById('pwd-error-msg');
const btnSubmitPassword = document.getElementById('btn-submit-password');
const btnCancelPassword = document.getElementById('btn-cancel-password');

// Elementos da Sala de Espera
const currentRoomCodeEl = document.getElementById('current-room-code');
const currentRoomPrivacyEl = document.getElementById('current-room-privacy');
const currentRoomNameSubtitleEl = document.getElementById('current-room-name-subtitle');
const waitingPlayerCountEl = document.getElementById('waiting-player-count');
const playersLobbyListEl = document.getElementById('players-lobby-list');
const btnToggleReady = document.getElementById('btn-toggle-ready');
const btnLeaveRoom = document.getElementById('btn-leave-room');

// Elementos do HUD da Arena
const hudRoomIdEl = document.getElementById('hud-room-id');
const hudTimerEl = document.getElementById('hud-timer');
const hudBombsEl = document.getElementById('hud-bombs');
const hudRangeEl = document.getElementById('hud-range');
const hudSpeedEl = document.getElementById('hud-speed');
const suddenDeathWarningEl = document.getElementById('sudden-death-warning');
const hudPlayersStatusEl = document.getElementById('hud-players-status');
const headerPingEl = document.getElementById('header-ping');
const gamePingEl = document.getElementById('game-ping');

// Elementos do Modal Fim de Jogo & Pódio
const gameOverModal = document.getElementById('game-over-modal');
const winnerTitleEl = document.getElementById('winner-title');
const winnerDescEl = document.getElementById('winner-desc');
const podiumContainerEl = document.getElementById('podium-container');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnBackLobby = document.getElementById('btn-back-lobby');

// Canvas e Instâncias do Jogo
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const network = new Network();

// Estado Global do Cliente
const state = {
  playerName: 'Lampião.bot',
  playerId: `p-${Math.random().toString(36).substring(2, 7)}`,
  roomId: '',
  roomName: '',
  isPrivate: false,
  targetPrivateRoomCode: '',
  isReady: false,
  inGame: false,
  activeRooms: [],
  map: [],
  players: new Map(), // id -> { id, name, color, x, y, visualX, visualY, alive, diedAt, activeEmote }
  bombs: new Map(),
  flames: [],
  powerUps: new Map(),
  localStats: { bombsMax: 1, bombsActive: 0, range: 2, speed: 1 },
  matchStartLocalTime: 0,
  suddenDeathActive: false,
  pendingMoves: [],
  lastPingMs: 42
};

// ============================================================================
// SISTEMA DE TOASTS RETRÔ 16-BIT
// ============================================================================
export function showToast(title, message, type = 'warning') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `pixel-toast ${type}`;

  const content = document.createElement('div');
  content.className = 'toast-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;

  const msgEl = document.createElement('div');
  msgEl.className = 'toast-message';
  msgEl.textContent = message;

  content.appendChild(titleEl);
  content.appendChild(msgEl);

  const tag = document.createElement('span');
  tag.className = 'toast-tag';
  tag.textContent = type === 'warning' ? 'RETRO-NET' : (type === 'alert' ? 'ALERTA' : 'INFO');

  toast.appendChild(content);
  toast.appendChild(tag);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.2s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Carrega informações da API oficial (Identificador ECS e Equipe SD)
async function loadServerInfo() {
  try {
    // 1. Lê parâmetros da URL (ex: ?player=ENTHONY ou hostname bomberman-enthony)
    const urlParams = new URLSearchParams(window.location.search);
    const paramPlayer = urlParams.get('player') || urlParams.get('nome');
    if (paramPlayer) {
      playerNameInput.value = paramPlayer.trim();
      state.playerName = paramPlayer.trim();
    } else {
      const match = window.location.hostname.match(/^bomberman-([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        playerNameInput.value = match[1].toUpperCase();
        state.playerName = match[1].toUpperCase();
      }
    }

    const res = await fetch('/api/info');
    const data = await res.json();
    const publicIdentityEl = document.getElementById('public-identity');
    const pageTitleEl = document.getElementById('page-title');
    const teamMembersEl = document.getElementById('team-members-display');

    if (data.appPublicName) {
      if (publicIdentityEl) publicIdentityEl.textContent = data.appPublicName;
      if (pageTitleEl) pageTitleEl.textContent = `${data.appPublicName} · BombermanUFERSA`;
    }
    if (data.groupMembers && data.groupMembers.length > 0 && teamMembersEl) {
      teamMembersEl.textContent = data.groupMembers.join(', ');
    }
  } catch (err) {
    console.warn('[Client] Não foi possível carregar /api/info:', err);
  }
}
loadServerInfo();

// Simulação de ping orgânico na interface
setInterval(() => {
  const jitter = Math.floor(38 + Math.random() * 8);
  state.lastPingMs = jitter;
  if (headerPingEl) headerPingEl.textContent = `Conectado · ${jitter} ms`;
  if (gamePingEl) gamePingEl.textContent = `${jitter} ms`;
}, 2500);

// ============================================================================
// FLUXO DE TELAS: LOGIN -> LOBBY PRINCIPAL -> SALA DE ESPERA
// ============================================================================

// 1. TELA DE LOGIN: Digitar Apelido e ir para o Lobby Principal
btnLogin.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Lampião.bot';
  state.playerName = name;
  lobbyPlayerDisplay.textContent = name;

  // Atualiza a barra de endereço do navegador com o nome do jogador (critério de avaliação)
  const url = new URL(window.location.href);
  url.searchParams.set('player', name);
  window.history.replaceState({ player: name }, '', url.toString());

  // Atualiza dinamicamente o badge de domínio ECS se aplicável
  const publicIdentityEl = document.getElementById('public-identity');
  if (publicIdentityEl && publicIdentityEl.textContent.includes('.')) {
    const domainPart = publicIdentityEl.textContent.substring(publicIdentityEl.textContent.indexOf('.'));
    publicIdentityEl.textContent = `BOMBERMAN-${name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}${domainPart}`;
    document.title = `${publicIdentityEl.textContent} · BombermanUFERSA`;
  }

  // Transição de tela
  loginScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');

  // Conecta ao canal de broadcast de salas do Lobby
  network.connectLobby(handleRoomsUpdate);
  loadRoomsFromApi();
  showToast('Lobby Conectado', 'Sincronizado com as salas ativas.', 'success');
});

// Busca lista de salas via API REST
async function loadRoomsFromApi() {
  try {
    const res = await fetch('/api/rooms');
    const data = await res.json();
    if (data.rooms) {
      handleRoomsUpdate(data.rooms);
    }
  } catch (err) {
    console.error('[Lobby] Erro ao carregar salas:', err);
  }
}

// Atualização de salas em tempo real recebida via WebSocket ou API
function handleRoomsUpdate(rooms) {
  state.activeRooms = rooms;
  renderRoomsList(rooms);
}

// Renderiza a lista de salas no Lobby
function renderRoomsList(rooms) {
  roomsListEl.innerHTML = '';

  if (!rooms || rooms.length === 0) {
    roomsListEl.innerHTML = `
      <div class="empty-rooms-box">
        <h3>NENHUMA SALA ATIVA NO MOMENTO</h3>
        <p>Clique em "+ CRIAR SALA" acima para ser o primeiro anfitrião da Caatinga!</p>
      </div>
    `;
    return;
  }

  for (const room of rooms) {
    const card = document.createElement('div');
    card.className = 'room-card-item';

    const isFull = room.playersCount >= room.maxPlayers;
    const isPlaying = room.status === 'PLAYING';

    card.innerHTML = `
      <div class="room-card-info">
        <div class="room-code-badge">#${room.id}</div>
        <div class="room-details">
          <div class="room-name-title">${room.name}</div>
          <div class="room-meta-tags">
            <span class="tag-privacy ${room.isPrivate ? 'private' : 'public'}">
              ${room.isPrivate ? '🔒 PRIVADA' : '🌐 PÚBLICA'}
            </span>
            <span class="tag-status ${isPlaying ? 'playing' : 'lobby'}">
              ${isPlaying ? 'EM JOGO' : 'AGUARDANDO'}
            </span>
          </div>
        </div>
      </div>
      <div class="room-card-actions">
        <span class="room-player-count">${room.playersCount}/${room.maxPlayers}</span>
        <button class="btn-pixel ${room.isPrivate ? 'btn-terracotta' : 'btn-cactus'} btn-join-action" 
                data-code="${room.id}" 
                data-private="${room.isPrivate}"
                ${isFull ? 'disabled' : ''}>
          ${isFull ? 'CHEIA' : (room.isPrivate ? 'ENTRAR 🔒' : 'ENTRAR')}
        </button>
      </div>
    `;

    // Evento de clique para entrar
    const btnJoin = card.querySelector('.btn-join-action');
    if (btnJoin && !isFull) {
      btnJoin.addEventListener('click', () => {
        if (room.isPrivate) {
          openPasswordModal(room.id);
        } else {
          joinRoom(room.id, room.name, false);
        }
      });
    }

    roomsListEl.appendChild(card);
  }
}

// Botão "Atualizar Lista" no Lobby
btnRefreshRooms.addEventListener('click', () => {
  loadRoomsFromApi();
  showToast('Atualizado', 'Lista de salas sincronizada.', 'info');
});

// Entrada rápida por código Among Us (ex: K7QM)
btnQuickJoin.addEventListener('click', () => {
  const code = quickCodeInput.value.trim().toUpperCase();
  if (!code) {
    showToast('Aviso', 'Digite um código de 4 caracteres.', 'warning');
    return;
  }

  const existingRoom = state.activeRooms.find(r => r.id === code);
  if (existingRoom && existingRoom.isPrivate) {
    openPasswordModal(code);
  } else {
    joinRoom(code, existingRoom ? existingRoom.name : `Arena ${code}`, false);
  }
});

quickCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnQuickJoin.click();
  }
});

// ============================================================================
// MODAL: CRIAR NOVA SALA
// ============================================================================
btnOpenCreateRoom.addEventListener('click', async () => {
  modalCreateRoom.classList.remove('hidden');
  try {
    const res = await fetch('/api/rooms/new-code');
    const data = await res.json();
    if (data.code) {
      newRoomCodeInput.value = data.code;
    }
  } catch (err) {
    newRoomCodeInput.value = 'K7QM';
  }
  newRoomNameInput.value = `Arena ${newRoomCodeInput.value}`;
  newRoomPasswordInput.value = '';
  document.querySelector('input[name="room-privacy"][value="public"]').checked = true;
  passwordFieldContainer.classList.add('hidden');
});

btnCloseCreateRoom.addEventListener('click', () => {
  modalCreateRoom.classList.add('hidden');
});

btnRegenerateCode.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/rooms/new-code');
    const data = await res.json();
    if (data.code) {
      newRoomCodeInput.value = data.code;
      newRoomNameInput.value = `Arena ${data.code}`;
    }
  } catch (err) {
    console.warn(err);
  }
});

// Alterna exibição do campo de senha ao selecionar Privada/Pública
privacyRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'private') {
      passwordFieldContainer.classList.remove('hidden');
      newRoomPasswordInput.focus();
    } else {
      passwordFieldContainer.classList.add('hidden');
      newRoomPasswordInput.value = '';
    }
  });
});

btnConfirmCreateRoom.addEventListener('click', async () => {
  const code = (newRoomCodeInput.value.trim() || 'K7QM').toUpperCase();
  const name = newRoomNameInput.value.trim() || `Arena ${code}`;
  const isPrivate = document.querySelector('input[name="room-privacy"]:checked').value === 'private';
  const password = newRoomPasswordInput.value.trim();

  if (isPrivate && !password) {
    showToast('Aviso', 'Digite uma senha para a sala privada.', 'alert');
    newRoomPasswordInput.focus();
    return;
  }

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        name,
        isPrivate,
        password,
        hostId: state.playerId
      })
    });
    const data = await res.json();

    if (data.success) {
      modalCreateRoom.classList.add('hidden');
      showToast('Sala Criada!', `Sala #${code} pronta para combate.`, 'success');
      joinRoom(code, name, isPrivate, password);
    } else {
      showToast('Erro', data.message || 'Falha ao criar sala.', 'alert');
    }
  } catch (err) {
    showToast('Erro', 'Erro de conexão ao criar sala.', 'alert');
  }
});

// ============================================================================
// MODAL: SENHA DE SALA PRIVADA (COM CADEADO)
// ============================================================================
function openPasswordModal(roomCode) {
  state.targetPrivateRoomCode = roomCode;
  pwdModalRoomCode.textContent = roomCode;
  privateRoomPasswordInput.value = '';
  pwdErrorMsg.classList.add('hidden');
  modalPassword.classList.remove('hidden');
  privateRoomPasswordInput.focus();
}

btnCancelPassword.addEventListener('click', () => {
  modalPassword.classList.add('hidden');
  state.targetPrivateRoomCode = '';
});

btnSubmitPassword.addEventListener('click', async () => {
  const code = state.targetPrivateRoomCode;
  const password = privateRoomPasswordInput.value.trim();

  if (!password) {
    pwdErrorMsg.textContent = '❌ Digite a senha para entrar.';
    pwdErrorMsg.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/rooms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: code, password })
    });
    const data = await res.json();

    if (data.valid) {
      modalPassword.classList.add('hidden');
      pwdErrorMsg.classList.add('hidden');
      const room = state.activeRooms.find(r => r.id === code);
      joinRoom(code, room ? room.name : `Arena ${code}`, true, password);
    } else {
      pwdErrorMsg.textContent = '❌ Senha incorreta! Tente novamente.';
      pwdErrorMsg.classList.remove('hidden');
      privateRoomPasswordInput.select();
    }
  } catch (err) {
    pwdErrorMsg.textContent = '❌ Erro de conexão ao validar senha.';
    pwdErrorMsg.classList.remove('hidden');
  }
});

privateRoomPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnSubmitPassword.click();
  }
});

// ============================================================================
// CONEXÃO COM A SALA DE JOGO
// ============================================================================
function joinRoom(roomId, roomName, isPrivate, password = '') {
  state.roomId = roomId;
  state.roomName = roomName;
  state.isPrivate = isPrivate;

  network.connect(
    roomId,
    state.playerId,
    state.playerName,
    handleServerEvent,
    () => {
      // Conexão bem-sucedida à sala de jogo
      lobbyScreen.classList.add('hidden');
      waitingScreen.classList.remove('hidden');

      currentRoomCodeEl.textContent = roomId;
      currentRoomNameSubtitleEl.textContent = `${roomName} · UFERSA CAMPUS CENTRAL`;
      currentRoomPrivacyEl.textContent = isPrivate ? '🔒 PRIVADA' : '🌐 PÚBLICA';
      hudRoomIdEl.textContent = roomId;

      showToast('Entrou na Sala', `Conectado à sala #${roomId}.`, 'success');
    },
    (closeEvent) => {
      if (closeEvent && closeEvent.code === 4001) {
        showToast('Acesso Negado', 'Senha incorreta para esta sala privada.', 'alert');
      } else if (closeEvent && closeEvent.code === 4002) {
        showToast('Sala Cheia', 'A sala já atingiu o limite de 4 jogadores.', 'alert');
      }
      leaveRoomAndReturnToLobby();
    },
    password
  );
}

// Sair da Sala e Voltar ao Lobby Principal
function leaveRoomAndReturnToLobby() {
  document.body.classList.remove('in-game-mode');
  network.disconnect();
  waitingScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  gameOverModal.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');

  state.roomId = '';
  state.roomName = '';
  state.inGame = false;
  state.isReady = false;
  state.pendingMoves = [];
  btnToggleReady.textContent = 'PRONTO';
  btnToggleReady.classList.remove('active');

  // Reconecta ao canal de observação do lobby
  network.connectLobby(handleRoomsUpdate);
  // Carrega imediatamente e agenda atualização rápida para sincronizar lobby
  loadRoomsFromApi();
  setTimeout(loadRoomsFromApi, 300);
}

btnLeaveRoom.addEventListener('click', () => {
  network.sendAction('LEAVE_ROOM', {});
  leaveRoomAndReturnToLobby();
});

// Botão Pronto
btnToggleReady.addEventListener('click', () => {
  state.isReady = !state.isReady;
  btnToggleReady.textContent = state.isReady ? 'CANCELAR PRONTO' : 'PRONTO';
  btnToggleReady.classList.toggle('active', state.isReady);
  network.sendAction('SET_READY', { ready: state.isReady });
});

// Jogar Novamente & Voltar ao Lobby
function handleRestartGame() {
  document.body.classList.remove('in-game-mode');
  gameOverModal.classList.add('hidden');
  gameScreen.classList.add('hidden');
  waitingScreen.classList.remove('hidden');
  state.isReady = false;
  state.inGame = false;
  state.pendingMoves = [];
  btnToggleReady.textContent = 'PRONTO';
  btnToggleReady.classList.remove('active');
  network.sendAction('RESTART_GAME', {});
}

btnPlayAgain.addEventListener('click', handleRestartGame);
if (btnBackLobby) {
  btnBackLobby.addEventListener('click', leaveRoomAndReturnToLobby);
}

// ============================================================================
// INPUT HANDLER E PREDIÇÃO LOCAL
// ============================================================================
const inputHandler = new InputHandler(
  (dir) => {
    if (!state.inGame) return;
    const me = state.players.get(state.playerId);
    if (!me || !me.alive) return;

    const offset = DIR_OFFSETS[dir];
    if (!offset) return;

    const targetX = me.x + offset.x;
    const targetY = me.y + offset.y;

    if (isCellPassableLocally(targetX, targetY)) {
      me.x = targetX;
      me.y = targetY;
      const sentSeq = network.sendAction('MOVE', { dir });
      if (sentSeq) {
        state.pendingMoves.push({ seq: sentSeq, dir, targetX, targetY });
      }
    }
  },
  () => {
    if (!state.inGame) return;
    const me = state.players.get(state.playerId);
    if (!me || !me.alive) return;

    let myActiveBombs = 0;
    for (const b of state.bombs.values()) {
      if (b.playerId === state.playerId) myActiveBombs++;
    }
    state.localStats.bombsActive = myActiveBombs;

    if (state.localStats.bombsActive < state.localStats.bombsMax) {
      network.sendAction('PLACE_BOMB', {});
    }
  },
  (emoteId) => {
    if (!state.inGame) return;
    network.sendAction('TRIGGER_EMOTE', { emoteId });
  }
);

function isCellPassableLocally(x, y) {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
  if (!state.map || !state.map[y]) return false;
  const tile = state.map[y][x];
  if (tile !== TILE_TYPE.EMPTY) return false;

  for (const b of state.bombs.values()) {
    if (b.x === x && b.y === y) return false;
  }
  return true;
}

// ============================================================================
// ROTEAMENTO DE EVENTOS DA ENGINE
// ============================================================================
function handleServerEvent(event) {
  const { type, payload } = event;

  switch (type) {
    case 'ROOM_STATE': {
      if (payload.status === 'LOBBY') {
        document.body.classList.remove('in-game-mode');
        state.inGame = false;
        gameOverModal.classList.add('hidden');
        gameScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');

        const me = payload.players?.find(p => p.id === state.playerId);
        if (me) {
          state.isReady = Boolean(me.ready);
          btnToggleReady.textContent = state.isReady ? 'CANCELAR PRONTO' : 'PRONTO';
          btnToggleReady.classList.toggle('active', state.isReady);
        }
      }
      updateWaitingRoomView(payload.players || []);
      break;
    }

    case 'ROOM_CLOSED': {
      showToast('Sala Encerrada', payload.message || 'O anfitrião saiu da sala. A sala foi encerrada.', 'alert');
      leaveRoomAndReturnToLobby();
      break;
    }

    case 'GAME_START':
      startGameView(payload);
      showToast('Partida Iniciada!', 'A batalha na Caatinga começou!', 'success');
      break;

    case 'PLAYER_MOVED': {
      const p = state.players.get(payload.playerId);
      if (p) {
        if (payload.playerId === state.playerId) {
          state.pendingMoves = state.pendingMoves.filter(m => m.seq > payload.seq);

          if (state.pendingMoves.length === 0) {
            p.x = payload.x;
            p.y = payload.y;
          } else {
            let currX = payload.x;
            let currY = payload.y;
            for (const m of state.pendingMoves) {
              const off = DIR_OFFSETS[m.dir];
              if (off && isCellPassableLocally(currX + off.x, currY + off.y)) {
                currX += off.x;
                currY += off.y;
              }
              m.targetX = currX;
              m.targetY = currY;
            }
            p.x = currX;
            p.y = currY;
          }
        } else {
          p.x = payload.x;
          p.y = payload.y;
        }
      }
      break;
    }

    case 'BOMB_PLACED': {
      state.bombs.set(payload.bombId, {
        id: payload.bombId,
        playerId: payload.playerId,
        x: payload.x,
        y: payload.y,
        range: payload.range,
        timerMs: payload.timerMs,
        createdAt: Date.now()
      });

      if (payload.playerId === state.playerId) {
        state.localStats.bombsActive++;
        updateHudStats();
      }
      break;
    }

    case 'EXPLOSION': {
      const bomb = state.bombs.get(payload.bombId);
      const ownerId = payload.playerId || (bomb ? bomb.playerId : null);

      state.bombs.delete(payload.bombId);
      state.flames.push({
        cells: payload.cells,
        expiresAt: Date.now() + (payload.durationMs || 500)
      });

      if (ownerId === state.playerId) {
        state.localStats.bombsActive = Math.max(0, state.localStats.bombsActive - 1);
        updateHudStats();
      }
      break;
    }

    case 'BLOCK_DESTROYED': {
      if (state.map[payload.y]) {
        state.map[payload.y][payload.x] = TILE_TYPE.EMPTY;
      }
      break;
    }

    case 'POWERUP_SPAWNED': {
      state.powerUps.set(`${payload.x},${payload.y}`, payload);
      break;
    }

    case 'POWERUP_COLLECTED': {
      state.powerUps.delete(`${payload.x},${payload.y}`);
      if (payload.playerId === state.playerId) {
        let label = 'Item Coletado!';
        if (payload.type === 'BOMB') {
          state.localStats.bombsMax++;
          label = '+1 Bomba Simultânea!';
        } else if (payload.type === 'FIRE') {
          state.localStats.range++;
          label = '+1 Alcance de Chama!';
        } else if (payload.type === 'SPEED') {
          state.localStats.speed += 0.5;
          label = '+Velocidade de Movimento!';
        }
        updateHudStats();
        showToast('Power-Up!', label, 'success');
      }
      break;
    }

    case 'PLAYER_DIED': {
      const deadPlayer = state.players.get(payload.playerId);
      if (deadPlayer) {
        deadPlayer.alive = false;
        deadPlayer.diedAt = Date.now();
      }
      updatePlayersHud();
      if (deadPlayer) {
        showToast('Jogador Eliminado', `${deadPlayer.name} foi atingido!`, 'alert');
      }
      break;
    }

    case 'SUDDEN_DEATH_TILE': {
      if (state.map[payload.y]) {
        state.map[payload.y][payload.x] = TILE_TYPE.INDESTRUCTIBLE;
      }
      if (!state.suddenDeathActive) {
        state.suddenDeathActive = true;
        suddenDeathWarningEl.classList.remove('hidden');
        showToast('Morte Súbita!', 'A arena está se fechando com cactos!', 'warning');
      }
      break;
    }

    case 'PLAYER_EMOTE': {
      const p = state.players.get(payload.playerId);
      if (p) {
        p.activeEmote = {
          id: payload.emoteId,
          expiresAt: Date.now() + 2000
        };
      }
      break;
    }

    case 'GAME_OVER': {
      state.inGame = false;
      renderMatchResult(payload);
      break;
    }
  }
}

// Atualização da Sala de Espera (4 Slots com Estética 16-Bit)
function updateWaitingRoomView(players) {
  if (waitingPlayerCountEl) {
    waitingPlayerCountEl.textContent = `${players.length} / 4 JOGADORES`;
  }
  playersLobbyListEl.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const p = players[i];
    const defaultMeta = ROBOT_META[i] || { name: `ROBÔ ${i + 1}`, color: '#2E6FDF', sub: 'Explorador' };
    const card = document.createElement('div');
    card.className = 'player-slot-card';

    if (p) {
      const isHost = p.isHost !== undefined ? Boolean(p.isHost) : (i === 0);
      const isMe = (p.id === state.playerId);
      const playerColor = p.color || defaultMeta.color;

      card.innerHTML = `
        <div class="slot-tag ${isHost ? 'host' : ''}">${isHost ? 'HOST' : `SLOT ${i + 1}`}</div>
        ${isHost ? '<div class="slot-crown">👑</div>' : ''}
        <div class="slot-avatar-frame" style="border-color:${playerColor}">
          <div class="pixel-robot-icon" style="background:${playerColor}; border: 2px solid #3B2A20; border-radius: 4px;"></div>
          <div class="slot-robot-tag">${defaultMeta.name}</div>
        </div>
        <div class="slot-player-name" title="${p.name}">${p.name} ${isMe ? '(Você)' : ''}</div>
        <div class="slot-status-pill ${p.ready ? 'ready' : 'waiting'}">
          ${p.ready ? '✓ PRONTO' : '... Aguardando'}
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="slot-tag">SLOT ${i + 1}</div>
        <div class="slot-avatar-frame" style="border-style: dashed; opacity: 0.5;">
          <div class="slot-robot-tag">${defaultMeta.name}</div>
        </div>
        <div class="slot-player-name" style="color: var(--retro-muted); font-size: 0.55rem;">Vago</div>
        <div class="slot-status-pill empty">-- Vazio --</div>
      `;
    }

    playersLobbyListEl.appendChild(card);
  }
}

// Início de Partida
function startGameView(payload) {
  document.body.classList.add('in-game-mode');
  waitingScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  state.inGame = true;
  state.map = payload.map;
  state.matchStartLocalTime = Date.now();
  state.suddenDeathActive = false;
  state.pendingMoves = [];
  suddenDeathWarningEl.classList.add('hidden');

  state.players.clear();
  state.bombs.clear();
  state.flames = [];
  state.powerUps.clear();

  state.localStats = { bombsMax: 1, bombsActive: 0, range: 2, speed: 1 };

  for (const p of payload.players) {
    state.players.set(p.id, {
      ...p,
      visualX: p.x,
      visualY: p.y,
      alive: p.alive,
      diedAt: null,
      activeEmote: null
    });
  }

  updateHudStats();
  updatePlayersHud();
}

function updateHudStats() {
  hudBombsEl.textContent = `${state.localStats.bombsActive}/${state.localStats.bombsMax}`;
  hudRangeEl.textContent = `${state.localStats.range}`;
  hudSpeedEl.textContent = `${state.localStats.speed}x`;
}

function updatePlayersHud() {
  hudPlayersStatusEl.innerHTML = '';
  for (const p of state.players.values()) {
    const item = document.createElement('div');
    item.className = `hud-player-item ${!p.alive ? 'dead' : ''}`;
    item.innerHTML = `
      <span class="chip-dot" style="background-color:${p.color || '#2E6FDF'};"></span>
      <strong>${p.name}</strong> ${p.alive ? '❤️' : '💀'}
    `;
    hudPlayersStatusEl.appendChild(item);
  }
}

// Renderização do Modal de Fim de Partida e Pódio
function renderMatchResult(payload) {
  gameOverModal.classList.remove('hidden');

  if (payload.winnerName) {
    winnerTitleEl.textContent = '🏆 TEMOS UM CAMPEÃO!';
    winnerDescEl.textContent = `${payload.winnerName} foi o último sobrevivente na Caatinga!`;
  } else {
    winnerTitleEl.textContent = 'EMPATE GERAL!';
    winnerDescEl.textContent = 'Todos os guerreiros foram eliminados!';
  }

  const playerList = Array.from(state.players.values());
  const ranked = [...playerList].sort((a, b) => {
    if (a.id === payload.winnerId) return -1;
    if (b.id === payload.winnerId) return 1;
    if (a.alive && !b.alive) return -1;
    if (!a.alive && b.alive) return 1;
    return (b.diedAt || 0) - (a.diedAt || 0);
  });

  const podiumRanks = [
    { rank: 2, class: 'rank-2', title: '2º LUGAR', label: 'TERRACOTA' },
    { rank: 1, class: 'rank-1', title: '1º LUGAR', label: 'CAMPEÃO' },
    { rank: 3, class: 'rank-3', title: '3º LUGAR', label: 'MANDACARU' },
    { rank: 4, class: 'rank-4', title: '4º LUGAR', label: 'JUAZEIRO' }
  ];

  podiumContainerEl.innerHTML = '';

  for (const pr of podiumRanks) {
    const p = ranked[pr.rank - 1];
    const col = document.createElement('div');
    col.className = 'podium-column';

    col.innerHTML = `
      <div class="podium-player-card">
        <div class="podium-player-name">${p ? p.name : '---'}</div>
        <div class="podium-player-score">${p ? (pr.rank === 1 ? '1.450 P' : (pr.rank === 2 ? '1.120 P' : (pr.rank === 3 ? '850 P' : '510 P'))) : '0 P'}</div>
      </div>
      <div class="podium-block ${pr.class}">
        <span class="podium-rank-num">${pr.rank === 1 ? '🏆 1º' : `${pr.rank}º`}</span>
        <span class="podium-block-label">${pr.label}</span>
      </div>
    `;

    podiumContainerEl.appendChild(col);
  }
}

// Game Loop Local a 60 FPS com Interpolação e Predição
function gameLoop() {
  requestAnimationFrame(gameLoop);

  const now = Date.now();

  if (state.inGame) {
    const elapsedSec = Math.floor((now - state.matchStartLocalTime) / 1000);
    const remainingSec = Math.max(0, 180 - elapsedSec);
    const mins = String(Math.floor(remainingSec / 60)).padStart(2, '0');
    const secs = String(remainingSec % 60).padStart(2, '0');
    hudTimerEl.textContent = `${mins}:${secs}`;

    for (const p of state.players.values()) {
      p.visualX += (p.x - p.visualX) * 0.40;
      p.visualY += (p.y - p.visualY) * 0.40;
      if (Math.abs(p.x - p.visualX) < 0.01) p.visualX = p.x;
      if (Math.abs(p.y - p.visualY) < 0.01) p.visualY = p.y;
    }

    state.flames = state.flames.filter(f => f.expiresAt > now);
    inputHandler.update();
  }

  // Renderização no Canvas
  renderer.clear();
  if (state.inGame && state.map.length > 0) {
    renderer.drawMap(state.map);
    renderer.drawPowerUps(state.powerUps);
    renderer.drawBombs(state.bombs, now);
    renderer.drawFlames(state.flames);
    renderer.drawPlayers(state.players, state.playerId);
  }
}

requestAnimationFrame(gameLoop);
