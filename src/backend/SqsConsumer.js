import { SQSClient, ReceiveMessageCommand, DeleteMessageBatchCommand } from '@aws-sdk/client-sqs';
import { config } from '../config/index.js';

export class SqsConsumer {
  constructor(webSocketManager, sqsClient = null, onEvent = null) {
    this.client = sqsClient || new SQSClient({
      region: config.aws.region,
      endpoint: config.aws.endpoint,
      credentials: config.aws.credentials
    });
    this.wsManager = webSocketManager;
    this.onEvent = onEvent;
    this.queueUrl = config.sqs.eventsQueueUrl;
    this.isRunning = false;
    this.sqsOnline = true;
  }

  /**
   * Inicia o loop de consumo contínuo de eventos do SQS.
   */
  start() {
    this.isRunning = true;
    console.log('[SqsConsumer] Iniciando consumo contínuo de events.fifo');
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  async loop() {
    while (this.isRunning) {
      try {
        const receiveCmd = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: config.sqs.maxNumberOfMessages,
          WaitTimeSeconds: config.sqs.waitTimeSeconds,
          AttributeNames: ['All']
        });

        const response = await this.client.send(receiveCmd);

        if (!this.sqsOnline) {
          console.log('[SqsConsumer] Conexão com events.fifo restabelecida!');
          this.sqsOnline = true;
        }

        const messages = response.Messages || [];

        if (messages.length === 0) {
          continue;
        }

        const deleteEntries = [];

        for (const msg of messages) {
          try {
            const body = JSON.parse(msg.Body);
            const { roomId, type, payload, eventId } = body;

            if (roomId) {
              const evt = { eventId, type, payload };
              // Repassa evento via WebSocket para todos os jogadores daquela sala
              this.wsManager.broadcastToRoom(roomId, evt);

              if (this.onEvent) {
                this.onEvent(roomId, evt);
              }
            }

            deleteEntries.push({
              Id: msg.MessageId,
              ReceiptHandle: msg.ReceiptHandle
            });
          } catch (parseErr) {
            console.error('[SqsConsumer] Erro ao processar evento individual:', parseErr);
            deleteEntries.push({
              Id: msg.MessageId,
              ReceiptHandle: msg.ReceiptHandle
            });
          }
        }

        // Deleta as mensagens consumidas da fila events.fifo
        if (deleteEntries.length > 0) {
          await this.client.send(new DeleteMessageBatchCommand({
            QueueUrl: this.queueUrl,
            Entries: deleteEntries
          }));
        }
      } catch (err) {
        if (err.name !== 'TimeoutError' && !err.message?.includes('socket hang up')) {
          if (this.sqsOnline) {
            console.warn('[SqsConsumer] SQS offline (LocalStack não detectado). Eventos rodando em modo local.');
            this.sqsOnline = false;
          }
        }
        // Espera 5 segundos antes de verificar novamente, evitando spam no console
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}
