# 🔌 Inventário de Contratos, Integrações Externas e Resiliência (`CONTRACTS_AND_INTEGRATIONS.md`)

Este documento consolida a arquitetura de borda, integrações externas (Outbound Integrations), serviços de terceiros, ausência de Webhooks/Filas e a matriz de resiliência e falhas do repositório **`ai-commit-review`**.

---

## 🌐 1. APIs e Serviços Externos Consumidos (Outbound Integrations)

O `ai-commit-review` conecta-se a 4 serviços externos/subprocessos do sistema operacional para realizar suas operações de análise, envio de e-mail e manipulação de repositórios.

### 1.1 OpenAI API / Local OpenAI-Compatible Server
- **Provedor / Serviço**: OpenAI REST API (`api.openai.com`) ou Servidor Local compatível (LM Studio / Ollama).
- **Módulo Responsável**: [`src/openaiUtils.js`](file:///d:/GitHub/ai_commit_review/src/openaiUtils.js) (funções `analyzeUpdatedCode` e `summarizeText`).
- **Forma de Autenticação**: Bearer Token (`apiKey: config.OPENAI_API_KEY`) e URL base opcional (`baseURL: config.OPENAI_API_BASEURL`).
- **Payload & Modelos**: Consome modelos `gpt-5-nano` (com parâmetros `reasoning_effort: "low"`), `openai/gpt-oss-20b` ou `deepseek-local`.
- **Resiliência e Retentativas**:
  - ⚠️ **Tratamento de 401 Unauthorized**: Se a API retornar HTTP 401 (chave de API inválida ou expirada), o sistema dispara automaticamente o prompt `updateValidApiKey()` e re-executa a chamada de forma recursiva.
  - 🚨 **Alerta de Resiliência**: Não há biblioteca de *Circuit Breaker* ou *Exponential Backoff* configurada. Falhas de rede não-401 (ex: HTTP 500 ou 503) lançam exceção e abortam a análise.

### 1.2 Serviço SMTP / Nodemailer (Validação OTP)
- **Provedor / Serviço**: Servidor SMTP (padrão `smtp.office365.com` ou configurado no `.env`).
- **Módulo Responsável**: [`src/validateEmail.js`](file:///d:/GitHub/ai_commit_review/src/validateEmail.js) (função `enviarEmail`).
- **Forma de Autenticação**: Autenticação SMTP básica (`user: process.env.SMTP_USER`, `pass: process.env.SMTP_PASS`) sobre TLS (porta 587, ciphers SSLv3).
- **Contrato da Mensagem**:
  - **Remetente**: `process.env.FROM_EMAIL` (`no-reply@ntapp.com.br`).
  - **Assunto**: `Code Validation - ai-commit-review`.
  - **Corpo**: `Your validation code is: {codigo}. It expires in 10 minutes.`.
- **Resiliência e Retentativas**:
  - 🚨 **Alerta de Resiliência**: Erros de conexão SMTP são capturados em bloco `try...catch`, imprimem mensagem de erro e retornam `false`. Não há fila de retentativa offline.

### 1.3 GitHub CLI (`gh`)
- **Provedor / Subprocesso**: CLI do GitHub instalado no sistema operacional host.
- **Módulo Responsável**: [`src/gitUtils.js`](file:///d:/GitHub/ai_commit_review/src/gitUtils.js) (função `createPullRequest`).
- **Forma de Autenticação**: Sessão local autenticada no SO (`gh auth login`).
- **Comando de Execução**: `gh pr create --base {base} --head {head} --title "{title}" --body "{body}" --reviewer {reviewer}`.
- **Resiliência**:
  - Executa verificação inicial de presença do binário `gh --version`. Se não instalado, encerra a execução com erro (`process.exit(1)`).

### 1.4 npm Registry (Verificação de Versão da CLI)
- **Provedor / Subprocesso**: Registro oficial do npm (`registry.npmjs.org`).
- **Módulo Responsável**: [`cli.js`](file:///d:/GitHub/ai_commit_review/cli.js) (função `checkOutdatedLib`).
- **Comando de Execução**: `npm outdated -g ai-commit-review --json` e `npm update -g ai-commit-review`.
- **Resiliência**:
  - 🛡️ **Degradação Graciosa**: Se o registro do npm estiver offline ou o terminal sem acesso à internet, o erro é capturado silenciosamente no bloco `try...catch` e a CLI prossegue normalmente com a versão instalada.

### 1.5 APIs de Scraping e Google Search (NTAPP)
- **Provedor / Serviço**: Gateway de Scraping Web da NTAPP (`https://global.ntapp.com.br/bkp-intra/api`).
- **Módulo Responsável**: [`src/webSearchService.js`](file:///d:/GitHub/ai_commit_review/src/webSearchService.js) (funções `searchGoogle` e `scrapeUrl`).
- **Forma de Autenticação**: HTTP Basic Auth (`Authorization: Basic <base64>`) configurado via `SCRAPING_API_AUTH` ou `SCRAPING_API_USER`/`SCRAPING_API_PASS` no `.env` ou `.config.json`.
- **Rotas**:
  - `GET /scraping_google_search/?query=<query>&limit=5&format=markdown&ai=true`
  - `GET /scraping_url/?url=<url>&format=markdown`
- **Resiliência e Retentativas**:
  - 🛡️ **Timeout e Fallback Seguro**: Requisições possuem timeout estrito de 8000ms (`AbortSignal.timeout`). Se a API oscilar ou falhar, retorna `{ success: false }` de forma segura sem interromper o fluxo do CLI.

### 1.6 Motor de Diagnóstico de Erros e Auto-Recuperação
- **Módulo Responsável**: [`src/errorDiagnosticService.js`](file:///d:/GitHub/ai_commit_review/src/errorDiagnosticService.js) e [`cli.js`](file:///d:/GitHub/ai_commit_review/cli.js) (`safeExecuteCommand`).
- **Finalidade**: Interceptar falhas em tempo de execução, enriquecer o erro com dados da web e obter análise e comando de correção (`AUTO_FIX_CMD`) da OpenAI.
- **Resiliência**:
  - Permite ao desenvolvedor executar o comando de auto-fix e reexecutar a operação original (`retry`) em loop contínuo até a conclusão.

---

## 📥 2. Webhooks Recebidos (Inbound Webhooks)

> [!NOTE]
> O `ai-commit-review` é uma ferramenta de linha de comando (CLI) utilitária que executa localmente sob demanda do desenvolvedor. **Não há servidores HTTP expostos, portas escutando requisições externas nem rotas de Webhooks de entrada (Inbound Webhooks)**.

---

## 🔄 3. Mensageria, Filas e Eventos Assíncronos

> [!NOTE]
> A aplicação não utiliza brokers de mensageria nem barramentos de eventos externos (como RabbitMQ, Kafka, SQS ou Redis Pub/Sub).
> 
> Toda a comunicação assíncrona é gerenciada em memória via `Promises` do Node.js, e o estado intermediário de diffs sumarizados é persistido localmente no arquivo `.cache/context.json`.

---

## ⏰ 4. Rotinas Agendadas e Processamentos em Lote (Schedulers)

| Identificador / Nome do Job | Frequência / Gatilho | Arquivo / Handler | Objetivo de Negócio | Controle de Concorrência (Lock) |
| :--- | :--- | :--- | :--- | :--- |
| **Check Update Global `ai-commit-review`** | Inicialização de cada comando CLI | [`cli.js:L14-L48`](file:///d:/GitHub/ai_commit_review/cli.js#L14-L48) | Verificar no registro npm se existe versão mais recente instalável globalmente e disparar `npm update -g` automaticamente. | N/A (Execução síncrona na inicialização do processo Node). |

---

## ⚠️ 5. Matriz de Falhas e Resiliência (Resilience Matrix)

A tabela abaixo descreve o comportamento do sistema e o nível de degradação diante da indisponibilidade de cada dependência externa:

| Dependência Externa | Evento de Falha / Erro | Comportamento do Sistema | Impacto no Usuário | Nível de Risco |
| :--- | :--- | :--- | :--- | :---: |
| **OpenAI API** | HTTP 401 Unauthorized | Dispara prompt interativo `updateValidApiKey()` solicitando nova chave e re-executa. | Baixo (recuperação interativa). | 🟡 MÉRITO |
| **OpenAI API** | HTTP 500 / 503 / Timeout de Rede | Lança exceção em `analyzeWithPrompt`, exibe mensagem em vermelho no terminal e encerra o comando. | **Bloqueante** para `analyze` e geração de mensagens com IA. | 🔴 CRÍTICO |
| **Local AI Server** | `ECONNREFUSED 127.0.0.1:1234` | Lança erro de conexão no SDK OpenAI e interrompe a execução. | **Bloqueante** se a configuração apontar para a URL local inativa. | 🔴 CRÍTICO |
| **Servidor SMTP** | Falha de autenticação ou timeout no envio de e-mail | `enviarEmail` retorna `false`. Exibe mensagem "Error sending email". | **Bloqueante** para validação de clientes NTAPP. | 🟡 MÉRITO |
| **GitHub CLI (`gh`)** | Binário `gh` não encontrado no `PATH` | Exibe mensagem de erro e executa `process.exit(1)`. | **Bloqueante** para `acr updateProductionServer`. | 🟡 MÉRITO |
| **npm Registry** | Sem conexão com a internet | Captura erro em `cli.js` e ignora a atualização, continuando o uso da CLI local. | **Nenhum** (degradação graciosa perfeita). | 🟢 BAIXO |
