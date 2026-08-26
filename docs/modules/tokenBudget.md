# 📄 Documentação do Módulo: `src/tokenBudget.js`

## 📌 Visão Geral
O módulo `src/tokenBudget.js` centraliza a estimativa de tokens e o cálculo do orçamento máximo de prompt permitido pelo modelo ativo. Ele existe para evitar erros de runtime do tipo `n_keep >= n_ctx` retornados por servidores locais (LM Studio/Ollama) e pela API da OpenAI quando o prompt excede a janela de contexto.

Funções puras, sem I/O e sem efeitos colaterais (padrão *Golden File*).

---

## 🛠️ Dependências e Importações
Nenhuma dependência externa ou interna.

---

## 📐 Constantes Exportadas

| Constante | Valor | Justificativa |
| :--- | :--- | :--- |
| `CHARS_PER_TOKEN` | `3` | Diffs e código são mais densos que prosa; `4` subestimava a contagem real e causava rejeição da requisição. |
| `SAFETY_RATIO` | `0.85` | Margem para diferenças de tokenizador entre provedores. |
| `TRUNCATION_NOTICE` | `"\n... [truncated due to model context limit]"` | Sinaliza ao modelo que o conteúdo foi cortado. |

---

## 🔄 Funções Exportadas

### `estimateTokens(text)`
- **Retorno**: `number` — estimativa conservadora de tokens (`ceil(length / CHARS_PER_TOKEN)`). Entradas nulas/vazias retornam `0`.

### `tokensToChars(tokens)`
- **Retorno**: `number` — quantidade de caracteres equivalente, nunca negativa.

### `computePromptBudget(contextLimit, reservedForResponse)`
- **Descrição**: Calcula quantos tokens o prompt pode usar: `(contextLimit - reservedForResponse) * SAFETY_RATIO`, com piso de `256` tokens.
- **Retorno**: `number`.

### `truncateToTokenBudget(text, maxTokens, notice = TRUNCATION_NOTICE)`
- **Descrição**: Corte rígido garantindo que a estimativa de tokens do texto nunca exceda `maxTokens`, reservando espaço para o aviso de truncamento.
- **Retorno**: `string`.

### `fitPromptToBudget(files, buildPrompt, maxTokens)`
- **Parâmetros**:
  - `files` (`Array<{ filename: string, diff: string }>`): Arquivos alterados.
  - `buildPrompt` (`(files) => string`): Fábrica do prompt para a lista de arquivos.
  - `maxTokens` (`number`): Orçamento máximo do prompt.
- **Funcionamento**: Reduz iterativamente (até `6` tentativas, fator `0.8`) os diffs até que o prompt gerado caiba no orçamento. Como último recurso, aplica `truncateToTokenBudget` no prompt final.
- **Retorno**: `{ prompt: string, files: Array, truncated: boolean }`.

---

## 🧪 Testes e Cobertura
Testes no padrão AAA em `tests/tokenBudget.test.js`, cobrindo estimativa, conversão, piso do orçamento, truncamento com e sem espaço para o aviso, prompt que já cabe e redução iterativa de diffs.
