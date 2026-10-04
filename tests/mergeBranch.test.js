import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDeps,
  checkUncommittedChanges,
  promptTargetBranch,
  validateBranches,
  getBranchDivergence,
  syncTargetIntoSource,
  executeBranchMerge,
  promptFollowupAction,
  executeMergeFlow,
} from "../src/mergeBranch.js";

test("mergeBranch.js - Cobertura 100% de Linhas, Branches e Funções (Padrão AAA)", async (t) => {
  await t.test("getDeps deve cobrir ramos com defaults e com injeção customizada", () => {
    // Arrange & Act (Defaults)
    const defaults = getDeps();

    const keys = [
      "getCurrentBranchFn", "listBranchesFn", "switchBranchFn", "pullChangesFn",
      "pushChangesFn", "executeGitCommandFn", "verifyConflictsFn", "updateServerToTestFn", "createCommitFn", "promptFn",
    ];
    keys.forEach((key) => assert.equal(typeof defaults[key], "function"));

    // Arrange & Act (Injected)
    const dummy = () => {};
    const custom = getDeps(Object.fromEntries(keys.map((k) => [k, dummy])));

    // Assert (Injected)
    keys.forEach((key) => assert.equal(custom[key], dummy));
  });

  await t.test("checkUncommittedChanges deve ignorar status limpo, permitir commit ou colocar em stash", async () => {
    let promptCalled = false;
    await checkUncommittedChanges({
      executeGitCommandFn: () => "",
      promptFn: async () => { promptCalled = true; return {}; },
    });
    assert.equal(promptCalled, false);

    let committed = false;
    let callCount = 0;
    await checkUncommittedChanges({
      executeGitCommandFn: () => (++callCount === 1 ? " M file.js" : ""),
      promptFn: async () => ({ shouldCommit: true }),
      createCommitFn: async () => { committed = true; },
    });
    assert.equal(committed, true);

    let stashedCmd = "";
    await checkUncommittedChanges({
      executeGitCommandFn: (cmd) => (cmd.includes("status") ? " M file.js" : (stashedCmd = cmd, "")),
      promptFn: async () => ({ shouldCommit: false }),
    });
    assert.ok(stashedCmd.includes("git stash push"));

    let stashedOnCancel = false;
    await checkUncommittedChanges({
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("status")) return " M file.js";
        if (cmd.includes("git stash")) stashedOnCancel = true;
        return "";
      },
      promptFn: async () => ({ shouldCommit: true }),
      createCommitFn: async () => { throw new Error("Connection error"); },
    });
    assert.equal(stashedOnCancel, true);
  });

  await t.test("promptTargetBranch deve listar branches ou permitir branch customizada", async () => {
    const target1 = await promptTargetBranch("feature/agenda", {
      listBranchesFn: () => ["master", "develop", "feature/agenda"],
      promptFn: async () => ({ target: "develop" }),
    });
    assert.equal(target1, "develop");

    const target2 = await promptTargetBranch("master", {
      listBranchesFn: () => ["master"],
      promptFn: async () => ({ target: "develop" }),
    });
    assert.equal(target2, "develop");

    const target3 = await promptTargetBranch("feature/agenda", {
      listBranchesFn: () => ["master", "feature/agenda"],
      promptFn: async (questions) => {
        const q = questions[0];
        if (q.name === "target") return { target: "__custom__" };
        if (q.name === "customBranch") {
          assert.equal(q.validate(""), "Branch name is required.");
          assert.equal(q.validate("release/v1.0"), true);
          return { customBranch: "release/v1.0" };
        }
        return {};
      },
    });
    assert.equal(target3, "release/v1.0");
  });

  await t.test("validateBranches deve validar ramos e impedir merge na mesma branch", () => {
    assert.doesNotThrow(() => validateBranches("feature/agenda", "develop"));
    assert.doesNotThrow(() => validateBranches("feature/agenda", "master"));
    assert.throws(() => validateBranches("", "develop"), /Invalid current branch/);
    assert.throws(() => validateBranches("develop", ""), /Target branch is required/);
    assert.throws(() => validateBranches("develop", "develop"), /Cannot merge branch 'develop' into itself/);
  });

  await t.test("getBranchDivergence deve calcular commits behind/ahead e retornar fallback 0 em caso de erro", () => {
    // Arrange: Sucesso
    const successDeps = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("git fetch")) return "";
        if (cmd.includes("HEAD..origin/master")) return "3\n";
        if (cmd.includes("origin/master..HEAD")) return "1\n";
        return "";
      },
    };
    const divSuccess = getBranchDivergence("feat/teste", "master", successDeps);
    assert.deepEqual(divSuccess, { behind: 3, ahead: 1 });

    // Arrange: Falha de comando
    const errorDeps = {
      executeGitCommandFn: () => {
        throw new Error("fatal: not a git repo");
      },
    };
    const divError = getBranchDivergence("feat/teste", "master", errorDeps);
    assert.deepEqual(divError, { behind: 0, ahead: 0 });
  });

  await t.test("syncTargetIntoSource deve sincronizar com sucesso ou abortar em conflito não resolvido", async () => {
    let pushed = false;
    await syncTargetIntoSource("feature/agenda", "develop", {
      executeGitCommandFn: () => "",
      pushChangesFn: () => { pushed = true; },
    });
    assert.equal(pushed, true);

    let verifyCalled = false;
    await syncTargetIntoSource("feature/agenda", "develop", {
      executeGitCommandFn: (cmd) => { if (cmd.includes("git merge origin/develop")) throw new Error("Conflict"); return ""; },
      verifyConflictsFn: async () => { verifyCalled = true; },
      pushChangesFn: () => {},
    });
    assert.equal(verifyCalled, true);

    let abortCalled = false;
    await assert.rejects(
      () => syncTargetIntoSource("feature/agenda", "develop", {
        executeGitCommandFn: (cmd) => {
          if (cmd.includes("git merge origin/develop")) throw new Error("Conflict");
          if (cmd.includes("git merge --abort")) abortCalled = true;
          return "";
        },
        verifyConflictsFn: async () => { throw new Error("Unresolved"); },
        pushChangesFn: () => {},
      }),
      /Unresolved/
    );
    assert.equal(abortCalled, true);
  });

  await t.test("executeBranchMerge deve fazer switch, pull, merge --no-ff e push ou abortar em conflito", async () => {
    const log = [];
    await executeBranchMerge("feature/agenda", "master", {
      switchBranchFn: (b) => log.push(`switch:${b}`),
      pullChangesFn: () => log.push("pull"),
      pushChangesFn: () => log.push("push"),
      executeGitCommandFn: (cmd) => { log.push(cmd); return ""; },
    });
    assert.deepEqual(log, [
      "switch:master", "pull",
      'git merge --no-ff -m "Merge branch \'feature/agenda\' into master" "feature/agenda"',
      "push",
    ]);

    let revertedToSource = false;
    let abortCalled = false;
    await assert.rejects(
      () => executeBranchMerge("feature/agenda", "master", {
        switchBranchFn: (b) => { if (b === "feature/agenda") revertedToSource = true; },
        pullChangesFn: () => {},
        pushChangesFn: () => {},
        executeGitCommandFn: (cmd) => {
          if (cmd.includes("git merge --no-ff")) throw new Error("Conflict");
          if (cmd.includes("git merge --abort")) abortCalled = true;
          return "";
        },
        verifyConflictsFn: async () => { throw new Error("Unresolved"); },
      }),
      /Unresolved/
    );
    assert.equal(abortCalled, true);
    assert.equal(revertedToSource, true);
  });

  await t.test("promptFollowupAction deve acionar updateServerToTestFn apenas quando destino for develop e confirmado", async () => {
    let updateCalled = false;
    const depsDevelopYes = {
      promptFn: async () => ({ runUpdateTest: true }),
      updateServerToTestFn: async () => { updateCalled = true; },
    };
    await promptFollowupAction("develop", depsDevelopYes);
    assert.equal(updateCalled, true);

    // Quando não é develop, não deve perguntar
    let promptCalled = false;
    const depsMaster = {
      promptFn: async () => { promptCalled = true; return {}; },
    };
    await promptFollowupAction("master", depsMaster);
    assert.equal(promptCalled, false);
  });

  await t.test("executeMergeFlow deve orquestrar o fluxo completo para qualquer branch destino", async () => {
    const steps = [];
    const deps = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("status --porcelain")) return "";
        if (cmd.includes("git fetch")) return "";
        if (cmd.includes("HEAD..origin/master")) return "2\n";
        if (cmd.includes("origin/master..HEAD")) return "1\n";
        steps.push(cmd);
        return "";
      },
      getCurrentBranchFn: () => "feat/nova",
      listBranchesFn: () => ["master", "feat/nova"],
      switchBranchFn: (b) => steps.push(`switch:${b}`),
      pullChangesFn: () => steps.push("pull"),
      pushChangesFn: () => steps.push("push"),
      promptFn: async (questions) => {
        const qName = questions[0].name;
        if (qName === "target") return { target: "master" };
        if (qName === "syncTarget") return { syncTarget: true };
        return {};
      },
    };

    await executeMergeFlow(null, deps);

    assert.ok(steps.includes("pull"));
    assert.ok(steps.some((s) => s.includes("git merge origin/master")));
    assert.ok(steps.includes("switch:master"));
    assert.ok(steps.some((s) => s.includes("git merge --no-ff")));
    assert.ok(steps.includes("push"));
  });
});
