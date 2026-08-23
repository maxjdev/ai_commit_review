// gitConflictHandlers.js
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import {
  checkConflicts,
  getConflictDiff,
  writeConflictToTempFile,
  openFileInEditor,
  updateFileFromTemp,
  executeGitCommand,
} from "./gitUtils.js";

export function getConflictDeps(deps = {}) {
  return {
    checkConflictsFn: deps.checkConflictsFn || checkConflicts,
    getConflictDiffFn: deps.getConflictDiffFn || getConflictDiff,
    writeConflictToTempFileFn: deps.writeConflictToTempFileFn || writeConflictToTempFile,
    openFileInEditorFn: deps.openFileInEditorFn || openFileInEditor,
    updateFileFromTempFn: deps.updateFileFromTempFn || updateFileFromTemp,
    executeGitCommandFn: deps.executeGitCommandFn || executeGitCommand,
    promptFn: deps.promptFn || inquirer.prompt,
  };
}

async function handleConflictResolution(resolutionOption, conflicts, deps) {
  if (resolutionOption === "manual") {
    await resolveConflictsManually(conflicts, deps);
  } else if (resolutionOption === "automatic") {
    await resolveConflictsAutomatically(conflicts, deps);
  } else {
    console.log(chalk.red("❌ Resolve the conflicts before proceeding."));
    throw new Error("Conflicts unresolved.");
  }
}

export async function verifyConflicts(deps = {}) {
  const d = getConflictDeps(deps);
  const conflicts = d.checkConflictsFn();
  if (conflicts.length === 0) {
    console.log(chalk.green("✔ No conflicts detected."));
    return;
  }

  console.log(chalk.red("❌ Conflicts detected in the following files:"));
  conflicts.forEach((file, index) => console.log(`${index + 1}. ${file}`));

  const { resolutionOption } = await d.promptFn([
    {
      type: "list",
      name: "resolutionOption",
      message: "How would you like to resolve the conflicts?",
      choices: [
        { name: "Resolve manually in an editor", value: "manual" },
        { name: "Resolve automatically using mergetool", value: "automatic" },
        { name: "Cancel and resolve later", value: "cancel" },
      ],
    },
  ]);

  await handleConflictResolution(resolutionOption, conflicts, deps);
}

export async function resolveConflictsManually(conflicts, deps = {}) {
  const d = getConflictDeps(deps);
  for (const file of conflicts) {
    console.log(chalk.yellow(`Resolving conflict for: ${file}`));
    const diff = d.getConflictDiffFn(file);
    if (!diff) continue;

    const tempFilePath = d.writeConflictToTempFileFn(file, diff);
    d.openFileInEditorFn(tempFilePath);

    const { confirmResolution } = await d.promptFn([
      {
        type: "confirm",
        name: "confirmResolution",
        message: `Have you resolved the conflict for: ${file}?`,
        default: true,
      },
    ]);

    if (confirmResolution) {
      d.updateFileFromTempFn(file, tempFilePath);
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
  }
}

export async function resolveConflictsAutomatically(conflicts, deps = {}) {
  const d = getConflictDeps(deps);
  console.log(chalk.blue("⚙️ Launching mergetool to resolve conflicts..."));
  conflicts.forEach((file) => d.executeGitCommandFn(`git mergetool -- "${file}"`));
  console.log(chalk.green("✔ Conflicts resolved using mergetool."));

  const { stageChanges } = await d.promptFn([
    {
      type: "confirm",
      name: "stageChanges",
      message: "Would you like to stage the resolved files?",
      default: true,
    },
  ]);

  if (stageChanges) {
    d.executeGitCommandFn("git add .");
  }
}
