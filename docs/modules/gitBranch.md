# 📄 Documentação do Módulo: `src/gitBranch.js`

## 📌 Visão Geral
O módulo `src/gitBranch.js` gerencia operações de trocas de branch, atualizações (`pull`/`push`), stash automático com rollback resiliente e identificação/resolução de conflitos de merge.

---

## 🛠️ Dependências
- `src/gitCore.js`: `executeGitCommand`
- `chalk`, `fs`, `path`, `os`, `child_process`

---

## 🔄 Funções Exportadas
- `getDeps(deps)`: Retorna fábrica de dependências com fallbacks seguros (`executeGitCommandFn`, `execSyncFn`, `editor`).
- `getCurrentBranch(deps)`: Retorna o nome da branch ativa.
- `listBranches(deps)`: Lista branches locais.
- `isNoTrackingError(errorMessage)`: Detecta se o erro retornado pelo Git é referente a branch local sem rastreamento remoto (`no tracking information`, `no upstream branch`).
- `pullChanges(deps)`: Executa `git pull --no-rebase`. Em branches locais sem rastreamento remoto, avisa amigavelmente e segue o fluxo sem travar o processo. Em outros erros, propaga a exceção para o motor de diagnóstico.
- `pushChanges(deps)`: Executa `git push`. Propaga exceções para acionar o diagnóstico inteligente e a autocorreção caso a branch não possua upstream ou ocorram divergências.
- `switchBranch(branch, deps)`: Alterna de branch com stash defensivo.
- `restoreStashOrRollback(originalBranch, deps)`: Restaura stash com rollback em caso de conflito.
- `mergeBranch(fromBranch, toBranch, deps)`: Executa merge entre branches sempre com `--no-ff --no-edit`, preservando o commit de merge e o agrupamento visual da funcionalidade originada na branch de origem. Sincroniza a branch de origem (`switchBranch` + `pushChanges`), sincroniza a branch de destino (`switchBranch`) e, após o merge, executa `pullChanges()` seguido de `pushChanges()` para evitar bifurcações e merges inesperados.
- `checkConflicts(deps)`: Retorna lista de arquivos em conflito (`UU`).
- `getConflictDiff(file, deps)`, `writeConflictToTempFile(file, diff)`, `openFileInEditor(tempFilePath, deps)`, `updateFileFromTemp(file, tempFilePath, deps)`: Resolução de conflitos de merge.

---

## 🧪 Testes e Isolamento de Efeitos Colaterais
Todas as funções em `gitBranch.js` suportam injeção de dependências (`executeGitCommandFn`, `execSyncFn`, `editor`) através de `getDeps()`. Nos testes automatizados, todas as invocações devem fornecer mocks para evitar execuções de `git checkout`, `git stash`, `git merge`, `git pull` ou `git push` no repositório real. Cobertura: **100.00% lines**, **100.00% branches** e **100.00% functions**.
