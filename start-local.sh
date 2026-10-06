#!/usr/bin/env bash
# ==============================================================================
# Script para iniciar o ambiente local do Bomberman SQS (LocalStack + Filas)
# ==============================================================================

set -e

CONTAINER_CMD="podman"
if command -v docker &> /dev/null; then
  CONTAINER_CMD="docker"
fi

echo "======================================================"
echo "Iniciando Bomberman LocalStack SQS com ${CONTAINER_CMD}..."
echo "======================================================"

# 1. Remove container anterior se existir
${CONTAINER_CMD} rm -f bomberman-localstack 2>/dev/null || true

# 2. Inicia o LocalStack em background
echo "1. Subindo container LocalStack na porta 4566..."
${CONTAINER_CMD} run -d \
  --name bomberman-localstack \
  -p 4566:4566 \
  -e SERVICES=sqs \
  -e AWS_DEFAULT_REGION=us-east-1 \
  localstack/localstack:3.0

echo "2. Aguardando inicialização do SQS no LocalStack (aguarde 5 segundos)..."
sleep 5

# 3. Cria as duas filas FIFO no LocalStack
echo "3. Criando filas FIFO locais no LocalStack..."
${CONTAINER_CMD} run --rm --network=host \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli:latest sqs create-queue \
    --endpoint-url=http://localhost:4566 \
    --queue-name bomberman-actions.fifo \
    --attributes FifoQueue=true,ContentBasedDeduplication=false

${CONTAINER_CMD} run --rm --network=host \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli:latest sqs create-queue \
    --endpoint-url=http://localhost:4566 \
    --queue-name bomberman-events.fifo \
    --attributes FifoQueue=true,ContentBasedDeduplication=false

echo "======================================================"
echo "✔ Filas criadas com sucesso no LocalStack!"
echo "Para iniciar a aplicação, execute:"
echo "  ./run-app.sh"
echo "======================================================"
