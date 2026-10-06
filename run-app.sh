#!/usr/bin/env bash
# ==============================================================================
# Executa o Bomberman Web Server + Worker via Container Podman/Docker
# ==============================================================================

set -e

CONTAINER_CMD="podman"
if command -v docker &> /dev/null; then
  CONTAINER_CMD="docker"
fi

echo "======================================================"
echo "Iniciando Bomberman Game (Backend + Worker) com ${CONTAINER_CMD}..."
echo "Acesse no navegador: http://localhost:3000"
echo "======================================================"

# Executa container com node 20 montando o projeto e conectando na rede do host
${CONTAINER_CMD} run --rm -it \
  --name bomberman-app \
  --network=host \
  -v .:/app:z \
  -w /app \
  node:20-alpine \
  sh -c "npm install && npm run start:all"
