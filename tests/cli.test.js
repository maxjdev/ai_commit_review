import { test } from "node:test";
import assert from "node:assert/strict";
import {
  safeExecuteCommand,
  checkOutdatedLib,
  getCommandAction,
  registerCliCommands,
  runInteractiveMenu,
  runCliFlow,
  isMainExecution,
  main,
  getDeps,
} from "../cli.js";

test("cli.js - Cobertura 100% de safeExecuteCommand e Auto-Recovery (Padrão AAA)", async (t) => {
  await t.test("getDeps deve retornar dependências padrão e injetadas", () => {
    const defaultDeps = getDeps();
    assert.equal(typeof defaultDeps.handleUnknownCommandFn, "function");
    assert.equal(typeof defaultDeps.diagnoseAndHandleErrorFn, "function");
    assert.equal(typeof defaultDeps.execSyncFn, "function");
    assert.equal(typeof defaultDeps.resetConfigFn, "function");
    assert.equal(typeof defaultDeps.ensureValidApiKeyFn, "function");
    assert.equal(typeof defaultDeps.promptFn, "function");
    assert.equal(typeof defaultDeps.updateConfigFromStringFn, "function");
    assert.equal(typeof defaultDeps.criptografarcli, "function");
    assert.equal(typeof defaultDeps.analyzeCommits, "function");
    assert.equal(typeof defaultDeps.createCommit, "function");
    assert.equal(typeof defaultDeps.commitStaged, "function");
    assert.equal(typeof defaultDeps.updateServerToTest, "function");
    assert.equal(typeof defaultDeps.updateServerToProduction, "function");
    assert.equal(typeof defaultDeps.executeMergeFlow, "function");
    assert.equal(typeof defaultDeps.resetConfig, "function");
    assert.equal(defaultDeps.isTesting, false);

    const customDeps = getDeps({
      handleUnknownCommandFn: "unknownHandler",
      diagnoseAndHandleErrorFn: "diag",
      execSyncFn: "exec",
      resetConfigFn: "reset",
      ensureValidApiKeyFn: "ensure",
      promptFn: "prompt",
      program: "prog",
      updateConfigFromStringFn: "updateCfg",
      commandActionMap: { custom: "action" },
      isTesting: true,
      criptografarcli: "crypto",
      analyzeCommits: "analyze",
      createCommit: "create",
      commitStaged: "commit",
      updateServerToTest: "testServ",
      updateServerToProduction: "prodServ",
      executeMergeFlow: "mergeFlow",
      resetConfig: "resetCfg",
    });
    assert.equal(customDeps.handleUnknownCommandFn, "unknownHandler");
    assert.equal(customDeps.diagnoseAndHandleErrorFn, "diag");
    assert.equal(customDeps.execSyncFn, "exec");
    assert.equal(customDeps.isTesting, true);
    assert.equal(customDeps.commandActionMap.custom, "action");
    assert.equal(customDeps.executeMergeFlow, "mergeFlow");
  });

  await t.test("getCommandAction deve retornar handlers padrão e injetados", () => {
    // Com injeção
    assert.equal(getCommandAction("crypto", { criptografarcli: "custom" }), "custom");
    assert.equal(getCommandAction("analyze", { analyzeCommits: "custom" }), "custom");
    assert.equal(getCommandAction("create", { createCommit: "custom" }), "custom");
    assert.equal(getCommandAction("commit", { commitStaged: "custom" }), "custom");
    assert.equal(getCommandAction("updateTestServer", { updateServerToTest: "custom" }), "custom");
    assert.equal(getCommandAction("updateProductionServer", { updateServerToProduction: "custom" }), "custom");
    assert.equal(getCommandAction("mergeBranch", { executeMergeFlow: "custom" }), "custom");
    assert.equal(getCommandAction("resetConfig", { resetConfig: "custom" }), "custom");

    // Sem injeção (padrão)
    assert.equal(typeof getCommandAction("crypto"), "function");
    assert.equal(typeof getCommandAction("analyze"), "function");
    assert.equal(typeof getCommandAction("create"), "function");
    assert.equal(typeof getCommandAction("commit"), "function");
    assert.equal(typeof getCommandAction("updateTestServer"), "function");
    assert.equal(typeof getCommandAction("updateProductionServer"), "function");
    assert.equal(typeof getCommandAction("mergeBranch"), "function");
    assert.equal(typeof getCommandAction("resetConfig"), "function");

    // Comando desconhecido (sem e com fallback)
    assert.equal(getCommandAction("unknown_cmd"), undefined);
    assert.equal(getCommandAction("unknown_cmd", { commandActionMap: { unknown_cmd: "fallbackAction" } }), "fallbackAction");
  });
  await t.test("safeExecuteCommand deve executar função com sucesso sem erros", async () => {
    // Arrange
    let executed = false;
    const asyncFn = async () => { executed = true; };

    // Act
    await safeExecuteCommand("testCmd", asyncFn);

    // Assert
    assert.equal(executed, true);
  });

  await t.test("safeExecuteCommand deve capturar erro e chamar diagnoseAndHandleError", async () => {
    // Arrange
    let diagnosedError = null;
    let contextPassed = null;
    const mockDeps = {
      diagnoseAndHandleErrorFn: async (err, ctx) => {
        diagnosedError = err;
        contextPassed = ctx;
        return { action: "cancel" };
      },
    };
    const failingFn = async () => { throw new Error("Command failed"); };

    // Act
    await safeExecuteCommand("create", failingFn, mockDeps);

    // Assert
    assert.equal(diagnosedError.message, "Command failed");
    assert.equal(contextPassed.command, "acr create");
  });

  await t.test("safeExecuteCommand deve reexecutar comando quando diagnose retornar retry", async () => {
    // Arrange
    let executionCount = 0;
    const mockDeps = {
      diagnoseAndHandleErrorFn: async () => {
        return { action: "retry" };
      },
    };
    const retryFn = async () => {
      executionCount++;
      if (executionCount === 1) {
        throw new Error("First attempt failure");
      }
      return "Success on attempt 2";
    };

    // Act
    await safeExecuteCommand("commit", retryFn, mockDeps);

    // Assert
    assert.equal(executionCount, 2);
  });

  await t.test("safeExecuteCommand deve tratar falha dentro do próprio diagnósticador sem quebrar", async () => {
    // Arrange
    const mockDeps = {
      diagnoseAndHandleErrorFn: async () => {
        throw new Error("Diagnosis crash");
      },
    };
    const failingFn = async () => { throw new Error("Original failure"); };

    // Act & Assert
    await assert.doesNotReject(async () => {
      await safeExecuteCommand("analyze", failingFn, mockDeps);
    });
  });

  await t.test("checkOutdatedLib deve lidar com pacotes atualizados, desatualizados e erros de npm", async () => {
    // Act 1: Atualizado
    await checkOutdatedLib({
      execSyncFn: () => "{}",
    });

    // Act 2: Desatualizado
    let updated = false;
    let configReset = false;
    await checkOutdatedLib({
      execSyncFn: (cmd) => {
        if (cmd.includes("npm outdated")) return JSON.stringify({ "ai-commit-review": { current: "1.0", latest: "1.1" } });
        if (cmd.includes("npm update")) updated = true;
      },
      resetConfigFn: async () => { configReset = true; },
      isTesting: true,
    });
    assert.equal(updated, true);
    assert.equal(configReset, true);

    // Act 3: Erro de parse JSON ou throw de execSync
    await checkOutdatedLib({
      execSyncFn: () => { throw new Error("NPM network fail"); },
    });

    // Act 4: Throw durante resetConfigFn para cobrir o catch externo (linhas 65-66)
    await checkOutdatedLib({
      execSyncFn: (cmd) => {
        if (cmd.includes("npm outdated")) return JSON.stringify({ "ai-commit-review": { current: "1.0", latest: "1.1" } });
      },
      resetConfigFn: async () => { throw new Error("Reset config fail"); },
      isTesting: true,
    });
  });

  await t.test("registerCliCommands deve registrar comandos e permitir executar callbacks", async () => {
    const actions = {};
    const mockProgram = {
      command: (name) => {
        const cmdName = name.split(" ")[0];
        return {
          description: () => ({
            action: (fn) => { actions[cmdName] = fn; },
          }),
        };
      },
      name: () => mockProgram,
      description: () => mockProgram,
    };

    const mockDeps = {
      diagnoseAndHandleErrorFn: async () => ({ action: "cancel" }),
      criptografarcli: async () => {},
      analyzeCommits: async () => {},
      createCommit: async () => {},
      commitStaged: async () => {},
      updateServerToTest: async () => {},
      updateServerToProduction: async () => {},
      executeMergeFlow: async () => {},
      resetConfig: async () => {},
    };

    registerCliCommands(mockProgram, mockDeps);
    assert.ok(typeof actions["crypto"] === "function");
    assert.ok(typeof actions["analyze"] === "function");
    assert.ok(typeof actions["create"] === "function");
    assert.ok(typeof actions["commit"] === "function");
    assert.ok(typeof actions["updateTestServer"] === "function");
    assert.ok(typeof actions["updateProductionServer"] === "function");
    assert.ok(typeof actions["mergeBranch"] === "function");
    assert.ok(typeof actions["resetConfig"] === "function");
    assert.ok(typeof actions["set_config"] === "function");

    // Executa todos os callbacks registrados
    await actions["crypto"]();
    await actions["analyze"]();
    await actions["create"]();
    await actions["commit"]();
    await actions["updateTestServer"]();
    await actions["updateProductionServer"]();
    await actions["mergeBranch"]();
    await actions["resetConfig"]();

    // Invoca set_config válido e inválido
    actions["set_config"]("OPENAI_RESPONSE_LANGUAGE=pt-BR");
    actions["set_config"]("INVALID_FORMAT");
  });

  await t.test("runInteractiveMenu deve executar comando e tratar ação desconhecida", async () => {
    let executedAction = "";
    const mockDeps = {
      promptFn: async () => ({ command: "customAction" }),
      commandActionMap: {
        customAction: async () => { executedAction = "customAction_ran"; },
      },
      diagnoseAndHandleErrorFn: async () => ({ action: "cancel" }),
    };

    await runInteractiveMenu(mockDeps);
    assert.equal(executedAction, "customAction_ran");

    // Ação desconhecida / não mapeada
    const mockDepsUnknown = {
      promptFn: async () => ({ command: "unknown_cmd" }),
      commandActionMap: {},
    };
    await runInteractiveMenu(mockDepsUnknown);
  });

  await t.test("runCliFlow e isMainExecution devem validar argv e controle de execução", async () => {
    // isMainExecution com e sem argumentos
    assert.equal(isMainExecution("C:/path/to/cli.js"), true);
    assert.equal(isMainExecution("C:/path/to/bundle.cjs"), true);
    assert.equal(isMainExecution("C:/path/to/acr"), true);
    assert.equal(isMainExecution("C:/path/to/other.js"), false);
    assert.equal(isMainExecution(null), false);
    assert.equal(typeof isMainExecution(), "boolean");

    // main sem argumentos
    await main();

    // runCliFlow com set_config e crypto
    let keyChecked = false;
    const mockDeps = {
      ensureValidApiKeyFn: async () => { keyChecked = true; },
      program: {
        command: () => ({ description: () => ({ action: () => {} }) }),
        name: () => mockDeps.program,
        description: () => mockDeps.program,
        parse: () => {},
      },
      execSyncFn: () => "{}",
      promptFn: async () => ({ command: "analyze" }),
      commandActionMap: { analyze: async () => {} },
    };

    await runCliFlow(["node", "cli.js", "set_config", "KEY=VAL"], mockDeps);
    assert.equal(keyChecked, false);

    await runCliFlow(["node", "cli.js", "crypto"], mockDeps);
    assert.equal(keyChecked, false);

    // runCliFlow sem argumentos adicionais
    await runCliFlow(["node", "cli.js"], mockDeps);
    assert.equal(keyChecked, true);

    // main executa quando for o entrypoint
    await main(["node", "cli.js"], mockDeps);

    // main não executa se não for o entrypoint
    await main(["node", "some_other_test.js"], mockDeps);
  });

  await t.test("deve cobrir fallbacks padrão de cli.js quando deps for omitido", async () => {
    // registerCliCommands sem deps
    const actions = {};
    const mockProgram = {
      command: (name) => {
        const cmdName = name.split(" ")[0];
        return {
          description: () => ({
            action: (fn) => { actions[cmdName] = fn; },
          }),
        };
      },
      name: () => mockProgram,
      description: () => mockProgram,
    };
    registerCliCommands(mockProgram);
    if (typeof actions["set_config"] === "function") {
      actions["set_config"]("OPENAI_RESPONSE_LANGUAGE=pt-BR");
      actions["set_config"]("INVALID");
    }

    // safeExecuteCommand com sucesso sem deps
    await safeExecuteCommand("noop", async () => {});

    // checkOutdatedLib com execSync retornando undefined (cobre || "")
    await checkOutdatedLib({
      execSyncFn: () => undefined,
    });

    // checkOutdatedLib com erro de execSync que não tem stdout
    await checkOutdatedLib({
      execSyncFn: () => {
        const err = new Error("No stdout error");
        throw err;
      },
    });

    // checkOutdatedLib com erro de execSync que tem stdout com objeto vazio
    await checkOutdatedLib({
      execSyncFn: () => {
        const err = new Error("With empty stdout");
        err.stdout = "{}";
        throw err;
      },
    });

    // checkOutdatedLib com erro de execSync que tem stdout com pacote desatualizado
    let updatedViaStdout = false;
    await checkOutdatedLib({
      execSyncFn: (cmd) => {
        if (cmd.includes("npm outdated")) {
          const err = new Error("Outdated error");
          err.stdout = JSON.stringify({ "ai-commit-review": { current: "1.0", latest: "1.1" } });
          throw err;
        }
        if (cmd.includes("npm update")) updatedViaStdout = true;
      },
      resetConfigFn: async () => {},
      isTesting: true,
    });
    assert.equal(updatedViaStdout, true);

    // safeExecuteCommand com erro capturado e diagnose retornando nulo / cancel
    await safeExecuteCommand("analyze", async () => { throw new Error("Failing"); }, {
      diagnoseAndHandleErrorFn: async () => null,
    });

    // runCliFlow com argumento adicional (cobre prog.parse)
    let parseCalled = false;
    await runCliFlow(["node", "cli.js", "analyze"], {
      ensureValidApiKeyFn: async () => {},
      program: {
        command: () => ({ description: () => ({ action: () => {} }) }),
        name: () => mockProgram,
        description: () => mockProgram,
        parse: () => { parseCalled = true; },
      },
      execSyncFn: () => "{}",
    });
    assert.equal(parseCalled, true);

    // checkOutdatedLib com !deps.isTesting chamando process.exit(0)
    const originalExit = process.exit;
    let exitCalled = false;
    process.exit = () => { exitCalled = true; };
    try {
      await checkOutdatedLib({
        execSyncFn: (cmd) => {
          if (cmd.includes("npm outdated")) {
            return JSON.stringify({ "ai-commit-review": { current: "1.0", latest: "1.1" } });
          }
        },
        resetConfigFn: async () => {},
      });
      assert.equal(exitCalled, true);
    } finally {
      process.exit = originalExit;
    }

    // main executa fluxo quando for entrypoint
    let mainFlowRan = false;
    await main(["node", "cli.js", "crypto"], {
      ensureValidApiKeyFn: async () => {},
      program: {
        command: () => ({ description: () => ({ action: () => {} }) }),
        name: () => mockProgram,
        description: () => mockProgram,
        parse: () => { mainFlowRan = true; },
      },
      execSyncFn: () => "{}",
    });
    assert.equal(mainFlowRan, true);

    // safeExecuteCommand com action auto_fix (não retenta)
    await safeExecuteCommand("test", async () => { throw new Error("Auto fix error"); }, {
      diagnoseAndHandleErrorFn: async () => ({ action: "auto_fix" }),
    });

    // set_config com updateConfigFromStringFn customizado que lança exceção
    const actionsCustom = {};
    const mockProgCustom = {
      command: (name) => {
        const cmdName = name.split(" ")[0];
        return {
          description: () => ({
            action: (fn) => { actionsCustom[cmdName] = fn; },
          }),
        };
      },
      name: () => mockProgCustom,
      description: () => mockProgCustom,
    };
    registerCliCommands(mockProgCustom, {
      updateConfigFromStringFn: () => { throw new Error("Injected set_config failure"); },
    });
    if (typeof actionsCustom["set_config"] === "function") {
      actionsCustom["set_config"]("ANY=VALUE");
    }

    // runInteractiveMenu usando mock action map
    await runInteractiveMenu({
      promptFn: async () => ({ command: "testCmd" }),
      commandActionMap: { testCmd: async () => {} },
      diagnoseAndHandleErrorFn: async () => ({ action: "cancel" }),
    });

    // runCliFlow com comando desconhecido (commander.unknownCommand)
    let handledUnknownCmd = "";
    const mockProgUnknown = {
      command: () => ({ description: () => ({ action: () => {} }) }),
      name: () => mockProgUnknown,
      description: () => mockProgUnknown,
      parse: () => {
        const err = new Error("unknown command 'teste'");
        err.code = "commander.unknownCommand";
        throw err;
      },
    };
    await runCliFlow(["node", "cli.js", "teste"], {
      ensureValidApiKeyFn: async () => {},
      program: mockProgUnknown,
      execSyncFn: () => "{}",
      handleUnknownCommandFn: async (cmd) => {
        handledUnknownCmd = cmd;
      },
    });
    assert.equal(handledUnknownCmd, "teste");

    // runCliFlow com opção desconhecida (commander.unknownOption) e argv com string vazia
    let handledUnknownOpt = "";
    const mockProgUnknownOpt = {
      command: () => ({ description: () => ({ action: () => {} }) }),
      name: () => mockProgUnknownOpt,
      description: () => mockProgUnknownOpt,
      parse: () => {
        const err = new Error("unknown option '--foo'");
        err.code = "commander.unknownOption";
        throw err;
      },
    };
    await runCliFlow(["node", "cli.js", ""], {
      ensureValidApiKeyFn: async () => {},
      program: mockProgUnknownOpt,
      execSyncFn: () => "{}",
      handleUnknownCommandFn: async (cmd) => {
        handledUnknownOpt = cmd;
      },
    });
    assert.equal(handledUnknownOpt, "unknown");

    // runCliFlow com helpDisplayed (não relança erro)
    const mockProgHelp = {
      command: () => ({ description: () => ({ action: () => {} }) }),
      name: () => mockProgHelp,
      description: () => mockProgHelp,
      parse: () => {
        const err = new Error("help displayed");
        err.code = "commander.helpDisplayed";
        throw err;
      },
    };
    await assert.doesNotReject(async () => {
      await runCliFlow(["node", "cli.js", "--help"], {
        ensureValidApiKeyFn: async () => {},
        program: mockProgHelp,
        execSyncFn: () => "{}",
      });
    });

    // runCliFlow com erro genérico do Commander (deve relançar erro)
    const mockProgCrash = {
      command: () => ({ description: () => ({ action: () => {} }) }),
      name: () => mockProgCrash,
      description: () => mockProgCrash,
      parse: () => {
        const err = new Error("Parser critical error");
        err.code = "commander.otherError";
        throw err;
      },
    };
    await assert.rejects(async () => {
      await runCliFlow(["node", "cli.js", "crash"], {
        ensureValidApiKeyFn: async () => {},
        program: mockProgCrash,
        execSyncFn: () => "{}",
      });
    }, /Parser critical error/);
  });
});


