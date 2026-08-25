import chalk from "chalk";
import { validateConfiguration, updateValidApiKey } from "./configManager.js";
import { OpenAI } from "openai";
import { OpenAIModels, PromptType, ModelContextLimits } from "./models.js";
import {
  generatePrompt,
  generateLanguageInstruction,
  generateErrorDiagnosticPrompt,
  generateCommandAssistantPrompt,
} from "./prompts.js";

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
  
  const prompt = generatePrompt(files, promptType, config);
  
  // Validate prompt size against model context limit
  const contextLimit = await getModelContextLimit();
  const RESERVED_FOR_RESPONSE = 2000; // Reserve tokens for the AI response
  const estimatedPromptTokens = Math.ceil(prompt.length / 4);
  const maxAllowedTokens = contextLimit - RESERVED_FOR_RESPONSE;
  
  if (estimatedPromptTokens > maxAllowedTokens) {
    // Prompt is too large - need to reduce file diffs
    console.warn(chalk.yellow(`⚠️  Prompt too large (${estimatedPromptTokens} tokens). Truncating files to fit ${maxAllowedTokens} tokens...`));
    
    // Calculate how much we need to reduce
    const maxDiffCharsTotal = Math.floor(maxAllowedTokens * 4 * 0.6); // 60% of available space for diffs
    let currentDiffChars = files.reduce((sum, f) => sum + (f.diff || "").length, 0);
    
    if (currentDiffChars > maxDiffCharsTotal) {
      const ratio = maxDiffCharsTotal / currentDiffChars;
      const truncatedFiles = files.map(file => {
        const maxDiffChars = Math.floor((file.diff || "").length * ratio);
        if ((file.diff || "").length > maxDiffChars) {
          return {
            ...file,
            diff: file.diff.substring(0, maxDiffChars) + "\n... [truncated due to model context limit]"
          };
        }
        return file;
      });
      
      // Regenerate prompt with truncated files
      const newPrompt = generatePrompt(truncatedFiles, promptType, config);
      const newEstimatedTokens = Math.ceil(newPrompt.length / 4);
      console.log(chalk.yellow(`✂️  Reduced from ${estimatedPromptTokens} to ${newEstimatedTokens} tokens`));
      
      return analyzeWithPrompt(openai, newPrompt, config, files, promptType, deps);
    }
  }
  
  return analyzeWithPrompt(openai, prompt, config, files, promptType, deps);
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
 * @returns {Promise<number>} The token limit for the model
 */
export async function getModelContextLimit() {
  const config = await validateConfiguration();
  const model = config.OPENAI_API_MODEL;
  return ModelContextLimits[model] || ModelContextLimits["default"];
}

function truncateTextForSummary(text, promptPrefix, contextLimit) {
  const RESERVED_FOR_RESPONSE = 1000;
  const prefixTokens = Math.ceil(promptPrefix.length / 4);
  const maxTextTokens = contextLimit - RESERVED_FOR_RESPONSE - prefixTokens;
  const maxTextChars = maxTextTokens * 4;

  if (text.length > maxTextChars) {
    console.warn(chalk.yellow(`⚠️  Text truncated from ${text.length} to ${maxTextChars} chars to fit model context`));
    return text.substring(0, maxTextChars) + "\n... [truncated]";
  }
  return text;
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
    
    const fullPrompt = promptPrefix + contentToSummarize;
    const estimatedTokens = Math.ceil(fullPrompt.length / 4);
    const RESERVED_FOR_RESPONSE = 1000;
    
    if (estimatedTokens + RESERVED_FOR_RESPONSE > contextLimit) {
      throw new Error(`Prompt too large: ${estimatedTokens} tokens (+ ${RESERVED_FOR_RESPONSE} for response) exceeds limit of ${contextLimit}`);
    }

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
    const isGpt5Nano = config.OPENAI_API_MODEL === OpenAIModels.GPT_5_NANO;
    const requestPayload = {
      model: config.OPENAI_API_MODEL,
      messages: [{ role: "user", content: prompt }],
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
    const prompt = generateCommandAssistantPrompt(queryData, config);
    const isGpt5Nano = config.OPENAI_API_MODEL === OpenAIModels.GPT_5_NANO;
    const requestPayload = {
      model: config.OPENAI_API_MODEL,
      messages: [{ role: "user", content: prompt }],
      ...(isGpt5Nano && { reasoning_effort: "low", verbosity: "low" }),
    };

    const response = await openai.chat.completions.create(requestPayload);
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(chalk.red("❌ Error during AI command assistance:"), error.message);
    throw error;
  }
}


