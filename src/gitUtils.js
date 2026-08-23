// gitUtils.js
// Facade module delegating core Git, Branch and GitHub CLI operations to modularized files.

export {
  executeGitCommand,
  stageAllChanges,
  clearStage,
  undoLastCommitSoft,
  commitChangesWithEditor,
  commitDirectlyWithMessageFile,
  getCommits,
  getModifiedFiles,
  getFileDiff,
  getRepositoryDiff,
  getStagedFileDiff,
  getStagedFilesDiffs,
} from "./gitCore.js";

export {
  getCurrentBranch,
  listBranches,
  pullChanges,
  pushChanges,
  switchBranch,
  mergeBranch,
  checkConflicts,
  getConflictDiff,
  writeConflictToTempFile,
  openFileInEditor,
  updateFileFromTemp,
} from "./gitBranch.js";

export { createPullRequest } from "./githubCli.js";
