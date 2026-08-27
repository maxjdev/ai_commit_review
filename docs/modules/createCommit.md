# 📄 Documentação do Módulo: `src/createCommit.js`

## 📌 Visão Geral
O módulo `src/createCommit.js` implementa o fluxo guiado interativo para a criação de commits assistidos por IA (`acr create`). O processo engloba validação de branch, sincronização remota (`pull`), resolução de conflitos, staging automático de alterações, geração/edição da mensagem de commit via IA ou entrada manual, opção de abortar o commit realizado e envio remoto (`push`).

---

## 🛠️ Dependências e Importações

### Dependências Nativas Node.js
- `fs`: Leitura e exclusão de arquivos temporários de mensagem de commit.
- `path`: Junção de caminhos para temporários.
- `os`: Obtenção do diretório de temporários (`os.tmpdir()`).

### Dependências Externas
- `chalk`: Formatação de saídas coloridas no terminal.
- `inquirer`: Prompts interativos de entrada, escolha de listas e confirmação.

### Módulos Internos Importados
- [`src/gitUtils.js`](file:///d:/GitHub/ai_commit_review/src/gitUtils.js): Funções de controle de repositório Git.
- [`src/openaiUtils.js`](file:///d:/GitHub/ai_commit_review/src/openaiUtils.js): `analyzeUpdatedCode`.
- [`src/contextManager.js`](file:///d:/GitHub/ai_commit_review/src/contextManager.js): `buildContextForFiles`.
- [`src/models.js`](file:///d:/GitHub/ai_commit_review/src/models.js): Enum `PromptType`.

---

## 🔄 Fluxo Operacional Guiado (`createCommit`)

1. **Confirmação / Troca de Branch (`confirmOrSwitchBranch`)**:
   - Exibe a branch atual. Se o usuário optar por trocar de branch, exibe a lista de branches locais e executa `switchBranch`.

2. **Atualização Remota (`pullChanges`)**:
   - Executa `git pull --no-rebase`.

3. **Limpeza da Staging Area (`clearStage`)**:
   - Executa `git reset` para garantir o controle total sobre o estado dos arquivos.

4. **Verificação e Resolução de Conflitos (`verifyConflicts`)**:
   - Se existirem conflitos (`checkConflicts`), apresenta 3 opções ao usuário:
     - `manual`: Abre cada arquivo de conflito no editor do sistema para resolução manual (`resolveConflictsManually`).
     - `automatic`: Executa `git mergetool -- <file>` para cada arquivo (`resolveConflictsAutomatically`).
     - `cancel`: Encerra o processo com `process.exit(1)`.

5. **Staging Geral (`stageAllChanges`)**:
   - Executa `git add .` para adicionar todas as alterações resolvidas e pendentes.

6. **Definição da Mensagem de Commit**:
   - Apresenta as opções:
     - `Generate with AI and edit`: Processa os diffs pelo `contextManager`, solicita a mensagem de commit via `analyzeUpdatedCode(condensed, PromptType.CREATE)` e salva em arquivo temporário `commit_message.txt`.
     - `Write my own`: Solicita o texto da mensagem no terminal.
     - `Cancel`: Aborta e encerra o processo com `process.exit(0)`.
   - Abre o editor configurado do Git (`commitChangesWithEditor`) para revisão/ajuste final da mensagem pelo usuário.

7. **Confirmação ou Aborto do Commit (`undoLastCommitSoft`)**:
   - Pergunta se o usuário deseja abortar o commit.
   - Se confirmado (`abortCommit === true`), executa `undoLastCommitSoft()` (`git reset --soft HEAD~1`), mantendo as alterações em staged/unstaged, e encerra o processo com `process.exit(0)`.

8. **Envio Remoto (`pullChanges` + `pushChanges`)**:
   - Pergunta se o usuário deseja fazer o push para o repositório remoto.
   - Se confirmado (`push === true`), executa `pullChanges()` (`git pull --no-rebase`) antes de `pushChanges()` (`git push`), garantindo sincronização remota antes e depois do commit e evitando bifurcações.

---

## 🔄 Funções Exportadas

### `createCommit()`
- **Descrição**: Função assíncrona principal que executa os 8 passos do fluxo interativo de criação de commit assistido por IA.

---

## 🧪 Testes e Isolamento de Efeitos Colaterais
A função `createCommit(deps = {})` utiliza o padrão *Dependency Injection* (`getDeps`). Durante a execução de testes automatizados, é **obrigatório** fornecer um objeto `safeDeps` contendo mocks para `clearStageFn`, `stageAllChangesFn`, `pullChangesFn` e `pushChangesFn`, evitando qualquer mutação no Git de desenvolvimento/produção.
