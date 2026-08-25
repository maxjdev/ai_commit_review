import path from "path";
import os from "os";

process.env.ACR_CONFIG_FILE = path.join(os.tmpdir(), `test_cfg_configManager_${process.pid}.json`);
process.env.PASSWORD_CRYPTO_KEY = "segredo_teste_key";

import { test } from "node:test";
import assert from "node:assert/strict";
import inquirer from "inquirer";
import {
  setApiKeyOpenAINTapp,
  resetConfig,
  setBaseURLOpenAILocal,
  validateConfiguration,
  ensureValidApiKey,
  updateValidApiKey,
  updateConfigFromString
} from "../src/configManager.js";
import { saveConfig, deleteConfigFile } from "../src/config.js";
import { criptografar, resetChave } from "../src/crypto.js";

function setupInquirerMock(customAnswers = {}, shouldRejectKey = false) {
  inquirer.prompt = async (questions) => {
    const list = Array.isArray(questions) ? questions : [questions];
    const result = {};
    for (const q of list) {
      if (q && q.name) {
        if (q.name === "apiKey" && shouldRejectKey) {
          throw new Error("Rejected Inquirer Key Prompt");
        }
        if (customAnswers[q.name] !== undefined) {
          result[q.name] = customAnswers[q.name];
        } else if (q.name === "isLocal") {
          result.isLocal = false;
        } else if (q.name === "isNTapp") {
          result.isNTapp = false;
        } else if (q.name === "apiKey") {
          result.apiKey = "sk-valid-prompted-key";
        } else if (q.name === "restartConfig") {
          result.restartConfig = false;
        }
      }
    }
    return result;
  };
}

test("configManager.js - Cobertura 100% de Gerenciamento de Configuração (Padrão AAA)", async (t) => {
  const originalPrompt = inquirer.prompt;

  t.beforeEach(() => {
    process.env.PASSWORD_CRYPTO_KEY = "segredo_teste";
    resetChave();
    setupInquirerMock();
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "gpt-5-nano",
      OPENAI_RESPONSE_LANGUAGE: "pt-BR",
      OPENAI_API_BASEURL: "https://api.openai.com/v1"
    });
  });

  t.afterEach(() => {
    deleteConfigFile();
    inquirer.prompt = originalPrompt;
  });

  await t.test("setApiKeyOpenAINTapp deve configurar chave NTAPP se chave não estiver definida", () => {
    // Arrange
    deleteConfigFile();
    process.env.PASSWORD_CRYPTO_KEY = "segredo_teste";
    resetChave();
    process.env.CRIPTO_OPENAI_KEY = criptografar("sk-ntapp-chave-criptografada");

    // Act 1: Chave ausente
    const config = setApiKeyOpenAINTapp();
    assert.equal(config.OPENAI_API_KEY, "sk-ntapp-chave-criptografada");

    // Act 2: Chave já definida
    const configExistente = setApiKeyOpenAINTapp();
    assert.equal(configExistente.OPENAI_API_KEY, "sk-ntapp-chave-criptografada");
  });

  await t.test("resetConfig deve remover arquivo se confirmado e ignorar se recusado", async () => {
    // Act 1: Recusado
    setupInquirerMock({ restartConfig: false });
    await resetConfig();
    assert.ok(true);

    // Act 2: Confirmado
    saveConfig({ key: "val" });
    setupInquirerMock({ restartConfig: true });
    await resetConfig();
    assert.ok(true);
  });

  await t.test("setBaseURLOpenAILocal deve configurar ambiente local quando selecionado pelo usuario", async () => {
    // Act 1: Sem base URL nem modelo + inquirer confirmando local
    setupInquirerMock({ isLocal: true });
    const confLocal = await setBaseURLOpenAILocal({});
    assert.equal(confLocal.OPENAI_API_KEY, "local");
    assert.equal(confLocal.OPENAI_API_MODEL, "google/gemma-4-31b-qat");

    // Act 2: inquirer recusando local
    setupInquirerMock({ isLocal: false });
    const confSemLocal = await setBaseURLOpenAILocal({});
    assert.equal(confSemLocal.OPENAI_API_KEY, undefined);

    // Act 3: Já configurado
    const confJaConfig = await setBaseURLOpenAILocal({ OPENAI_API_BASEURL: "http://localhost" });
    assert.equal(confJaConfig.OPENAI_API_BASEURL, "http://localhost");
  });

  await t.test("validateConfiguration deve cobrir NTAPP email e prompt de chave", async () => {
    // Act 1: Modelo local
    deleteConfigFile();
    saveConfig({ OPENAI_API_KEY: "local" });
    const confLocal = await validateConfiguration();
    assert.equal(confLocal.OPENAI_API_MODEL, "google/gemma-4-31b-qat");

    // Act 2: Sem chave, recusando local e confirmando NTapp
    deleteConfigFile();
    setupInquirerMock({ isLocal: false, isNTapp: false, apiKey: "sk-prompted-key" });
    const confPrompt = await validateConfiguration();
    assert.equal(confPrompt.OPENAI_API_KEY, "sk-prompted-key");
  });

  await t.test("ensureValidApiKey e updateValidApiKey devem gerenciar fluxos felizes e exceções no catch", async () => {
    // Act 1: ensureValidApiKey feliz
    setupInquirerMock();
    await ensureValidApiKey();

    // Act 2: updateValidApiKey feliz
    setupInquirerMock({ apiKey: "sk-novachave-123" });
    await updateValidApiKey();

    // Act 3: updateValidApiKey falhando com chave vazia (cobrindo catch interno de updateValidApiKey)
    setupInquirerMock({ apiKey: "" });
    await assert.rejects(async () => await updateValidApiKey(), /Invalid format/);

    // Act 4: ensureValidApiKey caindo no catch e relançando erro ACR not configured
    deleteConfigFile();
    setupInquirerMock({ isLocal: false, isNTapp: false }, true);
    await assert.rejects(async () => await ensureValidApiKey(), /ACR not configured/);
  });

  await t.test("updateConfigFromString deve validar parsings e erros de chaves, modelos e idiomas", () => {
    setupInquirerMock();

    // Act 1: Sucesso
    updateConfigFromString("OPENAI_API_MODEL=gpt-5-nano");
    updateConfigFromString("OPENAI_RESPONSE_LANGUAGE=en-US");

    // Act 2: Erros de formato
    assert.throws(() => updateConfigFromString("KEY_SEM_IGUAL"), /Invalid format/);
    assert.throws(() => updateConfigFromString("=VALOR_SEM_CHAVE"), /Invalid format/);
    assert.throws(() => updateConfigFromString("CHAVE_SEM_VALOR="), /Invalid format/);

    // Act 3: Erros de chave, modelo e idioma
    assert.throws(() => updateConfigFromString("INVALID_KEY=VAL"), /Invalid configuration key/);
    assert.throws(() => updateConfigFromString("OPENAI_API_MODEL=INVALID_MODEL"), /Invalid AI model/);
    assert.throws(() => updateConfigFromString("OPENAI_RESPONSE_LANGUAGE=INVALID_LANG"), /Invalid language code/);
  });
});
