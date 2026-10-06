import { SQSClient, ReceiveMessageCommand, DeleteMessageBatchCommand } from '@aws-sdk/client-sqs';
import { config } from '../config/index.js';
import { BombermanEngine } from '../engine/BombermanEngine.js';

export class ActionProcessor {
  constructor(eventPublisher, sqsClient = null, roomManager = null) {
    this.client = sqsClient || new SQSClient({
      region: config.aws.region,
      endpoint: config.aws.endpoint,
      credentials: config.aws.credentials
    });
    this.eventPublisher = eventPublisher;
    this.roomManager = roomManager;
    this.queueUrl = config.sqs.actionsQueueUrl;
    this.rooms = new Map(); // roomId -> BombermanEngine
  }

  setRoomManager(roomManager) {
    this.roomManager = roomManager;
  }

  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      const engine = new BombermanEngine(roomId);
      if (this.roomManager) {
        const meta = this.roomManager.getRoom(roomId);
        if (meta && meta.hostId) {
          engine.hostId = meta.hostId;
        }
      }
      this.rooms.set(roomId, engine);
    }
    return this.rooms.get(roomId);
  }

  /**
   * Processa uma ação diretamente na Engine e publica os eventos resultantes.
   */
  async processDirectAction(roomId, playerId, seq, type, payload = {}) {
    // Se a sala já foi encerrada ou não existe, ignora desconexão e saída sem recriar a engine
    if (!this.rooms.has(roomId) && (type === 'DISCONNECT' || type === 'LEAVE_ROOM')) {
      return [];
    }

    const engine = this.getOrCreateRoom(roomId);
    let resultEvents = [];

    if (type === 'JOIN_ROOM') {
      const res = engine.addPlayer(playerId, payload.name);
      resultEvents = res.events;
    } else if (type === 'SET_READY') {
      const res = engine.setPlayerReady(playerId, payload.ready);
      resultEvents = res.events;
    } else if (type === 'DISCONNECT' || type === 'LEAVE_ROOM') {
      const res = engine.removePlayer(playerId);
      resultEvents = res.events;
      if (res.roomClosed || engine.status === 'CLOSED' || engine.players.size === 0) {
        this.rooms.delete(roomId);
        if (this.roomManager) {
          this.roomManager.deleteRoom(roomId);
        }
      }
    } else {
      const res = engine.handleAction(playerId, seq, type, payload);
      resultEvents = res.events;
    }

    if (resultEvents && resultEvents.length > 0) {
      await this.eventPublisher.publishEvents(roomId, resultEvents);
    }

    return resultEvents;
  }

  /**
   * Executa uma rodada de polling em actions.fifo.
   */
  async pollAndProcess() {
    try {
      const receiveCommand = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: config.sqs.maxNumberOfMessages,
        WaitTimeSeconds: config.sqs.waitTimeSeconds,
        AttributeNames: ['All']
      });

      const response = await this.client.send(receiveCommand);
      const messages = response.Messages || [];

      if (messages.length === 0) {
        return 0; // Fila vazia no ciclo de long polling
      }

      const deleteEntries = [];

      for (const msg of messages) {
        try {
          const body = JSON.parse(msg.Body);
          const { roomId, playerId, seq, type, payload } = body;

          if (!roomId || !playerId || !type) {
            deleteEntries.push({ Id: msg.MessageId, ReceiptHandle: msg.ReceiptHandle });
            continue;
          }

          await this.processDirectAction(roomId, playerId, seq, type, payload);

          // Sucesso no processamento: marca para deleção no SQS
          deleteEntries.push({ Id: msg.MessageId, ReceiptHandle: msg.ReceiptHandle });
        } catch (msgErr) {
          console.error(`[ActionProcessor] Erro ao processar mensagem individual:`, msgErr);
        }
      }

      // Deleta do SQS apenas as mensagens processadas com sucesso
      if (deleteEntries.length > 0) {
        await this.client.send(new DeleteMessageBatchCommand({
          QueueUrl: this.queueUrl,
          Entries: deleteEntries
        }));
      }

      return messages.length;
    } catch (err) {
      // Falha silenciosa de polling se o SQS não estiver respondendo no host
      return 0;
    }
  }

  /**
   * Roda o tick da engine em todas as salas ativas para atualizar timers de bomba e morte súbita.
   */
  async tickActiveRooms() {
    const now = Date.now();
    for (const [roomId, engine] of this.rooms.entries()) {
      if (engine.status === 'PLAYING') {
        const events = engine.tick(now);
        if (events && events.length > 0) {
          await this.eventPublisher.publishEvents(roomId, events);
        }
      }
    }
  }
}
