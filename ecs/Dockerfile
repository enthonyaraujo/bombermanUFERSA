# Dockerfile para AWS ECS Fargate & Implantação de Produção
FROM node:20-alpine

WORKDIR /app

# Instala dependências de produção
COPY package*.json ./
RUN npm ci --only=production

# Copia código fonte da aplicação
COPY src/ ./src/

# Variáveis padrão
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Executa o servidor unificado com WebSocket, Game Engine e AWS SQS
CMD ["npm", "start"]
