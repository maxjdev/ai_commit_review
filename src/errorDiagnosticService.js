// errorDiagnosticService.js
import chalk from "chalk";
import inquirer from "inquirer";
import { execSync } from "child_process";
import { searchGoogle } from "./webSearchService.js";
import { diagnoseErrorWithAI } from "./openaiUtils.js";

export function getDeps(deps = {}) {
  return {
    searchGoogleFn: deps.searchGoogleFn || searchGoogle,
    diagnoseErrorWithAIFn: deps.diagnoseErrorWithAIFn || diagnoseErrorWithAI,
    execSyncFn: deps.execSyncFn || execSync,
    promptFn: deps.promptFn || inquirer.prompt,
  };
}

export function sanitizeErrorQuery(text) {
  if (!text) return "";
  return text
    .replace(/[A-Za-z]:\\[^ \t\n\r"']+/g, "") // remove windows paths
    .replace(/\/[^ \t\n\r"']+/g, "") // remove unix paths
    .replace(/commit_msg_[a-zA-Z0-9_]+/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchQuery(errorData) {
  const parts = [];
  if (errorData.command) parts.push(errorData.command.split(" ")[0]);
  const sanitizedMsg = sanitizeErrorQuery(errorData.message || "");
  const sanitizedStderr = sanitizeErrorQuery(errorData.stderr || "");
  parts.push(sanitizedStderr || sanitizedMsg);
  parts.push(process.platform === "win32" ? "windows" : "linux");
  return parts.filter(Boolean).join(" ").slice(0, 120).trim();
}

export function parseAutoFixCommand(aiAnalysis) {
  if (!aiAnalysis) return null;
  const match = aiAnalysis.match(/AUTO_FIX_CMD:\s*(.+)/i);
  if (!match) return null;
  const cmd = match[1].trim().replace(/^`+|`+$/g, "");
  if (!cmd || cmd.toLowerCase() === "none") return null;
  return cmd;
}

export function formatWebResults(searchResults) {
  if (!searchResults || !searchResults.success) return "";
  if (typeof searchResults.results === "string") return searchResults.results;
  if (Array.isArray(searchResults.results?.google_search)) {
    return searchResults.results.google_search
      .map((item, i) => `${i + 1}. [${item.title}](${item.link || item.url}): ${item.snippet}`)
      .join("\n");
  }
  return JSON.stringify(searchResults.results);
}

export function renderDiagnostic(analysis) {
  const cleanText = analysis.replace(/AUTO_FIX_CMD:.+/gi, "").trim();
  console.log("\n" + chalk.cyan("=".repeat(60)));
  console.log(chalk.bold.cyan("🧠 AI Error Diagnostic & Recovery Assistant"));
  console.log(chalk.cyan("=".repeat(60)));
  console.log(cleanText);
  console.log(chalk.cyan("=".repeat(60)) + "\n");
}

async function promptRemediationAction(autoFixCmd, d) {
  const choices = [];
  if (autoFixCmd) {
    choices.push({ name: `⚡ Run automatic fix: ${autoFixCmd}`, value: "auto_fix" });
  }
  choices.push({ name: "🔄 Retry operation", value: "retry" });
  choices.push({ name: "❌ Cancel and exit", value: "cancel" });

  const { action } = await d.promptFn([
    {
      type: "list",
      name: "action",
      message: "How would you like to proceed?",
      choices,
    },
  ]);
  return action;
}

export async function executeAutoFix(command, d) {
  console.log(chalk.blue(`⚙️ Executing auto-fix: ${command}`));
  try {
    d.execSyncFn(command, { stdio: "inherit", encoding: "utf-8" });
    console.log(chalk.green("✔ Auto-fix executed successfully!"));
    return true;
  } catch (err) {
    console.error(chalk.red(`❌ Failed to execute auto-fix: ${err.message}`));
    return false;
  }
}

/**
 * Diagnoses an error with web search + AI and offers guided recovery.
 */
export async function diagnoseAndHandleError(error, context = {}, deps = {}) {
  const d = getDeps(deps);
  const errorData = {
    command: context.command || "",
    platform: process.platform,
    message: error?.message || String(error),
    stderr: error?.stderr?.toString() || error?.output?.[2]?.toString() || "",
    stack: error?.stack || "",
  };

  console.log(chalk.yellow("\n🔍 Investigating error with AI & Web Search..."));
  const query = buildSearchQuery(errorData);
  const searchResults = await d.searchGoogleFn(query, { limit: 3, format: "markdown", ai: true });
  const webContext = formatWebResults(searchResults);

  const analysis = await d.diagnoseErrorWithAIFn(errorData, webContext, deps);
  renderDiagnostic(analysis);

  const autoFixCmd = parseAutoFixCommand(analysis);
  const action = await promptRemediationAction(autoFixCmd, d);

  if (action === "auto_fix" && autoFixCmd) {
    const success = await executeAutoFix(autoFixCmd, d);
    if (success) {
      const { retryAfterFix } = await d.promptFn([
        {
          type: "confirm",
          name: "retryAfterFix",
          message: "Would you like to retry the operation now?",
          default: true,
        },
      ]);
      return { handled: true, action: retryAfterFix ? "retry" : "auto_fix", success, autoFixCmd };
    }
    return { handled: true, action: "auto_fix", success, autoFixCmd };
  }

  return { handled: true, action, autoFixCmd };
}
