// featureMerge.js
import chalk from "chalk";
import inquirer from "inquirer";
import {
  getCurrentBranch,
  switchBranch,
  pullChanges,
  pushChanges,
  executeGitCommand,
} from "./gitUtils.js";
import { verifyConflicts } from "./gitConflictHandlers.js";
import { updateServerToTest } from "./testServerUpdate.js";

export function getDeps(deps = {}) {
  return {
    getCurrentBranchFn: deps.getCurrentBranchFn || getCurrentBranch,
    switchBranchFn: deps.switchBranchFn || switchBranch,
    pullChangesFn: deps.pullChangesFn || pullChanges,
    pushChangesFn: deps.pushChangesFn || pushChanges,
    executeGitCommandFn: deps.executeGitCommandFn || executeGitCommand,
    verifyConflictsFn: deps.verifyConflictsFn || verifyConflicts,
    updateServerToTestFn: deps.updateServerToTestFn || updateServerToTest,
    promptFn: deps.promptFn || inquirer.prompt,
  };
}

export function validateCleanWorktree(deps = {}) {
  const d = getDeps(deps);
  const status = d.executeGitCommandFn("git status --porcelain", deps);
  if (status && status.trim().length > 0) {
    console.error(chalk.red("❌ Uncommitted changes detected. Commit or stash them before merging."));
    throw new Error("Uncommitted changes in worktree.");
  }
}

export function validateFeatureBranch(branch) {
  const protectedBranches = ["develop", "teste", "test", "master", "main"];
  if (!branch || protectedBranches.includes(branch.trim())) {
    const errorMsg = `Cannot merge protected or base branch '${branch}' into develop.`;
    console.error(chalk.red(`❌ ${errorMsg}`));
    throw new Error(errorMsg);
  }
}

export function getBranchDivergence(featureBranch, targetBranch = "develop", deps = {}) {
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

export async function syncDevelopIntoFeature(featureBranch, targetBranch = "develop", deps = {}) {
  const d = getDeps(deps);
  console.log(chalk.blue(`ℹ️ Syncing latest '${targetBranch}' changes into '${featureBranch}'...`));
  try {
    d.executeGitCommandFn(`git merge origin/${targetBranch} -m "Sync ${targetBranch} into ${featureBranch}"`, deps);
    console.log(chalk.green(`✔ '${targetBranch}' successfully merged into '${featureBranch}'.`));
  } catch (mergeError) {
    await handleSyncConflicts(targetBranch, deps);
  }
  d.pushChangesFn(deps);
}

async function handleTargetConflicts(featureBranch, deps) {
  const d = getDeps(deps);
  try {
    await d.verifyConflictsFn(deps);
  } catch (err) {
    console.log(chalk.yellow(`⚠️ Conflicts unresolved merging '${featureBranch}'. Aborting merge...`));
    d.executeGitCommandFn("git merge --abort", deps);
    d.switchBranchFn(featureBranch, deps);
    throw err;
  }
}

export async function mergeFeatureIntoDevelop(featureBranch, targetBranch = "develop", deps = {}) {
  const d = getDeps(deps);
  console.log(chalk.blue(`ℹ️ Switching to '${targetBranch}' and pulling latest remote updates...`));
  d.switchBranchFn(targetBranch, deps);
  d.pullChangesFn(deps);

  console.log(chalk.blue(`ℹ️ Creating merge commit from '${featureBranch}' into '${targetBranch}'...`));
  try {
    d.executeGitCommandFn(`git merge --no-ff -m "Merge branch '${featureBranch}' into ${targetBranch}" "${featureBranch}"`, deps);
  } catch (mergeError) {
    await handleTargetConflicts(featureBranch, deps);
  }

  console.log(chalk.green(`✔ Successfully merged '${featureBranch}' into '${targetBranch}'.`));
  d.pushChangesFn(deps);
}

export async function promptTestServerUpdate(deps = {}) {
  const d = getDeps(deps);
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

export async function mergeFeatureToDevelop(deps = {}) {
  const d = getDeps(deps);
  validateCleanWorktree(deps);

  const featureBranch = d.getCurrentBranchFn(deps);
  validateFeatureBranch(featureBranch);

  d.pullChangesFn(deps);

  const divergence = getBranchDivergence(featureBranch, "develop", deps);
  if (divergence.behind > 0) {
    console.log(chalk.yellow(`⚠️ Your branch '${featureBranch}' is ${divergence.behind} commit(s) behind 'develop'.`));
    const { syncDevelop } = await d.promptFn([
      {
        type: "confirm",
        name: "syncDevelop",
        message: "Do you want to sync the latest 'develop' code into your feature first?",
        default: true,
      },
    ]);
    if (syncDevelop) {
      await syncDevelopIntoFeature(featureBranch, "develop", deps);
    }
  }

  await mergeFeatureIntoDevelop(featureBranch, "develop", deps);
  console.log(chalk.green(`🎉 Feature branch '${featureBranch}' integrated into 'develop' with merge commit!`));

  await promptTestServerUpdate(deps);
}

