# 📄 Documentação do Módulo: `src/models.js`

## 📌 Visão Geral
O módulo `src/models.js` centraliza os dicionários de constantes e enums imutáveis (`Object.freeze`) do projeto. Ele define os modelos de IA suportados, limites de contexto em tokens, chaves de configuração aceitas, idiomas de resposta e tipos de prompts.

---

## 🛠️ Dependências e Importações
Este módulo não possui dependências externas nem internas (JavaScript puro).

---

## 🔒 Constantes e Enums Exportados

### `OpenAIModels`
Enum de identificadores de modelos de IA suportados:
- `GPT_5_NANO`: `"gpt-5-nano"`
- `OSS_20B_LOCAL`: `"openai/gpt-oss-20b"`
- `GEMMA_4_31B_QAT`: `"google/gemma-4-31b-qat"`

### `ModelContextLimits`
Mapeamento de limites de janela de contexto em tokens por modelo:
- `"gpt-5-nano"`: `128000` tokens
- `"openai/gpt-oss-20b"`: `8000` tokens
- `"google/gemma-4-31b-qat"`: `8000` tokens
- `"default"`: `8000` tokens (fallback)

### `ConfigKeys`
Enum das chaves de configuração suportadas pelo sistema:
- `OPENAI_API_BASEURL`: `"OPENAI_API_BASEURL"`
- `OPENAI_API_KEY`: `"OPENAI_API_KEY"`
- `OPENAI_API_MODEL`: `"OPENAI_API_MODEL"`
- `OPENAI_RESPONSE_LANGUAGE`: `"OPENAI_RESPONSE_LANGUAGE"`
- `SCRAPING_API_BASEURL`: `"SCRAPING_API_BASEURL"`
- `AUTO_ERROR_DIAGNOSTICS`: `"AUTO_ERROR_DIAGNOSTICS"`

### `SupportedLanguages`
Mapeamento de idiomas suportados para geração de respostas da IA:
- `EN_US`: `{ code: "en-US", name: "English (US)" }`
- `PT_BR`: `{ code: "pt-BR", name: "Portuguese (Brazil)" }`

### `PromptType`
Enum dos tipos de prompts operacionais:
- `ANALYZE`: `"analyze"` (análise de commits)
- `CREATE`: `"create"` (criação de commits)
- `DIAGNOSE_ERROR`: `"diagnose_error"` (diagnóstico de falhas com IA e busca web)
- `COMMAND_ASSISTANT`: `"command_assistant"` (assistente de comandos não reconhecidos)

