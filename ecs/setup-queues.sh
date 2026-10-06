#!/usr/bin/env bash
# ==============================================================================
# Script de Criação das Filas AWS SQS FIFO para o Bomberman Multiplayer
# Cada membro do grupo deve rodar este script substituindo SEU_NOME pelo seu identificador
# ==============================================================================

set -e

MEMBER_NAME="${1:-enthony}"
AWS_REGION="${AWS_REGION:-us-east-1}"

ACTIONS_QUEUE="bomberman-${MEMBER_NAME}-actions.fifo"
EVENTS_QUEUE="bomberman-${MEMBER_NAME}-events.fifo"

echo "======================================================"
echo "Criando filas FIFO individuais na AWS para: ${MEMBER_NAME}"
echo "Região: ${AWS_REGION}"
echo "======================================================"

# 1. Criação da fila de Ações
echo "Criando fila: ${ACTIONS_QUEUE}..."
ACTIONS_URL=$(aws sqs create-queue \
  --queue-name "${ACTIONS_QUEUE}" \
  --region "${AWS_REGION}" \
  --attributes "FifoQueue=true,ContentBasedDeduplication=false,VisibilityTimeout=30" \
  --query 'QueueUrl' \
  --output text)

echo "Fila de Ações criada com sucesso: ${ACTIONS_URL}"

# 2. Criação da fila de Eventos
echo "Criando fila: ${EVENTS_QUEUE}..."
EVENTS_URL=$(aws sqs create-queue \
  --queue-name "${EVENTS_QUEUE}" \
  --region "${AWS_REGION}" \
  --attributes "FifoQueue=true,ContentBasedDeduplication=false,VisibilityTimeout=30" \
  --query 'QueueUrl' \
  --output text)

echo "Fila de Eventos criada com sucesso: ${EVENTS_URL}"

echo ""
echo "======================================================"
echo "Configuração para o arquivo .env ou Task Definition:"
echo "SQS_ACTIONS_QUEUE_URL=${ACTIONS_URL}"
echo "SQS_EVENTS_QUEUE_URL=${EVENTS_URL}"
echo "======================================================"
