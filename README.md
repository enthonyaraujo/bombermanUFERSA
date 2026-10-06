# BombermanUFERSA

Jogo web multiplayer (2 a 4 jogadores) no estilo clássico de arena com bombas em grade, desenvolvido como projeto prático da disciplina de Sistemas Distribuídos da Universidade Federal Rural do Semi-Árido (UFERSA).

> Aviso: Projeto acadêmico de caráter estritamente educacional, sem fins lucrativos e não afiliado à Konami Digital Entertainment ou a qualquer detentora de marcas comerciais de jogos. A denominação "Bomberman" é marca registrada de seus respectivos proprietários. Todas as implementações de código, roteamento de mensagens, estilos visuais e lógica de arena contidos neste repositório são originais.

---

## Sobre o Projeto

O jogador define seu apelido, acessa o lobby em tempo real, cria ou ingressa em salas ativas e participa de combates sincronizados em uma arena ambientada no semiárido brasileiro (bioma Caatinga):
- Mandacarus funcionam como blocos indestrutíveis da arena.
- Caixas de barro cozido atuam como blocos destrutíveis que liberam melhorias (power-ups).
- Robôs exploradores sertanejos personificam os avatares dos jogadores em quatro cores distintas.

O objetivo central do projeto é exercitar os conceitos fundamentais de sistemas distribuídos:
- Comunicação bidirecional em tempo real via WebSockets.
- Arquitetura assíncrona orientada a filas de mensagens com ordenação estrita (AWS SQS FIFO).
- Autoridade de simulação no servidor e desacoplamento entre camada de rede e motor de regras.
- Mecanismo de predição no cliente (Client-side Prediction) e reconciliação com o estado autoritativo.
- Tolerância a falhas, tratamento de desconexões e garantia de idempotência.

---

## Funcionalidades

- Autenticação simplificada por apelido (até 15 caracteres alfanuméricos).
- Lobby dinâmico com atualização de salas em tempo real via canal de transmissão.
- Salas com códigos curtos aleatórios de 4 caracteres (formato Among Us / Jackbox, ex.: K7QM).
- Suporte a salas públicas (listadas abertamente) e salas privadas protegidas por senha.
- Modal centralizado de autenticação com validação segura de senha para salas privadas.
- Sala de espera (Waiting Room) com quatro posições dedicadas, indicação de anfitrião (Host) e controle de prontidão ("Pronto").
- Arena em grade 17x13 com renderização a 60 quadros por segundo em HTML5 Canvas puro.
- Mecânicas de combate: bombas com pavio temporizado, faíscas incandescentes, explosões em cruz escalonadas, reações em cadeia e power-ups (bomba extra, alcance de chama e velocidade).
- Mecânica de Morte Súbita (Sudden Death): fechamento progressivo da arena em espiral das bordas para o centro após 2 minutos de partida.
- Painel superior (HUD) com cronômetro, contador de estoque de recursos, fichas de jogadores (vivos ou eliminados) e indicador de latência (ping).
- Interface autoadaptável ao monitor em formato 100vh fixo sem barra de rolagem (scroll-free).
- Tela de encerramento com pódio estruturado do 1º ao 4º colocado e pontuação dos combatentes.
- Notificações flutuantes de eventos de rede (entrada, saída de jogador, reconexão e morte súbita).

---

## Controles do Jogo

| Ação | Teclas |
| :--- | :--- |
| Movimentação | W, A, S, D ou Setas direcionais |
| Plantar bomba | Barra de Espaço |
| Expressões (Emotes) | Teclas numéricas 1, 2, 3 e 4 |

---

## Arquitetura do Sistema

A solução adota uma arquitetura desacoplada em três camadas principais:

```
[ Navegadores dos Jogadores (P1 a P4) ]
                   │
                   │ WebSockets (Deltas de Estado e Eventos)
                   ▼
  [ Servidor Backend (Node.js Express + ws) ]
  Implantado em contêineres AWS ECS Fargate
                   │                                ▲
                   │ SendMessage (Ações)            │ ReceiveMessage (Eventos)
                   ▼                                │
      [ AWS SQS: actions.fifo ]        [ AWS SQS: events.fifo ]
                   │                                ▲
                   │ ReceiveMessageBatch (Lote)     │ SendMessageBatch (Lote)
                   ▼                                │
         [ Game Engine Worker (Motor Autoritativo do Jogo) ]
```

### Componentes

| Componente | Papel na Arquitetura |
| :--- | :--- |
| Cliente Web (Frontend) | Interface gráfica em HTML5 Canvas puro e CSS retrô 16-bit. Executa predição local de movimento e interpolação linear (LERP) para garantir latência percebida nula. |
| Servidor Backend | Aplicação Express e servidor de WebSockets. Gerencia conexões, atende endpoints de consulta (/api/info, /api/rooms), valida senhas e despacha ações dos clientes para a fila de entrada. |
| AWS SQS FIFO (actions.fifo) | Fila de entrada com ordenação rigorosa (First-In-First-Out) e eliminação de duplicidades para as ações dos jogadores (JOIN_ROOM, MOVE, PLACE_BOMB, SET_READY). |
| Game Engine Worker | Instância autoritativa que consome ações em lotes, processa colisões, detonações, danos, power-ups e regras de vitória, gerando deltas de estado para a fila de eventos. |
| AWS SQS FIFO (events.fifo) | Fila de saída que recebe os eventos consolidados pela Game Engine (PLAYER_MOVED, BOMB_PLACED, EXPLOSION, GAME_OVER) para encaminhamento aos clientes. |
| AWS ECS Fargate | Ambiente gerenciado de execução dos contêineres Docker da aplicação em nuvem sob um Application Load Balancer (ALB). |

---

## Decisões de Projeto

- Codificação Curta de Salas: Códigos de 4 caracteres em caixa alta gerados a partir de um alfabeto sem caracteres ambíguos visualmente (sem 0, O, 1, I). A unicidade é verificada em memória pelo gerenciador de salas.
- Separação entre Código e Sessão: O código público da sala identifica o agrupamento no lobby. O acesso às ações de jogo é validado pelo identificador do jogador (playerId) atribuído na conexão.
- Servidor como Autoridade Absoluta: Nenhuma física, colisão ou eliminação é decidida no cliente. O cliente propõe movimentações numeradas sequencialmente (seq) e reconcilia a posição visual com as coordenadas autoritativas confirmadas pelo backend.
- Idempotência e Desduplicação: Cada mensagem enviada ao AWS SQS utiliza MessageGroupId por sala e MessageDeduplicationId composto pelo identificador da sala, do jogador e do número de sequência, evitando reprocessamento de ações repetidas em caso de instabilidade na rede.
- Modo Híbrido de Desenvolvimento: O sistema opera nativamente com os serviços da nuvem AWS, suporta emulação local sem custos via LocalStack, e possui mecanismo de fallback em memória para execução de testes unitários contínuos sem dependências externas.
- Conformidade de Avaliação Acadêmica: Implementação dos cabeçalhos informativos com a identificação pública da aplicação (APP_PUBLIC_NAME) e listagem nominal dos integrantes da equipe (GROUP_MEMBERS) disponibilizados via rota REST /api/info.

---

## Estrutura do Repositório

```
avaliacao-06-07/
├── src/
│   ├── backend/               # Servidor HTTP, WebSocketManager e RoomManager
│   │   ├── RoomManager.js      # Geração de códigos de 4 letras e validação de senhas
│   │   ├── server.js           # Inicialização do Express, endpoints e rotas WS
│   │   ├── SqsConsumer.js      # Consumo contínuo de eventos do SQS
│   │   ├── SqsProducer.js      # Despacho de mensagens para o SQS
│   │   └── WebSocketManager.js # Roteamento de conexões de sala e lobby
│   ├── config/                # Variáveis de ambiente, credenciais AWS e limites
│   ├── engine/                # Motor de simulação isolado de dependências de rede
│   │   ├── BombermanEngine.js  # Lógica autoritativa, colisões, timers e ciclo de jogo
│   │   ├── Constants.js        # Dimensões da arena, velocidades e constantes
│   │   └── MapGenerator.js     # Geração procedural determinística da arena
│   ├── public/                # Aplicação frontend entregue ao navegador
│   │   ├── css/style.css       # Folha de estilos 16-bit com tema da Caatinga
│   │   ├── js/                 # Scripts do cliente (Renderer, Network, InputHandler, main)
│   │   └── index.html          # Estrutura das telas de login, lobby, sala e arena
│   └── worker/                # Worker desacoplado de processamento da engine
│       ├── ActionProcessor.js  # Processamento de lotes da fila actions.fifo
│       ├── EventPublisher.js   # Publicação em lote na fila events.fifo
│       └── worker.js           # Ponto de entrada para execução isolada do worker
├── tests/                     # Suíte de testes unitários e de integração
│   ├── engine-bombs-chain.test.js
│   ├── engine-movement.test.js
│   ├── engine-victory.test.js
│   ├── room-manager.test.js
│   └── server-lobby.test.js
├── ecs/                       # Artefatos de implantação em nuvem
│   ├── Dockerfile
│   ├── setup-queues.sh
│   └── task-definition.json
├── docs/                      # Documentação dos requisitos e telas
│   ├── ui-screens.md
│   ├── avaliação.md
│   └── jogo.md
├── docker-compose.yml         # Orquestração local com emulador LocalStack
├── package.json
└── README.md
```

---

## Tecnologias Utilizadas

- Frontend: HTML5 Canvas, JavaScript (ECMAScript Modules), CSS customizado (Design System Sertão Pixel).
- Tipografia: Google Fonts (Press Start 2P para títulos e números retrô; Space Mono para formulários e controles).
- Backend: Node.js 20+, Express 4, biblioteca ws para WebSockets.
- Mensageria em Nuvem: AWS SDK para JavaScript v3 (@aws-sdk/client-sqs), AWS SQS FIFO.
- Contêineres e Infraestrutura: Docker, AWS ECS Fargate, AWS Application Load Balancer (ALB).
- Ambiente Local: LocalStack (emulação de filas SQS para testes sem custos de nuvem).
- Testes Automatizados: Node.js Test Runner nativo (módulos node:test e node:assert).

---

## Como Executar

### Pré-requisitos

- Node.js versão 20 ou superior instalada.
- Docker ou Podman (opcional, para execução com LocalStack ou contêineres).
- AWS CLI configurado com credenciais válidas (para implantação oficial no ECS).

---

### Execução Local Rápida (Sem Dependência Externa)

O projeto possui mecanismo de contingência em memória que permite testar toda a lógica do jogo e o fluxo de salas sem necessidade de conexão com a AWS:

1. Clone o repositório e acerte o diretório de trabalho:
```bash
git clone https://github.com/Enthony-dev/distributed-sytems.git
cd distributed-sytems/avaliacao-06-07
```

2. Instale as dependências do projeto:
```bash
npm install
```

3. Configure o arquivo de variáveis de ambiente:
```bash
cp .env.example .env
```

4. Inicie o servidor:
```bash
npm start
```

5. Acesse a aplicação no navegador pelo endereço:
```
http://localhost:3000
```

---

### Execução com Emulação do AWS SQS (LocalStack)

Caso deseje validar o tráfego real de mensagens em filas FIFO localmente:

1. Inicie o contêiner do LocalStack:
```bash
docker compose up -d
```

2. Certifique-se de que o arquivo `.env` aponta para o endpoint local:
```env
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
SQS_ACTIONS_QUEUE_URL=http://localhost:4566/000000000000/bomberman-actions.fifo
SQS_EVENTS_QUEUE_URL=http://localhost:4566/000000000000/bomberman-events.fifo
```

3. Inicie a aplicação:
```bash
npm start
```

---

### Execução dos Testes Automatizados

A suíte de testes cobre a integridade física da engine, detonações em cadeia, colisões, Morte Súbita, gestão de códigos Among Us e validação de senhas do lobby:

```bash
npm test
```

---

## Implantação em Nuvem (AWS ECS & SQS)

1. Criação das filas FIFO individuais na AWS:
```bash
./ecs/setup-queues.sh SEU_NOME
```

2. Construção e publicação da imagem Docker no Amazon ECR:
```bash
docker build -t bomberman-ufersa -f ecs/Dockerfile .
docker tag bomberman-ufersa:latest <ID_CONTA>.dkr.ecr.us-east-1.amazonaws.com/bomberman-ufersa:latest
docker push <ID_CONTA>.dkr.ecr.us-east-1.amazonaws.com/bomberman-ufersa:latest
```

3. Registro da Task Definition e inicialização do serviço no cluster ECS Fargate associado a um Application Load Balancer.

---

## Boas Práticas de Segurança

- Credenciais de acesso à AWS, segredos e chaves de API não devem ser versionados em repositório público.
- O repositório contém arquivo `.gitignore` instruindo a exclusão de arquivos `.env` e diretórios de dependência.
- Em ambiente de produção na AWS, a autenticação das instâncias ECS deve ser realizada por IAM Roles vinculadas à Task Definition, evitando chaves de longa duração no código.

---

## Equipe de Desenvolvimento

| Integrante | Responsabilidade |
| :--- | :--- |
| Enthony Araújo | Arquitetura de Nuvem, Integração AWS SQS/ECS e Frontend |
| Douglas Patrick | Lógica da Game Engine, Mecânicas de Combate e Colisões |
| Guilherme Silva | Servidor WebSocket, Gerenciador de Salas e Mensageria |
| Guilherme Gabriel | Interface Visual, Design System Sertão Pixel e Testes |

- Disciplina: Sistemas Distribuídos
- Instituição: Universidade Federal Rural do Semi-Árido (UFERSA)
- Semestre Letivo: 2026.2

---

## Licença

Este projeto é distribuído sob os termos da licença MIT. Consulte o arquivo [LICENSE](./LICENSE) para informações adicionais.
