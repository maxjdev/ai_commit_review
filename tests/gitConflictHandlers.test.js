import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  getConflictDeps,
  verifyConflicts,
  resolveConflictsManually,
  resolveConflictsAutomatically,
} from "../src/gitConflictHandlers.js";

function createPromptMock(answers) {
  let callCount = 0;
  return async () => {
    const answer = answers[callCount] || answers[answers.length - 1];
    callCount++;
    return answer;
  };
}

test("gitConflictHandlers.js - Cobertura 100% de Resolução de Conflitos (Padrão AAA)", async (t) => {
  await t.test("getConflictDeps deve retornar dependências padrão e customizadas", () => {
    const dDefault = getConflictDeps();
    assert.equal(typeof dDefault.checkConflictsFn, "function");
    assert.equal(typeof dDefault.getConflictDiffFn, "function");

    const customFn = () => {};
    const dCustom = getConflictDeps({ checkConflictsFn: customFn });
    assert.equal(dCustom.checkConflictsFn, customFn);
  });

  await t.test("verifyConflicts deve cobrir fluxo sem conflitos, manual, automático e cancelamento", async () => {
    // Act 1: 0 conflitos
    await verifyConflicts({ checkConflictsFn: () => [] });

    // Act 2: Manual
    let manualRan = false;
    const tempFile = path.join(os.tmpdir(), "temp_conflict_test.txt");
    fs.writeFileSync(tempFile, "conflict", "utf-8");

    const depsManual = {
      checkConflictsFn: () => ["file1.js"],
      getConflictDiffFn: () => "DIFF",
      writeConflictToTempFileFn: () => tempFile,
      openFileInEditorFn: () => {},
      updateFileFromTempFn: () => { manualRan = true; },
      promptFn: createPromptMock([
        { resolutionOption: "manual" },
        { confirmResolution: true },
      ]),
    };
    await verifyConflicts(depsManual);
    assert.equal(manualRan, true);

    // Act 3: Automático
    let gitAddRan = false;
    const depsAuto = {
      checkConflictsFn: () => ["file2.js"],
      executeGitCommandFn: (cmd) => { if (cmd.includes("git add")) gitAddRan = true; },
      promptFn: createPromptMock([
        { resolutionOption: "automatic" },
        { stageChanges: true },
      ]),
    };
    await verifyConflicts(depsAuto);
    assert.equal(gitAddRan, true);

    // Act 4: Cancel
    const depsCancel = {
      checkConflictsFn: () => ["file3.js"],
      promptFn: createPromptMock([{ resolutionOption: "cancel" }]),
    };
    await assert.rejects(async () => await verifyConflicts(depsCancel), /Conflicts unresolved/);
  });

  await t.test("resolveConflictsManually deve tratar arquivo sem diff e confirmResolution = false", async () => {
    const tempFile = path.join(os.tmpdir(), "temp_conflict_manual.txt");
    fs.writeFileSync(tempFile, "conflict", "utf-8");

    const deps = {
      getConflictDiffFn: (f) => (f === "with_diff.js" ? "DIFF" : ""),
      writeConflictToTempFileFn: () => tempFile,
      openFileInEditorFn: () => {},
      updateFileFromTempFn: () => {},
      promptFn: createPromptMock([{ confirmResolution: false }]),
    };

    await resolveConflictsManually(["no_diff.js", "with_diff.js"], deps);
  });

  await t.test("resolveConflictsAutomatically com stageChanges = false", async () => {
    let gitAddRan = false;
    const deps = {
      executeGitCommandFn: (cmd) => { if (cmd.includes("git add")) gitAddRan = true; },
      promptFn: createPromptMock([{ stageChanges: false }]),
    };
    await resolveConflictsAutomatically(["f1.js"], deps);
    assert.equal(gitAddRan, false);
  });
});
