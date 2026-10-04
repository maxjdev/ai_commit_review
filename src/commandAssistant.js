// commandAssistant.js
import chalk from "chalk";
import inquirer from "inquirer";
import { execSync } from "child_process";
import { askAIAssistantForCommand } from "./openaiUtils.js";

export const AVAILABLE_COMMANDS = Object.freeze([
  {
    name: "analyze",
    signature: "acr analyze",
    description: "Analisa os commits recentes do repositório local com IA",
  },
  {
    name: "create",
    signature: "acr create",
    description: "Cria um novo commit interativo com mensagem e título gerados por IA",
  },
  {
    name: "commit",
    signature: "acr commit",
    description: "Faz o commit direto das alterações em staged com assistência de IA",
  },
  {
    name: "crypto",
    signature: "acr crypto",
    description: "Criptografa e descriptografa textos e credenciais sensíveis",
  },
  {
    name: "updateTestServer",
    signature: "acr updateTestServer",
    description: "Atualiza e prepara o servidor para o ambiente de testes",
  },
  {
    name: "updateProductionServer",
    signature: "acr updateProductionServer",
    description: "Atualiza e prepara o servidor para o ambiente de produção",
  },
  {
    name: "resetConfig",
    signature: "acr resetConfig",
    description: "Restaura as configurações da CLI para os valores padrão",
  },
  {
    name: "mergeBranch",
    signature: "acr mergeBranch [targetBranch]",
    description: "Mescla a branch atual em outra branch com merge commit e resolução de conflitos",
  },
  {
    name: "set_config",
    signature: "acr set_config <KEY=VALUE>",
    description: "Atualiza configurações da CLI (ex: OPENAI_API_KEY=...)",
  },
]);

export function getDeps(deps = {}) {
  return {
    askAIAssistantForCommandFn: deps.askAIAssistantForCommandFn || askAIAssistantForCommand,
    promptFn: deps.promptFn || inquirer.prompt,
    execSyncFn: deps.execSyncFn || execSync,
    safeExecuteCommandFn: deps.safeExecuteCommandFn,
    commandActionMap: deps.commandActionMap,
  };
}

export function renderUnknownCommandMessage(enteredCommand) {
  console.log(chalk.red(`\n❌ Comando não reconhecido: '${enteredCommand}'`));
  console.log(chalk.bold.cyan("\n📋 Comandos disponíveis no 'ai-commit-review':\n"));
  for (const cmd of AVAILABLE_COMMANDS) {
    console.log(`  ${chalk.green(cmd.signature.padEnd(28))} ${chalk.white("- " + cmd.description)}`);
  }
  console.log("");
}

export function parseSuggestedCommand(aiResponse) {
  if (!aiResponse) return null;
  const match = aiResponse.match(/SUGGESTED_CMD:\s*(.+)/i);
  if (!match) return null;
  const cmd = match[1].trim().replace(/^`+|`+$/g, "");
  if (!cmd || cmd.toLowerCase() === "none") return null;
  return cmd;
}

export function renderAIAssistanceResponse(aiResponse) {
  const cleanText = (aiResponse || "").replace(/SUGGESTED_CMD:.+/gi, "").trim();
  console.log("\n" + chalk.cyan("=".repeat(60)));
  console.log(chalk.bold.cyan("🤖 Assistente de Comandos da IA"));
  console.log(chalk.cyan("=".repeat(60)));
  console.log(cleanText);
  console.log(chalk.cyan("=".repeat(60)) + "\n");
}

export async function executeSuggestedCommand(suggestedCmd, deps = {}) {
  const d = getDeps(deps);
  const normalized = (suggestedCmd || "").trim().replace(/^acr\s+/, "");
  const cmdKey = normalized.split(" ")[0];

  if (d.commandActionMap && d.commandActionMap[cmdKey] && d.safeExecuteCommandFn) {
    console.log(chalk.blue(`🚀 Executando comando 'acr ${cmdKey}'...`));
    await d.safeExecuteCommandFn(cmdKey, d.commandActionMap[cmdKey], deps);
    return true;
  }

  console.log(chalk.blue(`⚙️ Executando: ${suggestedCmd}`));
  try {
    d.execSyncFn(suggestedCmd, { stdio: "inherit" });
    console.log(chalk.green("✔ Comando executado com sucesso!"));
    return true;
  } catch (err) {
    console.error(chalk.red(`❌ Erro ao executar comando: ${err.message}`));
    return false;
  }
}

export async function handleAIAssistance(enteredCommand, deps = {}) {
  const d = getDeps(deps);
  const { userQuery } = await d.promptFn([
    {
      type: "input",
      name: "userQuery",
      message: "💬 Descreva o que você gostaria de fazer:",
      validate: (input) => (input && input.trim().length > 0 ? true : "Por favor, digite uma descrição válida."),
    },
  ]);

  try {
    console.log(chalk.yellow("\n🔍 Consultando a IA para identificar a melhor ação..."));
    const aiResponse = await d.askAIAssistantForCommandFn(
      {
        enteredCommand,
        userQuery,
        availableCommands: AVAILABLE_COMMANDS,
      },
      deps
    );

    renderAIAssistanceResponse(aiResponse);
    const suggestedCmd = parseSuggestedCommand(aiResponse);

    if (suggestedCmd) {
      const { shouldRun } = await d.promptFn([
        {
          type: "confirm",
          name: "shouldRun",
          message: `⚡ Deseja executar o comando sugerido (${chalk.cyan(suggestedCmd)}) agora?`,
          default: true,
        },
      ]);

      if (shouldRun) {
        await executeSuggestedCommand(suggestedCmd, deps);
      }
    }
  } catch (error) {
    console.error(chalk.red("❌ Não foi possível obter assistência da IA:"), error.message);
  }
}

export async function handleCommandSelection(deps = {}) {
  const d = getDeps(deps);
  const choices = AVAILABLE_COMMANDS
    .filter((c) => !c.signature.includes("<"))
    .map((c) => ({
      name: `${c.signature.padEnd(25)} - ${c.description}`,
      value: c.name,
    }));

  const { command } = await d.promptFn([
    {
      type: "list",
      name: "command",
      message: "Selecione o comando que deseja executar:",
      choices,
    },
  ]);

  if (d.commandActionMap && d.commandActionMap[command] && d.safeExecuteCommandFn) {
    await d.safeExecuteCommandFn(command, d.commandActionMap[command], deps);
  }
}

export async function handleUnknownCommand(enteredCommand, deps = {}) {
  const d = getDeps(deps);
  renderUnknownCommandMessage(enteredCommand);

  const { action } = await d.promptFn([
    {
      type: "list",
      name: "action",
      message: "🤖 O que você deseja fazer?",
      choices: [
        { name: "🧠 Pedir ajuda à IA (descrever o que você precisa)", value: "ai_assist" },
        { name: "📋 Escolher um comando válido da lista", value: "select_command" },
        { name: "❌ Cancelar e sair", value: "cancel" },
      ],
    },
  ]);

  if (action === "ai_assist") {
    await handleAIAssistance(enteredCommand, deps);
  } else if (action === "select_command") {
    await handleCommandSelection(deps);
  }
}
