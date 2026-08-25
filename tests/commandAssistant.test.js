import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVAILABLE_COMMANDS,
  getDeps,
  renderUnknownCommandMessage,
  parseSuggestedCommand,
  renderAIAssistanceResponse,
  executeSuggestedCommand,
  handleAIAssistance,
  handleCommandSelection,
  handleUnknownCommand,
} from "../src/commandAssistant.js";

function createPromptMock(answers) {
  let callCount = 0;
  return async (questions) => {
    // If questions contains validation, test it
    if (Array.isArray(questions)) {
      for (const q of questions) {
        if (typeof q.validate === "function") {
          q.validate("valid input");
          q.validate("");
          q.validate(null);
        }
      }
    }
    const answer = answers[callCount] || answers[answers.length - 1];
    callCount++;
    return answer;
  };
}

test("commandAssistant.js - Cobertura 100% de Assistência a Comandos Desconhecidos e IA (Padrão AAA)", async (t) => {
  await t.test("AVAILABLE_COMMANDS e getDeps devem retornar definições corretas e fallbacks", () => {
    // Arrange & Act
    const defaultDeps = getDeps();
    const customDeps = getDeps({
      askAIAssistantForCommandFn: "customAsk",
      promptFn: "customPrompt",
      execSyncFn: "customExec",
      safeExecuteCommandFn: "customSafe",
      commandActionMap: { test: "action" },
    });

    // Assert
    assert.ok(AVAILABLE_COMMANDS.length >= 7);
    assert.equal(typeof defaultDeps.askAIAssistantForCommandFn, "function");
    assert.equal(typeof defaultDeps.promptFn, "function");
    assert.equal(typeof defaultDeps.execSyncFn, "function");
    assert.equal(customDeps.askAIAssistantForCommandFn, "customAsk");
    assert.equal(customDeps.promptFn, "customPrompt");
    assert.equal(customDeps.execSyncFn, "customExec");
    assert.equal(customDeps.safeExecuteCommandFn, "customSafe");
    assert.equal(customDeps.commandActionMap.test, "action");
  });

  await t.test("renderUnknownCommandMessage deve imprimir mensagens sem erros", () => {
    // Arrange & Act & Assert
    assert.doesNotThrow(() => {
      renderUnknownCommandMessage("teste");
    });
  });

  await t.test("parseSuggestedCommand deve extrair comandos ou retornar null", () => {
    // Arrange & Act & Assert
    assert.equal(
      parseSuggestedCommand("Explicação...\nSUGGESTED_CMD: acr updateTestServer\nFim"),
      "acr updateTestServer"
    );
    assert.equal(
      parseSuggestedCommand("Explicação...\nSUGGESTED_CMD: `npm test`"),
      "npm test"
    );
    assert.equal(parseSuggestedCommand("Explicação...\nSUGGESTED_CMD: none"), null);
    assert.equal(parseSuggestedCommand("Explicação...\nSUGGESTED_CMD:   "), null);
    assert.equal(parseSuggestedCommand("Sem comando"), null);
    assert.equal(parseSuggestedCommand(""), null);
    assert.equal(parseSuggestedCommand(null), null);
  });

  await t.test("renderAIAssistanceResponse deve formatar texto e tratar entradas vazias", () => {
    // Arrange & Act & Assert
    assert.doesNotThrow(() => {
      renderAIAssistanceResponse("Orientação para o usuário.\nSUGGESTED_CMD: acr create");
      renderAIAssistanceResponse(null);
    });
  });

  await t.test("executeSuggestedCommand deve executar comando acr mapeado", async () => {
    // Arrange
    let executedCmdKey = "";
    let executedAction = null;
    const mockAction = async () => "actionExecuted";
    const deps = {
      commandActionMap: {
        updateTestServer: mockAction,
      },
      safeExecuteCommandFn: async (cmdKey, action) => {
        executedCmdKey = cmdKey;
        executedAction = action;
      },
    };

    // Act
    const result = await executeSuggestedCommand("acr updateTestServer", deps);

    // Assert
    assert.equal(result, true);
    assert.equal(executedCmdKey, "updateTestServer");
    assert.equal(executedAction, mockAction);
  });

  await t.test("executeSuggestedCommand deve executar comando de sistema via execSync e tratar erros", async () => {
    // Arrange: Cenário de sucesso
    let ranShellCmd = "";
    const depsSuccess = {
      execSyncFn: (cmd) => { ranShellCmd = cmd; },
    };

    // Act 1
    const resSuccess = await executeSuggestedCommand("npm test", depsSuccess);

    // Assert 1
    assert.equal(resSuccess, true);
    assert.equal(ranShellCmd, "npm test");

    // Arrange: Cenário de erro
    const depsFail = {
      execSyncFn: () => { throw new Error("Command failed"); },
    };

    // Act 2
    const resFail = await executeSuggestedCommand("invalid-cmd", depsFail);

    // Assert 2
    assert.equal(resFail, false);
  });

  await t.test("handleAIAssistance deve coletar necessidade do usuário, consultar IA e executar comando sugerido quando confirmado", async () => {
    // Arrange
    let askedQuery = null;
    let safeExecutedCmd = "";
    const mockDeps = {
      promptFn: createPromptMock([
        { userQuery: "Quero atualizar o servidor de teste" },
        { shouldRun: true },
      ]),
      askAIAssistantForCommandFn: async (queryData) => {
        askedQuery = queryData;
        return "Use o comando de teste.\nSUGGESTED_CMD: acr updateTestServer";
      },
      commandActionMap: {
        updateTestServer: async () => {},
      },
      safeExecuteCommandFn: async (cmd) => {
        safeExecutedCmd = cmd;
      },
    };

    // Act
    await handleAIAssistance("teste", mockDeps);

    // Assert
    assert.equal(askedQuery.enteredCommand, "teste");
    assert.equal(askedQuery.userQuery, "Quero atualizar o servidor de teste");
    assert.equal(safeExecutedCmd, "updateTestServer");
  });

  await t.test("handleAIAssistance não deve executar comando quando usuário recusa confirmação ou não há sugestão", async () => {
    // Arrange: Usuário recusa
    let safeExecutedCmd = "";
    const mockDepsRefuse = {
      promptFn: createPromptMock([
        { userQuery: "Quero atualizar" },
        { shouldRun: false },
      ]),
      askAIAssistantForCommandFn: async () => "Orientação.\nSUGGESTED_CMD: acr create",
      commandActionMap: { create: async () => {} },
      safeExecuteCommandFn: async (cmd) => { safeExecutedCmd = cmd; },
    };

    // Act 1
    await handleAIAssistance("test", mockDepsRefuse);

    // Assert 1
    assert.equal(safeExecutedCmd, "");

    // Arrange: Sem comando sugerido (SUGGESTED_CMD: none)
    const mockDepsNone = {
      promptFn: createPromptMock([
        { userQuery: "Apenas uma dúvida conceitual" },
      ]),
      askAIAssistantForCommandFn: async () => "Explicação apenas.\nSUGGESTED_CMD: none",
      safeExecuteCommandFn: async (cmd) => { safeExecutedCmd = cmd; },
    };

    // Act 2
    await handleAIAssistance("ajuda", mockDepsNone);

    // Assert 2
    assert.equal(safeExecutedCmd, "");
  });

  await t.test("handleAIAssistance deve capturar erros lançados pela IA amigavelmente", async () => {
    // Arrange
    const mockDepsError = {
      promptFn: createPromptMock([
        { userQuery: "Quero ajuda" },
      ]),
      askAIAssistantForCommandFn: async () => {
        throw new Error("OpenAI API Outage");
      },
    };

    // Act & Assert
    await assert.doesNotReject(async () => {
      await handleAIAssistance("erro", mockDepsError);
    });
  });

  await t.test("handleCommandSelection deve executar o comando selecionado da lista", async () => {
    // Arrange
    let executedCommand = "";
    const mockDeps = {
      promptFn: createPromptMock([
        { command: "create" },
      ]),
      commandActionMap: {
        create: async () => {},
      },
      safeExecuteCommandFn: async (cmd) => {
        executedCommand = cmd;
      },
    };

    // Act
    await handleCommandSelection(mockDeps);

    // Assert
    assert.equal(executedCommand, "create");
  });

  await t.test("handleUnknownCommand deve orquestrar ai_assist, select_command e cancel", async () => {
    // Arrange 1: ai_assist
    let ranAIAssist = false;
    const mockDepsAI = {
      promptFn: createPromptMock([
        { action: "ai_assist" },
        { userQuery: "Quero commitar" },
        { shouldRun: false },
      ]),
      askAIAssistantForCommandFn: async () => {
        ranAIAssist = true;
        return "Orientação.\nSUGGESTED_CMD: acr commit";
      },
    };

    // Act 1
    await handleUnknownCommand("committ", mockDepsAI);

    // Assert 1
    assert.equal(ranAIAssist, true);

    // Arrange 2: select_command
    let selectedCmd = "";
    const mockDepsSelect = {
      promptFn: createPromptMock([
        { action: "select_command" },
        { command: "analyze" },
      ]),
      commandActionMap: { analyze: async () => {} },
      safeExecuteCommandFn: async (cmd) => { selectedCmd = cmd; },
    };

    // Act 2
    await handleUnknownCommand("unknown", mockDepsSelect);

    // Assert 2
    assert.equal(selectedCmd, "analyze");

    // Arrange 3: cancel
    const mockDepsCancel = {
      promptFn: createPromptMock([
        { action: "cancel" },
      ]),
    };

    // Act 3 & Assert 3
    await assert.doesNotReject(async () => {
      await handleUnknownCommand("foo", mockDepsCancel);
    });
  });
});
