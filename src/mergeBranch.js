// mergeBranch.js
import chalk from "chalk";
import inquirer from "inquirer";
import {
  getCurrentBranch,
  listBranches,
  switchBranch,
  pullChanges,
  pushChanges,
  executeGitCommand,
} from "./gitUtils.js";
import { verifyConflicts } from "./gitConflictHandlers.js";
import { updateServerToTest } from "./testServerUpdate.js";
import { createCommit } from "./createCommit.js";

export function getDeps(deps = {}) {
  return {
    getCurrentBranchFn: deps.getCurrentBranchFn || getCurrentBranch,
    listBranchesFn: deps.listBranchesFn || listBranches,
    switchBranchFn: deps.switchBranchFn || switchBranch,
    pullChangesFn: deps.pullChangesFn || pullChanges,
    pushChangesFn: deps.pushChangesFn || pushChanges,
    executeGitCommandFn: deps.executeGitCommandFn || executeGitCommand,
    verifyConflictsFn: deps.verifyConflictsFn || verifyConflicts,
    updateServerToTestFn: deps.updateServerToTestFn || updateServerToTest,
    createCommitFn: deps.createCommitFn || createCommit,
    promptFn: deps.promptFn || inquirer.prompt,
  };
}

async function stashUncommittedChanges(d, deps) {
  console.log(chalk.yellow("📦 Stashing uncommitted changes before merge..."));
  d.executeGitCommandFn("git stash push -u -m \"ACR auto-stash before merge\"", deps);
  console.log(chalk.green("✔ Uncommitted changes stashed successfully. Proceeding with merge..."));
}

export async function checkUncommittedChanges(deps = {}) {
  const d = getDeps(deps);
  const status = d.executeGitCommandFn("git status --porcelain", deps);
  if (!status || status.trim().length === 0) return;

  console.log(chalk.yellow("⚠️ Uncommitted changes detected in branch."));
  const { shouldCommit } = await d.promptFn([
    {
      type: "confirm",
      name: "shouldCommit",
      message: "Do you want to commit these changes before merging?",
      default: true,
    },
  ]);

  if (shouldCommit) {
    await d.createCommitFn(deps);
    const statusAfter = d.executeGitCommandFn("git status --porcelain", deps);
    if (!statusAfter || statusAfter.trim().length === 0) return;
  }

  await stashUncommittedChanges(d, deps);
}

async function askCustomBranch(promptFn) {
  const { customBranch } = await promptFn([
    {
      type: "input",
      name: "customBranch",
      message: "Enter the target branch name:",
      validate: (input) => (input && input.trim().length > 0 ? true : "Branch name is required."),
    },
  ]);
  return customBranch.trim();
}

export async function promptTargetBranch(currentBranch, deps = {}) {
  const d = getDeps(deps);
  const allBranches = d.listBranchesFn(deps);
  const available = allBranches.filter((b) => b && b !== currentBranch);

  const choices = available.length > 0
    ? [...available, new inquirer.Separator(), { name: "Other branch...", value: "__custom__" }]
    : [{ name: "master", value: "master" }, { name: "develop", value: "develop" }, { name: "teste", value: "teste" }];

  const { target } = await d.promptFn([
    {
      type: "list",
      name: "target",
      message: `Select the destination branch to merge '${currentBranch}' into:`,
      choices,
    },
  ]);

  if (target === "__custom__") {
    return askCustomBranch(d.promptFn);
  }
  return target;
}

export function validateBranches(currentBranch, targetBranch) {
  if (!currentBranch || typeof currentBranch !== "string") {
    throw new Error("Invalid current branch.");
  }
  if (!targetBranch || typeof targetBranch !== "string") {
    throw new Error("Target branch is required.");
  }
  if (currentBranch.trim() === targetBranch.trim()) {
    const errorMsg = `Cannot merge branch '${currentBranch}' into itself.`;
    console.error(chalk.red(`❌ ${errorMsg}`));
    throw new Error(errorMsg);
  }
}

export function getBranchDivergence(sourceBranch, targetBranch, deps = {}) {
  const d = getDeps(deps);
  try {
    d.executeGitCommandFn(`git fetch origin ${targetBranch}`, deps);
    const behindRaw = d.executeGitCommandFn(`git rev-list --count HEAD..origin/${targetBranch}`, deps);
    const aheadRaw = d.executeGitCommandFn(`git rev-list --count origin/${targetBranch}..HEAD`, deps);
    return {
      behind: parseInt(behindRaw, 10) || 0,
      ahead: parseInt(aheadRaw, 10) || 0,
    };
  } catch {
    return { behind: 0, ahead: 0 };
  }
}

async function handleSyncConflicts(targetBranch, deps) {
  const d = getDeps(deps);
  try {
    await d.verifyConflictsFn(deps);
  } catch (err) {
    console.log(chalk.yellow(`⚠️ Conflicts unresolved during sync from '${targetBranch}'. Aborting merge...`));
    d.executeGitCommandFn("git merge --abort", deps);
    throw err;
  }
}

export async function syncTargetIntoSource(sourceBranch, targetBranch, deps = {}) {
  const d = getDeps(deps);
  console.log(chalk.blue(`ℹ️ Syncing latest '${targetBranch}' changes into '${sourceBranch}'...`));
  try {
    d.executeGitCommandFn(`git merge origin/${targetBranch} -m "Sync ${targetBranch} into ${sourceBranch}"`, deps);
    console.log(chalk.green(`✔ '${targetBranch}' successfully merged into '${sourceBranch}'.`));
  } catch (mergeError) {
    await handleSyncConflicts(targetBranch, deps);
  }
  d.pushChangesFn(deps);
}

async function handleTargetConflicts(sourceBranch, deps) {
  const d = getDeps(deps);
  try {
    await d.verifyConflictsFn(deps);
  } catch (err) {
    console.log(chalk.yellow(`⚠️ Conflicts unresolved merging '${sourceBranch}'. Aborting merge...`));
    d.executeGitCommandFn("git merge --abort", deps);
    d.switchBranchFn(sourceBranch, deps);
    throw err;
  }
}

export async function executeBranchMerge(sourceBranch, targetBranch, deps = {}) {
  const d = getDeps(deps);
  console.log(chalk.blue(`ℹ️ Switching to '${targetBranch}' and pulling latest remote updates...`));
  d.switchBranchFn(targetBranch, deps);
  d.pullChangesFn(deps);

  console.log(chalk.blue(`ℹ️ Creating merge commit from '${sourceBranch}' into '${targetBranch}'...`));
  try {
    d.executeGitCommandFn(`git merge --no-ff -m "Merge branch '${sourceBranch}' into ${targetBranch}" "${sourceBranch}"`, deps);
  } catch (mergeError) {
    await handleTargetConflicts(sourceBranch, deps);
  }

  console.log(chalk.green(`✔ Successfully merged '${sourceBranch}' into '${targetBranch}'.`));
  d.pushChangesFn(deps);
}

export async function promptFollowupAction(targetBranch, deps = {}) {
  const d = getDeps(deps);
  if (targetBranch === "develop") {
    const { runUpdateTest } = await d.promptFn([
      {
        type: "confirm",
        name: "runUpdateTest",
        message: "Do you want to deploy to the test server now (updateTestServer)?",
        default: false,
      },
    ]);
    if (runUpdateTest) {
      console.log(chalk.blue("🚀 Triggering updateTestServer flow..."));
      await d.updateServerToTestFn(deps);
    }
  }
}

export async function checkAndSyncDivergence(currentBranch, targetBranch, deps = {}) {
  const d = getDeps(deps);
  const divergence = getBranchDivergence(currentBranch, targetBranch, deps);
  if (divergence.behind > 0) {
    console.log(chalk.yellow(`⚠️ Your branch '${currentBranch}' is ${divergence.behind} commit(s) behind '${targetBranch}'.`));
    const { syncTarget } = await d.promptFn([
      {
        type: "confirm",
        name: "syncTarget",
        message: `Do you want to sync the latest '${targetBranch}' code into '${currentBranch}' first?`,
        default: true,
      },
    ]);
    if (syncTarget) {
      await syncTargetIntoSource(currentBranch, targetBranch, deps);
    }
  }
}

export async function executeMergeFlow(specifiedTarget = null, deps = {}) {
  const d = getDeps(deps);
  await checkUncommittedChanges(deps);

  const currentBranch = d.getCurrentBranchFn(deps);
  const targetBranch = specifiedTarget || (await promptTargetBranch(currentBranch, deps));
  validateBranches(currentBranch, targetBranch);

  d.pullChangesFn(deps);
  await checkAndSyncDivergence(currentBranch, targetBranch, deps);
  await executeBranchMerge(currentBranch, targetBranch, deps);
  console.log(chalk.green(`🎉 Branch '${currentBranch}' integrated into '${targetBranch}' with merge commit!`));

  await promptFollowupAction(targetBranch, deps);
}
