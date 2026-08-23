import path from "path";
import os from "os";

process.env.ACR_CONFIG_FILE = path.join(os.tmpdir(), `test_cfg_commitFlowHandlers_${process.pid}.json`);
process.env.PASSWORD_CRYPTO_KEY = "segredo_teste_key";

import { test } from "node:test";
import assert from "node:assert/strict";
import inquirer from "inquirer";
import fs from "fs";
import {
  getDeps,
  confirmOrSwitchBranch,
  verifyConflicts,
  resolveConflictsManually,
  resolveConflictsAutomatically,
  obtainCommitMessage,
  handleCommitAbortOrPush
} from "../src/commitFlowHandlers.js";
import { saveConfig, deleteConfigFile } from "../src/config.js";

function createPromptMock(answersList = []) {
  let index = 0;
  return async (questions) => {
    const list = Array.isArray(questions) ? questions : [questions];
    const current = answersList[index] || {};
    index++;
    const result = {};
    for (const q of list) {
      if (q && q.name) {
        if (q.validate && typeof q.validate === "function") {
          q.validate("");
          q.validate("texto valido");
        }
        result[q.name] = current[q.name] !== undefined ? current[q.name] : true;
      }
    }
    return result;
  };
}

test("commitFlowHandlers.js - Cobertura 100% de Linhas, Branches e Funções (Padrão AAA)", async (t) => {
  t.beforeEach(() => {
    saveConfig({
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_API_MODEL: "gpt-5-nano",
      OPENAI_RESPONSE_LANGUAGE: "pt-BR"
    });
  });

  t.afterEach(() => {
    deleteConfigFile();
  });

  await t.test("getDeps deve cobrir 100% dos ramos com e sem objeto de dependências", () => {
    // Act 1: Sem parâmetros (testa todos os operadores || com fallback)
    const defaults = getDeps();
    assert.equal(typeof defaults.getCurrentBranchFn, "function");
    assert.equal(typeof defaults.listBranchesFn, "function");
    assert.equal(typeof defaults.switchBranchFn, "function");
    assert.equal(typeof defaults.commitChangesWithEditorFn, "function");
    assert.equal(typeof defaults.commitDirectlyWithMessageFileFn, "function");
    assert.equal(typeof defaults.diagnoseAndHandleErrorFn, "function");
    assert.equal(typeof defaults.undoLastCommitSoftFn, "function");
    assert.equal(typeof defaults.buildContextForFilesFn, "function");
    assert.equal(typeof defaults.analyzeUpdatedCodeFn, "function");
    assert.equal(typeof defaults.promptFn, "function");

    // Act 2: Com parâmetros injetados (testa todos os lados esquerdos dos operadores ||)
    const dummyFn = () => {};
    const injected = getDeps({
      getCurrentBranchFn: dummyFn,
      listBranchesFn: dummyFn,
      switchBranchFn: dummyFn,
      commitChangesWithEditorFn: dummyFn,
      commitDirectlyWithMessageFileFn: dummyFn,
      diagnoseAndHandleErrorFn: dummyFn,
      undoLastCommitSoftFn: dummyFn,
      buildContextForFilesFn: dummyFn,
      analyzeUpdatedCodeFn: dummyFn,
      promptFn: dummyFn,
    });
    assert.equal(injected.getCurrentBranchFn, dummyFn);
    assert.equal(injected.commitDirectlyWithMessageFileFn, dummyFn);
  });

  await t.test("confirmOrSwitchBranch deve cobrir o fluxo de continuar na branch e alternar branch", async () => {
    let switchedBranch = "";
    const depsContinue = {
      getCurrentBranchFn: () => "main",
      listBranchesFn: () => ["main", "dev"],
      switchBranchFn: (b) => { switchedBranch = b; },
      promptFn: createPromptMock([{ continueOnBranch: true }])
    };

    // Act 1: Continuar na mesma branch
    await confirmOrSwitchBranch(depsContinue);
    assert.equal(switchedBranch, "");

    // Act 2: Alternar para outra branch
    const depsSwitch = {
      ...depsContinue,
      promptFn: createPromptMock([{ continueOnBranch: false }, { selectedBranch: "dev" }])
    };
    await confirmOrSwitchBranch(depsSwitch);
    assert.equal(switchedBranch, "dev");
  });

  await t.test("verifyConflicts deve cobrir 0 conflitos, manual (com diff e sem diff), auto (add/no add) e cancel", async () => {
    // Act 1: 0 conflitos
    await verifyConflicts({ checkConflictsFn: () => [] });

    // Act 2: Manual com arquivo com diff e arquivo sem diff
    let manualUpdated = false;
    const tempFileExisting = path.join(os.tmpdir(), "temp_existing.txt");
    fs.writeFileSync(tempFileExisting, "test", "utf-8");

    const depsManual = {
      checkConflictsFn: () => ["conflito_com_diff.js", "conflito_sem_diff.js"],
      getConflictDiffFn: (f) => (f === "conflito_com_diff.js" ? "DIFF_BODY" : ""),
      writeConflictToTempFileFn: () => tempFileExisting,
      openFileInEditorFn: () => {},
      updateFileFromTempFn: () => { manualUpdated = true; },
      promptFn: createPromptMock([
        { resolutionOption: "manual" },
        { confirmResolution: true },  // conflito_com_diff.js
        { confirmResolution: false } // conflito_sem_diff.js (sem diff)
      ])
    };
    await verifyConflicts(depsManual);
    assert.equal(manualUpdated, true);

    // Act 3: Manual com confirmResolution = false em arquivo com diff (testa fs.existsSync no unlinking e temp inexistente)
    const tempFileNonExistent = path.join(os.tmpdir(), "temp_non_existent_abc.txt");
    if (fs.existsSync(tempFileNonExistent)) fs.unlinkSync(tempFileNonExistent);

    const depsManualNoConfirm = {
      checkConflictsFn: () => ["file_no_confirm.js"],
      getConflictDiffFn: () => "DIFF",
      writeConflictToTempFileFn: () => tempFileNonExistent,
      openFileInEditorFn: () => {},
      updateFileFromTempFn: () => {},
      promptFn: createPromptMock([
        { resolutionOption: "manual" },
        { confirmResolution: true }
      ])
    };
    await resolveConflictsManually(["file_no_confirm.js"], depsManualNoConfirm);

    // Act 4: Automático com stageChanges: true e stageChanges: false
    let gitAddCount = 0;
    const depsAuto = {
      checkConflictsFn: () => ["c1.js"],
      executeGitCommandFn: (cmd) => { if (cmd.includes("git add")) gitAddCount++; },
      promptFn: createPromptMock([{ resolutionOption: "automatic" }, { stageChanges: true }])
    };
    await verifyConflicts(depsAuto);
    assert.equal(gitAddCount, 1);

    const depsAutoNoAdd = {
      checkConflictsFn: () => ["c1.js"],
      executeGitCommandFn: (cmd) => { if (cmd.includes("git add")) gitAddCount++; },
      promptFn: createPromptMock([{ resolutionOption: "automatic" }, { stageChanges: false }])
    };
    await resolveConflictsAutomatically(["c1.js"], depsAutoNoAdd);

    // Act 5: Opção Cancelar
    const depsCancel = {
      checkConflictsFn: () => ["c1.js"],
      promptFn: createPromptMock([{ resolutionOption: "cancel" }])
    };
    await assert.rejects(async () => await verifyConflicts(depsCancel), /Conflicts unresolved/);
  });

  await t.test("obtainCommitMessage deve cobrir opção cancel, IA, manual e mensagem vazia com retry", async () => {
    const stagedFiles = [{ filename: "a.js", diff: "diff" }];

    // Act 1: Cancelar
    const depsCancel = {
      promptFn: createPromptMock([{ messageOption: "cancel" }])
    };
    await assert.rejects(async () => await obtainCommitMessage(stagedFiles, depsCancel), /Commit process canceled by user/);

    // Act 2: IA
    const depsAI = {
      buildContextForFilesFn: async () => stagedFiles,
      analyzeUpdatedCodeFn: async () => "✨ feat: mensagem IA",
      commitChangesWithEditorFn: (file) => {
        fs.writeFileSync(file, "✨ feat: mensagem IA final", "utf-8");
      },
      promptFn: createPromptMock([{ messageOption: "ai" }])
    };
    const msgIA = await obtainCommitMessage(stagedFiles, depsAI);
    assert.equal(msgIA, "✨ feat: mensagem IA final");

    // Act 3: Manual com 1ª mensagem vazia (força retry) e 2ª válida
    let attempts = 0;
    const depsManualRetry = {
      commitChangesWithEditorFn: (file) => {
        attempts++;
        if (attempts === 1) {
          fs.writeFileSync(file, "", "utf-8");
        } else {
          fs.writeFileSync(file, "📝 docs: mensagem manual", "utf-8");
        }
      },
      promptFn: createPromptMock([
        { messageOption: "manual" },
        { manualMessage: "msg 1" },
        { messageOption: "manual" },
        { manualMessage: "msg 2" }
      ])
    };
    const msgManual = await obtainCommitMessage(stagedFiles, depsManualRetry);
    assert.equal(msgManual, "📝 docs: mensagem manual");

    // Act 4: Falha no editor com fallback direto
    let directCommitted = false;
    const depsEditorFailDirect = {
      buildContextForFilesFn: async () => stagedFiles,
      analyzeUpdatedCodeFn: async () => "✨ feat: fallback direto",
      commitChangesWithEditorFn: () => { throw new Error("Editor not found"); },
      commitDirectlyWithMessageFileFn: () => { directCommitted = true; },
      promptFn: createPromptMock([
        { messageOption: "ai" },
        { fallbackChoice: "direct" }
      ])
    };
    const msgDirect = await obtainCommitMessage(stagedFiles, depsEditorFailDirect);
    assert.equal(msgDirect, "✨ feat: fallback direto");
    assert.equal(directCommitted, true);

    // Act 5: Falha no editor com diagnóstico de IA
    let diagnosed = false;
    let editorRetryCalled = false;
    const depsEditorFailDiag = {
      buildContextForFilesFn: async () => stagedFiles,
      analyzeUpdatedCodeFn: async () => "✨ feat: diag",
      commitChangesWithEditorFn: (file) => {
        if (!editorRetryCalled) {
          editorRetryCalled = true;
          throw new Error("Editor not found");
        }
        fs.writeFileSync(file, "✨ feat: diag pos fix", "utf-8");
      },
      diagnoseAndHandleErrorFn: async () => { diagnosed = true; },
      promptFn: createPromptMock([
        { messageOption: "ai" },
        { fallbackChoice: "diagnose" }
      ])
    };
    const msgDiag = await obtainCommitMessage(stagedFiles, depsEditorFailDiag);
    assert.equal(msgDiag, "✨ feat: diag pos fix");
    assert.equal(diagnosed, true);

    // Act 6: Falha no editor com fallback manual
    let manualDirectCommitted = false;
    const depsEditorFailManual = {
      buildContextForFilesFn: async () => stagedFiles,
      analyzeUpdatedCodeFn: async () => "✨ feat: manual prompt",
      commitChangesWithEditorFn: () => { throw new Error("Editor not found"); },
      commitDirectlyWithMessageFileFn: () => { manualDirectCommitted = true; },
      promptFn: createPromptMock([
        { messageOption: "ai" },
        { fallbackChoice: "manual" },
        { manualMsg: "📝 feat: manual input" }
      ])
    };
    const msgFallbackManual = await obtainCommitMessage(stagedFiles, depsEditorFailManual);
    assert.equal(msgFallbackManual, "📝 feat: manual input");
    assert.equal(manualDirectCommitted, true);

    // Act 7: Falha no editor com cancelamento
    const depsEditorFailCancel = {
      buildContextForFilesFn: async () => stagedFiles,
      analyzeUpdatedCodeFn: async () => "✨ feat: cancel",
      commitChangesWithEditorFn: () => { throw new Error("Editor not found"); },
      promptFn: createPromptMock([
        { messageOption: "ai" },
        { fallbackChoice: "cancel" }
      ])
    };
    await assert.rejects(
      async () => await obtainCommitMessage(stagedFiles, depsEditorFailCancel),
      /Commit process canceled by user/
    );
  });

  await t.test("handleCommitAbortOrPush deve cobrir abortCommit = true e abortCommit = false", async () => {
    let undoRan = false;
    const depsAbort = {
      undoLastCommitSoftFn: () => { undoRan = true; },
      promptFn: createPromptMock([{ abortCommit: true }])
    };
    const resAbort = await handleCommitAbortOrPush(depsAbort);
    assert.equal(resAbort, false);
    assert.equal(undoRan, true);

    const depsPush = {
      promptFn: createPromptMock([{ abortCommit: false }])
    };
    const resPush = await handleCommitAbortOrPush(depsPush);
    assert.equal(resPush, true);
  });
});
