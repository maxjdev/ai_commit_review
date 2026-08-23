// gitCore.js
import { execSync } from "child_process";
import chalk from "chalk";

export function getDeps(deps = {}) {
  return {
    execSyncFn: deps.execSyncFn || execSync
  };
}

/**
 * Executes a Git command synchronously with safe UTF-8 encoding.
 * @param {string} command - The Git command to execute.
 * @param {object} [deps] - Optional dependencies for testing.
 * @returns {string} - The command output, trimmed of whitespace.
 */
export function executeGitCommand(command, deps = {}) {
  const d = getDeps(deps);
  try {
    return d.execSyncFn(command, { encoding: "utf-8" }).trim();
  } catch (error) {
    console.error(
      chalk.red(`❌ Error executing Git command '${command}': ${error.message}`)
    );
    throw error;
  }
}

/**
 * Adds all changes to the staging area.
 */
export function stageAllChanges(deps = {}) {
  try {
    executeGitCommand("git add .", deps);
    console.log(chalk.green("✔ All changes have been staged."));
  } catch (error) {
    console.error(chalk.red("❌ Error staging all changes:"), error.message);
    throw error;
  }
}

/**
 * Clears the staging area.
 */
export function clearStage(deps = {}) {
  try {
    executeGitCommand("git reset", deps);
    console.log(chalk.green("✔ Stage cleared. All changes unstaged."));
  } catch (error) {
    console.error(chalk.red("❌ Error clearing stage:"), error.message);
  }
}

/**
 * Undoes the last commit without altering unstaged changes.
 */
export function undoLastCommitSoft(deps = {}) {
  try {
    console.log(chalk.blue("🔄 Undoing the last commit..."));
    executeGitCommand("git reset --soft HEAD~1", deps);
    console.log(chalk.green("✔ Last commit undone. Changes remain staged."));
  } catch (error) {
    console.error(chalk.red("❌ Failed to undo last commit:"), error.message);
    throw error;
  }
}

/**
 * Commits changes using the editor with a prefilled message file.
 */
export function commitChangesWithEditor(tempFilePath, deps = {}) {
  const d = getDeps(deps);
  try {
    d.execSyncFn(`git commit --edit --file="${tempFilePath}" --no-verify`, { stdio: "inherit" });
    console.log(chalk.green("✔ Commit successfully made!"));
  } catch (error) {
    console.error(chalk.red("❌ Error making commit:"), error.message);
    throw error;
  }
}

/**
 * Commits changes directly using the message file without opening an editor.
 */
export function commitDirectlyWithMessageFile(tempFilePath, deps = {}) {
  const d = getDeps(deps);
  try {
    d.execSyncFn(`git commit --file="${tempFilePath}" --no-verify`, { stdio: "inherit" });
    console.log(chalk.green("✔ Commit successfully made!"));
  } catch (error) {
    console.error(chalk.red("❌ Error making direct commit:"), error.message);
    throw error;
  }
}

/**
 * Retrieves list of commits with details.
 */
export function getCommits(skip = 0, limit = 5, deps = {}) {
  try {
    const output = executeGitCommand(
      `git log --skip=${skip} -n ${limit} --pretty=format:"%H\x1f%ct\x1f%s"`,
      deps
    );
    if (!output) return [];
    return output.split("\n").map((line) => {
      const [shaFull, timestamp, message] = line.split("\x1f");
      return {
        shaFull,
        shaShort: (shaFull || "").slice(0, 7),
        date: formatGitDate(timestamp),
        message: truncateString((message || "").replace(/\n/g, " "), 100),
      };
    });
  } catch (error) {
    console.error(chalk.red("❌ Error fetching commits:"), error.message);
    return [];
  }
}

export function formatGitDate(timestamp) {
  if (!timestamp) return "";
  return new Date(parseInt(timestamp, 10) * 1000)
    .toLocaleString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
}

export function truncateString(str, maxLength) {
  return str.length <= maxLength ? str : `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Retrieves modified files for a given commit SHA.
 */
export function getModifiedFiles(sha, deps = {}) {
  try {
    const output = executeGitCommand(
      `git diff-tree --no-commit-id --name-status -r ${sha}`,
      deps
    );
    if (!output) return [];
    return output.split("\n").map((line) => {
      const [status, file] = line.trim().split("\t");
      return { status, file };
    });
  } catch (error) {
    console.error(chalk.red("❌ Error retrieving modified files:"), error.message);
    return [];
  }
}

/**
 * Retrieves file diff for a commit.
 */
export function getFileDiff(sha, file, deps = {}) {
  try {
    return executeGitCommand(`git diff ${sha}~1 ${sha} -- "${file}" || true`, deps);
  } catch (error) {
    console.error(chalk.red(`❌ Error diff for file '${file}':`), error.message);
    return "";
  }
}

/**
 * Retrieves unstaged repository diff.
 */
export function getRepositoryDiff(deps = {}) {
  try {
    return executeGitCommand("git diff", deps);
  } catch (error) {
    console.error(chalk.red("❌ Error retrieving repository diff:"), error.message);
    return "";
  }
}

/**
 * Gets diff of a specific staged file.
 */
export function getStagedFileDiff(file, deps = {}) {
  try {
    return executeGitCommand(`git diff --cached -- "${file}"`, deps);
  } catch (error) {
    console.error(chalk.red(`❌ Error diff for staged file '${file}':`), error.message);
    let isDeleted = false;
    try {
      isDeleted = executeGitCommand(`git ls-files --deleted -- "${file}"`, deps).length > 0;
    } catch (e) {}

    if (isDeleted) {
      console.warn(chalk.yellow(`⚠️ File '${file}' was deleted.`));
      return `File deleted: ${file}`;
    }
    return "";
  }
}

/**
 * Retrieves staged files and their diffs.
 */
export function getStagedFilesDiffs(deps = {}) {
  try {
    const output = executeGitCommand("git diff --cached --name-only", deps);
    const files = output ? output.split("\n").filter((line) => line) : [];

    return files.map((file) => ({
      filename: file,
      diff: getStagedFileDiff(file, deps),
    }));
  } catch (error) {
    console.error(chalk.red("❌ Error diffs for staged files:"), error.message);
    return [];
  }
}
