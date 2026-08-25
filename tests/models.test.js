import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OpenAIModels,
  ModelContextLimits,
  ConfigKeys,
  SupportedLanguages,
  PromptType
} from "../src/models.js";

test("models.js - Validação 100% de Enums e Constantes (Padrão AAA)", async (t) => {
  await t.test("OpenAIModels deve conter modelos congelados válidos", () => {
    // Arrange & Act
    const nano = OpenAIModels.GPT_5_NANO;
    const local = OpenAIModels.OSS_20B_LOCAL;
    const gemma = OpenAIModels.GEMMA_4_31B_QAT;

    // Assert
    assert.equal(nano, "gpt-5-nano");
    assert.equal(local, "openai/gpt-oss-20b");
    assert.equal(gemma, "google/gemma-4-31b-qat");
    assert.throws(() => { OpenAIModels.GPT_5_NANO = "outro"; }, TypeError);
  });

  await t.test("ModelContextLimits deve retornar limites configurados por modelo", () => {
    // Arrange & Act
    const nanoLimit = ModelContextLimits["gpt-5-nano"];
    const localLimit = ModelContextLimits["openai/gpt-oss-20b"];
    const gemmaLimit = ModelContextLimits["google/gemma-4-31b-qat"];
    const defaultLimit = ModelContextLimits["default"];

    // Assert
    assert.equal(nanoLimit, 128000);
    assert.equal(localLimit, 8000);
    assert.equal(gemmaLimit, 8000);
    assert.equal(defaultLimit, 8000);
  });

  await t.test("ConfigKeys deve conter chaves de configuração congeladas", () => {
    // Arrange & Act & Assert
    assert.equal(ConfigKeys.OPENAI_API_BASEURL, "OPENAI_API_BASEURL");
    assert.equal(ConfigKeys.OPENAI_API_KEY, "OPENAI_API_KEY");
    assert.equal(ConfigKeys.OPENAI_API_MODEL, "OPENAI_API_MODEL");
    assert.equal(ConfigKeys.OPENAI_RESPONSE_LANGUAGE, "OPENAI_RESPONSE_LANGUAGE");
    assert.equal(ConfigKeys.SCRAPING_API_BASEURL, "SCRAPING_API_BASEURL");
    assert.equal(ConfigKeys.SCRAPING_API_AUTH, "SCRAPING_API_AUTH");
    assert.equal(ConfigKeys.AUTO_ERROR_DIAGNOSTICS, "AUTO_ERROR_DIAGNOSTICS");
    assert.throws(() => { ConfigKeys.OPENAI_API_KEY = "NOVA_CHAVE"; }, TypeError);
  });

  await t.test("SupportedLanguages deve ter estrutura de codigo e nome", () => {
    // Arrange & Act
    const enUs = SupportedLanguages.EN_US;
    const ptBr = SupportedLanguages.PT_BR;

    // Assert
    assert.equal(enUs.code, "en-US");
    assert.equal(enUs.name, "English (US)");
    assert.equal(ptBr.code, "pt-BR");
    assert.equal(ptBr.name, "Portuguese (Brazil)");
  });

  await t.test("PromptType deve conter tipos de prompt congelados", () => {
    // Arrange & Act & Assert
    assert.equal(PromptType.ANALYZE, "analyze");
    assert.equal(PromptType.CREATE, "create");
    assert.equal(PromptType.DIAGNOSE_ERROR, "diagnose_error");
    assert.throws(() => { PromptType.ANALYZE = "outro"; }, TypeError);
  });
});
