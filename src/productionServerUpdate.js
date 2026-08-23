// productionServerUpdate.js
import {
  createPullRequest,
  mergeBranch,
  executeGitCommand,
  pullChanges,
  pushChanges
} from "./gitUtils.js";
import chalk from "chalk";
import inquirer from "inquirer";

export function getDeps(deps = {}) {
  return {
    createPullRequestFn: deps.createPullRequestFn || createPullRequest,
    mergeBranchFn: deps.mergeBranchFn || mergeBranch,
    executeGitCommandFn: deps.executeGitCommandFn || executeGitCommand,
    pullChangesFn: deps.pullChangesFn || pullChanges,
    pushChangesFn: deps.pushChangesFn || pushChanges,
    promptFn: deps.promptFn || inquirer.prompt,
  };
}

export function ensureBranch(targetBranch, deps = {}) {
  const d = getDeps(deps);
  const currentBranch = d.executeGitCommandFn("git rev-parse --abbrev-ref HEAD");
  if (currentBranch !== targetBranch) {
    console.log(chalk.blue(`ℹ️ Switching to branch ${targetBranch}...`));
    d.executeGitCommandFn(`git checkout "${targetBranch}"`);
  } else {
    console.log(chalk.blue(`ℹ️ Already on branch ${targetBranch}.`));
  }
}

export function checkUncommittedChanges(deps = {}) {
  const d = getDeps(deps);
  console.log(chalk.blue("ℹ️ Checking uncommitted changes..."));
  const status = d.executeGitCommandFn("git status --porcelain");
  if (status) {
    console.error(
      chalk.red(
        "❌ There are uncommitted changes in the branch. Please commit the changes and run new tests before putting into production."
      )
    );
    throw new Error("Uncommitted changes in branch.");
  }
}

async function promptDeployConfirm(d) {
  const { deployConfirm } = await d.promptFn([
    {
      type: "confirm",
      name: "deployConfirm",
      message: "The 'teste' branch is working correctly. Do you want to put it into production?",
      default: true
    }
  ]);
  return deployConfirm;
}

async function promptFinalDeploy(d) {
  const { finalDeploy } = await d.promptFn([
    {
      type: "confirm",
      name: "finalDeploy",
      message: "Are you sure? This action cannot be undone.",
      default: false
    }
  ]);
  return finalDeploy;
}

export async function confirmProductionDeploy(deps = {}) {
  const d = getDeps(deps);
  const { confirm } = await d.promptFn([
    {
      type: "confirm",
      name: "confirm",
      message: 'Is the "teste" branch working correctly?',
      default: true
    }
  ]);

  if (!confirm) {
    throw new Error('The "teste" branch is not working correctly. Fix it and try again.');
  }

  if (!(await promptDeployConfirm(d))) {
    console.log(chalk.yellow("Operation cancelled by user."));
    return false;
  }

  if (!(await promptFinalDeploy(d))) {
    console.log(chalk.yellow("Operation cancelled by user."));
    return false;
  }

  return true;
}

function executePullRequestAndPush(branchPR, branchOrigem, branchDestino, revisor, d, deps) {
  console.log(chalk.blue(`ℹ️ Creating pull request from ${branchOrigem} to '${branchPR}'...`));
  d.createPullRequestFn({
    base: branchPR,
    head: branchOrigem,
    title: `Merge from ${branchOrigem} to ${branchPR}`,
    body: `Update Production Server: This pull request was automatically created to merge the '${branchOrigem}' branch into the ${branchPR} branch.`,
    reviewer: revisor
  });
  console.log(chalk.green("ℹ️ Pull request created successfully!"));
  console.log(chalk.yellow("⚠️ Warning: DO NOT approve the pull request. Wait for Fernando to review the request."));

  ensureBranch(branchDestino, deps);
  d.pushChangesFn();
}

export async function updateServerToProduction(deps = {}) {
  const branchOrigem = 'teste';
  const branchPR = 'master';
  const branchDestino = 'develop';
  const revisor = 'fernandobnog';
  const d = getDeps(deps);

  try {
    ensureBranch(branchOrigem, deps);
    d.pullChangesFn();
    checkUncommittedChanges(deps);

    const shouldDeploy = await confirmProductionDeploy(deps);
    if (!shouldDeploy) {
      return;
    }

    console.log(chalk.blue(`ℹ️ Merging branch ${branchOrigem}...`));
    await d.mergeBranchFn(branchOrigem, branchDestino);

    executePullRequestAndPush(branchPR, branchOrigem, branchDestino, revisor, d, deps);
  } catch (error) {
    console.error(chalk.red("❌ Error in pull request and merge flow:"), error.message);
    throw error;
  }
}