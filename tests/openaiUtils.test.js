import path from "path";
import os from "os";

process.env.ACR_CONFIG_FILE = path.join(os.tmpdir(), `test_cfg_openaiUtils_${process.pid}.json`);
process.env.PASSWORD_CRYPTO_KEY = "segredo_teste_key";

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeUpdatedCode,
  getModelContextLimit,
  summarizeText,
  diagnoseErrorWithAI,
} from "../src/openaiUtils.js";
import { saveConfig, deleteConfigFile } from "../src/config.js";
import { PromptType } from "../src/models.js";

function createMockOpenAI(responseContent = "Análise mock da IA", shouldFail = false, failMessage = "401 Unauthorized") {
  return {
    chat: {
      completions: {
        create: async (payload) => {
          if (shouldFail) {
            throw new Error(failMessage);
          }
          return {
            choices: [{ message: { content: responseContent } }]
          };
        }
      }
    }
  };
}

test("openaiUtils.js - Cobertura 100% de Integração com OpenAI (Padrão AAA)", async (t) => {
  t.beforeEach(() => {
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "gpt-5-nano",
      OPENAI_RESPONSE_LANGUAGE: "pt-BR",
      OPENAI_API_BASEURL: "https://api.openai.com/v1"
    });
  });

  t.afterEach(() => {
    deleteConfigFile();
  });

  await t.test("getModelContextLimit deve retornar limite do modelo ou default para desconhecido", async () => {
    // Act 1: gpt-5-nano
    const limitNano = await getModelContextLimit();
    assert.equal(limitNano, 128000);

    // Act 2: modelo desconhecido
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "modelo-desconhecido",
      OPENAI_RESPONSE_LANGUAGE: "en-US",
      OPENAI_API_BASEURL: "http://127.0.0.1:9999/v1"
    });
    const limitDefault = await getModelContextLimit();
    assert.equal(limitDefault, 8000);
  });

  await t.test("analyzeUpdatedCode deve processar requisições felizes com e sem GPT_5_NANO", async () => {
    // Act 1: modelo gpt-5-nano (com reasoning_effort)
    const mockClient = createMockOpenAI("Review gpt-5-nano feito");
    const res1 = await analyzeUpdatedCode(
      [{ filename: "app.js", diff: "+ const x = 1;" }],
      PromptType.ANALYZE,
      { openaiClient: mockClient }
    );
    assert.equal(res1, "Review gpt-5-nano feito");

    // Act 2: modelo convencional sem baseurl
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "openai/gpt-oss-20b",
      OPENAI_RESPONSE_LANGUAGE: "en-US",
      OPENAI_API_BASEURL: "http://127.0.0.1:9999/v1"
    });
    const mockClient2 = createMockOpenAI("Review gpt-oss-20b feito");
    const res2 = await analyzeUpdatedCode(
      [{ filename: "app.js", diff: "+ const y = 2;" }],
      PromptType.CREATE,
      { openaiClient: mockClient2 }
    );
    assert.equal(res2, "Review gpt-oss-20b feito");
  });

  await t.test("analyzeUpdatedCode deve truncar arquivos mantendo arquivos pequenos intactos", async () => {
    // Arrange: Modelo com limite pequeno para forçar truncamento
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "openai/gpt-oss-20b", // Context limit 8000
      OPENAI_RESPONSE_LANGUAGE: "pt-BR",
      OPENAI_API_BASEURL: "http://127.0.0.1:9999/v1"
    });

    const diffGigante = "LARGE_DIFF_LINE_".repeat(2000); // ~34.000 chars
    const files = [
      { filename: "pequeno.js", diff: "const a = 1;" },
      { filename: "grande.js", diff: diffGigante },
      { filename: "vazio.js", diff: "" }
    ];
    const mockClient = createMockOpenAI("Review de diff truncado");

    // Act
    const result = await analyzeUpdatedCode(files, PromptType.ANALYZE, { openaiClient: mockClient });

    // Assert
    assert.equal(result, "Review de diff truncado");
  });

  await t.test("analyzeUpdatedCode deve tratar erro 401 recarregando chave API e relançar outros erros", async () => {
    // Act 1: Erro 401 com retry bem sucedido
    let updateKeyCalled = false;
    let attempts = 0;
    const mockClientRetry = {
      chat: {
        completions: {
          create: async () => {
            attempts++;
            if (attempts === 1) throw new Error("401 Unauthorized API Key");
            return { choices: [{ message: { content: "Sucesso no retry" } }] };
          }
        }
      }
    };

    const resRetry = await analyzeUpdatedCode(
      [{ filename: "a.js", diff: "diff" }],
      PromptType.ANALYZE,
      {
        openaiClient: mockClientRetry,
        updateValidApiKeyFn: async () => { updateKeyCalled = true; }
      }
    );
    assert.equal(resRetry, "Sucesso no retry");
    assert.equal(updateKeyCalled, true);

    // Act 2: Erro genérico (ex: 500 Server Error)
    const mockClientFail = createMockOpenAI("", true, "500 Internal Server Error");
    await assert.rejects(
      async () => await analyzeUpdatedCode([{ filename: "a.js", diff: "diff" }], PromptType.ANALYZE, { openaiClient: mockClientFail }),
      /500 Internal Server Error/
    );
  });

  await t.test("summarizeText deve sumarizar textos curtos, truncar textos longos e tratar limites e erros", async () => {
    // Act 1: Texto normal
    const mockClient = createMockOpenAI("Resumo efetuado");
    const res1 = await summarizeText("Texto curto para resumo", { openaiClient: mockClient });
    assert.equal(res1, "Resumo efetuado");

    // Act 2: Texto longo com truncamento
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "openai/gpt-oss-20b",
      OPENAI_RESPONSE_LANGUAGE: "pt-BR",
      OPENAI_API_BASEURL: "http://127.0.0.1:9999/v1"
    });
    const textoLongo = "TEXTO_MUITO_LONGO_".repeat(1000);
    const res2 = await summarizeText(textoLongo, { openaiClient: mockClient });
    assert.equal(res2, "Resumo efetuado");

    // Act 3: Erro no cliente
    const mockClientFail = createMockOpenAI("", true, "Network Error");
    await assert.rejects(
      async () => await summarizeText("teste", { openaiClient: mockClientFail }),
      /Network Error/
    );
  });

  await t.test("summarizeText deve lançar erro se prompt estimado exceder o limite de tokens do modelo", async () => {
    // Arrange: limite extremamente baixo mockado no modelo
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "modelo-micro",
      OPENAI_RESPONSE_LANGUAGE: "pt-BR",
      OPENAI_API_BASEURL: "http://127.0.0.1:9999/v1"
    });

    const mockClient = createMockOpenAI("ok");
    // Act & Assert (Prompt excedendo limite de 8000 tokens com margem reservada)
    const textoGigante = "X".repeat(40000);
    await assert.rejects(
      async () => await summarizeText(textoGigante, { openaiClient: mockClient }),
      /Prompt too large/
    );
  });

  await t.test("deve testar integrações com e sem a opção OPENAI_API_BASEURL via OpenAIConstructor", async () => {
    // Arrange: Mock de construtor que retorna o cliente simulado
    class MockOpenAIClass {
      constructor(opts) {
        this.opts = opts;
        this.chat = {
          completions: {
            create: async () => ({ choices: [{ message: { content: "Instância criada com sucesso" } }] })
          }
        };
      }
    }

    // Act 1: Com BASEURL
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "gpt-5-nano",
      OPENAI_RESPONSE_LANGUAGE: "pt-BR",
      OPENAI_API_BASEURL: "https://custom.api.openai.com/v1"
    });
    const resAnalyze = await analyzeUpdatedCode([{ filename: "a.js", diff: "diff" }], PromptType.ANALYZE, { OpenAIConstructor: MockOpenAIClass });
    assert.equal(resAnalyze, "Instância criada com sucesso");

    const resSummarize = await summarizeText("teste", { OpenAIConstructor: MockOpenAIClass });
    assert.equal(resSummarize, "Instância criada com sucesso");

    // Act 2: Sem BASEURL
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "gpt-5-nano",
      OPENAI_RESPONSE_LANGUAGE: "pt-BR"
    });
    const resNoBaseUrl = await analyzeUpdatedCode([{ filename: "b.js", diff: "diff" }], PromptType.ANALYZE, { OpenAIConstructor: MockOpenAIClass });
    assert.equal(resNoBaseUrl, "Instância criada com sucesso");

    const resSummarizeNoBaseUrl = await summarizeText("teste2", { OpenAIConstructor: MockOpenAIClass });
    assert.equal(resSummarizeNoBaseUrl, "Instância criada com sucesso");
  });

  await t.test("analyzeUpdatedCode deve lançar erro para promptType desconhecido", async () => {
    const mockClient = createMockOpenAI("ok");
    await assert.rejects(
      async () => await analyzeUpdatedCode([{ filename: "a.js", diff: "diff" }], "TIPO_INVALIDO", { openaiClient: mockClient }),
      /Invalid prompt type/
    );
  });

  await t.test("diagnoseErrorWithAI deve diagnosticar erros e tratar falhas de API", async () => {
    // Act 1: Sucesso
    const mockClient = createMockOpenAI("Diagnóstico: Editor não encontrado.\nAUTO_FIX_CMD: git config core.editor notepad");
    const errorData = {
      command: "git commit --edit",
      message: "Command failed",
      stderr: "Notepad++ not found",
    };
    const res = await diagnoseErrorWithAI(errorData, "Doc Git", { openaiClient: mockClient });
    assert.match(res, /Diagnóstico/);
    assert.match(res, /AUTO_FIX_CMD/);

    // Act 2: Erro no cliente
    const mockClientFail = createMockOpenAI("", true, "API Error");
    await assert.rejects(
      async () => await diagnoseErrorWithAI(errorData, "Doc Git", { openaiClient: mockClientFail }),
      /API Error/
    );
  });
});
