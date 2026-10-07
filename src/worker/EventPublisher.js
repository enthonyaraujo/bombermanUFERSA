import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { config } from '../config/index.js';

export class EventPublisher {
  constructor(sqsClient = null, fallbackBroadcast = null) {
    this.client = sqsClient || new SQSClient({
      region: config.aws.region,
      endpoint: config.aws.endpoint,
      credentials: config.aws.credentials
    });
    this.queueUrl = config.sqs.eventsQueueUrl;
    this.fallbackBroadcast = fallbackBroadcast;
    this.sqsOnline = true;
    this.lastOfflineCheck = 0;
  }

  setFallbackBroadcast(broadcastFn) {
    this.fallbackBroadcast = broadcastFn;
  }

  /**
   * Publica uma lista de eventos no events.fifo em lotes de até 10 mensagens.
   * Se o SQS estiver offline, despacha diretamente pelo broadcast do WebSocket sem bloquear o loop.
   */
  async publishEvents(roomId, events) {
    if (!events || events.length === 0) return;

    // 1. Despacha imediatamente via WebSocket local para latência zero e sincronização instantânea
    if (this.fallbackBroadcast) {
      for (const evt of events) {
        try {
          this.fallbackBroadcast(roomId, evt);
        } catch (bErr) {
          console.error('[EventPublisher] Erro no broadcast local:', bErr);
        }
      }
    }

    const now = Date.now();
    // Fast-path: se SQS estiver offline e o intervalo de retry não expirou (15s), pula tentativa do SQS
    if (!this.sqsOnline && (now - this.lastOfflineCheck < 15000)) {
      return;
    }

    // SQS permite no máximo 10 mensagens por batch
    const chunkSize = 10;
    for (let i = 0; i < events.length; i += chunkSize) {
      const chunk = events.slice(i, i + chunkSize);
      const entries = chunk.map((evt, idx) => ({
        Id: `msg-${Date.now()}-${i + idx}`,
        MessageGroupId: roomId,
        MessageDeduplicationId: `${roomId}-evt-${evt.eventId || `${Date.now()}-${i + idx}`}`,
        MessageBody: JSON.stringify({
          roomId,
          eventId: evt.eventId,
          type: evt.type,
          payload: evt.payload,
          ts: Date.now()
        })
      }));

      try {
        const command = new SendMessageBatchCommand({
          QueueUrl: this.queueUrl,
          Entries: entries
        });
        const response = await this.client.send(command);

        if (response.Failed && response.Failed.length > 0) {
          console.error(`[EventPublisher] Falha ao enviar ${response.Failed.length} eventos para sala ${roomId}:`, response.Failed);
        }
        this.sqsOnline = true;
      } catch (err) {
        if (this.sqsOnline) {
          console.warn(`[EventPublisher] events.fifo offline (${err.message}). Despachando eventos via WebSocket local em alta performance.`);
        }
        this.sqsOnline = false;
        this.lastOfflineCheck = Date.now();

        // Se o SQS falhar, entrega direto via WebSocket para os jogadores não ficarem travados
        if (this.fallbackBroadcast) {
          for (const evt of chunk) {
            this.fallbackBroadcast(roomId, evt);
          }
        }
      }
    }
  }
}
