// commitStaged.js
import chalk from "chalk";
import inquirer from "inquirer";
import {
  pullChanges,
  getStagedFilesDiffs,
  pushChanges,
} from "./gitUtils.js";
import {
  confirmOrSwitchBranch,
  verifyConflicts,
  obtainCommitMessage,
  handleCommitAbortOrPush,
} from "./commitFlowHandlers.js";

export function getDeps(deps = {}) {
  return {
    pullChangesFn: deps.pullChangesFn || pullChanges,
    getStagedFilesDiffsFn: deps.getStagedFilesDiffsFn || getStagedFilesDiffs,
    pushChangesFn: deps.pushChangesFn || pushChanges,
    promptFn: deps.promptFn || inquirer.prompt,
  };
}

async function promptAndExecutePush(d) {
  const { push } = await d.promptFn([
    {
      type: "confirm",
      name: "push",
      message: "Do you want to push to the remote repository?",
      default: true,
    },
  ]);

  if (!push) {
    console.log(chalk.yellow("⚠️ Push not performed."));
    return;
  }

  d.pullChangesFn();
  d.pushChangesFn();
}

export async function commitStaged(deps = {}) {
  const d = getDeps(deps);
  try {
    await confirmOrSwitchBranch(deps);
    d.pullChangesFn();
    await verifyConflicts(deps);

    const stagedFiles = d.getStagedFilesDiffsFn();
    if (!stagedFiles || stagedFiles.length === 0) {
      console.log(chalk.yellow("⚠️ No staged changes to commit."));
      return;
    }

    await obtainCommitMessage(stagedFiles, deps);
    const proceed = await handleCommitAbortOrPush(deps);
    if (proceed) {
      await promptAndExecutePush(d);
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Error during the commit creation process:"),
      error.message
    );
    throw error;
  }
}