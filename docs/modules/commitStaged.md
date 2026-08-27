# 📄 Documentação do Módulo: `src/commitStaged.js`

## 📌 Visão Geral
O módulo `src/commitStaged.js` implementa o comando `acr commit`. Diferente do `createCommit.js` (que limpa e re-adiciona todas as alterações do repositório), o `commitStaged.js` preserva o estado atual da área de staging, processando estritamente os arquivos que já foram previamente marcados via `git add` pelo desenvolvedor.

---

## 🛠️ Dependências e Importações

### Dependências Nativas Node.js
- `fs`: Leitura e remoção de arquivo temporário de mensagem de commit.
- `path`: Junção de caminhos do sistema.
- `os`: Diretório temporário do sistema (`os.tmpdir()`).

### Dependências Externas
- `chalk`: Saídas estilizadas no console.
- `inquirer`: Interfaces de terminal interativas (confirmações e entradas).

### Módulos Internos Importados
- [`src/gitUtils.js`](file:///d:/GitHub/ai_commit_review/src/gitUtils.js): Operações de controle de versão Git.
- [`src/openaiUtils.js`](file:///d:/GitHub/ai_commit_review/src/openaiUtils.js): `analyzeUpdatedCode`.
- [`src/models.js`](file:///d:/GitHub/ai_commit_review/src/models.js): Enum `PromptType`.

---

## 🔄 Fluxo Operacional (`commitStaged`)

1. **Validação da Branch (`confirmOrSwitchBranch`)**:
   - Confirma a branch ativa ou permite alternar para outra branch local.

2. **Sincronização Remota (`pullChanges`)**:
   - Executa `git pull --no-rebase`.

3. **Verificação de Conflitos (`verifyConflicts`)**:
   - Checa a existência de conflitos no repositório (`checkConflicts`) e permite resolução manual ou via `git mergetool`.

4. **Coleta de Alterações Staged (`getStagedFilesDiffs`)**:
   - Lê os arquivos e diffs presentes na área de staging. Se nada estiver em staging, avisa o usuário e encerra com `process.exit(0)`.

5. **Geração / Edição da Mensagem de Commit**:
   - `Generate with AI and edit`: Envia os diffs staged diretamente para `analyzeUpdatedCode(stagedFiles, PromptType.CREATE)`.
   - `Write my own`: Solicita o texto via prompt.
   - Grava a mensagem em arquivo temporário `commit_message.txt` e abre o editor do Git (`commitChangesWithEditor`) para revisão final.

6. **Confirmação ou Aborto do Commit (`undoLastCommitSoft`)**:
   - Pergunta se o usuário deseja abortar o commit. Caso afirmativo, executa `undoLastCommitSoft()` (`git reset --soft HEAD~1`) e encerra o processo.

7. **Push Remoto (`pullChanges` + `pushChanges`)**:
   - Pergunta se o usuário deseja enviar as alterações para o repositório remoto.
   - Se confirmado, executa `pullChanges()` (`git pull --no-rebase`) antes de `pushChanges()` (`git push`), evitando bifurcações e merges inesperados.

---

## 🔄 Funções Exportadas

### `commitStaged()`
- **Descrição**: Função assíncrona principal que orquestra o fluxo de commit exclusivo para alterações em staging.

---

## 🧪 Testes e Isolamento de Efeitos Colaterais
A função `commitStaged(deps = {})` utiliza o padrão *Dependency Injection* (`getDeps`). Durante a execução de testes automatizados, é **obrigatório** fornecer um objeto `safeDeps` contendo mocks para `pullChangesFn`, `pushChangesFn` e `getStagedFilesDiffsFn`, garantindo o isolamento completo contra o Git local.
