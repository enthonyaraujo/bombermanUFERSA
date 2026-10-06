# Avaliação 06 e 07 - Comunicação em Sistemas Distribuídos

## Enunciado da Atividade

- Junte-se em grupo de 4 pessoas;
- Desenvolva um jogo criativo e divertido (utilize ferramentas de IA Generativa) para ser jogado em multiplayer na Internet, onde tenha os 4 jogadores executando o mesmo jogo em simultâneo;
- Utilize o sistema de filas da AWS SQS e os servidores utilizam contêineres ECS como recursos computacionais ao seu jogo;

### Prints Obrigatórios para Envio:

1. **Do jogo, sendo executado na barra de endereço do seu navegador**, mostrando o nome do jogador no formato `NOME_DO_JOGO-SEU_NOME.DOMÍNIO_DO_ECS`;
2. **Das informações dos membros do seu grupo**, como um print do jogo contendo os nomes de todos os jogadores do seu grupo;
3. **Da sua fila SQS**, contendo mensagens utilizadas pelo jogo.

### Observações Importantes:

- Não serão aceitos jogos executando em ambiente de localhost (máquina individual). Utilize os endereços IPv4 e DNS públicos disponíveis nos registros de prints.
- Cada membro do grupo tem que ter a sua própria fila do AWS SQS.
- Apesar de ser em grupo, a atividade é individual e os registros deverão registrar tal requisito.

---

## Mapeamento da Equipe

| Membro | Papel no Projeto | Identificador Individual da Fila SQS |
|---|---|---|
| ENTHONY ARAUJO | Backend, Mensageria SQS e Infra ECS | `bomberman-enthony` |
| DOUGLAS PATRICK | Lógica da Engine e Sincronização | `bomberman-douglas` |
| GUILHERME SILVA | Frontend, Canvas e Design Sertão | `bomberman-guilherme-silva` |
| GUILHERME GABRIEL | Protocolo WebSocket e Validações | `bomberman-guilherme-gabriel` |

---

## Checklist de Conformidade dos Requisitos

| Requisito do Professor | Implementação no Projeto | Evidência no Sistema |
|---|---|---|
| Grupo de 4 pessoas | Grupo oficial cadastrado na aplicação | Exibido no cabeçalho do jogo (`Equipe SD: ENTHONY ARAUJO, DOUGLAS PATRICK, GUILHERME SILVA, GUILHERME GABRIEL`) |
| Jogo criativo e multiplayer simultâneo (4 jogadores) | BombermanUFERSA com tema do semiárido brasileiro (Caatinga) | Suporta de 2 a 4 jogadores reais simultâneos em grid 17x13 com bombas em cadeia, power-ups e morte súbita |
| Arquitetura em nuvem: AWS SQS FIFO | Filas `actions.fifo` e `events.fifo` com desacoplamento produtor/consumidor | Worker dedicado processa mensagens em fila com ordenação e deduplicação |
| Arquitetura em nuvem: AWS ECS Fargate | Contêiner Docker implantado em cluster ECS | Configurado via `ecs/Dockerfile` e `ecs/task-definition.json` atrás de Application Load Balancer (ALB) |
| Formato da URL no navegador: `NOME_DO_JOGO-SEU_NOME.DOMÍNIO_DO_ECS` | Roteamento por Host e URL query | Suporta `http://BOMBERMAN-ENTHONY.DOMÍNIO_DO_ECS/` e rota `/bomberman-enthony` ou `?player=ENTHONY` |
| Fila SQS individual por membro | Script `ecs/setup-queues.sh` parametrizado por nome | Cada aluno possui suas próprias filas nominais na AWS (ex.: `bomberman-enthony-actions.fifo`) |
| Sem uso de localhost nos prints | Acesso via DNS público do ALB / Route 53 | Utiliza o domínio público ou IP público da AWS na barra de endereços |

---

## Guia Passo a Passo para os Prints de Entrega

### Print 1: Jogo na Barra de Endereço (`NOME_DO_JOGO-SEU_NOME.DOMÍNIO_DO_ECS`)

O professor exige que a barra de endereços do navegador mostre claramente o nome do jogo, o nome do aluno e o domínio público do ECS.

**Como configurar e capturar:**
1. No arquivo `.env` ou nas variáveis de ambiente da Task Definition do ECS, configure:
   ```env
   APP_PUBLIC_NAME=BOMBERMAN-ENTHONY.SEU-ALB-DNS.COM
   ```
2. Acesse a aplicação no navegador através do DNS do Load Balancer ou CNAME Route 53:
   - Formato via subdomínio: `http://bomberman-enthony.seu-alb-dns.com:3000/`
   - Formato via caminho/query: `http://seu-alb-dns.com:3000/?player=ENTHONY` ou `http://seu-alb-dns.com:3000/bomberman-enthony`
3. O jogo detecta o nome do aluno e:
   - Preenche automaticamente o apelido no login;
   - Exibe o badge superior com `DOMÍNIO ECS: BOMBERMAN-ENTHONY.SEU-ALB-DNS.COM`;
   - Define o título da aba do navegador como `BOMBERMAN-ENTHONY.SEU-ALB-DNS.COM · BombermanUFERSA`.
4. **Tire o print da tela inteira do navegador**, garantindo que a **barra de endereços do navegador esteja 100% visível e legível**.

---

### Print 2: Membros do Grupo no Jogo

O professor exige a comprovação dos nomes dos membros do grupo dentro do jogo em execução.

**Como configurar e capturar:**
1. Certifique-se de que a variável `GROUP_MEMBERS` contenha os 4 membros:
   ```env
   GROUP_MEMBERS="ENTHONY ARAUJO, DOUGLAS PATRICK, GUILHERME SILVA, GUILHERME GABRIEL"
   ```
2. No topo de todas as telas (Login, Lobby e Sala de Espera), o banner oficial exibe:
   ```text
   Equipe SD: ENTHONY ARAUJO, DOUGLAS PATRICK, GUILHERME SILVA, GUILHERME GABRIEL
   ```
3. Na **Sala de Espera**, crie uma sala e conecte os 4 jogadores simultaneamente. Cada slot exibirá o nome de um membro da equipe com sua respectiva cor e robô da Caatinga.
4. **Tire o print da tela do jogo** mostrando a sala com os 4 jogadores conectados e o banner da Equipe SD visível no topo.

---

### Print 3: Console AWS SQS com Mensagens Utilizadas pelo Jogo

O professor exige o registro da sua fila individual do Amazon SQS contendo mensagens reais trocadas durante uma partida.

**Como configurar e capturar:**
1. Execute o script de criação da sua fila nominal individual na AWS:
   ```bash
   ./ecs/setup-queues.sh enthony
   ```
   Isso criará as filas:
   - `bomberman-enthony-actions.fifo`
   - `bomberman-enthony-events.fifo`
2. No `.env`, aponte para essas filas:
   ```env
   SQS_ACTIONS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<SEU_ACCOUNT_ID>/bomberman-enthony-actions.fifo
   SQS_EVENTS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<SEU_ACCOUNT_ID>/bomberman-enthony-events.fifo
   ```
3. Inicie o jogo e realize ações (mover, plantar bombas, coletar itens).
4. No console da AWS:
   - Navegue até **Amazon SQS** > **Queues**.
   - Abra a fila `bomberman-enthony-actions.fifo` ou `bomberman-enthony-events.fifo`.
   - Clique em **Send and receive messages** > **Poll for messages**.
   - Abra uma das mensagens capturadas para exibir o payload JSON no formato:
     ```json
     {
       "roomId": "K7QM",
       "playerId": "p-enthony",
       "seq": 4,
       "type": "PLACE_BOMB",
       "payload": {},
       "ts": 1728230000000
     }
     ```
5. **Tire o print do console da AWS** mostrando o nome da fila individual (`bomberman-enthony-actions.fifo`) e a mensagem expandida com os dados da partida.
