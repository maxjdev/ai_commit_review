# 📄 Documentação do Módulo: `src/contextManager.js`

## 📌 Visão Geral
O módulo `src/contextManager.js` é responsável por condensar e resumir diffs de código extensos que excedem o limite de janela de contexto do modelo de IA configurado. Ele realiza a divisão de diffs grandes em pedaços (chunks), gera resumos via OpenAI e armazena os resumos em cache local (`.cache/context.json`) baseado em hash MD5 para evitar chamadas redundantes à API.

---

## 🛠️ Dependências e Importações

### Dependências Nativas Node.js
- `fs`: Manipulação do sistema de arquivos (`existsSync`, `mkdirSync`, `readFileSync`, `writeFileSync`, `unlinkSync`).
- `path`: Resolução do caminho do diretório de cache (`path.join(process.cwd(), ".cache")`).
- `crypto`: Geração de hash MD5 (`crypto.createHash("md5")`).

### Dependências Externas
- `chalk`: Formatação de saídas coloridas no terminal.

### Módulos Internos Importados
- [`src/openaiUtils.js`](file:///d:/GitHub/ai_commit_review/src/openaiUtils.js): `summarizeText`, `getModelContextLimit`.
- [`src/tokenBudget.js`](file:///d:/GitHub/ai_commit_review/src/tokenBudget.js): `CHARS_PER_TOKEN`, `computePromptBudget`, `tokensToChars`.

---

## 📂 Armazenamento em Cache

- **Diretório**: `.cache/` (no diretório de trabalho atual do processo, `process.cwd()`).
- **Arquivo**: `.cache/context.json`.
- **Formato da Chave de Cache**: `${filename}:${md5(diff)}`.
- **Conteúdo Armazenado**: `{ summary: string, timestamp: number }`.

---

## 📐 Algoritmo de Cálculo de Contexto e Chunks

1. Obtém o limite de tokens do modelo (`getModelContextLimit()`).
  Para `qwen/qwen3.5-9b`, o catálogo usa `25000` tokens, compatível com o limite `n_ctx` do runtime local; esse valor pode ser sobrescrito por `OPENAI_API_CONTEXT_LIMIT`.
2. Reserva:
   - `1000` tokens para a resposta da IA (via `computePromptBudget`, que também aplica margem de segurança de 15%).
   - `200` tokens para as instruções do prompt de resumo.
3. Converte o orçamento em caracteres com `tokensToChars` (1 token ≈ 3 caracteres, estimativa conservadora para diffs/código).
4. Se o diff do arquivo for menor ou igual a `maxChars`, o diff original é preservado.

---

## 🔄 Funções Exportadas

### `buildContextForFiles(files, promptType, options)`
- **Parâmetros**:
  - `files` (`Array<{ filename: string, diff: string, status: string }>`): Lista de arquivos alterados.
  - `promptType` (`string`): Parâmetro reservado para uso futuro.
  - `options` (`object`, opcional): Permite sobrescrever `maxChars` e `maxCombinedChars`.
- **Funcionamento**:
  - Verifica o cache por hash MD5 do diff. Se encontrado, retorna o diff formatado como resumo em cache `/* SUMMARY (cached): ... */`.
  - Se for necessário resumir:
    - Divide o diff em chunks de tamanho `maxChars`.
    - Envia cada chunk para `summarizeText()`.
    - Se a união dos resumos exceder `maxCombinedChars`, executa uma segunda camada de sumarização para consolidar tudo em um único parágrafo.
    - Grava o resultado no cache `.cache/context.json`.
- **Retorno**: `Promise<Array<{ filename: string, diff: string, status: string }>>` com os diffs (ou resumos de diffs) ajustados.

### `clearContextCache()`
- **Descrição**: Remove o arquivo `.cache/context.json` do sistema de arquivos via `fs.unlinkSync()`.

### `hashContent(text)`, `chunkText(text, maxChars)`, `ensureCache()`, `readCache()`, `writeCache(cache)`
- **Descrição**: Funções utilitárias puras e de I/O exportadas para manipulação e persistência segura de chunks e hashes MD5.

---

## 🧪 Testes e Cobertura
O módulo possui 100% de testes automatizados no padrão AAA em `tests/contextManager.test.js` com **100.00% de linhas**, **100.00% de branches** e **100.00% de funções**.
