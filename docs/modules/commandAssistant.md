# 📄 Documentação do Módulo: `src/commandAssistant.js`

## 📌 Visão Geral
O módulo `src/commandAssistant.js` é responsável por interceptar comandos não reconhecidos informados pelo usuário na CLI `ai-commit-review`, listar de forma visual todos os comandos válidos disponíveis com suas respectivas descrições e fornecer uma experiência interativa assistida por Inteligência Artificial (OpenAI) para orientar o usuário e executar automaticamente o comando recomendado.

---

## 🛠️ Dependências e Importações

### Dependências Externas
- `chalk`: Formatação de saídas coloridas no terminal.
- `inquirer`: Interface de menu interativo e captura de texto descritivo do usuário.
- `child_process.execSync`: Execução síncrona segura de comandos de sistema/shell sugeridos pela IA.

### Módulos Internos Importados
- [`src/openaiUtils.js`](file:///d:/GitHub/ai_commit_review/src/openaiUtils.js): Consulta à OpenAI (`askAIAssistantForCommand`).

---

## 📋 Constantes e Estruturas de Dados

### `AVAILABLE_COMMANDS`
Lista imutável com a assinatura e descrição de todos os comandos válidos da CLI:
- `acr analyze`: Analisa os commits recentes do repositório local com IA.
- `acr create`: Cria um novo commit interativo com mensagem e título gerados por IA.
- `acr commit`: Faz o commit direto das alterações em staged com assistência de IA.
- `acr crypto`: Criptografa e descriptografa textos e credenciais sensíveis.
- `acr updateTestServer`: Atualiza e prepara o servidor para o ambiente de testes.
- `acr updateProductionServer`: Atualiza e prepara o servidor para o ambiente de produção.
- `acr resetConfig`: Restaura as configurações da CLI para os valores padrão.
- `acr set_config <KEY=VALUE>`: Atualiza configurações da CLI (ex: `OPENAI_API_KEY=...`).

---

## 🔄 Funções Exportadas

### `getDeps(deps)`
- **Descrição**: Centralizador de injeção de dependências para permitir isolamento completo em testes unitários.

### `renderUnknownCommandMessage(enteredCommand)`
- **Descrição**: Renderiza aviso em vermelho com o comando não reconhecido e a tabela formatada dos comandos válidos com `chalk`.

### `parseSuggestedCommand(aiResponse)`
- **Descrição**: Extrai o comando delimitado por `SUGGESTED_CMD: <cmd>` da resposta da OpenAI. Retorna `null` se for `none`, vazio ou ausente.

### `renderAIAssistanceResponse(aiResponse)`
- **Descrição**: Exibe a explicação da IA em um banner estilizado no console.

### `executeSuggestedCommand(suggestedCmd, deps)`
- **Descrição**: Executa o comando sugerido. Caso pertença aos comandos internos do ACR (`commandActionMap`), invoca `safeExecuteCommandFn`; caso contrário, executa via `execSyncFn`.

### `handleAIAssistance(enteredCommand, deps)`
- **Descrição**: Solicita que o usuário descreva seu objetivo, consulta a OpenAI (`askAIAssistantForCommand`), renderiza a orientação e oferece execução imediata do comando sugerido.

### `handleCommandSelection(deps)`
- **Descrição**: Apresenta menu interativo com os comandos válidos para que o usuário escolha e execute imediatamente.

### `handleUnknownCommand(enteredCommand, deps)`
- **Descrição**: Ponto de entrada que exibe a listagem de comandos válidos e o menu de decisão (IA, seleção manual ou cancelamento).
