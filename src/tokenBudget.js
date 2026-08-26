// tokenBudget.js

// Diffs/code are denser than prose: ~3 chars per token is a safe estimate.
export const CHARS_PER_TOKEN = 3;

// Extra head-room to absorb tokenizer differences between providers (LM Studio, OpenAI, etc.).
export const SAFETY_RATIO = 0.85;

export const TRUNCATION_NOTICE = "\n... [truncated due to model context limit]";

const MIN_PROMPT_TOKENS = 256;
const SHRINK_FACTOR = 0.8;
const MAX_SHRINK_ATTEMPTS = 6;

export function estimateTokens(text) {
  return Math.ceil((text || "").length / CHARS_PER_TOKEN);
}

export function tokensToChars(tokens) {
  return Math.max(0, Math.floor(tokens * CHARS_PER_TOKEN));
}

/**
 * Calculates how many tokens the prompt may use, reserving space for the response.
 */
export function computePromptBudget(contextLimit, reservedForResponse) {
  const usable = Math.floor((contextLimit - reservedForResponse) * SAFETY_RATIO);
  return Math.max(MIN_PROMPT_TOKENS, usable);
}

/**
 * Hard-cuts a text so its estimated token count never exceeds the budget.
 */
export function truncateToTokenBudget(text, maxTokens, notice = TRUNCATION_NOTICE) {
  const content = text || "";
  const maxChars = tokensToChars(maxTokens);
  if (content.length <= maxChars) return content;
  const keep = Math.max(0, maxChars - notice.length);
  return content.slice(0, keep) + (keep > 0 ? notice : "");
}

function shrinkFiles(files, ratio) {
  return files.map((file) => {
    const diff = file.diff || "";
    const maxChars = Math.floor(diff.length * ratio);
    if (diff.length <= maxChars) return file;
    return { ...file, diff: truncateToTokenBudget(diff, Math.ceil(maxChars / CHARS_PER_TOKEN)) };
  });
}

/**
 * Iteratively shrinks file diffs until the generated prompt fits the token budget.
 * @param {Array<{filename: string, diff: string}>} files - Changed files.
 * @param {(files: Array) => string} buildPrompt - Prompt factory for the given files.
 * @param {number} maxTokens - Maximum tokens allowed for the prompt.
 * @returns {{ prompt: string, files: Array, truncated: boolean }}
 */
export function fitPromptToBudget(files, buildPrompt, maxTokens) {
  let currentFiles = files;
  let prompt = buildPrompt(currentFiles);
  let attempts = 0;

  while (estimateTokens(prompt) > maxTokens && attempts < MAX_SHRINK_ATTEMPTS) {
    const ratio = (maxTokens / estimateTokens(prompt)) * SHRINK_FACTOR;
    currentFiles = shrinkFiles(currentFiles, ratio);
    prompt = buildPrompt(currentFiles);
    attempts += 1;
  }

  return {
    prompt: truncateToTokenBudget(prompt, maxTokens),
    files: currentFiles,
    truncated: attempts > 0,
  };
}

export default {
  estimateTokens,
  tokensToChars,
  computePromptBudget,
  truncateToTokenBudget,
  fitPromptToBudget,
};
