# 📄 Documentação do Módulo: `src/configManager.js`

## 📌 Visão Geral
O módulo `src/configManager.js` é o gerenciador central de configurações da aplicação. Ele aplica valores padrão (modelo de IA, idioma e servidor local), gerencia a validação da chave de API da OpenAI, permite atualização manual via formato `CHAVE=VALOR`, trata o reset interativo de configurações e oferece suporte à validação via e-mail institucional ou ambiente local (LM Studio / Ollama).

---

## 🛠️ Dependências e Importações

### Dependências Externas
- `chalk`: Formatação de saídas no terminal.
- `inquirer`: Prompts interativos de entrada de texto e confirmação.

### Módulos Internos Importados
- [`src/config.js`](file:///d:/GitHub/ai_commit_review/src/config.js): `loadConfig`, `saveConfig`, `deleteConfigFile`.
- [`src/models.js`](file:///d:/GitHub/ai_commit_review/src/models.js): Enums `OpenAIModels`, `ConfigKeys`, `SupportedLanguages`.
- [`src/validateEmail.js`](file:///d:/GitHub/ai_commit_review/src/validateEmail.js): `configByNTAPPEmail`, `configBaseUrlLocal`.
- [`src/crypto.js`](file:///d:/GitHub/ai_commit_review/src/crypto.js): `decriptografar`.

---

## 🔄 Funções Exportadas

### `validateConfiguration()`
- **Descrição**: Função assíncrona principal de validação de estado da aplicação.
- **Fluxo**:
  1. Carrega as configurações via `loadConfig()`.
  2. Verifica e aplica configurações para servidor local AI via `setBaseURLOpenAILocal(config)`.
  3. Aplica modelo padrão via `setDefaultModel(config)` (`GPT_5_NANO` para chaves remotas ou `OSS_20B_LOCAL` para chave `'local'`).
  4. Aplica idioma padrão via `setDefaultLanguage(config)` (`pt-BR`).
  5. Caso não existam `OPENAI_API_KEY` nem `OPENAI_API_BASEURL`:
     - Tenta validação por e-mail via `configByNTAPPEmail()`.
     - Caso não seja configurado, dispara solicitação interativa da chave de API via `updateValidApiKey()`.
- **Retorno**: `Promise<Object>` (objeto de configuração validado).

### `ensureValidApiKey()`
- **Descrição**: Garante que a aplicação possui uma configuração válida antes de executar comandos protegidos.
- **Comportamento**: Invoca `validateConfiguration()`. Se ocorrer erro e a tentativa por e-mail (`configByNTAPPEmail()`) falhar, encerra o processo com `process.exit(1)`.

### `resetConfig()`
- **Descrição**: Exibe confirmação interativa com `inquirer.prompt` (`Delete the configuration file and start a new setup?`, padrão `false`).
- **Comportamento**: Exclui o arquivo `.config.json` via `deleteConfigFile()` somente se o usuário confirmar (`restartConfig === true`).

### `updateConfigFromString(configString)`
- **Parâmetros**: `configString` (`string`) - String no formato `CHAVE=VALOR`.
- **Validações**:
  - Garante o separador `=`.
  - Converte a chave para maiúsculas e valida contra o enum `ConfigKeys`.
  - Se a chave for `OPENAI_API_MODEL`, valida se o valor pertence ao enum `OpenAIModels`.
  - Se a chave for `OPENAI_RESPONSE_LANGUAGE`, valida se o valor é um código em `SupportedLanguages`.
- **Ação**: Persiste a nova configuração via `saveConfig(config)` e re-valida via `validateConfiguration()`.

### `setApiKeyOpenAINTapp()`
- **Descrição**: Se `OPENAI_API_KEY` não estiver definida na configuração, descriptografa a chave presente na variável de ambiente `process.env.CRIPTO_OPENAI_KEY` e a salva na configuração.

### `setBaseURLOpenAILocal(config)`
- **Descrição**: Caso `OPENAI_API_BASEURL` e `OPENAI_API_MODEL` não estejam definidos, verifica se há um servidor local ativo via `configBaseUrlLocal()`.
- **Configurações Locais Padrão**:
  - `OPENAI_API_BASEURL`: `"http://127.0.0.1:1234/v1"`
  - `OPENAI_API_MODEL`: `OpenAIModels.OSS_20B_LOCAL`
  - `OPENAI_API_KEY`: `"local"`

### `updateValidApiKey()`
- **Descrição**: Solicita interativamente que o usuário digite sua `OPENAI_API_KEY` via terminal, atualiza as configurações e valida.
