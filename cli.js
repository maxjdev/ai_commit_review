import chalk from "chalk";
import { program } from "commander";
import inquirer from "inquirer";
import { showHelp } from "./src/helpers.js";
import { updateConfigFromString, ensureValidApiKey, resetConfig } from "./src/configManager.js";
import { analyzeCommits } from "./src/analyzeCommit.js";
import { createCommit } from "./src/createCommit.js";
import { commitStaged } from "./src/commitStaged.js";
import { criptografarcli } from "./src/crypto.js";
import { updateServerToTest } from "./src/testServerUpdate.js";
import { updateServerToProduction } from "./src/productionServerUpdate.js";
import { mergeFeatureToDevelop } from "./src/featureMerge.js";
import { diagnoseAndHandleError } from "./src/errorDiagnosticService.js";
import { handleUnknownCommand } from "./src/commandAssistant.js";
import { execSync } from "child_process";

export const commandActionMap = Object.freeze({
  analyze: analyzeCommits,
  create: createCommit,
  commit: commitStaged,
  crypto: criptografarcli,
  updateTestServer: updateServerToTest,
  updateProductionServer: updateServerToProduction,
  mergeFeature: mergeFeatureToDevelop,
  resetConfig: resetConfig,
});

export function getDeps(deps = {}) {
  return {
    handleUnknownCommandFn: deps.handleUnknownCommandFn || handleUnknownCommand,
    diagnoseAndHandleErrorFn: deps.diagnoseAndHandleErrorFn || diagnoseAndHandleError,
    execSyncFn: deps.execSyncFn || execSync,
    resetConfigFn: deps.resetConfigFn || resetConfig,
    ensureValidApiKeyFn: deps.ensureValidApiKeyFn || ensureValidApiKey,
    promptFn: deps.promptFn || inquirer.prompt,
    program: deps.program || program,
    updateConfigFromStringFn: deps.updateConfigFromStringFn || updateConfigFromString,
    commandActionMap: deps.commandActionMap || commandActionMap,
    isTesting: Boolean(deps.isTesting),
    criptografarcli: deps.criptografarcli || criptografarcli,
    analyzeCommits: deps.analyzeCommits || analyzeCommits,
    createCommit: deps.createCommit || createCommit,
    commitStaged: deps.commitStaged || commitStaged,
    updateServerToTest: deps.updateServerToTest || updateServerToTest,
    updateServerToProduction: deps.updateServerToProduction || updateServerToProduction,
    mergeFeatureToDevelop: deps.mergeFeatureToDevelop || mergeFeatureToDevelop,
    resetConfig: deps.resetConfig || resetConfig,
  };
}

export function getCommandAction(cmdName, deps = {}) {
  const d = getDeps(deps);
  const handlerMap = {
    crypto: d.criptografarcli,
    analyze: d.analyzeCommits,
    create: d.createCommit,
    commit: d.commitStaged,
    updateTestServer: d.updateServerToTest,
    updateProductionServer: d.updateServerToProduction,
    mergeFeature: d.mergeFeatureToDevelop,
    resetConfig: d.resetConfig,
  };
  return handlerMap[cmdName] || d.commandActionMap[cmdName];
}

export async function safeExecuteCommand(cmdName, asyncFn, deps = {}) {
  const d = getDeps(deps);
  let shouldRetry = true;
  while (shouldRetry) {
    try {
      await asyncFn();
      shouldRetry = false;
    } catch (error) {
      try {
        const result = await d.diagnoseAndHandleErrorFn(error, { command: `acr ${cmdName}` });
        shouldRetry = result?.action === "retry";
        if (shouldRetry) {
          console.log(chalk.blue(`\n🔄 Retrying command 'acr ${cmdName}'...\n`));
        }
      } catch (diagError) {
        console.error(chalk.red("❌ Error during diagnosis:"), diagError.message);
        shouldRetry = false;
      }
    }
  }
}

export async function checkOutdatedLib(deps = {}) {
  const d = getDeps(deps);
  try {
    console.log(chalk.blue("Checking if 'ai-commit-review' lib is up to date..."));
    let outdatedData = "";
    try {
      outdatedData = d.execSyncFn("npm outdated -g ai-commit-review --json", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }) || "";
    } catch (error) {
      outdatedData = error.stdout || "";
    }

    if (outdatedData.toString().trim()) {
      const outdated = JSON.parse(outdatedData);
      if (Object.keys(outdated).length > 0) {
        console.log(chalk.yellow("'ai-commit-review' lib is outdated. Updating..."));
        await d.resetConfigFn();
        d.execSyncFn("npm update -g ai-commit-review", { stdio: "inherit" });
        console.log(chalk.green("'ai-commit-review' lib updated successfully."));
        if (!d.isTesting) process.exit(0);
        return;
      }
    }
    console.log(chalk.green("'ai-commit-review' lib is already up to date."));
  } catch (error) {
    console.error(chalk.red("Error checking 'ai-commit-review' lib updates:"), error.message);
  }
}

export function registerCliCommands(prog, deps = {}) {
  const d = getDeps(deps);
  if (typeof prog.exitOverride === "function") prog.exitOverride();
  if (typeof prog.configureOutput === "function") prog.configureOutput({ writeErr: () => {} });
  prog.helpInformation = showHelp;
  prog.name("acr").description("A tool to analyze commits and create new ones with AI assistance");

  prog.command("crypto").description("Encrypt and decrypt text").action(() => safeExecuteCommand("crypto", getCommandAction("crypto", deps), deps));
  prog.command("analyze").description("Analyze commits").action(() => safeExecuteCommand("analyze", getCommandAction("analyze", deps), deps));
  prog.command("create").description("Create a new commit").action(() => safeExecuteCommand("create", getCommandAction("create", deps), deps));
  prog.command("commit").description("Commit staged changes").action(() => safeExecuteCommand("commit", getCommandAction("commit", deps), deps));
  prog.command("updateTestServer").description("Update server to test").action(() => safeExecuteCommand("updateTestServer", getCommandAction("updateTestServer", deps), deps));
  prog.command("updateProductionServer").description("Update server to production").action(() => safeExecuteCommand("updateProductionServer", getCommandAction("updateProductionServer", deps), deps));
  prog.command("mergeFeature").description("Merge feature branch into develop").action(() => safeExecuteCommand("mergeFeature", getCommandAction("mergeFeature", deps), deps));
  prog.command("resetConfig").description("Reset configuration to defaults").action(() => safeExecuteCommand("resetConfig", getCommandAction("resetConfig", deps), deps));
  prog.command("set_config <keyValue>").description("Update configurations with KEY=VALUE").action((keyValue) => {
    try {
      d.updateConfigFromStringFn(keyValue);
    } catch (error) {
      console.error(chalk.red("❌ Error updating configuration:", error.message));
    }
  });
}

export async function runInteractiveMenu(deps = {}) {
  const d = getDeps(deps);
  console.log(chalk.yellow("⚠️ No command provided."));
  const { command } = await d.promptFn([
    {
      type: "list",
      name: "command",
      message: "What do you want to do?",
      choices: [
        { name: "Analyze commits", value: "analyze" },
        { name: "Create a new commit", value: "create" },
        { name: "Commit staged changes", value: "commit" },
        { name: "Encrypt/Decrypt text", value: "crypto" },
        { name: "Update server to test", value: "updateTestServer" },
        { name: "Update server to production", value: "updateProductionServer" },
        { name: "Merge feature branch into develop", value: "mergeFeature" },
        { name: "Reset configuration", value: "resetConfig" },
      ],
    },
  ]);

  const action = d.commandActionMap[command];
  if (action) {
    await safeExecuteCommand(command, action, deps);
  }
}

export async function runCliFlow(argv = process.argv, deps = {}) {
  const d = getDeps(deps);
  process.noDeprecation = true;
  await checkOutdatedLib(deps);

  if (!argv.includes("set_config") && !argv.includes("crypto")) {
    await d.ensureValidApiKeyFn();
  }

  const prog = d.program;
  registerCliCommands(prog, deps);

  if (!argv.slice(2).length) {
    await runInteractiveMenu(deps);
  } else {
    try {
      prog.parse(argv);
    } catch (err) {
      if (err?.code === "commander.unknownCommand" || err?.code === "commander.unknownOption") {
        const unknownCmd = argv[2] || "unknown";
        await d.handleUnknownCommandFn(unknownCmd, {
          ...deps,
          safeExecuteCommandFn: safeExecuteCommand,
          commandActionMap: d.commandActionMap,
        });
      } else if (err?.code !== "commander.helpDisplayed" && err?.code !== "commander.version") {
        throw err;
      }
    }
  }
}

export function isMainExecution(argv1 = process.argv[1]) {
  if (!argv1) return false;
  return (
    argv1.endsWith("cli.js") ||
    argv1.endsWith("bundle.cjs") ||
    argv1.endsWith("acr")
  );
}

export async function main(argv = process.argv, deps = {}) {
  if (isMainExecution(argv[1])) {
    await runCliFlow(argv, deps);
  }
}

main();
