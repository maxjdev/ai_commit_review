// models.js

// Enum for OpenAI models
export const OpenAIModels = Object.freeze({
  GPT_5_NANO: "gpt-5-nano",
  OSS_20B_LOCAL: "openai/gpt-oss-20b",
  GEMMA_4_31B_QAT: "google/gemma-4-31b-qat",
  QWEN_9B_LOCAL: "qwen/qwen3.5-9b",
});

// Token context limits per model
export const ModelContextLimits = Object.freeze({
  "gpt-5-nano": 128000,
  "openai/gpt-oss-20b": 8000,
  "google/gemma-4-31b-qat": 8000,
  "qwen/qwen3.5-9b": 25000,
  "default": 8000,
});

// Enum for configuration keys
export const ConfigKeys = Object.freeze({
  OPENAI_API_BASEURL: "OPENAI_API_BASEURL",
  OPENAI_API_KEY: "OPENAI_API_KEY",
  OPENAI_API_MODEL: "OPENAI_API_MODEL",
  OPENAI_API_CONTEXT_LIMIT: "OPENAI_API_CONTEXT_LIMIT",
  OPENAI_RESPONSE_LANGUAGE: "OPENAI_RESPONSE_LANGUAGE",
  SCRAPING_API_BASEURL: "SCRAPING_API_BASEURL",
  SCRAPING_API_AUTH: "SCRAPING_API_AUTH",
  AUTO_ERROR_DIAGNOSTICS: "AUTO_ERROR_DIAGNOSTICS",
});

// Enum for supported languages with popular variations
export const SupportedLanguages = Object.freeze({
  EN_US: { code: "en-US", name: "English (US)" },
  PT_BR: { code: "pt-BR", name: "Portuguese (Brazil)" },
});

export const PromptType = Object.freeze({
  ANALYZE: "analyze",
  CREATE: "create",
  DIAGNOSE_ERROR: "diagnose_error",
  COMMAND_ASSISTANT: "command_assistant",
});