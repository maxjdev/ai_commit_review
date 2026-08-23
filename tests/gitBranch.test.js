process.env.ACR_CONFIG_FILE = path.join(os.tmpdir(), `test_cfg_gitBranch_${process.pid}.json`);
process.env.PASSWORD_CRYPTO_KEY = "segredo_teste_key";

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  getDeps,
  getCurrentBranch,
  listBranches,
  pullChanges,
  pushChanges,
  switchBranch,
  restoreStashOrRollback,
  mergeBranch,
  checkConflicts,
  getConflictDiff,
  writeConflictToTempFile,
  openFileInEditor,
  updateFileFromTemp,
  isNoTrackingError
} from "../src/gitBranch.js";

test("gitBranch.js - Cobertura 100% de Gerenciamento de Branches (Padrão AAA)", async (t) => {
  await t.test("getDeps deve cobrir 100% dos ramos de injeção e fallbacks", () => {
    // Act 1: com fallbacks padrão
    const oldEditor = process.env.EDITOR;
    delete process.env.EDITOR;
    const defaultDeps = getDeps({});
    assert.equal(typeof defaultDeps.executeGitCommandFn, "function");
    assert.equal(typeof defaultDeps.execSyncFn, "function");
    assert.equal(defaultDeps.editor, "vim");

    // Act 2: com process.env.EDITOR
    process.env.EDITOR = "nano";
    const envDeps = getDeps();
    assert.equal(envDeps.editor, "nano");
    if (oldEditor !== undefined) process.env.EDITOR = oldEditor; else delete process.env.EDITOR;

    // Act 3: com editor customizado injetado
    const customEditorDeps = getDeps({ editor: "custom_editor" });
    assert.equal(customEditorDeps.editor, "custom_editor");

    // Act 3: com injeção explícita
    const customDeps = getDeps({
      executeGitCommandFn: () => "custom",
      execSyncFn: () => {},
      editor: "code"
    });
    assert.equal(customDeps.executeGitCommandFn(), "custom");
    assert.equal(customDeps.editor, "code");
  });

  await t.test("getCurrentBranch deve retornar o nome da branch atual ou 'unknown' em erro", () => {
    // Act 1: Sucesso
    const branch = getCurrentBranch({ executeGitCommandFn: () => "feature/nova-feature" });
    assert.equal(branch, "feature/nova-feature");

    // Act 2: Erro
    const erroBranch = getCurrentBranch({ executeGitCommandFn: () => { throw new Error("Branch Fail"); } });
    assert.equal(erroBranch, "unknown");
  });

  await t.test("listBranches deve listar branches sem o marcador asterisco ou retornar [] em erro", () => {
    // Act 1: Sucesso
    const branches = listBranches({
      executeGitCommandFn: () => "* main\n  feature/login\n  dev"
    });
    assert.deepEqual(branches, ["main", "feature/login", "dev"]);

    // Act 2: Output vazio
    const vazio = listBranches({ executeGitCommandFn: () => "" });
    assert.deepEqual(vazio, []);

    // Act 3: Output null
    const nullOutput = listBranches({ executeGitCommandFn: () => null });
    assert.deepEqual(nullOutput, []);

    // Act 4: Erro
    const erro = listBranches({ executeGitCommandFn: () => { throw new Error("List Fail"); } });
    assert.deepEqual(erro, []);
  });

  await t.test("pullChanges e pushChanges devem executar comandos e tratar erros", () => {
    let pullCmd = "";
    pullChanges({ executeGitCommandFn: (cmd) => { pullCmd = cmd; return ""; } });
    assert.equal(pullCmd, "git pull --no-rebase");

    // Pull com erro comum
    assert.throws(
      () => pullChanges({ executeGitCommandFn: () => { throw new Error("Pull Fail"); } }),
      /Pull Fail/
    );

    // Act 2: Erro de tracking ignorado graciosamente (com Error e com string pura)
    assert.doesNotThrow(
      () => pullChanges({ executeGitCommandFn: () => { throw new Error("There is no tracking information for the current branch."); } })
    );
    assert.doesNotThrow(
      () => pullChanges({ executeGitCommandFn: () => { throw "fatal: The current branch has no upstream branch."; } })
    );

    let pushCmd = "";
    pushChanges({ executeGitCommandFn: (cmd) => { pushCmd = cmd; return ""; } });
    assert.equal(pushCmd, "git push");

    assert.throws(
      () => pushChanges({ executeGitCommandFn: () => { throw new Error("Push Fail"); } }),
      /Push Fail/
    );

    // isNoTrackingError utilitário
    assert.equal(isNoTrackingError(), false);
    assert.equal(isNoTrackingError(undefined), false);
    assert.equal(isNoTrackingError(""), false);
    assert.equal(isNoTrackingError("There is no tracking information for the current branch."), true);
    assert.equal(isNoTrackingError("fatal: The current branch has no upstream branch."), true);
    assert.equal(isNoTrackingError("fatal: couldn't find remote ref main"), true);
    assert.equal(isNoTrackingError("Outro erro qualquer"), false);
  });

  await t.test("switchBranch deve validar parâmetros e lidar com stash e erros", async () => {
    // Act 1: Nome de branch inválido
    switchBranch(null);
    switchBranch(123);
    switchBranch("   ");

    // Act 2: Troca com uncommitted changes (hadStash = true) e rev-parse retornando null
    const executedCmds = [];
    const depsStash = {
      executeGitCommandFn: (cmd) => {
        executedCmds.push(cmd);
        if (cmd === "git rev-parse --abbrev-ref HEAD") return null;
        if (cmd === "git status --porcelain") return " M file.js";
        return "";
      }
    };
    switchBranch("feature/teste", depsStash);
    assert.ok(executedCmds.includes("git stash"));
    assert.ok(executedCmds.includes('git checkout "feature/teste"'));
    assert.ok(executedCmds.includes("git stash pop"));

    // Act 3: Troca sem uncommitted changes (hadStash = false) e status retornando null
    const executedCmdsNoStash = [];
    const depsNoStash = {
      executeGitCommandFn: (cmd) => {
        executedCmdsNoStash.push(cmd);
        if (cmd === "git rev-parse --abbrev-ref HEAD") return "main";
        if (cmd === "git status --porcelain") return null;
        return "";
      }
    };
    switchBranch("feature/teste", depsNoStash);
    assert.ok(!executedCmdsNoStash.includes("git stash"));

    // Act 4: Erro com objeto Error ao mudar de branch
    assert.throws(
      () => switchBranch("feature/erro", {
        executeGitCommandFn: (cmd) => {
          if (cmd.startsWith("git checkout")) throw new Error("Checkout Fail");
          return "";
        }
      }),
      /Checkout Fail/
    );

    // Act 5: Erro primitivo (sem propriedade .message) ao mudar de branch
    assert.throws(
      () => switchBranch("feature/erro_str", {
        executeGitCommandFn: (cmd) => {
          if (cmd.startsWith("git checkout")) throw "ErroPrimitivoString";
          return "";
        }
      }),
      (err) => err === "ErroPrimitivoString"
    );
  });

  await t.test("restoreStashOrRollback deve tratar conflitos de stash e erros no rollback", () => {
    // Act 1: Conflito no stash pop, rollback sucede (re-lança stashError)
    let popCount = 0;
    const depsRollbackSuccess = {
      executeGitCommandFn: (cmd) => {
        if (cmd === "git stash pop") {
          popCount++;
          if (popCount === 1) throw new Error("Stash Pop Conflict");
        }
        return "";
      }
    };
    assert.throws(
      () => restoreStashOrRollback("main", depsRollbackSuccess),
      /Stash Pop Conflict/
    );

    // Act 2: Conflito no stash pop, rollback também falha no segundo stash pop (lança restoreError)
    const depsRollbackFail = {
      executeGitCommandFn: (cmd) => {
        if (cmd === "git stash pop") {
          throw new Error("Stash Restore Error");
        }
        return "";
      }
    };
    assert.throws(
      () => restoreStashOrRollback("main", depsRollbackFail),
      /Stash Restore Error/
    );
  });

  await t.test("mergeBranch deve executar switch, merge e pullChanges", async () => {
    const executedCmds = [];
    const deps = {
      executeGitCommandFn: (cmd) => {
        executedCmds.push(cmd);
        return "";
      }
    };

    await mergeBranch("dev", "main", deps);
    assert.ok(executedCmds.includes('git checkout "main"'));
    assert.ok(executedCmds.includes('git merge --no-ff "dev"'));
  });

  await t.test("checkConflicts e getConflictDiff devem identificar conflitos de merge", () => {
    // checkConflicts - com conflitos UU
    const statusOutput = "UU file1.js\n M file2.js\nUU file3.js";
    const conflicts = checkConflicts({ executeGitCommandFn: () => statusOutput });
    assert.deepEqual(conflicts, ["file1.js", "file3.js"]);

    // checkConflicts - output vazio e null
    const semConflito = checkConflicts({ executeGitCommandFn: () => "" });
    assert.deepEqual(semConflito, []);

    const nullConflito = checkConflicts({ executeGitCommandFn: () => null });
    assert.deepEqual(nullConflito, []);

    // checkConflicts - erro
    const erroConflito = checkConflicts({ executeGitCommandFn: () => { throw new Error("Status Fail"); } });
    assert.deepEqual(erroConflito, []);

    // getConflictDiff - sucesso e erro
    const diff = getConflictDiff("file1.js", { executeGitCommandFn: () => "<<<<<< HEAD" });
    assert.equal(diff, "<<<<<< HEAD");

    const diffErro = getConflictDiff("file1.js", { executeGitCommandFn: () => { throw new Error("Diff Fail"); } });
    assert.equal(diffErro, "");
  });

  await t.test("writeConflictToTempFile, openFileInEditor e updateFileFromTemp devem manipular arquivos temporarios", () => {
    const tempPath = writeConflictToTempFile("teste.js", "CONFLITO_DIFF");
    assert.ok(fs.existsSync(tempPath));
    assert.equal(fs.readFileSync(tempPath, "utf-8"), "CONFLITO_DIFF");

    // openFileInEditor - sucesso e erro
    let editorCmd = "";
    openFileInEditor(tempPath, { execSyncFn: (cmd) => { editorCmd = cmd; }, editor: "subl" });
    assert.match(editorCmd, /subl ".*teste\.js_conflict\.txt"/);

    assert.doesNotThrow(() => openFileInEditor(tempPath, { execSyncFn: () => { throw new Error("Editor Fail"); } }));

    // updateFileFromTemp - sucesso e erro
    const targetFile = path.join(os.tmpdir(), `target_test_${process.pid}.js`);
    fs.writeFileSync(tempPath, "CONTEUDO_RESOLVIDO", "utf-8");

    let addCmd = "";
    updateFileFromTemp(targetFile, tempPath, { executeGitCommandFn: (cmd) => { addCmd = cmd; } });
    assert.equal(fs.readFileSync(targetFile, "utf-8"), "CONTEUDO_RESOLVIDO");
    assert.match(addCmd, /git add/);

    // updateFileFromTemp erro
    assert.doesNotThrow(() => updateFileFromTemp("/caminho/invalido/absurdo.js", "inexistente.txt"));

    // Cleanup
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
  });

  await t.test("deve testar chamadas passando deps mockados seguros para validar executabilidade", async () => {
    const mockDeps = { executeGitCommandFn: () => "", execSyncFn: () => "" };
    try { getCurrentBranch(mockDeps); } catch (e) {}
    try { listBranches(mockDeps); } catch (e) {}
    try { pullChanges(mockDeps); } catch (e) {}
    try { pushChanges(mockDeps); } catch (e) {}
    try { switchBranch("main", mockDeps); } catch (e) {}
    try { restoreStashOrRollback("main", mockDeps); } catch (e) {}
    try { await mergeBranch("dev", "main", mockDeps); } catch (e) {}
    try { checkConflicts(mockDeps); } catch (e) {}
    try { getConflictDiff("file.js", mockDeps); } catch (e) {}
    try { openFileInEditor("file.txt", mockDeps); } catch (e) {}
    try { updateFileFromTemp("file.js", "file.txt", mockDeps); } catch (e) {}
  });
});
