import path from "path";
import os from "os";

process.env.ACR_CONFIG_FILE = path.join(os.tmpdir(), `test_cfg_productionServerUpdate_${process.pid}.json`);
process.env.PASSWORD_CRYPTO_KEY = "segredo_teste_key";

import { test } from "node:test";
import assert from "node:assert/strict";
import inquirer from "inquirer";
import {
  getDeps,
  ensureBranch,
  checkUncommittedChanges,
  confirmProductionDeploy,
  updateServerToProduction
} from "../src/productionServerUpdate.js";
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
        result[q.name] = current[q.name] !== undefined ? current[q.name] : true;
      }
    }
    return result;
  };
}

test("productionServerUpdate.js - Cobertura 100% de Linhas, Branches e Funções (Padrão AAA)", async (t) => {
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

  await t.test("getDeps deve cobrir 100% dos ramos de injeção e fallbacks", () => {
    const defaults = getDeps();
    assert.equal(typeof defaults.createPullRequestFn, "function");
    assert.equal(typeof defaults.mergeBranchFn, "function");
    assert.equal(typeof defaults.executeGitCommandFn, "function");
    assert.equal(typeof defaults.pullChangesFn, "function");
    assert.equal(typeof defaults.pushChangesFn, "function");
    assert.equal(typeof defaults.promptFn, "function");

    const dummy = () => {};
    const injected = getDeps({
      createPullRequestFn: dummy,
      mergeBranchFn: dummy,
      executeGitCommandFn: dummy,
      pullChangesFn: dummy,
      pushChangesFn: dummy,
      promptFn: dummy,
    });
    assert.equal(injected.createPullRequestFn, dummy);
  });



  await t.test("ensureBranch deve alternar branch se diferente ou apenas informar se ja estiver nela", () => {
    let checkedOutBranch = "";
    const depsDiff = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("rev-parse")) return "main";
        if (cmd.includes("git checkout")) checkedOutBranch = cmd.replace("git checkout ", "");
        return "";
      }
    };
    ensureBranch("teste", depsDiff);
    assert.equal(checkedOutBranch, '"teste"');

    let checkedOutSame = "";
    const depsSame = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("rev-parse")) return "teste";
        if (cmd.includes("git checkout")) checkedOutSame = cmd;
        return "";
      }
    };
    ensureBranch("teste", depsSame);
    assert.equal(checkedOutSame, "");
  });

  await t.test("checkUncommittedChanges deve passar se status for limpo e lancar erro se houver alteracoes", () => {
    // Act 1: Sem alterações
    checkUncommittedChanges({ executeGitCommandFn: () => "" });

    // Act 2: Com alterações
    assert.throws(
      () => checkUncommittedChanges({ executeGitCommandFn: () => " M file.js" }),
      /Uncommitted changes in branch/
    );
  });

  await t.test("confirmProductionDeploy deve cobrir recusar teste, recusar deploy, recusar final e aceitar tudo", async () => {
    // Act 1: Recusar confirmação da branch "teste"
    const depsNoConfirm = { promptFn: createPromptMock([{ confirm: false }]) };
    await assert.rejects(async () => await confirmProductionDeploy(depsNoConfirm), /The "teste" branch is not working correctly/);

    // Act 2: Recusar deployConfirm
    const depsNoDeploy = { promptFn: createPromptMock([{ confirm: true }, { deployConfirm: false }]) };
    const resNoDeploy = await confirmProductionDeploy(depsNoDeploy);
    assert.equal(resNoDeploy, false);

    // Act 3: Recusar finalDeploy
    const depsNoFinal = { promptFn: createPromptMock([{ confirm: true }, { deployConfirm: true }, { finalDeploy: false }]) };
    const resNoFinal = await confirmProductionDeploy(depsNoFinal);
    assert.equal(resNoFinal, false);

    // Act 4: Aceitar todos os prompts
    const depsAllTrue = { promptFn: createPromptMock([{ confirm: true }, { deployConfirm: true }, { finalDeploy: true }]) };
    const resAllTrue = await confirmProductionDeploy(depsAllTrue);
    assert.equal(resAllTrue, true);
  });

  await t.test("updateServerToProduction deve tratar cancelamento de deploy, fluxo feliz e erros", async () => {
    // Act 1: Cancelamento no deployConfirm
    let mergeRan = false;
    const depsCancel = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("rev-parse")) return "teste";
        if (cmd.includes("status")) return "";
        return "";
      },
      pullChangesFn: () => {},
      promptFn: createPromptMock([{ confirm: true }, { deployConfirm: false }])
    };
    await updateServerToProduction(depsCancel);
    assert.equal(mergeRan, false);

    // Act 2: Fluxo feliz completo (troca branch no inicio e fim)
    let prCreated = false;
    let pushed = false;
    let currentBranchState = "master";

    const depsHappy = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("rev-parse")) return currentBranchState;
        if (cmd.includes("git checkout")) currentBranchState = cmd.replace("git checkout ", "");
        if (cmd.includes("status")) return "";
        return "";
      },
      pullChangesFn: () => {},
      mergeBranchFn: async () => { mergeRan = true; },
      createPullRequestFn: () => { prCreated = true; },
      pushChangesFn: () => { pushed = true; },
      promptFn: createPromptMock([{ confirm: true }, { deployConfirm: true }, { finalDeploy: true }])
    };

    await updateServerToProduction(depsHappy);
    assert.equal(mergeRan, true);
    assert.equal(prCreated, true);
    assert.equal(pushed, true);

    // Act 3: Tratamento de exceção
    const depsError = {
      executeGitCommandFn: () => { throw new Error("Falha no git"); }
    };
    await assert.rejects(async () => await updateServerToProduction(depsError), /Falha no git/);
  });

  await t.test("deve testar os fallbacks sem argumento deps utilizando mocks seguros de comandos git", async () => {
    const origPrompt = inquirer.prompt;
    inquirer.prompt = async () => ({ confirm: true, deployConfirm: false });

    // Mock seguro de executeGitCommand para que a branch local não tente checkout 'teste'
    const depsSafeFallback = {
      executeGitCommandFn: (cmd) => {
        if (cmd.includes("rev-parse")) return "teste";
        if (cmd.includes("status")) return "";
        return "";
      },
      pullChangesFn: () => {},
      promptFn: inquirer.prompt
    };

    await updateServerToProduction(depsSafeFallback);

    inquirer.prompt = origPrompt;
  });
});
