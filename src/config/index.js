import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  appPublicName: process.env.APP_PUBLIC_NAME || 'BOMBERMAN-ENTHONY.ECS-ALB.COM',
  groupMembers: (process.env.GROUP_MEMBERS || 'ENTHONY ARAUJO, DOUGLAS PATRICK, GUILHERME SILVA, GUILHERME GABRIEL')
    .split(',')
    .map(name => name.trim()),

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT || undefined,
    credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined
  },

  sqs: {
    actionsQueueUrl: process.env.SQS_ACTIONS_QUEUE_URL || 'http://localhost:4566/000000000000/bomberman-actions.fifo',
    eventsQueueUrl: process.env.SQS_EVENTS_QUEUE_URL || 'http://localhost:4566/000000000000/bomberman-events.fifo',
    waitTimeSeconds: 20, // Long polling
    maxNumberOfMessages: 10 // Lotes de até 10 mensagens
  },

  game: {
    gridWidth: 17,
    gridHeight: 13,
    bombTimerMs: 2500,
    flameDurationMs: 500,
    maxPlayersPerRoom: 4,
    minPlayersToStart: 2,
    matchDurationSeconds: 180, // 3 minutos
    suddenDeathStartSeconds: 120, // Inicia após 2 minutos
    suddenDeathIntervalMs: 1500, // Novo bloco a cada 1.5s
    actionRateLimitPerSecond: 8
  }
};
