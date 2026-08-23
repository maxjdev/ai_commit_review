// prompts.js
import { PromptType, SupportedLanguages } from "./models.js";

/**
 * Generates language instruction for OpenAI prompts.
 */
export function generateLanguageInstruction(langcode) {
  const languageMap = Object.values(SupportedLanguages).reduce((map, lang) => {
    map[lang.code] = lang.name;
    return map;
  }, {});
  const language = languageMap[langcode] || "English (US)";
  return `Please respond entirely in ${language}.`;
}

/**
 * Generates prompt for code review or commit creation.
 */
export function generatePrompt(files, promptType, config) {
  const diffs = files
    .map((file) => `\n **${file.filename}:**\n \`\`\`\n ${file.diff}\n \`\`\``)
    .join("\n");

  const languageInstruction = generateLanguageInstruction(config.OPENAI_RESPONSE_LANGUAGE);

  if (promptType === PromptType.ANALYZE) {
    return buildAnalyzePrompt(diffs, languageInstruction);
  }
  if (promptType === PromptType.CREATE) {
    return buildCreatePrompt(diffs, languageInstruction);
  }

  throw new Error(`Invalid prompt type: ${promptType}`);
}

export function generateErrorDiagnosticPrompt(errorData, webContext, config) {
  const languageInstruction = generateLanguageInstruction(config.OPENAI_RESPONSE_LANGUAGE);
  return buildDiagnoseErrorPrompt(errorData, webContext, languageInstruction);
}

const ANALYZE_PROMPT_TEMPLATE = `Assume the role of a senior code reviewer.

Analyze in detail the following code changes (commits) provided:

[[DIFFS]]

For each modified file, organize your analysis as follows:

**File: [File Name]**

1.  **Detailed Summary of Modifications:**
    * What was the main objective and expected impact of the changes in this file?
    * Describe the main functionalities or logic that were added, removed, or significantly altered.

2.  **Identification of Errors, Potential Bugs, and Vulnerabilities:**
    * Are there logic errors, exception handling failures, race conditions, memory leaks, or other bugs?
    * Were security vulnerabilities introduced or neglected (e.g., SQL Injection, XSS, insecure input handling)?
    * For each identified item:
        * Quote the relevant code snippet (or approximate line).
        * Explain in detail the nature of the problem.
        * Describe the potential impact (e.g., incorrect behavior, system failure, security breach).

3.  **Improvement and Optimization Suggestions (with justifications):**
    * Can the code be refactored to increase clarity, readability, or maintainability?
    * Are there opportunities to optimize performance?
    * Can the testability of the code be improved? How?

4.  **Best Practices and Code Quality Recommendations:**
    * Evaluate adherence to clean code principles.
    * Does the code follow style conventions?
    * Are comments adequate?

[[LANG]]`;

const CREATE_PROMPT_TEMPLATE = `Your task is to generate a commit title and commit message (body).

**Diffs:**
[[DIFFS]]

**Output Instructions:**
- **Commit Title:**
  - [[LANG]]
  - Start with a relevant emoji (🚀, ✨, 🐛, 🔧, 📝, ♻️, 🔒, 📈).
  - Use an imperative verb.
  - Maximum of 50 characters.

- **Commit Message (Body):**
  - [[LANG]]
  - Detailed Description of Changes (What Was Done)
  - Motivation and Context (Why the Change)
  - Project Impact (How It Affects)

**Response Format (Exactly as in the example):**
Title
Message (body)`;

function buildAnalyzePrompt(diffs, languageInstruction) {
  return ANALYZE_PROMPT_TEMPLATE
    .replace("[[DIFFS]]", diffs)
    .replace("[[LANG]]", languageInstruction);
}

function buildCreatePrompt(diffs, languageInstruction) {
  return CREATE_PROMPT_TEMPLATE
    .replace("[[DIFFS]]", diffs)
    .replace(/\[\[LANG\]\]/g, languageInstruction);
}

const DIAGNOSE_ERROR_PROMPT_TEMPLATE = `Assume the role of an expert DevOps and Git systems engineer assistant.
An error occurred during the execution of the CLI tool 'ai-commit-review'.

**Error Context:**
- Command / Operation: [[COMMAND]]
- Platform / OS: [[PLATFORM]]
- Error Message: [[ERROR_MESSAGE]]
- Error Details / Stderr: [[STDERR]]

**Web Search Context & Documentation:**
[[WEB_SEARCH]]

**Instructions:**
1. **Resumo do Problema (Problem Summary)**: Explain clearly in 1-2 sentences what went wrong.
2. **Causa Raiz (Root Cause)**: Explain technically why the error happened.
3. **Soluções Recomendadas (Recommended Solutions)**: Step-by-step instructions on how to solve this immediately.
4. **Comando de Auto-Correção (Auto-Fix Command)**:
If there is a specific command that can fix the issue automatically (e.g. \`git config --global core.editor notepad\`), provide it on a single line starting with:
AUTO_FIX_CMD: <command>
If no command can automatically fix it safely, write:
AUTO_FIX_CMD: none

[[LANG]]`;

function buildDiagnoseErrorPrompt(errorData, webContext, languageInstruction) {
  return DIAGNOSE_ERROR_PROMPT_TEMPLATE
    .replace("[[COMMAND]]", errorData.command || "N/A")
    .replace("[[PLATFORM]]", errorData.platform || process.platform)
    .replace("[[ERROR_MESSAGE]]", errorData.message || "Unknown error")
    .replace("[[STDERR]]", errorData.stderr || errorData.stack || "N/A")
    .replace("[[WEB_SEARCH]]", webContext || "No search results available.")
    .replace("[[LANG]]", languageInstruction);
}
