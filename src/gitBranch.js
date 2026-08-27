// gitBranch.js
import { execSync } from "child_process";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import os from "os";
import { executeGitCommand } from "./gitCore.js";

export function getDeps(deps = {}) {
  return {
    executeGitCommandFn: deps.executeGitCommandFn || executeGitCommand,
    execSyncFn: deps.execSyncFn || execSync,
    editor: deps.editor || process.env.EDITOR || "vim"
  };
}

/**
 * Gets the current branch name.
 */
export function getCurrentBranch(deps = {}) {
  const d = getDeps(deps);
  try {
    return d.executeGitCommandFn("git branch --show-current", deps);
  } catch (error) {
    console.error(chalk.red("❌ Error retrieving current branch:"), error.message);
    return "unknown";
  }
}

/**
 * Lists all local branch names.
 */
export function listBranches(deps = {}) {
  const d = getDeps(deps);
  try {
    const output = d.executeGitCommandFn("git branch --list", deps);
    if (!output) return [];
    return output
      .split("\n")
      .map((branch) => branch.trim().replace("* ", ""));
  } catch (error) {
    console.error(chalk.red("❌ Error listing branches:"), error.message);
    return [];
  }
}

export function isNoTrackingError(errorMessage = "") {
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes("no tracking information") ||
    msg.includes("has no upstream branch") ||
    msg.includes("couldn't find remote ref")
  );
}

/**
 * Pulls latest changes from remote.
 */
export function pullChanges(deps = {}) {
  const d = getDeps(deps);
  try {
    d.executeGitCommandFn("git pull --no-rebase", deps);
    console.log(chalk.green("✔ Pulled latest changes from remote."));
  } catch (error) {
    if (isNoTrackingError(error.message || String(error))) {
      console.log(chalk.yellow("ℹ️ Local branch has no remote tracking yet (skipping pull)."));
      return;
    }
    console.error(chalk.red("❌ Error pulling changes:"), error.message);
    throw error;
  }
}

/**
 * Pushes changes to remote.
 */
export function pushChanges(deps = {}) {
  const d = getDeps(deps);
  try {
    d.executeGitCommandFn("git push", deps);
    console.log(chalk.green("✔ Changes successfully pushed to remote repository!"));
  } catch (error) {
    console.error(chalk.red("❌ Error pushing changes:"), error.message);
    throw error;
  }
}

function saveStashAndPull(originalBranch, deps, d) {
  let hadStash = false;
  const statusOutput = (d.executeGitCommandFn("git status --porcelain", deps) || "").toString().trim();
  if (statusOutput.length > 0) {
    console.log(chalk.blue("ℹ️ Saving uncommitted changes with stash..."));
    d.executeGitCommandFn("git stash", deps);
    hadStash = true;
  }

  console.log(chalk.blue("ℹ️ Updating current branch with git pull..."));
  d.executeGitCommandFn("git pull --no-rebase", deps);
  return hadStash;
}

/**
 * Switches to a target branch handling stashes cleanly.
 */
export function switchBranch(branch, deps = {}) {
  const d = getDeps(deps);
  if (typeof branch !== "string" || !branch.trim()) {
    console.error(chalk.red("❌ Branch name is required and must be non-empty."));
    return;
  }

  const originalBranch = (d.executeGitCommandFn("git rev-parse --abbrev-ref HEAD", deps) || "").toString().trim();

  try {
    const hadStash = saveStashAndPull(originalBranch, deps, d);

    d.executeGitCommandFn(`git checkout "${branch}"`, deps);
    console.log(chalk.green(`✔ Switched to branch '${branch}' successfully.`));

    console.log(chalk.blue("ℹ️ Updating target branch with git pull..."));
    d.executeGitCommandFn("git pull --no-rebase", deps);

    if (hadStash) {
      restoreStashOrRollback(originalBranch, deps);
    }
  } catch (error) {
    console.error(chalk.red(`❌ Error switching to branch '${branch}':`), error.message || error);
    throw error;
  }
}

export function restoreStashOrRollback(originalBranch, deps = {}) {
  const d = getDeps(deps);
  console.log(chalk.blue("ℹ️ Reapplying stash changes..."));
  try {
    d.executeGitCommandFn("git stash pop", deps);
  } catch (stashError) {
    console.error(chalk.red("❌ Conflicts detected reapplying stash. Reverting..."));
    d.executeGitCommandFn(`git checkout "${originalBranch}"`, deps);
    d.executeGitCommandFn("git pull --no-rebase", deps);
    try {
      d.executeGitCommandFn("git stash pop", deps);
    } catch (restoreError) {
      throw restoreError;
    }
    throw stashError;
  }
}

/**
 * Merges a branch into another branch always creating a merge commit (--no-ff),
 * syncing both branches with the remote before and after the merge.
 */
export async function mergeBranch(fromBranch, toBranch, deps = {}) {
  const d = getDeps(deps);
  switchBranch(fromBranch, deps);
  pushChanges(deps);
  switchBranch(toBranch, deps);
  d.executeGitCommandFn(`git merge --no-ff --no-edit "${fromBranch}"`, deps);
  console.log(chalk.green(`Merge of ${fromBranch} into ${toBranch} completed.`));
  pullChanges(deps);
  pushChanges(deps);
}

/**
 * Checks for conflict files in status.
 */
export function checkConflicts(deps = {}) {
  const d = getDeps(deps);
  try {
    const status = d.executeGitCommandFn("git status --short", deps);
    if (!status) return [];
    return status
      .split("\n")
      .filter((line) => line.startsWith("UU"))
      .map((line) => line.replace("UU ", "").trim());
  } catch (error) {
    console.error(chalk.red("❌ Error checking conflicts:"), error.message);
    return [];
  }
}

/**
 * Gets diff output for conflict file.
 */
export function getConflictDiff(file, deps = {}) {
  const d = getDeps(deps);
  try {
    return d.executeGitCommandFn(`git diff "${file}"`, deps);
  } catch (error) {
    console.error(chalk.red(`❌ Error getting conflict diff for '${file}':`), error.message);
    return "";
  }
}

/**
 * Writes conflict diff to temp file.
 */
export function writeConflictToTempFile(file, diff) {
  const tempFilePath = path.join(os.tmpdir(), `${path.basename(file)}_conflict.txt`);
  fs.writeFileSync(tempFilePath, diff, { encoding: "utf-8" });
  return tempFilePath;
}

/**
 * Opens file in editor.
 */
export function openFileInEditor(tempFilePath, deps = {}) {
  const d = getDeps(deps);
  try {
    d.execSyncFn(`${d.editor} "${tempFilePath}"`, { stdio: "inherit" });
    console.log(chalk.green(`✔ Resolved file saved: ${tempFilePath}`));
  } catch (error) {
    console.error(chalk.red("❌ Error opening file in editor:"), error.message);
  }
}

/**
 * Updates repository file from resolved temp file.
 */
export function updateFileFromTemp(file, tempFilePath, deps = {}) {
  const d = getDeps(deps);
  try {
    const resolvedContent = fs.readFileSync(tempFilePath, "utf-8");
    fs.writeFileSync(file, resolvedContent);
    d.executeGitCommandFn(`git add "${file}"`, deps);
    console.log(chalk.green(`✔ Conflict resolved and staged for: ${file}`));
  } catch (error) {
    console.error(chalk.red("❌ Error updating file from temp:"), error.message);
  }
}
