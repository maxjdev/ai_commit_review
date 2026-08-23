# Módulo: Error Diagnostic & Auto-Recovery Service (`src/errorDiagnosticService.js`)

## 1. Visão Geral
Motor central de resiliência e autocorreção do `ai-commit-review`. Intercepta falhas de comandos Git, processos e exceções de sistema, consulta a internet via `webSearchService` para soluções atualizadas, processa o diagnóstico com a OpenAI e apresenta sugestões guiadas com execução automática de correções.

## 2. Contratos e Métodos Principais

### `diagnoseAndHandleError(error, context, deps)`
- **Objetivo**: Diagnostica a falha ocorrida e oferece menu de remediação.
- **Entrada**:
  - `error` (Error|string): Objeto de erro ou mensagem contendo stack/stderr.
  - `context` (object): Informações adicionais (ex: `{ command: "git commit --edit" }`).
- **Saída**: `{ handled: boolean, action: "auto_fix" | "retry" | "cancel", success?: boolean, autoFixCmd?: string }`

### `sanitizeErrorQuery(text)` & `buildSearchQuery(errorData)`
- **Objetivo**: Sanitiza mensagens brutas de erro, removendo caminhos de diretórios locais, IDs temporários e ruídos para gerar consultas concisas para o Google.

### `parseAutoFixCommand(aiAnalysis)` & `executeAutoFix(command, deps)`
- **Objetivo**: Detecta comandos de auto-correção sugeridos pelo modelo no formato `AUTO_FIX_CMD: <comando>` e executa de forma segura via `execSync`.

## 3. Fluxo de Auto-Recuperação Agnóstico
1. **Captura Universal**: Qualquer erro de comando Git (push, pull, merge, checkout, rebase, editor), Docker, rede ou permissão é interceptado.
2. **Sanitização de Termos**: Remove caminhos locais e hashes temporários.
3. **Consulta em Tempo Real**: Busca na web via API de scraping Google (`webSearchService`).
4. **Diagnóstico com IA**: Modelo OpenAI analisa a causa raiz técnica e gera instruções claras em pt-BR + `AUTO_FIX_CMD`.
5. **Painel Visual e Interatividade**: O terminal exibe a explicação e oferece opções para executar o comando de correção (`AUTO_FIX_CMD`), retentar ou cancelar.
6. **Loop de Auto-Recuperação**: Ao aplicar o auto-fix, o sistema pergunta se o usuário deseja reexecutar o fluxo original e repete o comando automaticamente até a conclusão com sucesso.

## 4. Governança e Testes
- **Testes**: `tests/errorDiagnosticService.test.js` (Padrão AAA).
- **Limites**: Funções ≤ 30 linhas, arquivo ≤ 250 linhas, complexidade ciclomática ≤ 5.
