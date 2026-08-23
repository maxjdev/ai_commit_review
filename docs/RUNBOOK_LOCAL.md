# 🚀 Guia de Execução, Setup e Testes Locais (`RUNBOOK_LOCAL.md`)

Este documento estabelece o guia oficial de ambiente de desenvolvimento local (DX/DevOps) para a execução, compilação, testes e troubleshooting do repositório **`ai-commit-review`**.

---

## 🛠️ 1. Pré-requisitos do Sistema

Para executar, testar e empacotar a aplicação localmente, certifique-se de ter instalado em seu ambiente:

| Ferramenta / Runtime | Versão Recomendada | Verificação no Terminal | Obrigatoriedade |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 18.x` (LTS recomendado 20.x/22.x) | `node -v` | **Mandatório** |
| **npm** | `>= 9.x` | `npm -v` | **Mandatório** |
| **Git CLI** | `>= 2.30.0` | `git --version` | **Mandatório** |
| **GitHub CLI (`gh`)** | `>= 2.0.0` | `gh --version` | **Mandatório** (necessário para `acr updateProductionServer`) |
| **PowerShell** | `>= 5.1` (Windows) | `$PSVersionTable.PSVersion` | Opcional (necessário apenas para `publish-npm.ps1`) |
| **Docker** | `>= 20.10.0` | `docker --version` | Opcional (necessário apenas para fluxos de versão em `testServerUpdate.js`) |

---

## ⚙️ 2. Setup Inicial Passo a Passo (Zero to Running)

Siga a sequência abaixo para configurar o ambiente do zero até a execução interativa:

### Passo 1: Clonar o Repositório e Entrar na Pasta
```bash
git clone https://github.com/fernandobnog/ai_commit_review.git
cd ai_commit_review
```

### Passo 2: Instalar Dependências do Projeto
```bash
npm install
```

### Passo 3: Configurar Variáveis de Ambiente
Copie ou crie o arquivo de variáveis de ambiente com base no template de desenvolvimento:
```bash
# Em sistemas Unix/macOS:
cp .env.develop .env

# Em Windows (PowerShell):
Copy-Item .env.develop .env
```

### Passo 4: Executar o Compilador / Webpack Build
O `ai-commit-review` é empacotado via Webpack em um arquivo único CommonJS executável em `dist/bundle.cjs`:
```bash
npm run build
```

### Passo 5: Inicializar a Aplicação em Modo de Desenvolvimento
Para testar a CLI em desenvolvimento (lendo `.env` via `dotenv`):
```bash
# Execução direta via Node.js:
npm start

# Ou execução direta apontando para o CLI:
node cli.js
```

---

## 🔑 3. Dicionário de Variáveis de Ambiente

As variáveis abaixo controlam a criptografia, o envio de e-mails OTP e a integração com a API da OpenAI ou modelos locais:

| Variável | Obrigatória? | Valor Padrão / Exemplo `.env.develop` | Descrição e Impacto no Sistema |
| :--- | :---: | :--- | :--- |
| `PASSWORD_CRYPTO_KEY` | **Sim** | `9734yrv2qp98342...` | Chave secreta de alta entropia para derivação AES via `scryptSync` em `crypto.js`. |
| `CRIPTO_OPENAI_KEY` | **Sim** | `97ce371e793fb9b3...` | API Key da OpenAI cifrada em AES usada como fallback para clientes corporativos NTAPP. |
| `SMTP_HOST` | **Sim** (para OTP) | `smtp.office365.com` | Servidor SMTP para disparo de e-mails com códigos de validação OTP de 8 caracteres. |
| `SMTP_PORT` | **Sim** (para OTP) | `587` | Porta do servidor SMTP (TLS/STARTTLS). |
| `SMTP_USER` | **Sim** (para OTP) | `automacao@ntadvogados.com.br` | Usuário/conta autenticada do serviço SMTP. |
| `SMTP_PASS` | **Sim** (para OTP) | `""` | Senha de autenticação do serviço SMTP. |
| `FROM_EMAIL` | **Sim** (para OTP) | `no-reply@ntapp.com.br` | Endereço remetente exibido nas mensagens de validação. |
| `OPENAI_API_KEY` | Opcional | `sk-proj-...` | Chave de API pessoal da OpenAI do usuário (caso não use NTAPP/Local). |
| `OPENAI_API_MODEL` | Opcional | `gpt-5-nano` | Modelo LLM configurado (`gpt-5-nano`, `openai/gpt-oss-20b`, etc.). |
| `OPENAI_RESPONSE_LANGUAGE` | Opcional | `pt-BR` | Idioma retornado pela IA (`pt-BR` ou `en-US`). |
| `OPENAI_API_BASEURL` | Opcional | `http://127.0.0.1:1234/v1` | URL customizada para execução contra LLM local (Ollama/LM Studio). |
| `SCRAPING_API_BASEURL` | Opcional | `https://global.ntapp.com.br/bkp-intra/api` | URL base do gateway de busca e scraping web da NTAPP. |
| `SCRAPING_API_AUTH` | Opcional | `usuario:senha` | Credenciais HTTP Basic Auth para acesso às rotas de scraping. |

---

## 🧪 4. Execução de Testes e Validação Rápida

Conforme estabelecido em `docs/TESTING_STRATEGY.md` e `AGENTS.md`, a suíte de testes deve seguir o padrão AAA.

### 4.1 Execução de Suíte Completa de Testes
```bash
# Executar todos os testes unitários e de integração:
npm test

# Executar com relatório de cobertura de código nativo:
npm run test:coverage
```

### 4.2 Execução de Teste Atômico/Isolado (Essencial para IA e DX)
Para rodar apenas um arquivo específico ou um teste individual rapidamente sem rodar toda a suíte:
```bash
# Rodar apenas os testes do módulo de criptografia:
node --test tests/crypto.test.js

# Rodar apenas testes que correspondam a um padrão no nome (utilizando regex):
node --test --test-name-pattern="deve decriptografar" tests/crypto.test.js
```

### 4.4 Verificação de Tipos e Linters / Validação de Clean Code
```bash
# Validar se o bundle compila sem erros de sintaxe ou importação:
npm run build

# Verificar métricas físicas de linhas (ex: buscar arquivos > 250 linhas):
powershell -Command "Get-ChildItem -Recurse -Filter *.js -Exclude node_modules,dist | Get-Content | Measure-Object -Line"
```

---

## 🗄️ 5. Operações Comuns de Persistência e Cache Local

O `ai-commit-review` armazena configurações e caches no sistema de arquivos local do desenvolvedor:

### 5.1 Localização dos Arquivos de Estado
- **Arquivo de Configuração do Usuário**: `~/.ai-commit-review/.config.json` (ou `%APPDATA%\ai-commit-review\.config.json` no Windows).
- **Cache de Diffs Sumarizados**: `.cache/context.json` (no diretório raiz do repositório).

### 5.2 Resetar Configurações e Limpar Cache
```bash
# Limpar arquivo de configuração via CLI:
node cli.js resetConfig

# Excluir manualmente o cache local de contexto de diffs:
# Unix/macOS:
rm -rf .cache/context.json

# Windows (PowerShell):
Remove-Item -Force -Recurse .cache\context.json -ErrorAction SilentlyContinue
```

---

## 🚨 6. Troubleshooting e Problemas Conhecidos

### ❌ Problema 1: `GitHub CLI (gh) is not installed`
- **Sintoma**: Erro ao tentar executar `acr updateProductionServer`.
- **Causa**: O utilitário `gh` não está no `PATH` do sistema.
- **Solução**: Instale o GitHub CLI (`winget install GitHub.cli` no Windows ou `brew install gh` no macOS) e execute `gh auth login`.

### ❌ Problema 2: `PASSWORD_CRYPTO_KEY environment variable is not defined`
- **Sintoma**: Falha ao tentar decifrar configurações ou executar `acr crypto`.
- **Causa**: O arquivo `.env` não está carregado ou a variável `PASSWORD_CRYPTO_KEY` não foi definida.
- **Solução**: Certifique-se de que o `.env.develop` foi copiado para `.env` e que `dotenv` está ativo (`node -r dotenv/config cli.js`).

### ❌ Problema 3: Falha de Conexão com IA Local (`ECONNREFUSED 127.0.0.1:1234`)
- **Sintoma**: Timeout ou erro de conexão ao disparar `acr analyze` ou `acr create` com modelo local.
- **Causa**: O servidor local (LM Studio / Ollama) não está rodando na porta `1234` ou o endpoint `/v1` não está habilitado.
- **Solução**: Inicie o servidor local na porta `1234` ou remova a opção `OPENAI_API_BASEURL` do `~/.config.json`.

### ❌ Problema 4: `npm outdated -g` demorando na inicialização do CLI
- **Sintoma**: O comando `acr` demora vários segundos antes de exibir o menu.
- **Causa**: A verificação síncrona de atualização via registro remoto do npm está aguardando timeout de rede.
- **Solução**: Pressione `Ctrl+C` e execute com rede ativa, ou utilize `node cli.js` diretamente para contornar a verificação global do npm.
