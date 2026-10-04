# 📄 Documentação do Módulo: `src/mergeBranch.js`

## 📌 Visão Geral
O módulo `src/mergeBranch.js` implementa o comando `acr mergeBranch [targetBranch]`. Ele fornece um mecanismo flexível e seguro de integração entre branches no Git, permitindo mesclar a branch atual para qualquer branch de destino (ex.: `develop`, `teste`, `master` ou branches customizadas). O fluxo automatiza a verificação de alterações pendentes, análise de defasagem de commits, sincronização preventiva, criação de **Merge Commit** formal (`--no-ff`), tratamento assistido de conflitos e encadeamento opcional para o servidor de testes quando o destino for `develop`.

---

## 🛠️ Dependências e Importações

### Dependências Externas
- `chalk`: Saídas estilizadas e diagnósticos coloridos no terminal.
- `inquirer`: Prompts interativos para seleção de branch destino, confirmações de sincronização e opções de resolução.

### Módulos Internos Importados
- [`src/gitUtils.js`](file:///c:/Users/Public/GitHub/ai_commit_review-master/src/gitUtils.js): `getCurrentBranch`, `listBranches`, `switchBranch`, `pullChanges`, `pushChanges`, `executeGitCommand`.
- [`src/gitConflictHandlers.js`](file:///c:/Users/Public/GitHub/ai_commit_review-master/src/gitConflictHandlers.js): `verifyConflicts`.
- [`src/testServerUpdate.js`](file:///c:/Users/Public/GitHub/ai_commit_review-master/src/testServerUpdate.js): `updateServerToTest`.

---

## 🔄 Fluxos de Execução

### 1. Tratamento de Alterações Pendentes (`checkUncommittedChanges`)
- Executa `git status --porcelain`.
- Se houver arquivos modificados, deletados ou em staged, pergunta interativamente ao desenvolvedor se deseja realizar o commit antes do merge.
  - **Se Sim**: Dispara o fluxo padrão de commit assistido por IA (`createCommit`).
  - **Se Não** (ou se o commit for cancelado): Guarda automaticamente as alterações no stash (`git stash push -u -m "ACR auto-stash before merge"`) e prossegue com segurança com o merge.

### 2. Seleção e Validação da Branch de Destino
- Se a branch de destino for informada via argumento CLI (`acr mergeBranch master`), utiliza diretamente o parâmetro.
- Se não for informada, `promptTargetBranch` consulta as branches locais via `listBranches` e exibe um menu interativo para o usuário escolher o destino (ou digitar um nome customizado).
- `validateBranches`: Impede mesclagem de uma branch nela mesma e valida strings não vazias.

### 3. Análise de Divergência e Defasagem
- `getBranchDivergence(sourceBranch, targetBranch, deps)`:
  - Executa `git fetch origin <targetBranch>` para consultar metadados remotos atualizados.
  - Calcula a contagem de commits de diferença:
    - Commits que o destino avançou: `git rev-list --count HEAD..origin/<targetBranch>`.
    - Commits locais exclusivos da branch atual: `git rev-list --count origin/<targetBranch>..HEAD`.
  - Retorna `{ behind, ahead }`.

### 4. Sincronização Preventiva (`targetBranch` ➔ `sourceBranch`)
- Se `behind > 0`, alerta o desenvolvedor sobre a quantidade de commits de defasagem e pergunta se deseja sincronizar a branch destino na sua branch antes da integração.
- `syncTargetIntoSource(sourceBranch, targetBranch, deps)`:
  - Executa `git merge origin/<targetBranch> -m "Sync <targetBranch> into <sourceBranch>"`.
  - Se houver conflitos: delega para `verifyConflicts()`. Se não resolvido, executa `git merge --abort` e cancela a operação com segurança.
  - Se resolvido ou sem conflitos: executa `pushChanges()` na branch de origem.

### 5. Criação do Merge Commit na Branch de Destino
- `executeBranchMerge(sourceBranch, targetBranch, deps)`:
  - Alterna para a branch de destino via `switchBranch()`.
  - Executa `pullChanges()` para garantir paridade com o servidor remoto.
  - Executa o merge formal sem fast-forward:
    ```bash
    git merge --no-ff -m "Merge branch '<sourceBranch>' into <targetBranch>" "<sourceBranch>"
    ```
  - Se houver conflitos: aciona `verifyConflicts()`. Caso o usuário cancele, executa `git merge --abort`, retorna para a branch de origem e encerra.
  - Envia as alterações com `pushChanges()`.

### 6. Encadeamento Opcional
- `promptFollowupAction(targetBranch, deps)`:
  - Quando a branch de destino for `develop`, pergunta interativamente se o desenvolvedor deseja disparar o deploy para testes (`updateTestServer`).

---

## 🧪 Testes e Isolamento de Efeitos Colaterais
- O módulo utiliza injeção de dependências via `getDeps(deps)`.
- A suíte de testes em `tests/mergeBranch.test.js` mocka comandos Git e prompts interativos no padrão AAA, assegurando que o repositório local nunca sofra alterações de estado durante os testes automatizados (Regra 5 do `AGENTS.md`).
