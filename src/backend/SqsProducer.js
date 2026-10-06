import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { config } from '../config/index.js';

export class SqsProducer {
  constructor(sqsClient = null, fallbackProcessor = null) {
    this.client = sqsClient || new SQSClient({
      region: config.aws.region,
      endpoint: config.aws.endpoint,
      credentials: config.aws.credentials
    });
    this.queueUrl = config.sqs.actionsQueueUrl;
    this.fallbackProcessor = fallbackProcessor;
    this.sqsOnline = true;
    this.lastOfflineCheck = 0;
  }

  setFallbackProcessor(processor) {
    this.fallbackProcessor = processor;
  }

  /**
   * Publica uma ação do jogador no actions.fifo.
   * Se o SQS estiver indisponível no ambiente local, aciona fallback direto para a engine.
   */
  async sendAction(roomId, playerId, seq, type, payload = {}) {
    const now = Date.now();
    // Fast-path: se SQS estiver offline e o intervalo de retry não expirou (15s)
    if (!this.sqsOnline && (now - this.lastOfflineCheck < 15000)) {
      if (this.fallbackProcessor) {
        await this.fallbackProcessor.processDirectAction(roomId, playerId, seq, type, payload);
        return { success: true, fallback: true };
      }
    }

    // Deduplication única por ação para evitar que JOIN_ROOM e SET_READY colidam
    const dedupId = `${roomId}-${playerId}-${type}-${seq}-${Date.now()}`;

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageGroupId: roomId,
      MessageDeduplicationId: dedupId,
      MessageBody: JSON.stringify({
        roomId,
        playerId,
        seq,
        type,
        payload,
        ts: Date.now()
      })
    });

    try {
      const response = await this.client.send(command);
      this.sqsOnline = true;
      return { success: true, messageId: response.MessageId };
    } catch (err) {
      if (this.sqsOnline) {
        console.warn(`[SqsProducer] SQS offline ou inacessível (${err.message}). Ativando fallback direto da Engine.`);
        this.sqsOnline = false;
      }

      // Fallback em memória para o jogo nunca travar localmente
      if (this.fallbackProcessor) {
        await this.fallbackProcessor.processDirectAction(roomId, playerId, seq, type, payload);
        return { success: true, fallback: true };
      }

      throw err;
    }
  }
}
