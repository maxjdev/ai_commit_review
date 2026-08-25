# 📄 Documentação do Módulo: `cli.js`

## 📌 Visão Geral
O arquivo `cli.js` é o ponto de entrada (entrypoint) da ferramenta de linha de comando `ai-commit-review` (`acr`). Ele gerencia a auto-atualização do pacote via NPM, validação inicial da chave de API da OpenAI, registro de comandos CLI via `commander` e exibição de menu interativo via `inquirer` quando nenhum argumento é informado pelo usuário.

---

## 🛠️ Dependências e Importações

### Dependências Externas
- `chalk`: Formatação de saídas coloridas no terminal.
- `commander`: Parser de argumentos e construtor de comandos da CLI.
- `inquirer`: Interface de menu interativo no terminal.
- `child_process.execSync`: Execução síncrona de comandos do sistema shell (`npm`).

### Módulos Internos Importados
- [`src/helpers.js`](file:///d:/GitHub/ai_commit_review/src/helpers.js): Exibição de texto de ajuda customizado (`showHelp`).
- [`src/configManager.js`](file:///d:/GitHub/ai_commit_review/src/configManager.js): Gestão de configurações (`updateConfigFromString`, `ensureValidApiKey`, `resetConfig`).
- [`src/analyzeCommit.js`](file:///d:/GitHub/ai_commit_review/src/analyzeCommit.js): Análise de commits (`analyzeCommits`).
- [`src/createCommit.js`](file:///d:/GitHub/ai_commit_review/src/createCommit.js): Criação guiada de commits (`createCommit`).
- [`src/commitStaged.js`](file:///d:/GitHub/ai_commit_review/src/commitStaged.js): Commit de alterações staged (`commitStaged`).
- [`src/crypto.js`](file:///d:/GitHub/ai_commit_review/src/crypto.js): Funcionalidades de criptografia (`criptografarcli`).
- [`src/testServerUpdate.js`](file:///d:/GitHub/ai_commit_review/src/testServerUpdate.js): Script de atualização de servidor de testes (`updateServerToTest`).
- [`src/productionServerUpdate.js`](file:///d:/GitHub/ai_commit_review/src/productionServerUpdate.js): Script de atualização de servidor de produção (`updateServerToProduction`).
- [`src/commandAssistant.js`](file:///d:/GitHub/ai_commit_review/src/commandAssistant.js): Tratamento de comandos não reconhecidos e assistência de IA (`handleUnknownCommand`).

---

## 🔄 Fluxo de Execução Detalhado

1. **Auto-atualização do Pacote Global**:
   - Ao iniciar, executa `npm outdated -g ai-commit-review --json`.
   - Se houver uma nova versão global disponível:
     - Exibe mensagem indicando biblioteca desatualizada.
     - Invoca `resetConfig()` que exibe uma confirmação interativa ao usuário (via `inquirer`, padrão `false`) antes de apagar o arquivo de configuração.
     - Executa `npm update -g ai-commit-review` com `stdio: "inherit"`.
     - Exibe mensagem de sucesso e encerra a execução com `process.exit(0)`.

2. **Silenciamento de Depreciações Node.js**:
   - Define `process.noDeprecation = true` para evitar poluição visual no terminal.

3. **Validação da API Key e Configurações**:
   - A validação de configurações (`ensureValidApiKey()`) deve ser executada em todas as chamadas de comandos, **exceto** ao utilizar os comandos `set_config` ou `crypto`.

4. **Registro de Comandos (`commander`)**:
   - Define o nome `acr` e a descrição da CLI.
   - Sobrescreve `program.helpInformation` com a função `showHelp`.
   - Registra os subcomandos disponíveis:
     - `acr crypto`: Executa a ferramenta de criptografia/descriptografia (`criptografarcli`).
     - `acr analyze`: Analisa commits individuais ou agrupados do repositório Git local (`analyzeCommits`).
     - `acr create`: Cria um novo commit com assistência de IA (`createCommit`).
     - `acr commit`: Faz commit das alterações em staged com assistência de IA (`commitStaged`).
     - `acr updateTestServer`: Executa rotinas de atualização do servidor de testes (`updateServerToTest`).
     - `acr updateProductionServer`: Executa rotinas de atualização do servidor de produção (`updateServerToProduction`).
     - `acr resetConfig`: Pergunta interativamente ao usuário se deseja reiniciar as configurações (`resetConfig`).
     - `acr set_config <keyValue>`: Atualiza configurações com o formato `CHAVE=VALOR` (`updateConfigFromString`).

5. **Modo Interativo (`inquirer`)**:
   - Ativado quando nenhum parâmetro é fornecido na linha de comando (`!process.argv.slice(2).length`).
   - Apresenta um menu de seleção contendo as opções: `analyze`, `create`, `commit`, `crypto`, `updateTestServer`, `updateProductionServer` e `resetConfig`.

6. **Injeção de Dependências e Testabilidade (`getDeps`, `getCommandAction`)**:
   - O módulo exporta `getDeps(deps)` e `getCommandAction(cmdName, deps)` permitindo isolamento total de efeitos colaterais em testes unitários e de integração, atingindo 100% de cobertura em linhas, ramificações e funções.

7. **Tratamento Centralizado e Auto-Recuperação (`safeExecuteCommand`)**:
   - Todos os comandos registrados e opções do menu interativo são envolvidos pela função `safeExecuteCommand`.
   - Se ocorrer qualquer exceção inesperada durante a execução de qualquer comando ou fluxo (Git, Docker, rede, permissão, etc.), o erro é encaminhado para `diagnoseAndHandleError` em [`src/errorDiagnosticService.js`](file:///d:/GitHub/ai_commit_review/src/errorDiagnosticService.js).
   - O sistema aciona a busca web com as APIs da NTAPP e a análise da OpenAI para fornecer diagnóstico amigável, sugerir e executar comandos de autocorreção (`AUTO_FIX_CMD`) e reexecutar o fluxo (`retry`) automaticamente em um loop até a conclusão com sucesso.

8. **Tratamento de Comandos Desconhecidos (`handleUnknownCommand`)**:
   - O Commander é configurado com `exitOverride()` e `configureOutput({ writeErr: () => {} })`.
   - Quando um comando desconhecido é executado (ex: `acr test`, `acr teste`), o fluxo captura `commander.unknownCommand` / `commander.unknownOption` e aciona `handleUnknownCommand` em [`src/commandAssistant.js`](file:///d:/GitHub/ai_commit_review/src/commandAssistant.js).
   - O sistema lista todos os comandos válidos com suas descrições e abre menu interativo oferecendo assistência com IA ou seleção manual.


