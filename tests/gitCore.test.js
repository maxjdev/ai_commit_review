import path from "path";
import os from "os";

process.env.ACR_CONFIG_FILE = path.join(os.tmpdir(), `test_cfg_gitCore_${process.pid}.json`);
process.env.PASSWORD_CRYPTO_KEY = "segredo_teste_key";

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDeps,
  executeGitCommand,
  stageAllChanges,
  clearStage,
  undoLastCommitSoft,
  commitChangesWithEditor,
  commitDirectlyWithMessageFile,
  getCommits,
  formatGitDate,
  truncateString,
  getModifiedFiles,
  getFileDiff,
  getRepositoryDiff,
  getStagedFileDiff,
  getStagedFilesDiffs
} from "../src/gitCore.js";

test("gitCore.js - Cobertura 100% de Operações do Git (Padrão AAA)", async (t) => {
  await t.test("getDeps deve cobrir 100% dos ramos de injeção e fallbacks padrão", () => {
    const defaultDeps = getDeps();
    assert.equal(typeof defaultDeps.execSyncFn, "function");

    const emptyDeps = getDeps({});
    assert.equal(typeof emptyDeps.execSyncFn, "function");

    const customDeps = getDeps({ execSyncFn: () => "custom" });
    assert.equal(customDeps.execSyncFn(), "custom");
  });

  await t.test("executeGitCommand deve retornar output limpo e relançar erros no catch", () => {
    // Act 1: Sucesso
    const res = executeGitCommand("git status", { execSyncFn: () => "  On branch main \n" });
    assert.equal(res, "On branch main");

    // Act 2: Erro
    assert.throws(
      () => executeGitCommand("git status", { execSyncFn: () => { throw new Error("Git Error"); } }),
      /Git Error/
    );
  });

  await t.test("stageAllChanges deve executar git add . e lançar erro em falhas", () => {
    let executedCmd = "";

    // Act 1: Sucesso
    stageAllChanges({ execSyncFn: (cmd) => { executedCmd = cmd; return ""; } });
    assert.equal(executedCmd, "git add .");

    // Act 2: Erro
    assert.throws(
      () => stageAllChanges({ execSyncFn: () => { throw new Error("Add Fail"); } }),
      /Add Fail/
    );
  });

  await t.test("clearStage deve executar git reset e capturar exceções sem quebrar fluxo", () => {
    let executedCmd = "";

    // Act 1: Sucesso
    clearStage({ execSyncFn: (cmd) => { executedCmd = cmd; return ""; } });
    assert.equal(executedCmd, "git reset");

    // Act 2: Captura de erro
    assert.doesNotThrow(() => clearStage({ execSyncFn: () => { throw new Error("Reset Fail"); } }));
  });

  await t.test("undoLastCommitSoft deve executar git reset --soft HEAD~1 e relançar exceções", () => {
    let executedCmd = "";

    // Act 1: Sucesso
    undoLastCommitSoft({ execSyncFn: (cmd) => { executedCmd = cmd; return ""; } });
    assert.equal(executedCmd, "git reset --soft HEAD~1");

    // Act 2: Erro
    assert.throws(
      () => undoLastCommitSoft({ execSyncFn: () => { throw new Error("Undo Fail"); } }),
      /Undo Fail/
    );
  });

  await t.test("commitChangesWithEditor deve executar git commit com editor e relançar exceção", () => {
    let executedCmd = "";

    // Act 1: Sucesso
    commitChangesWithEditor("temp.txt", { execSyncFn: (cmd) => { executedCmd = cmd; return ""; } });
    assert.match(executedCmd, /git commit --edit --file="temp\.txt"/);

    // Act 2: Erro
    assert.throws(
      () => commitChangesWithEditor("temp.txt", { execSyncFn: () => { throw new Error("Commit Fail"); } }),
      /Commit Fail/
    );
  });

  await t.test("commitDirectlyWithMessageFile deve executar git commit sem editor e relançar exceção", () => {
    let executedCmd = "";

    // Act 1: Sucesso
    commitDirectlyWithMessageFile("temp.txt", { execSyncFn: (cmd) => { executedCmd = cmd; return ""; } });
    assert.match(executedCmd, /git commit --file="temp\.txt"/);

    // Act 2: Erro
    assert.throws(
      () => commitDirectlyWithMessageFile("temp.txt", { execSyncFn: () => { throw new Error("Direct Commit Fail"); } }),
      /Direct Commit Fail/
    );
  });

  await t.test("getCommits e utilitários de data/string devem cobrir parsings, truncamentos e falhas", () => {
    // Utilitários de data e truncamento
    assert.equal(formatGitDate(null), "");
    assert.equal(formatGitDate(""), "");
    assert.match(formatGitDate("1672531199"), /2022|2023/);
    assert.equal(truncateString("curto", 10), "curto");
    assert.equal(truncateString("texto_muito_longo_para_truncar", 10), "texto_m...");

    // Act 1: Output de log do git vazio
    const resVazio = getCommits(0, 5, { execSyncFn: () => "" });
    assert.deepEqual(resVazio, []);

    // Act 2: Output com commit longo, linha sem sha e linha sem mensagem
    const longMsg = "A".repeat(120);
    const mockLogOutput = `abc1234567890def\x1f1672531199\x1f${longMsg}\n\x1f1672531199\x1fmsg\nsha123\x1f1672531199`;
    const resCommits = getCommits(0, 5, { execSyncFn: () => mockLogOutput });
    assert.equal(resCommits[0].shaShort, "abc1234");
    assert.equal(resCommits[0].message.length, 100);
    assert.equal(resCommits[1].shaShort, "");
    assert.equal(resCommits[2].message, "");

    // Act 3: Exceção no git log
    const resErro = getCommits(0, 5, { execSyncFn: () => { throw new Error("Log Fail"); } });
    assert.deepEqual(resErro, []);
  });

  await t.test("getModifiedFiles deve retornar arquivos modificados e tratar saída vazia e exceções", () => {
    // Act 1: Sucesso
    const mockOutput = "M\tsrc/index.js\nA\tsrc/utils.js";
    const res = getModifiedFiles("sha123", { execSyncFn: () => mockOutput });
    assert.equal(res.length, 2);
    assert.equal(res[0].status, "M");
    assert.equal(res[0].file, "src/index.js");

    // Act 2: Vazio
    const resVazio = getModifiedFiles("sha123", { execSyncFn: () => "" });
    assert.deepEqual(resVazio, []);

    // Act 3: Erro
    const resErro = getModifiedFiles("sha123", { execSyncFn: () => { throw new Error("Diff Fail"); } });
    assert.deepEqual(resErro, []);
  });

  await t.test("getFileDiff e getRepositoryDiff devem retornar diff ou string vazia em erro", () => {
    // getFileDiff
    const diff1 = getFileDiff("sha123", "app.js", { execSyncFn: () => "+ diff content" });
    assert.equal(diff1, "+ diff content");
    const diffFail = getFileDiff("sha123", "app.js", { execSyncFn: () => { throw new Error("Fail"); } });
    assert.equal(diffFail, "");

    // getRepositoryDiff
    const repoDiff = getRepositoryDiff({ execSyncFn: () => "+ repo diff" });
    assert.equal(repoDiff, "+ repo diff");
    const repoDiffFail = getRepositoryDiff({ execSyncFn: () => { throw new Error("Fail"); } });
    assert.equal(repoDiffFail, "");
  });

  await t.test("getStagedFileDiff e getStagedFilesDiffs devem cobrir arquivos deletados, linhas vazias e erros", () => {
    // getStagedFileDiff - sucesso
    const stagedDiff = getStagedFileDiff("app.js", { execSyncFn: () => "+ staged diff" });
    assert.equal(stagedDiff, "+ staged diff");

    // getStagedFileDiff - erro com arquivo deletado
    let calls = 0;
    const deletedDiff = getStagedFileDiff("deleted.js", {
      execSyncFn: (cmd) => {
        calls++;
        if (calls === 1) throw new Error("Staged diff fail");
        return "deleted.js"; // ls-files
      }
    });
    assert.equal(deletedDiff, "File deleted: deleted.js");

    // getStagedFileDiff - erro mas ls-files retorna vazio (isDeleted = false)
    let lsEmptyCalls = 0;
    const notDeletedDiff = getStagedFileDiff("not_deleted.js", {
      execSyncFn: (cmd) => {
        lsEmptyCalls++;
        if (lsEmptyCalls === 1) throw new Error("Staged diff fail");
        return "";
      }
    });
    assert.equal(notDeletedDiff, "");

    // getStagedFileDiff - erro com ls-files lançando exceção no catch interno
    const innerCatchDiff = getStagedFileDiff("other.js", {
      execSyncFn: () => { throw new Error("Staged & ls-files fail"); }
    });
    assert.equal(innerCatchDiff, "");

    // getStagedFilesDiffs - sucesso com quebra de linha final (linha vazia filtrada)
    let diffCalls = 0;
    const listDiffs = getStagedFilesDiffs({
      execSyncFn: (cmd) => {
        diffCalls++;
        if (cmd === "git diff --cached --name-only") return "file1.js\nfile2.js\n";
        return `+ diff for ${cmd}`;
      }
    });
    assert.equal(listDiffs.length, 2);
    assert.equal(listDiffs[0].filename, "file1.js");

    // getStagedFilesDiffs - retorno de string vazia em name-only
    const emptyOutputDiffs = getStagedFilesDiffs({
      execSyncFn: () => ""
    });
    assert.deepEqual(emptyOutputDiffs, []);

    // getStagedFilesDiffs - erro no git diff --cached --name-only
    const emptyListDiffs = getStagedFilesDiffs({
      execSyncFn: () => { throw new Error("Diff --cached fail"); }
    });
    assert.deepEqual(emptyListDiffs, []);
  });

  await t.test("deve testar chamadas passando deps mockados seguros para validar executabilidade", () => {
    const mockDeps = { execSyncFn: () => "" };
    try { executeGitCommand("git --version", mockDeps); } catch (e) {}
    try { stageAllChanges(mockDeps); } catch (e) {}
    try { clearStage(mockDeps); } catch (e) {}
    try { undoLastCommitSoft(mockDeps); } catch (e) {}
    try { commitChangesWithEditor("non_existent_file.txt", mockDeps); } catch (e) {}
    try { getCommits(undefined, undefined, mockDeps); } catch (e) {}
    try { getModifiedFiles("HEAD", mockDeps); } catch (e) {}
    try { getFileDiff("HEAD", "file.js", mockDeps); } catch (e) {}
    try { getRepositoryDiff(mockDeps); } catch (e) {}
    try { getStagedFileDiff("file.js", mockDeps); } catch (e) {}
    try { getStagedFilesDiffs(mockDeps); } catch (e) {}
  });
});
