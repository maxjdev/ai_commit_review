import chalk from "chalk";
import { validateConfiguration, updateValidApiKey } from "./configManager.js";
import { OpenAI } from "openai";
import { OpenAIModels, PromptType, ModelContextLimits, ConfigKeys } from "./models.js";
import {
  estimateTokens,
  computePromptBudget,
  truncateToTokenBudget,
  fitPromptToBudget,
} from "./tokenBudget.js";
import {
  generatePrompt,
  generateLanguageInstruction,
  generateErrorDiagnosticPrompt,
  generateCommandAssistantPrompt,
} from "./prompts.js";

const RESERVED_FOR_ANALYSIS_RESPONSE = 2000;
const RESERVED_FOR_SUMMARY_RESPONSE = 1000;

/**
 * Analyzes updated code using OpenAI.
 */
export function createOpenAIInstance(config, deps = {}) {
  const OpenAIConstructor = deps.OpenAIConstructor || OpenAI;
  let openai = deps.openaiClient || null;
  if (!openai) {
    if (config.OPENAI_API_BASEURL) {
      openai = new OpenAIConstructor({ baseURL: config.OPENAI_API_BASEURL, apiKey: config.OPENAI_API_KEY });
    } else {
      openai = new OpenAIConstructor({ apiKey: config.OPENAI_API_KEY });
    }
  }
  return openai;
}

/**
 * Analyzes updated code using OpenAI.
 */
export async function analyzeUpdatedCode(
  files,
  promptType = PromptType.ANALYZE,
  deps = {}
) {
  const config = await validateConfiguration();
  const openai = createOpenAIInstance(config, deps);

  const buildPrompt = (currentFiles) => generatePrompt(currentFiles, promptType, config);
  const contextLimit = await getModelContextLimit();
  const maxPromptTokens = computePromptBudget(contextLimit, RESERVED_FOR_ANALYSIS_RESPONSE);

  const prompt = buildFittedPrompt(files, buildPrompt, maxPromptTokens);

  return analyzeWithPrompt(openai, prompt, config, files, promptType, deps);
}

function buildFittedPrompt(files, buildPrompt, maxPromptTokens) {
  const originalTokens = estimateTokens(buildPrompt(files));
  if (originalTokens <= maxPromptTokens) {
    return buildPrompt(files);
  }

  console.warn(
    chalk.yellow(`⚠️  Prompt too large (~${originalTokens} tokens). Truncating to fit ${maxPromptTokens} tokens...`)
  );
  const { prompt } = fitPromptToBudget(files, buildPrompt, maxPromptTokens);
  console.log(chalk.yellow(`✂️  Reduced from ~${originalTokens} to ~${estimateTokens(prompt)} tokens`));
  return prompt;
}

async function analyzeWithPrompt(openai, prompt, config, files, promptType, deps = {}) {
  const updateValidApiKeyFn = deps.updateValidApiKeyFn || updateValidApiKey;
  try {
    console.log(chalk.blue("📤 Sending request to AI..."));

    const isGpt5Nano = config.OPENAI_API_MODEL == OpenAIModels.GPT_5_NANO;
    const requestPayload = {
      model: config.OPENAI_API_MODEL,
      messages: [{ role: "user", content: prompt }],
      ...(isGpt5Nano && {
        reasoning_effort: "low",
        verbosity: "low",
      }),
    };

    const response = await openai.chat.completions.create(requestPayload);
    console.log(chalk.green("✅ Response received."));

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(chalk.red("❌ Error analyzing updated code:"), error.message);
    if(error.message.includes("401")) {
      await updateValidApiKeyFn(deps);
      return analyzeUpdatedCode(files, promptType, deps);
    } else{
      throw error;
    }
  }
}

/**
 * Get the context token limit for the configured model.
 * The `OPENAI_API_CONTEXT_LIMIT` configuration key overrides the built-in table,
 * allowing local runtimes (LM Studio, Ollama) to declare their real `n_ctx`.
 * @returns {Promise<number>} The token limit for the model
 */
export async function getModelContextLimit() {
  const config = await validateConfiguration();
  const configuredLimit = Number(config[ConfigKeys.OPENAI_API_CONTEXT_LIMIT]);
  if (Number.isFinite(configuredLimit) && configuredLimit > 0) {
    return Math.floor(configuredLimit);
  }
  const model = config.OPENAI_API_MODEL;
  return ModelContextLimits[model] || ModelContextLimits["default"];
}

function truncateTextForSummary(text, promptPrefix, contextLimit) {
  const promptBudget = computePromptBudget(contextLimit, RESERVED_FOR_SUMMARY_RESPONSE);
  const maxTextTokens = promptBudget - estimateTokens(promptPrefix);

  const truncated = truncateToTokenBudget(text, maxTextTokens);
  if (truncated.length < (text || "").length) {
    console.warn(chalk.yellow(`⚠️  Text truncated from ${text.length} to ${truncated.length} chars to fit model context`));
  }
  return truncated;
}

/**
 * Summarize arbitrary text using the configured OpenAI model.
 * This helper is intended for internal use by contextManager to reduce token usage.
 */
export async function summarizeText(text, deps = {}) {
  const config = await validateConfiguration();
  const openai = createOpenAIInstance(config, deps);

  try {
    const languageInstruction = generateLanguageInstruction(config.OPENAI_RESPONSE_LANGUAGE);
    const promptPrefix = `${languageInstruction}\nResuma de forma concisa e técnica o conteúdo a seguir. Seja direto e foque nas mudanças e impacto:\n\n`;
    
    const contextLimit = await getModelContextLimit();
    const contentToSummarize = truncateTextForSummary(text, promptPrefix, contextLimit);

    const promptBudget = computePromptBudget(contextLimit, RESERVED_FOR_SUMMARY_RESPONSE);
    const fullPrompt = truncateToTokenBudget(promptPrefix + contentToSummarize, promptBudget);

    const requestPayload = {
      model: config.OPENAI_API_MODEL,
      messages: [{ role: "user", content: fullPrompt }],
    };

    const response = await openai.chat.completions.create(requestPayload);
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(chalk.red("❌ Error while summarizing text:"), error.message);
    throw error;
  }
}

/**
 * Diagnoses an execution error using OpenAI with web search context.
 */
export async function diagnoseErrorWithAI(errorData, webContext = "", deps = {}) {
  const config = await validateConfiguration();
  const openai = createOpenAIInstance(config, deps);
  try {
    const prompt = generateErrorDiagnosticPrompt(errorData, webContext, config);
    const contextLimit = await getModelContextLimit();
    const safePrompt = truncateToTokenBudget(prompt, computePromptBudget(contextLimit, RESERVED_FOR_ANALYSIS_RESPONSE));
    const isGpt5Nano = config.OPENAI_API_MODEL === OpenAIModels.GPT_5_NANO;
    const requestPayload = {
      model: config.OPENAI_API_MODEL,
      messages: [{ role: "user", content: safePrompt }],
      ...(isGpt5Nano && { reasoning_effort: "low", verbosity: "low" }),
    };

    const response = await openai.chat.completions.create(requestPayload);
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(chalk.red("❌ Error during AI error diagnosis:"), error.message);
    throw error;
  }
}

/**
 * Asks AI for command recommendation and guidance.
 */
export async function askAIAssistantForCommand(queryData, deps = {}) {
  const config = await validateConfiguration();
  const openai = createOpenAIInstance(config, deps);
  try {
    console.log(chalk.blue("📤 Enviando solicitação para a IA..."));
    const prompt = generateCommandAssistantPrompt(queryData, config);
    const contextLimit = await getModelContextLimit();
    const safePrompt = truncateToTokenBudget(prompt, computePromptBudget(contextLimit, RESERVED_FOR_ANALYSIS_RESPONSE));
    const isGpt5Nano = config.OPENAI_API_MODEL === OpenAIModels.GPT_5_NANO;
    const requestPayload = {
      model: config.OPENAI_API_MODEL,
      messages: [{ role: "user", content: safePrompt }],
      ...(isGpt5Nano && { reasoning_effort: "low", verbosity: "low" }),
    };

    const response = await openai.chat.completions.create(requestPayload);
    console.log(chalk.green("✅ Resposta recebida da IA."));
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(chalk.red("❌ Error during AI command assistance:"), error.message);
    throw error;
  }
}


