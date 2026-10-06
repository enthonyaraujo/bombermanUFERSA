import { EventPublisher } from './EventPublisher.js';
import { ActionProcessor } from './ActionProcessor.js';

console.log('[Worker] Iniciando Game Engine Worker...');

const eventPublisher = new EventPublisher();
const actionProcessor = new ActionProcessor(eventPublisher);

let isRunning = true;

// Loop autônomo de Long Polling em actions.fifo
async function runPollingLoop() {
  console.log('[Worker] Long polling ativo em actions.fifo');
  while (isRunning) {
    try {
      await actionProcessor.pollAndProcess();
    } catch (err) {
      console.error('[Worker] Exceção no polling loop:', err);
      // Breve pausa para não sobrecarregar CPU em caso de queda de rede
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// Tick periódico de física e timers (50ms = 20 ticks por segundo no servidor)
const tickInterval = setInterval(async () => {
  try {
    await actionProcessor.tickActiveRooms();
  } catch (err) {
    console.error('[Worker] Erro no tick periódico:', err);
  }
}, 50);

// Inicia polling
runPollingLoop();

// Tratamento de encerramento gracioso
function shutdown() {
  console.log('[Worker] Encerrando worker graciosa...');
  isRunning = false;
  clearInterval(tickInterval);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
