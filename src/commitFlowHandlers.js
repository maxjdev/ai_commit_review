// commitFlowHandlers.js
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import os from "os";
import {
  getCurrentBranch,
  listBranches,
  switchBranch,
  commitChangesWithEditor,
  commitDirectlyWithMessageFile,
  undoLastCommitSoft,
} from "./gitUtils.js";
import { analyzeUpdatedCode } from "./openaiUtils.js";
import { buildContextForFiles } from "./contextManager.js";
import { PromptType } from "./models.js";
import { diagnoseAndHandleError } from "./errorDiagnosticService.js";

export {
  verifyConflicts,
  resolveConflictsManually,
  resolveConflictsAutomatically,
} from "./gitConflictHandlers.js";

export function getDeps(deps = {}) {
  return {
    getCurrentBranchFn: deps.getCurrentBranchFn || getCurrentBranch,
    listBranchesFn: deps.listBranchesFn || listBranches,
    switchBranchFn: deps.switchBranchFn || switchBranch,
    commitChangesWithEditorFn: deps.commitChangesWithEditorFn || commitChangesWithEditor,
    commitDirectlyWithMessageFileFn: deps.commitDirectlyWithMessageFileFn || commitDirectlyWithMessageFile,
    diagnoseAndHandleErrorFn: deps.diagnoseAndHandleErrorFn || diagnoseAndHandleError,
    undoLastCommitSoftFn: deps.undoLastCommitSoftFn || undoLastCommitSoft,
    buildContextForFilesFn: deps.buildContextForFilesFn || buildContextForFiles,
    analyzeUpdatedCodeFn: deps.analyzeUpdatedCodeFn || analyzeUpdatedCode,
    promptFn: deps.promptFn || inquirer.prompt,
  };
}

export async function confirmOrSwitchBranch(deps = {}) {
  const d = getDeps(deps);
  const currentBranch = d.getCurrentBranchFn();
  console.log(chalk.blue(`You are currently on the branch: ${currentBranch}`));

  const { continueOnBranch } = await d.promptFn([
    {
      type: "confirm",
      name: "continueOnBranch",
      message: "Do you want to continue working on this branch?",
      default: true,
    },
  ]);

  if (!continueOnBranch) {
    const branches = d.listBranchesFn();
    const { selectedBranch } = await d.promptFn([
      {
        type: "list",
        name: "selectedBranch",
        message: "Select the branch to switch to:",
        choices: branches,
      },
    ]);
    d.switchBranchFn(selectedBranch);
  }
}

async function generateInitialMessage(messageOption, stagedFiles, d) {
  if (messageOption === "cancel") {
    throw new Error("Commit process canceled by user.");
  }
  if (messageOption === "ai") {
    console.log(chalk.blue("📤 Generating commit message with AI..."));
    const condensed = await d.buildContextForFilesFn(stagedFiles, PromptType.CREATE);
    return d.analyzeUpdatedCodeFn(condensed, PromptType.CREATE);
  }
  const { manualMessage } = await d.promptFn([
    {
      type: "input",
      name: "manualMessage",
      message: "Enter your commit message:",
      validate: (input) => (input.trim() === "" ? "Cannot be empty." : true),
    },
  ]);
  return manualMessage;
}

async function handleEditorFailure(err, tempFile, commitMessage, d) {
  console.log(chalk.yellow("\n⚠️ Editor could not be launched."));
  const { fallbackChoice } = await d.promptFn([
    {
      type: "list",
      name: "fallbackChoice",
      message: "The editor failed to open. How would you like to proceed?",
      choices: [
        { name: "⚡ Commit directly with the AI message (no editor)", value: "direct" },
        { name: "🧠 Diagnose error with AI & Fix Git editor", value: "diagnose" },
        { name: "📝 Enter commit message in terminal", value: "manual" },
        { name: "❌ Cancel commit", value: "cancel" },
      ],
    },
  ]);

  if (fallbackChoice === "direct") {
    d.commitDirectlyWithMessageFileFn(tempFile);
    return commitMessage;
  }
  if (fallbackChoice === "diagnose") {
    await d.diagnoseAndHandleErrorFn(err, { command: "git commit --edit" });
    d.commitChangesWithEditorFn(tempFile);
    return fs.readFileSync(tempFile, { encoding: "utf-8" }).trim();
  }
  if (fallbackChoice === "manual") {
    const { manualMsg } = await d.promptFn([
      {
        type: "input",
        name: "manualMsg",
        message: "Enter your commit message:",
        default: commitMessage,
      },
    ]);
    fs.writeFileSync(tempFile, manualMsg, { encoding: "utf-8" });
    d.commitDirectlyWithMessageFileFn(tempFile);
    return manualMsg;
  }
  throw new Error("Commit process canceled by user.");
}

async function editMessageInTempFile(commitMessage, d) {
  const rand = Math.random().toString(36).slice(2);
  const tempFile = path.join(os.tmpdir(), `commit_msg_${process.pid}_${Date.now()}_${rand}.txt`);
  try {
    fs.writeFileSync(tempFile, commitMessage, { encoding: "utf-8" });
    try {
      d.commitChangesWithEditorFn(tempFile);
    } catch (editorErr) {
      return await handleEditorFailure(editorErr, tempFile, commitMessage, d);
    }
    return fs.readFileSync(tempFile, { encoding: "utf-8" }).trim();
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

export async function obtainCommitMessage(stagedFiles, deps = {}) {
  const d = getDeps(deps);
  let commitMessage = "";
  let finalMessageGenerated = false;

  while (!finalMessageGenerated) {
    const { messageOption } = await d.promptFn([
      {
        type: "list",
        name: "messageOption",
        message: "How would you like to proceed with the commit message?",
        choices: [
          { name: "Generate with AI and edit", value: "ai" },
          { name: "Write my own", value: "manual" },
          { name: "Cancel", value: "cancel" },
        ],
      },
    ]);

    commitMessage = await generateInitialMessage(messageOption, stagedFiles, d);
    const updatedMessage = await editMessageInTempFile(commitMessage, d);

    if (updatedMessage) {
      commitMessage = updatedMessage;
      finalMessageGenerated = true;
    } else {
      console.log(chalk.red("❌ Commit message is empty."));
    }
  }

  return commitMessage;
}

export async function handleCommitAbortOrPush(deps = {}) {
  const d = getDeps(deps);
  const { abortCommit } = await d.promptFn([
    {
      type: "confirm",
      name: "abortCommit",
      message: "Do you want to abort the commit and undo all changes?",
      default: false,
    },
  ]);

  if (abortCommit) {
    d.undoLastCommitSoftFn();
    console.log(chalk.yellow("⚠️ Commit aborted. Changes returned to unstaged."));
    return false;
  }
  return true;
}
