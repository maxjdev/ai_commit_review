# 📄 Documentação do Módulo: `src/featureMerge.js`

## 📌 Visão Geral

O módulo `src/featureMerge.js` implementa o comando `acr mergeFeature`. Ele gerencia a finalização do ciclo de desenvolvimento de feature branches (ex: `feature/*`, `fix/*`, `chore/*`), automatizando a sincronização bidirecional e preventiva com a branch `develop`, o merge commit formal (`--no-ff`), o tratamento resiliente de conflitos e o encadeamento opcional para o fluxo de testes (`acr updateTestServer`).

---

## 🛠️ Dependências e Importações

### Dependências Externas

- `chalk`: Formatação e saídas coloridas no terminal.
- `inquirer`: Prompts interativos de confirmação de sincronização prévia e acionamento de testes.

### Módulos Internos Importados

- [`src/gitUtils.js`](file:///c:/Users/Public/GitHub/ai_commit_review-master/src/gitUtils.js): `getCurrentBranch`, `switchBranch`, `pullChanges`, `pushChanges`, `executeGitCommand`.
- [`src/gitConflictHandlers.js`](file:///c:/Users/Public/GitHub/ai_commit_review-master/src/gitConflictHandlers.js): `verifyConflicts`.
- [`src/testServerUpdate.js`](file:///c:/Users/Public/GitHub/ai_commit_review-master/src/testServerUpdate.js): `updateServerToTest`.

---

## 🔄 Fluxos de Execução

### 1. Validação de Sanidade e Segurança

- `validateCleanWorktree(deps)`:
  - Executa `git status --porcelain`.
  - Se houver arquivos modificados ou unstaged, lança exceção com aviso amigável, impedindo operações de merge em estado sujo.
- `validateFeatureBranch(branch)`:
  - Valida se a branch atual não pertence à lista de branches protegidas/base (`develop`, `teste`, `test`, `master`, `main`) e se não está vazia.

### 2. Análise de Divergência e Defasagem

- `getBranchDivergence(featureBranch, targetBranch, deps)`:
  - Executa `git fetch origin <targetBranch>`.
  - Calcula a contagem de commits de diferença:
    - Commits que o destino avançou: `git rev-list --count HEAD..origin/<targetBranch>`.
    - Commits locais exclusivos da feature: `git rev-list --count origin/<targetBranch>..HEAD`.
  - Retorna `{ behind, ahead }`. Em caso de falha de conexão/upstream, assume `{ behind: 0, ahead: 0 }`.

### 3. Sincronização Preventiva (`develop` ➔ `feature`)

- Se `behind > 0`, alerta o usuário e pergunta se deseja mesclar a `develop` na feature primeiro.
- `syncDevelopIntoFeature(featureBranch, targetBranch, deps)`:
  - Executa `git merge origin/<targetBranch> -m "Sync <targetBranch> into <featureBranch>"`.
  - Se houver conflito: delega para `verifyConflicts()`. Se não resolvido pelo desenvolvedor, executa `git merge --abort` e cancela a operação de forma segura.
  - Se resolvido ou sem conflitos: executa `pushChanges()` na branch de feature.

### 4. Merge Commit na Branch de Destino (`feature` ➔ `develop`)

- `mergeFeatureIntoDevelop(featureBranch, targetBranch, deps)`:
  - Alterna para a branch de destino (`develop`) via `switchBranch()`.
  - Executa `pullChanges()` para garantir que a `develop` local esteja em dia com o remoto.
  - Executa merge explícito sem fast-forward:
    ```bash
    git merge --no-ff -m "Merge branch '<featureBranch>' into <targetBranch>" "<featureBranch>"
    ```
  - Se houver conflitos: invoca `verifyConflicts()`. Caso o usuário cancele, executa `git merge --abort`, retorna para a branch de feature original e relança a exceção.
  - Publica o merge no repositório remoto com `pushChanges()`.

### 5. Encadeamento Opcional para Testes

- `promptTestServerUpdate(deps)`:
  - Pergunta interativamente ao desenvolvedor se deseja acionar imediatamente o deploy para o ambiente de testes (`updateTestServer`).
  - Se confirmado, delega a execução para `updateServerToTest(deps)`.

---

## 🧪 Testes e Isolamento de Efeitos Colaterais

- Suporta 100% de injeção de dependências em `getDeps(deps)`.
- Toda a suíte de testes em `tests/featureMerge.test.js` mocka comandos Git, operações do sistema de arquivos e prompts do Inquirer, assegurando que o estado local do repositório de trabalho nunca seja alterado durante a execução dos testes automatizados (em conformidade com a Regra 5 do `AGENTS.md`).
