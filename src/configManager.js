import chalk from "chalk";
import { loadConfig, saveConfig, deleteConfigFile } from "./config.js";
import { OpenAIModels, ConfigKeys, SupportedLanguages } from "./models.js";
import inquirer from "inquirer";
import { configByNTAPPEmail, configBaseUrlLocal } from "./validateEmail.js";
import { decriptografar } from "./crypto.js";

/**
 * Sets the default OpenAI model to 'gpt-4o-mini' if not already set.
 * @param {object} config - The current configuration object.
 * @returns {object} - The updated configuration object.
 */
export function setApiKeyOpenAINTapp() {
  const config = loadConfig();
  if (!config[ConfigKeys.OPENAI_API_KEY]) {
    const apiKey = decriptografar(process.env.CRIPTO_OPENAI_KEY || "key_fallback");
    config[ConfigKeys.OPENAI_API_KEY] = apiKey;
    saveConfig(config);
    console.log(
      chalk.green(
        `✅ OPENAI_API_KEY not set. Defaulting to NTAPP.`
      )
    );
  }
  return config;
}

export async function resetConfig(promptFn = inquirer.prompt) {
  const { restartConfig } = await promptFn([
    {
      type: "confirm",
      name: "restartConfig",
      message: "Delete the configuration file and start a new setup?",
      default: false
    }
  ]);
  if (restartConfig) {
    deleteConfigFile();
  }
}

export async function setBaseURLOpenAILocal(config, configBaseUrlLocalFn = configBaseUrlLocal) {
  if (!config[ConfigKeys.OPENAI_API_BASEURL] && !config[ConfigKeys.OPENAI_API_MODEL]) {
    const isLocal = await configBaseUrlLocalFn();
    if (isLocal) {
      config[ConfigKeys.OPENAI_API_BASEURL] = "http://127.0.0.1:1234/v1";
      config[ConfigKeys.OPENAI_API_MODEL] = OpenAIModels.QWEN_9B_LOCAL;
      config[ConfigKeys.OPENAI_API_KEY] = "local";
      saveConfig(config);
      console.log(
        chalk.green(
          `✅ OPENAI_API_BASEURL for local AI is ok.`
        )
      );
    }
  }
  return config;
}

/**
 * Sets the default OpenAI model if not already set.
 * @param {object} config - The current configuration object.
 * @returns {object} - The updated configuration object.
 */
export function setDefaultModel(config) {
  if (!config[ConfigKeys.OPENAI_API_MODEL]) {
    if (config[ConfigKeys.OPENAI_API_KEY] !== 'local') {
      config[ConfigKeys.OPENAI_API_MODEL] = OpenAIModels.GPT_5_NANO;
    } else {
      config[ConfigKeys.OPENAI_API_MODEL] = OpenAIModels.OSS_20B_LOCAL;
    }
    saveConfig(config);
    console.log(
      chalk.green(
        `✅ OPENAI_API_MODEL not set. Defaulting to '${config[ConfigKeys.OPENAI_API_MODEL]}'.`
      )
    );
  }
  return config;
}

/**
 * Sets the default language to Portuguese (PT-BR) if not already set.
 * @param {object} config - The current configuration object.
 * @returns {object} - The updated configuration object.
 */
export function setDefaultLanguage(config) {
  if (!config[ConfigKeys.OPENAI_RESPONSE_LANGUAGE]) {
    config[ConfigKeys.OPENAI_RESPONSE_LANGUAGE] = SupportedLanguages.PT_BR.code;
    saveConfig(config);
    console.log(
      chalk.green(
        `✅ OPENAI_RESPONSE_LANGUAGE not set. Defaulting to '${SupportedLanguages.PT_BR.code}: ${SupportedLanguages.PT_BR.name}'.`
      )
    );
  }
  return config;
}

/**
 * Validates the current configuration.
 * @returns {object} - The validated configuration object.
 * @throws Will throw an error if mandatory configurations are missing or invalid.
 */
export async function validateConfiguration(deps = {}) {
  const configBaseUrlLocalFn = deps.configBaseUrlLocalFn || configBaseUrlLocal;
  const configByNTAPPEmailFn = deps.configByNTAPPEmailFn || configByNTAPPEmail;
  const updateValidApiKeyFn = deps.updateValidApiKeyFn || updateValidApiKey;

  let config = loadConfig();

  config = await setBaseURLOpenAILocal(config, configBaseUrlLocalFn);
  config = setDefaultModel(config);
  config = setDefaultLanguage(config);

  if (!config.OPENAI_API_KEY && !config.OPENAI_API_BASEURL) {
    const configurado = await configByNTAPPEmailFn();
    if (!configurado) {
      await updateValidApiKeyFn(deps);
    }
    config = loadConfig();
  }

  return config;
}

export async function ensureValidApiKey(deps = {}) {
  const configByNTAPPEmailFn = deps.configByNTAPPEmailFn || configByNTAPPEmail;
  try {
    await validateConfiguration(deps);
  } catch (error) {
    console.log(chalk.red("❌ ACR not configured."));
    const configurado = await configByNTAPPEmailFn();
    if (!configurado) {
      console.log(chalk.red("❌ ACR not configured. Set configs manualy."));
      throw new Error("ACR not configured.");
    }
  }
}

export async function updateValidApiKey(deps = {}) {
  const promptFn = deps.promptFn || inquirer.prompt;
  const { apiKey } = await promptFn([
    {
      type: "input",
      name: "apiKey",
      message: "Please enter your OpenAI API key:",
    },
  ]);

  try {
    updateConfigFromString(`OPENAI_API_KEY=${apiKey}`);
    await validateConfiguration(deps);
  } catch (updateError) {
    console.error(
      chalk.red("❌ Failed to configure API key: " + updateError.message)
    );
    throw updateError;
  }
}

function validateConfigKey(key) {
  const validKeys = Object.values(ConfigKeys);
  if (!validKeys.includes(key)) {
    throw new Error(
      `Invalid configuration key "${key}".\n\n` +
      `Available keys:\n` +
      validKeys.map((k) => `  - ${k}`).join("\n") +
      `\n\nUse one of the listed keys.`
    );
  }
}

function validateContextLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1024) {
    throw new Error(
      `❌ Invalid context limit "${value}".\n\n` +
      `Use an integer greater than or equal to 1024 (e.g. 'acr set_config OPENAI_API_CONTEXT_LIMIT=16384').`
    );
  }
}

function validateConfigValue(key, value) {
  if (key === ConfigKeys.OPENAI_API_CONTEXT_LIMIT) {
    validateContextLimit(value);
  }

  if (key === ConfigKeys.OPENAI_API_MODEL) {
    const validModels = Object.values(OpenAIModels);
    if (!validModels.includes(value)) {
      throw new Error(
        `❌ Invalid AI model provided.\n\n` +
        `Available models:\n` +
        validModels.map((model) => `  - ${model}`).join("\n") +
        `\n\nUse one of the listed models.`
      );
    }
  }

  if (key === ConfigKeys.OPENAI_RESPONSE_LANGUAGE) {
    const validLanguages = Object.values(SupportedLanguages).map(
      (lang) => lang.code
    );
    if (!validLanguages.includes(value)) {
      throw new Error(
        `❌ Invalid language code "${value}" provided.\n\n` +
        `Supported languages:\n` +
        Object.values(SupportedLanguages)
          .map((lang) => `  - ${lang.code}: ${lang.name}`)
          .join("\n") +
        `\n\nUse one of the listed language codes.`
      );
    }
  }
}

/**
 * Updates the configuration from a key-value string.
 * @param {string} configString - The configuration string in the format KEY=VALUE.
 * @throws Will throw an error if the format is invalid or if the key/value is not supported.
 */
export function updateConfigFromString(configString) {
  const index = configString.indexOf("=");
  if (index === -1) {
    throw new Error("Invalid format.\n\nUse 'acr set_config KEY=VALUE'");
  }

  const key = configString.substring(0, index).trim().toUpperCase();
  const value = configString.substring(index + 1).trim();

  if (!key || !value) {
    throw new Error("Invalid format.\n\nUse 'acr set_config KEY=VALUE'");
  }

  validateConfigKey(key);
  validateConfigValue(key, value);

  const config = loadConfig();
  config[key] = value;
  saveConfig(config);

  console.log(chalk.green(`\n✅ Configuration "${key}" updated.`));
  return config;
}
