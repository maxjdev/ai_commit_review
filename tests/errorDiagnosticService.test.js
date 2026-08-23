import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDeps,
  sanitizeErrorQuery,
  buildSearchQuery,
  parseAutoFixCommand,
  formatWebResults,
  renderDiagnostic,
  executeAutoFix,
  diagnoseAndHandleError,
} from "../src/errorDiagnosticService.js";

function createPromptMock(answers) {
  let callCount = 0;
  return async () => {
    const answer = answers[callCount] || answers[answers.length - 1];
    callCount++;
    return answer;
  };
}

test("errorDiagnosticService.js - Cobertura 100% de Diagnóstico com IA e Auto-Fix (Padrão AAA)", async (t) => {
  await t.test("getDeps deve retornar instâncias padrão e injetadas", () => {
    // Arrange & Act
    const dDefault = getDeps();
    const dCustom = getDeps({
      searchGoogleFn: async () => {},
      diagnoseErrorWithAIFn: async () => {},
      execSyncFn: () => {},
      promptFn: async () => {},
    });

    // Assert
    assert.equal(typeof dDefault.searchGoogleFn, "function");
    assert.equal(typeof dDefault.diagnoseErrorWithAIFn, "function");
    assert.equal(typeof dDefault.execSyncFn, "function");
    assert.equal(typeof dDefault.promptFn, "function");
    assert.notEqual(dCustom.searchGoogleFn, dDefault.searchGoogleFn);
  });

  await t.test("sanitizeErrorQuery e buildSearchQuery devem limpar caminhos e gerar query concisa", () => {
    // Arrange
    const errorData = {
      command: "git commit --edit --file=temp.txt",
      message: 'Command failed: git commit --edit --file="C:\\Users\\user\\AppData\\Local\\Temp\\commit_msg_123.txt"',
      stderr: "Waiting for your editor to close the file... 'C:/Program Files/Notepad++/notepad++.exe': No such file",
    };

    // Act
    const sanitizedMsg = sanitizeErrorQuery(errorData.message);
    const sanitizedNull = sanitizeErrorQuery(null);
    const query = buildSearchQuery(errorData);
    const queryEmpty = buildSearchQuery({});

    // Assert
    assert.equal(sanitizedNull, "");
    assert.equal(sanitizedMsg.includes("C:\\Users"), false);
    assert.match(query, /git/i);
    assert.match(query, /editor/i);
    assert.ok(queryEmpty.length > 0);

    // Act 2: Plataforma Linux
    const originalPlatform = process.platform;
    try {
      Object.defineProperty(process, "platform", { value: "linux", configurable: true });
      const linuxQuery = buildSearchQuery({ message: "fatal error" });
      assert.ok(linuxQuery.includes("linux"));
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });

  await t.test("parseAutoFixCommand deve extrair comandos ou retornar null", () => {
    // Act & Assert
    assert.equal(
      parseAutoFixCommand("Explicação...\nAUTO_FIX_CMD: git config --global core.editor notepad\nFim"),
      "git config --global core.editor notepad"
    );
    assert.equal(
      parseAutoFixCommand("Explicação...\nAUTO_FIX_CMD: `git config --unset core.editor`"),
      "git config --unset core.editor"
    );
    assert.equal(parseAutoFixCommand("Explicação...\nAUTO_FIX_CMD: none"), null);
    assert.equal(parseAutoFixCommand("Explicação...\nAUTO_FIX_CMD:   "), null);
    assert.equal(parseAutoFixCommand("Sem comando de correção"), null);
    assert.equal(parseAutoFixCommand(""), null);
    assert.equal(parseAutoFixCommand(null), null);
  });

  await t.test("formatWebResults deve formatar texto e lista de resultados", () => {
    // Act 1: Sem resultados
    assert.equal(formatWebResults(null), "");
    assert.equal(formatWebResults({ success: false }), "");

    // Act 2: Texto markdown
    assert.equal(formatWebResults({ success: true, results: "Markdown text" }), "Markdown text");

    // Act 3: Lista google_search (com link e com url)
    const listRes = formatWebResults({
      success: true,
      results: {
        google_search: [
          { title: "Doc Git", link: "https://git.com", snippet: "Resumo" },
          { title: "Doc Fallback", url: "https://fallback.com", snippet: "Resumo 2" },
        ],
      },
    });
    assert.match(listRes, /Doc Git/);
    assert.match(listRes, /https:\/\/git\.com/);
    assert.match(listRes, /https:\/\/fallback\.com/);

    // Act 4: Objeto genérico sem google_search
    const objRes = formatWebResults({
      success: true,
      results: { customKey: "customValue" },
    });
    assert.match(objRes, /customKey/);
  });

  await t.test("renderDiagnostic deve imprimir analise formatada", () => {
    renderDiagnostic("Diagnostico do erro.\nAUTO_FIX_CMD: git status");
  });

  await t.test("executeAutoFix deve executar com sucesso e tratar falhas", async () => {
    // Arrange
    let ranCmd = "";
    const dSuccess = {
      execSyncFn: (cmd) => { ranCmd = cmd; },
    };
    const dFail = {
      execSyncFn: () => { throw new Error("Exec permission denied"); },
    };

    // Act & Assert
    const resSuccess = await executeAutoFix("git config --global core.editor notepad", dSuccess);
    assert.equal(resSuccess, true);
    assert.equal(ranCmd, "git config --global core.editor notepad");

    const resFail = await executeAutoFix("invalid cmd", dFail);
    assert.equal(resFail, false);
  });

  await t.test("diagnoseAndHandleError deve cobrir auto_fix, retry e cancel", async () => {
    // Arrange
    const mockError = new Error("Command failed: git commit");
    mockError.stderr = "Notepad++ not found";
    const aiAnalysisWithFix = "Resumo: Editor inexistente.\nAUTO_FIX_CMD: git config --global core.editor notepad";

    // Act 1: Auto-fix com retry
    let executedCmd = "";
    const depsAutoFix = {
      searchGoogleFn: async () => ({ success: true, results: "Docs" }),
      diagnoseErrorWithAIFn: async () => aiAnalysisWithFix,
      execSyncFn: (cmd) => { executedCmd = cmd; },
      promptFn: createPromptMock([{ action: "auto_fix" }, { retryAfterFix: true }]),
    };
    const resFix = await diagnoseAndHandleError(mockError, { command: "git commit" }, depsAutoFix);
    assert.equal(resFix.handled, true);
    assert.equal(resFix.action, "retry");
    assert.equal(resFix.success, true);
    assert.equal(executedCmd, "git config --global core.editor notepad");

    // Act 1.1: Auto-fix sem retry
    const depsAutoFixNoRetry = {
      searchGoogleFn: async () => ({ success: true, results: "Docs" }),
      diagnoseErrorWithAIFn: async () => aiAnalysisWithFix,
      execSyncFn: () => {},
      promptFn: createPromptMock([{ action: "auto_fix" }, { retryAfterFix: false }]),
    };
    const resFixNoRetry = await diagnoseAndHandleError(mockError, { command: "git commit" }, depsAutoFixNoRetry);
    assert.equal(resFixNoRetry.action, "auto_fix");

    // Act 1.2: Auto-fix com falha de execução
    const depsAutoFixFail = {
      searchGoogleFn: async () => ({ success: true, results: "Docs" }),
      diagnoseErrorWithAIFn: async () => aiAnalysisWithFix,
      execSyncFn: () => { throw new Error("Permission denied"); },
      promptFn: createPromptMock([{ action: "auto_fix" }]),
    };
    const resFixFail = await diagnoseAndHandleError(mockError, { command: "git commit" }, depsAutoFixFail);
    assert.equal(resFixFail.action, "auto_fix");
    assert.equal(resFixFail.success, false);

    // Act 1.3: Ação auto_fix selecionada quando autoFixCmd é nulo
    const resFixNullCmd = await diagnoseAndHandleError(
      mockError,
      {},
      {
        searchGoogleFn: async () => ({ success: false }),
        diagnoseErrorWithAIFn: async () => "Sem comando AUTO_FIX_CMD",
        promptFn: createPromptMock([{ action: "auto_fix" }]),
      }
    );
    assert.equal(resFixNullCmd.action, "auto_fix");
    assert.equal(resFixNullCmd.autoFixCmd, null);

    // Act 2: Retry e erro com output[2]
    const errorWithOutput = { output: [null, null, "error in buffer"] };
    const depsRetry = {
      searchGoogleFn: async () => ({ success: false }),
      diagnoseErrorWithAIFn: async () => "Resumo do erro.\nAUTO_FIX_CMD: none",
      promptFn: createPromptMock([{ action: "retry" }]),
    };
    const resRetry = await diagnoseAndHandleError(errorWithOutput, {}, depsRetry);
    assert.equal(resRetry.handled, true);
    assert.equal(resRetry.action, "retry");

    // Act 3: Cancel com erro em formato string pura, buffer stderr e null
    const depsCancel = {
      searchGoogleFn: async () => ({ success: false }),
      diagnoseErrorWithAIFn: async () => "Erro.\nAUTO_FIX_CMD: none",
      promptFn: createPromptMock([{ action: "cancel" }]),
    };
    const resCancel = await diagnoseAndHandleError("String error message", {}, depsCancel);
    assert.equal(resCancel.handled, true);
    assert.equal(resCancel.action, "cancel");

    // Casos de borda: null, undefined, buffer stderr e output [null, null, null]
    await diagnoseAndHandleError(null, { command: "git status" }, depsCancel);
    await diagnoseAndHandleError(undefined, {}, depsCancel);
    await diagnoseAndHandleError({ output: [null, null, null] }, {}, depsCancel);
    await diagnoseAndHandleError(
      { stderr: Buffer.from("Buffer stderr msg"), stack: "Custom error stack" },
      {},
      depsCancel
    );
  });
});
