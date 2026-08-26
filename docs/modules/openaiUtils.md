# 📄 Documentação do Módulo: `src/openaiUtils.js`

## 📌 Visão Geral
O módulo `src/openaiUtils.js` é a camada de integração com a API da OpenAI (ou servidores locais compatíveis como LM Studio/Ollama via `baseURL`). Ele constrói prompts estruturados em inglês para análise de código e geração de mensagens de commit, calcula defensivamente os limites de contexto em tokens (truncando diffs quando necessário) e lida com renovação de chave de API em respostas de erro HTTP 401.

---

## 🛠️ Dependências e Importações

### Dependências Externas
- `chalk`: Formatação de saídas coloridas no terminal.
- `openai`: SDK oficial da OpenAI (`OpenAI`).

### Módulos Internos Importados
- [`src/configManager.js`](file:///d:/GitHub/ai_commit_review/src/configManager.js): `validateConfiguration`, `updateValidApiKey`.
- [`src/models.js`](file:///d:/GitHub/ai_commit_review/src/models.js): `OpenAIModels`, `PromptType`, `SupportedLanguages`, `ModelContextLimits`, `ConfigKeys`.
- [`src/tokenBudget.js`](file:///d:/GitHub/ai_commit_review/src/tokenBudget.js): `estimateTokens`, `computePromptBudget`, `truncateToTokenBudget`, `fitPromptToBudget`.

---

## 🏗️ Estrutura de Prompts Gerados (`generatePrompt`)

1. **Instrução de Idioma (`generateLanguageInstruction`)**:
   - Mapeia o código de idioma configurado (ex: `pt-BR`) para o nome legível (ex: `Portuguese (Brazil)`).
   - Adiciona a instrução: `Please respond entirely in <Language Name>.`

2. **Tipo: `PromptType.ANALYZE`**:
   - Instruções em papel de *Senior Code Reviewer*.
   - Estrutura esperada de resposta por arquivo:
     1. **Resumo Detalhado das Modificações**
     2. **Identificação de Erros, Bugs Potenciais e Vulnerabilidades** (com trecho cotado, explicação e impacto)
     3. **Sugestões de Melhoria e Otimização** (refatoração, DRY, performance, testabilidade)
     4. **Recomendações de Boas Práticas e Qualidade de Código** (Clean code, legibilidade, reutilização)
     5. **Considerações Gerais do Commit**

3. **Tipo: `PromptType.CREATE`**:
   - Instruções para geração de commit no padrão:
     - **Título**: Emoji no início (ex: 🚀, ✨, 🐛, 🔧, 📝, ♻️, 🔒, 📈) + Verbo no imperativo + Max 50 caracteres.
     - **Corpo da Mensagem**: Descrição detalhada (o quê), Motivação/Contexto (por quê) e Impacto no projeto.
     - **Restrições**: Fidelidade aos diffs (não inventar), concisão, privacidade.
   - Formato estrito da resposta da IA:
     ```text
     Título
     Mensagem (corpo)
     ```

---

## 🔄 Funções Exportadas

### `analyzeUpdatedCode(files, promptType = PromptType.ANALYZE, deps = {})`
- **Parâmetros**:
  - `files`: `Array<{ filename: string, diff: string, status: string }>`
  - `promptType`: `PromptType.ANALYZE` ou `PromptType.CREATE`
  - `deps`: `Object` contendo `{ openaiClient, updateValidApiKeyFn, OpenAIConstructor }` para testes e isolamento.
- **Funcionamento**:
  - Valida a configuração e instancia o cliente `OpenAI` (com `baseURL` customizada se definida ou via `deps`).
  - Calcula o orçamento máximo de tokens do prompt via `computePromptBudget(contextLimit, 2000)` (reserva de `2000` tokens para a resposta e margem de segurança de 15%).
  - Estima o tamanho do prompt via `estimateTokens` (≈ 3 caracteres por token, adequado a diffs/código).
  - Se o prompt exceder o orçamento, aplica `fitPromptToBudget`, que reduz iterativamente os diffs (até 6 tentativas) e, como último recurso, corta o prompt final, garantindo que a requisição nunca exceda o `n_ctx` do modelo.
  - Para o modelo `GPT_5_NANO`, injeta os parâmetros adicionais `{ reasoning_effort: "low", verbosity: "low" }`.
- **Tratamento de Erros**: Se a chamada à API retornar erro HTTP 401 (não autorizado), chama `updateValidApiKey()` e re-executa a análise de forma recursiva.

### `getModelContextLimit()`
- **Descrição**: Retorna o limite de tokens de contexto para o modelo ativo. A chave de configuração `OPENAI_API_CONTEXT_LIMIT` (quando numérica e positiva) tem precedência sobre a tabela `ModelContextLimits`, permitindo declarar o `n_ctx` real de runtimes locais (LM Studio/Ollama) via `acr set_config OPENAI_API_CONTEXT_LIMIT=16384`.

### `diagnoseErrorWithAI(errorData, webContext, deps = {})`
- **Descrição**: Envia os detalhes do erro (comando, SO, mensagem, stderr) combinados com o contexto coletado na busca do Google para a OpenAI gerar o diagnóstico com causa raiz e o comando de auto-remediação (`AUTO_FIX_CMD`).
- **Parâmetros**:
  - `errorData` (`object`): `{ command, platform, message, stderr, stack }`.
  - `webContext` (`string`): Resultados formatados da busca Google / Scraping.
  - `deps` (`object`): Injeção de dependências (`openaiClient`, `OpenAIConstructor`).
- **Retorno**: `string` contendo a análise gerada pelo modelo.

### `summarizeText(text, deps = {})`
- **Descrição**: Sumariza um texto arbitrário utilizando o modelo configurado, respeitando limites e truncamento. Aceita `{ openaiClient, OpenAIConstructor }` em `deps`.
- **Parâmetros**: `text` (`string`) - Conteúdo a ser resumido.
- **Descrição**: Função auxiliar que utiliza o modelo ativo para gerar um resumo conciso e técnico do texto. Realiza truncamento defensivo antes do envio caso o texto exceda a capacidade do modelo.
