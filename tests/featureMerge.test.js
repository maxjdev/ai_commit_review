import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDeps,
  validateCleanWorktree,
  validateFeatureBranch,
  getBranchDivergence,
  syncDevelopIntoFeature,
  mergeFeatureIntoDevelop,
  promptTestServerUpdate,
  mergeFeatureToDevelop,
} from "../src/featureMerge.js";

test("featureMerge.js - Cobertura 100% de Linhas, Branches e Funções (Padrão AAA)", async (t) => {
  await t.test("getDeps deve cobrir ramos com defaults e com injeção customizada", () => {
    // Arrange & Act (Defaults)
    const defaults = getDeps();

    // Assert (Defaults)
    assert.equal(typeof defaults.getCurrentBranchFn, "function");
    assert.equal(typeof defaults.switchBranchFn, "function");
    assert.equal(typeof defaults.pullChangesFn, "function");
    assert.equal(typeof defaults.pushChangesFn, "function");
    assert.equal(typeof defaults.executeGitCommandFn, "function");
    assert.equal(typeof defaults.verifyConflictsFn, "function");
    assert.equal(typeof defaults.updateServerToTestFn, "function");
    assert.equal(typeof defaults.promptFn, "function");

    // Arrange & Act (Injected)
    const dummy = () => {};
    const custom = getDeps({
      getCurrentBranchFn: dummy,
      switchBranchFn: dummy,
      pullChangesFn: dummy,
      pushChangesFn: dummy,
      executeGitCommandFn: dummy,
      verifyConflictsFn: dummy,
      updateServerToTestFn: dummy,
      promptFn: dummy,
    });

    // Assert (Injected)
    assert.equal(custom.getCurrentBranchFn, dummy);
    assert.equal(custom.switchBranchFn, dummy);
    assert.equal(custom.pullChangesFn, dummy);
    assert.equal(custom.pushChangesFn, dummy);
    assert.equal(custom.executeGitCommandFn, dummy);
    assert.equal(custom.verifyConflictsFn, dummy);
    assert.equal(custom.updateServerToTestFn, dummy);
    assert.equal(custom.promptFn, dummy);
  });

  await t.test("validateCleanWorktree deve passar com status vazio e lançar erro com alterações", () => {
    // Arrange: status limpo
    const cleanDeps = { executeGitCommandFn: () => "" };
    // Act & Assert: não lança
    assert.doesNotThrow(() => validateCleanWorktree(cleanDeps));

    // Arrange: status sujo
    const dirtyDeps = { executeGitCommandFn: () => " M src/index.js\n" };
    // Act & Assert: lança erro
    assert.throws(
      () => validateCleanWorktree(dirtyDeps),
      /Uncommitted changes in worktree/
    );
  });

  await t.test("validateFeatureBranch deve aceitar feature branch e rejeitar branches protegidas ou vazias", () => {
    // Act & Assert: Válidas
    assert.doesNotThrow(() => validateFeatureBranch("feature/agenda"));
    assert.doesNotThrow(() => validateFeatureBranch("fix/login-bug"));

    // Act & Assert: Inválidas / protegidas
    assert.throws(() => validateFeatureBranch("develop"), /Cannot merge protected/);
    assert.throws(() => validateFeatureBranch("teste"), /Cannot merge protected/);
    assert.throws(() => validateFeatureBranch("test"), /Cannot merge protected/);
    assert.throws(() => validateFeatureBranch("master"), /Cannot merge protected/);
    assert.throws(() => validateFeatureBranch("main"), /Cannot merge protected/);
    assert.throws(() => validateFeatureBranch(""), /Cannot merge protected/);
  });

  await t.test("getBranchDivergence deve calcular commits behind/ahead e retornar fallback 0 em caso de erro", () => {
    // Arrange: Sucesso
    const successDeps = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("git fetch")) return "";
        if (cmd.includes("HEAD..origin/develop")) return "4\n";
        if (cmd.includes("origin/develop..HEAD")) return "2\n";
        return "";
      },
    };
    // Act
    const divSuccess = getBranchDivergence("feature/agenda", "develop", successDeps);
    // Assert
    assert.deepEqual(divSuccess, { behind: 4, ahead: 2 });

    // Arrange: Falha de comando
    const errorDeps = {
      executeGitCommandFn: () => {
        throw new Error("fatal: not a git repo");
      },
    };
    // Act
    const divError = getBranchDivergence("feature/agenda", "develop", errorDeps);
    // Assert
    assert.deepEqual(divError, { behind: 0, ahead: 0 });
  });

  await t.test("syncDevelopIntoFeature deve mesclar e fazer push quando não há conflitos", async () => {
    // Arrange
    const executedCmds = [];
    let pushed = false;
    const deps = {
      executeGitCommandFn: (cmd) => {
        executedCmds.push(cmd);
        return "";
      },
      pushChangesFn: () => {
        pushed = true;
      },
    };

    // Act
    await syncDevelopIntoFeature("feature/agenda", "develop", deps);

    // Assert
    assert.ok(executedCmds.some((c) => c.includes("git merge origin/develop")));
    assert.equal(pushed, true);
  });

  await t.test("syncDevelopIntoFeature deve resolver conflito com verifyConflictsFn ou abortar se falhar", async () => {
    // Cenário 1: Conflito resolvido com sucesso
    let verifyCalled = false;
    let pushCalled = false;
    const resolvedDeps = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("git merge origin/develop")) {
          throw new Error("Merge conflict");
        }
        return "";
      },
      verifyConflictsFn: async () => {
        verifyCalled = true;
      },
      pushChangesFn: () => {
        pushCalled = true;
      },
    };

    await syncDevelopIntoFeature("feature/agenda", "develop", resolvedDeps);
    assert.equal(verifyCalled, true);
    assert.equal(pushCalled, true);

    // Cenário 2: Conflito não resolvido (usuário cancela) -> aborta merge
    let abortCalled = false;
    const unresolvedDeps = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("git merge origin/develop")) {
          throw new Error("Merge conflict");
        }
        if (cmd.includes("git merge --abort")) {
          abortCalled = true;
        }
        return "";
      },
      verifyConflictsFn: async () => {
        throw new Error("Conflicts unresolved.");
      },
      pushChangesFn: () => {},
    };

    await assert.rejects(
      () => syncDevelopIntoFeature("feature/agenda", "develop", unresolvedDeps),
      /Conflicts unresolved/
    );
    assert.equal(abortCalled, true);
  });

  await t.test("mergeFeatureIntoDevelop deve trocar para develop, puxar atualizações, fazer merge --no-ff e push", async () => {
    // Arrange
    const log = [];
    const deps = {
      switchBranchFn: (branch) => log.push(`switch:${branch}`),
      pullChangesFn: () => log.push("pull"),
      pushChangesFn: () => log.push("push"),
      executeGitCommandFn: (cmd) => {
        log.push(cmd);
        return "";
      },
    };

    // Act
    await mergeFeatureIntoDevelop("feature/agenda", "develop", deps);

    // Assert
    assert.deepEqual(log, [
      "switch:develop",
      "pull",
      'git merge --no-ff -m "Merge branch \'feature/agenda\' into develop" "feature/agenda"',
      "push",
    ]);
  });

  await t.test("mergeFeatureIntoDevelop deve tratar conflitos com verifyConflicts ou abortar e reverter branch", async () => {
    // Cenário: Conflito não resolvido no merge final para develop
    const executedCmds = [];
    let revertedToFeature = false;
    const deps = {
      switchBranchFn: (b) => {
        if (b === "feature/agenda") revertedToFeature = true;
      },
      pullChangesFn: () => {},
      pushChangesFn: () => {},
      executeGitCommandFn: (cmd) => {
        executedCmds.push(cmd);
        if (cmd.includes("git merge --no-ff")) throw new Error("Merge conflict");
        return "";
      },
      verifyConflictsFn: async () => {
        throw new Error("Conflicts unresolved.");
      },
    };

    // Act & Assert
    await assert.rejects(
      () => mergeFeatureIntoDevelop("feature/agenda", "develop", deps),
      /Conflicts unresolved/
    );
    assert.ok(executedCmds.some((c) => c.includes("git merge --abort")));
    assert.equal(revertedToFeature, true);
  });

  await t.test("promptTestServerUpdate deve acionar updateServerToTestFn quando confirmado", async () => {
    // Arrange: não confirmado
    let called = false;
    const depsNo = {
      promptFn: async () => ({ runUpdateTest: false }),
      updateServerToTestFn: async () => {
        called = true;
      },
    };
    await promptTestServerUpdate(depsNo);
    assert.equal(called, false);

    // Arrange: confirmado
    const depsYes = {
      promptFn: async () => ({ runUpdateTest: true }),
      updateServerToTestFn: async () => {
        called = true;
      },
    };
    await promptTestServerUpdate(depsYes);
    assert.equal(called, true);
  });

  await t.test("mergeFeatureToDevelop deve orquestrar fluxo completo com sincronização prévia e sucesso", async () => {
    // Arrange
    const steps = [];
    const deps = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("status --porcelain")) return "";
        if (cmd.includes("git fetch")) return "";
        if (cmd.includes("HEAD..origin/develop")) return "3\n";
        if (cmd.includes("origin/develop..HEAD")) return "1\n";
        steps.push(cmd);
        return "";
      },
      getCurrentBranchFn: () => "feature/agenda",
      switchBranchFn: (b) => steps.push(`switch:${b}`),
      pullChangesFn: () => steps.push("pull"),
      pushChangesFn: () => steps.push("push"),
      promptFn: async (questions) => {
        const qName = questions[0].name;
        if (qName === "syncDevelop") return { syncDevelop: true };
        if (qName === "runUpdateTest") return { runUpdateTest: false };
        return {};
      },
    };

    // Act
    await mergeFeatureToDevelop(deps);

    // Assert
    assert.ok(steps.includes("pull"));
    assert.ok(steps.some((s) => s.includes("git merge origin/develop")));
    assert.ok(steps.includes("switch:develop"));
    assert.ok(steps.some((s) => s.includes("git merge --no-ff")));
    assert.ok(steps.includes("push"));
  });

  await t.test("mergeFeatureToDevelop deve pular sincronização se usuário recusar syncDevelop", async () => {
    // Arrange
    const steps = [];
    const deps = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("status --porcelain")) return "";
        if (cmd.includes("git fetch")) return "";
        if (cmd.includes("HEAD..origin/develop")) return "2\n";
        if (cmd.includes("origin/develop..HEAD")) return "1\n";
        steps.push(cmd);
        return "";
      },
      getCurrentBranchFn: () => "feature/agenda",
      switchBranchFn: (b) => steps.push(`switch:${b}`),
      pullChangesFn: () => steps.push("pull"),
      pushChangesFn: () => steps.push("push"),
      promptFn: async (questions) => {
        const qName = questions[0].name;
        if (qName === "syncDevelop") return { syncDevelop: false };
        if (qName === "runUpdateTest") return { runUpdateTest: false };
        return {};
      },
    };

    // Act
    await mergeFeatureToDevelop(deps);

    // Assert: Não executou merge de origin/develop na feature
    assert.ok(!steps.some((s) => s.includes("git merge origin/develop")));
    // Mas executou o merge final na develop
    assert.ok(steps.includes("switch:develop"));
    assert.ok(steps.some((s) => s.includes("git merge --no-ff")));
  });
});
