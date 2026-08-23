# 📄 Documentação do Módulo: `src/gitCore.js`

## 📌 Visão Geral
O módulo `src/gitCore.js` abstrai as operações de leitura, log, diffs e staging do Git local através de execuções síncronas com tratamento de erros.

---

## 🛠️ Dependências
- `child_process.execSync`
- `chalk`

---

## 🔄 Funções Exportadas
- `getDeps(deps)`: Fábrica de dependências com fallback para `child_process.execSync`.
- `executeGitCommand(command, deps)`: Executa comandos git via `execSync` em UTF-8.
- `stageAllChanges(deps)`: Executa `git add .`.
- `clearStage(deps)`: Executa `git reset`.
- `undoLastCommitSoft(deps)`: Executa `git reset --soft HEAD~1`.
- `commitChangesWithEditor(tempFilePath, deps)`: Abre o editor com mensagem pré-carregada.
- `commitDirectlyWithMessageFile(tempFilePath, deps)`: Efetua commit direto usando arquivo de mensagem sem abrir editor externo.
- `getCommits(skip, limit, deps)`: Retorna lista formatada do histórico Git.
- `formatGitDate(timestamp)`, `truncateString(str, maxLength)`: Utilitários puros de formatação.
- `getModifiedFiles(sha, deps)`: Retorna status e arquivos modificados de um commit.
- `getFileDiff(sha, file, deps)`: Retorna diff de arquivo específico.
- `getRepositoryDiff(deps)`: Retorna `git diff` não-staged.
- `getStagedFileDiff(file, deps)`: Retorna diff de arquivo staged.
- `getStagedFilesDiffs(deps)`: Retorna lista de arquivos e diffs staged.

---

## 🧪 Testes e Isolamento de Efeitos Colaterais
Todas as funções expostas em `gitCore.js` aceitam um objeto opcional `deps = {}` contendo `execSyncFn` via `getDeps()`. Durante a execução de testes automatizados, `execSyncFn` deve ser obrigatoriamente mockado para garantir que nenhuma operação real (`git add`, `git reset`, `git commit`) altere o repositório local. Cobertura: **100.00% lines**, **100.00% branches** e **100.00% functions**.
