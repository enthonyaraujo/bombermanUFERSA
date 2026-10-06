export class Network {
  constructor() {
    this.ws = null;
    this.lobbyWs = null;
    this.seq = 1; // seq 1 é reservado para JOIN_ROOM na conexão
    this.isConnected = false;
  }

  /**
   * Conecta o cliente ao canal do Lobby principal para receber atualizações de salas em tempo real.
   */
  connectLobby(onRoomsUpdate) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws?roomId=__LOBBY__`;

    if (this.lobbyWs) {
      this.lobbyWs.close();
    }

    this.lobbyWs = new WebSocket(url);

    this.lobbyWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ROOMS_UPDATE' && onRoomsUpdate) {
          onRoomsUpdate(data.payload.rooms || []);
        }
      } catch (err) {
        console.error('[Network] Erro ao decodificar evento do lobby:', err);
      }
    };

    this.lobbyWs.onerror = (err) => {
      console.warn('[Network] Erro na conexão do lobby:', err);
    };
  }

  disconnectLobby() {
    if (this.lobbyWs) {
      this.lobbyWs.close();
      this.lobbyWs = null;
    }
  }

  /**
   * Conecta o jogador a uma sala de jogo específica, passando senha caso seja privada.
   */
  connect(roomId, playerId, playerName, onMessage, onOpen, onClose, password = '') {
    // Desconecta do lobby ao entrar na sala de jogo
    this.disconnectLobby();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let url = `${protocol}//${host}/ws?roomId=${encodeURIComponent(roomId)}&playerId=${encodeURIComponent(playerId)}&name=${encodeURIComponent(playerName)}`;
    if (password) {
      url += `&password=${encodeURIComponent(password)}`;
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log(`[Network] Conectado à sala ${roomId}`);
      if (onOpen) onOpen();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (err) {
        console.error('[Network] Erro ao decodificar mensagem:', err);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      console.log(`[Network] Conexão encerrada (código: ${event.code})`);
      if (onClose) onClose(event);
    };

    this.ws.onerror = (err) => {
      console.error('[Network] Erro no WebSocket:', err);
    };
  }

  /**
   * Envia uma intenção de ação para o Backend com seq incremental.
   */
  sendAction(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Network] Não conectado para enviar ação:', type);
      return false;
    }

    this.seq++;
    const message = {
      seq: this.seq,
      type,
      payload
    };

    this.ws.send(JSON.stringify(message));
    return this.seq;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
