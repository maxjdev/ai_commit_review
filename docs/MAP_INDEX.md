# 🗺️ Índice de Mapeamento do Repositório (`ai-commit-review`)

Este documento rastreia o status do mapeamento e documentação dos módulos e arquivos do repositório para padronização de desenvolvimento assistido por IA.

## 📊 Legenda de Status
- ⚪ **Não Iniciado**: Módulo ainda não analisado/entrevistado.
- 🟡 **Em Progresso**: Análise/entrevista em andamento.
- 🟢 **Concluído**: Documentação gerada e validada.

---

## 📂 Documentação Principal de Arquitetura, ADRs, DevOps & Governança (`docs/` & Raiz)
| Arquivo | Descrição | Status |
| :--- | :--- | :---: |
| `AGENTS.md` | Matriz Definitiva de Governança e Regras Rígidas para IAs/Devs | 🟢 Concluído |
| `docs/adr/README.md` | Registro de Decisões Arquiteturais | 🟢 Concluído |
| `docs/GLOSSARY.md` | Dicionário de Domínio e Linguagem Ubíqua (DDD) | 🟢 Concluído |
| `docs/RUNBOOK_LOCAL.md` | Guia de Execução, Setup, Dicionário de `.env` e Testes Locais | 🟢 Concluído |
| `docs/CONTRACTS_AND_INTEGRATIONS.md` | Inventário de Integrações Externas e Matriz de Resiliência | 🟢 Concluído |
| `docs/MIGRATIONS_AND_DB.md` | Padrões de Persistência, Schemas JSON e Evolução de Configuração | 🟢 Concluído |
| `docs/ARCHITECTURE.md` | Síntese macro de arquitetura, camadas, sequência e contratos | 🟢 Concluído |
| `docs/TESTING_STRATEGY.md` | Pirâmide de testes, matriz por módulo e padrão AAA | 🟢 Concluído |
| `docs/SECURITY_AND_RESILIENCE.md` | OWASP checklist, prevenção de injeção e transação Git | 🟢 Concluído |
| `docs/DEAD_CODE_AND_DUPLICATION.md` | Inventário de código morto, rotas desusadas e refatoração DRY | 🟢 Concluído |
| `README.md` | Documentação principal do repositório | 🟢 Concluído |
| `LICENSE.md` | Licença do projeto | 🟢 Concluído |

---

## 🏛️ Registros de Decisões Arquiteturais (`docs/adr/`)
| Arquivo | Título do ADR | Status |
| :--- | :--- | :---: |
| `docs/adr/0001-adocao-de-arquitetura-cli-com-esm-e-webpack.md` | Adoção de Arquitetura CLI com ES Modules e Webpack | 🟢 Concluído |
| `docs/adr/0002-persistencia-baseada-em-arquivos-json-locais.md` | Persistência Descentralizada em Arquivos JSON Locais | 🟢 Concluído |
| `docs/adr/0003-sumarizacao-de-contexto-em-cascata-para-llm.md` | Sumarização de Contexto em Cascata para LLM | 🟢 Concluído |
| `docs/adr/0004-criptografia-simetrica-aes-256-cbc-para-credenciais.md` | Criptografia Simétrica AES-256-CBC para Credenciais | 🟢 Concluído |
| `docs/adr/0005-integracao-com-github-cli-para-automacao-de-releases.md` | Delegação de Releases para GitHub CLI (`gh`) | 🟢 Concluído |

---

## ⚙️ Entrada & CLI Core
| Arquivo / Módulo | Descrição | Status |
| :--- | :--- | :---: |
| `cli.js` | Ponto de entrada CLI (Commander.js & Inquirer) | 🟢 Concluído |

---

## 📦 Módulos Internos (`src/`)

### 1. Configuração & Gerenciamento de Estado
| Arquivo | Descrição | Status |
| :--- | :--- | :---: |
| `src/config.js` | Objeto de configuração base e IO de arquivo | 🟢 Concluído |
| `src/configManager.js` | Gerenciador de configurações e chaves de API | 🟢 Concluído |
| `src/contextManager.js` | Gerenciamento de contexto e truncamento de diffs | 🟢 Concluído |
| `src/models.js` | Definições de enums de modelos de IA e limites | 🟢 Concluído |

### 2. Integração IA, Busca Web & Criptografia
| Arquivo | Descrição | Status |
| :--- | :--- | :---: |
| `src/openaiUtils.js` | Integração com a API da OpenAI | 🟢 Concluído |
| `src/prompts.js` | Templates de prompt estruturados para IA | 🟢 Concluído |
| `src/crypto.js` | Utilitários de criptografia AES-256-CBC | 🟢 Concluído |
| `src/webSearchService.js` | Busca Google e Web Scraping via APIs NTAPP | 🟢 Concluído |
| `src/errorDiagnosticService.js` | Diagnóstico inteligente de erros e auto-recuperação | 🟢 Concluído |
| `src/commandAssistant.js` | Interceptação de comandos inválidos e assistência de IA | 🟢 Concluído |

### 3. Utilitários & Git
| Arquivo | Descrição | Status |
| :--- | :--- | :---: |
| `src/gitUtils.js` | Fachada de re-exportação dos módulos Git | 🟢 Concluído |
| `src/gitCore.js` | Operações fundamentais de leitura e staging Git | 🟢 Concluído |
| `src/gitBranch.js` | Gerenciamento de branches, stash e merges | 🟢 Concluído |
| `src/gitConflictHandlers.js` | Resolução manual e automática de conflitos Git | 🟢 Concluído |
| `src/githubCli.js` | Execução segura da GitHub CLI (gh) | 🟢 Concluído |
| `src/helpers.js` | Funções auxiliares gerais e exibição de ajuda | 🟢 Concluído |
| `src/validateEmail.js` | Validação de e-mail e envio de códigos OTP | 🟢 Concluído |
| `src/acr-wrapper.js` | Wrapper para execução CLI sem avisos | 🟢 Concluído |

### 4. Fluxos de Trabalho / Comandos Principais
| Arquivo | Descrição | Status |
| :--- | :--- | :---: |
| `src/commitFlowHandlers.js` | Handlers interativos compartilhados de commit e fallback | 🟢 Concluído |
| `src/analyzeCommit.js` | Comando de análise de commits com IA | 🟢 Concluído |
| `src/createCommit.js` | Comando de criação interativa de commit com IA | 🟢 Concluído |
| `src/commitStaged.js` | Comando de commit direto de alterações staged | 🟢 Concluído |

### 5. Automações de Atualização de Servidor
| Arquivo | Descrição | Status |
| :--- | :--- | :---: |
| `src/testServerUpdate.js` | Atualização do servidor de teste e versão Docker | 🟢 Concluído |
| `src/productionServerUpdate.js` | Atualização do servidor de produção e PR para master | 🟢 Concluído |

---

## 🛠️ Build, Script & Tooling
| Arquivo | Descrição | Status |
| :--- | :--- | :---: |
| `package.json` | Manifest do projeto Node.js e dependências | 🟢 Concluído |
| `webpack.config.js` | Configuração de empacotamento com Webpack | 🟢 Concluído |
| `publish-npm.ps1` | Script PowerShell para publicação no NPM | 🟢 Concluído |
| `.env.develop` | Variáveis de ambiente para desenvolvimento | 🟢 Concluído |
