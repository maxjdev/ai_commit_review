import fs from "fs";
import path from "path";
import crypto from "crypto";
import chalk from "chalk";
import { summarizeText, getModelContextLimit } from "./openaiUtils.js";
import { CHARS_PER_TOKEN, computePromptBudget, tokensToChars } from "./tokenBudget.js";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "context.json");

export function ensureCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);
    if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, JSON.stringify({}), "utf8");
  } catch (err) {
    console.warn(chalk.yellow("⚠️ Unable to create cache directory:"), err.message);
  }
}

export function readCache() {
  try {
    ensureCache();
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    return {};
  }
}

export function writeCache(cache) {
  try {
    ensureCache();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    console.warn(chalk.yellow("⚠️ Unable to write cache file:"), err.message);
  }
}

export function hashContent(text) {
  return crypto.createHash("md5").update(text || "").digest("hex");
}

export function chunkText(text, maxChars) {
  if (!text) return [];
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxChars));
    i += maxChars;
  }
  return chunks;
}

async function processFileDiff(file, cache, maxChars, maxCombinedChars, CHARS_PER_TOKEN, summarizeTextFn) {
  const key = `${file.filename}:${hashContent(file.diff)}`;
  if (cache[key]) {
    return { ...file, diff: `/* SUMMARY (cached): ${cache[key].summary} */\n` };
  }

  if ((file.diff || "").length <= maxChars) {
    return file;
  }

  const chunks = chunkText(file.diff, maxChars);
  console.log(chalk.yellow(` 📦 Splitting ${file.filename} into ${chunks.length} chunks for summarization...`));
  
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTokens = Math.ceil(chunk.length / CHARS_PER_TOKEN);
    console.log(chalk.gray(` → Chunk ${i+1}/${chunks.length}: ${chunk.length} chars (~${chunkTokens} tokens)`));
    
    const prompt = `Resuma de forma concisa e técnica o seguinte trecho de diff (responda no mesmo idioma do conteúdo):\n\n${chunk}`;
    const summary = await summarizeTextFn(prompt);
    chunkSummaries.push(summary);
  }

  let combined = chunkSummaries.join("\n\n");

  if (combined.length > maxCombinedChars) {
    const prompt = `Resuma de forma sucinta e técnica o seguinte conjunto de resumos de diff em um único parágrafo que capture as mudanças mais importantes:\n\n${combined}`;
    combined = await summarizeTextFn(prompt);
  }

  cache[key] = { summary: combined, timestamp: Date.now() };
  writeCache(cache);

  return { ...file, diff: `/* SUMMARY:\n${combined}\n*/\n` };
}

export async function buildContextForFiles(files, promptType, options = {}) {
  const cache = readCache();
  const getModelContextLimitFn = options.getModelContextLimitFn || getModelContextLimit;
  const summarizeTextFn = options.summarizeTextFn || summarizeText;
  
  const modelTokenLimit = await getModelContextLimitFn();
  const RESERVED_FOR_RESPONSE = 1000;
  const RESERVED_FOR_INSTRUCTIONS = 200;

  const maxTokensForContent = computePromptBudget(modelTokenLimit, RESERVED_FOR_RESPONSE) - RESERVED_FOR_INSTRUCTIONS;
  const maxChars = options.maxChars || tokensToChars(maxTokensForContent);
  const maxCombinedChars = options.maxCombinedChars || maxChars;
  
  console.log(chalk.blue(`ℹ️ Model: ${modelTokenLimit} tokens | Chunk size: ~${Math.floor(maxChars/1000)}k chars (${maxTokensForContent} tokens max per chunk)`));

  const result = [];
  for (const file of files) {
    try {
      const processed = await processFileDiff(file, cache, maxChars, maxCombinedChars, CHARS_PER_TOKEN, summarizeTextFn);
      result.push(processed);
    } catch (err) {
      console.warn(chalk.yellow(`⚠️ failed to build context for ${file.filename}: ${err.message}`));
      result.push(file);
    }
  }

  return result;
}

export function clearContextCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    console.log(chalk.green("✅ Context cache cleared."));
  } catch (err) {
    console.warn(chalk.yellow("⚠️ Unable to clear cache:"), err.message);
  }
}

export default { buildContextForFiles, clearContextCache };
