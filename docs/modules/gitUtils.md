# 📄 Documentação do Módulo: `src/gitUtils.js`

## 📌 Visão Geral
O módulo `src/gitUtils.js` atua como um padrão de projeto **Facade** (Fachada) unificado para todo o sistema de controle de versão da aplicação. Ele não implementa lógica diretamente; em vez disso, agrega, encapsula e reexporta funções utilitárias especializadas de submódulos de mais baixo nível ([`src/gitCore.js`](file:///d:/GitHub/ai_commit_review/src/gitCore.js), [`src/gitBranch.js`](file:///d:/GitHub/ai_commit_review/src/gitBranch.js), e [`src/githubCli.js`](file:///d:/GitHub/ai_commit_review/src/githubCli.js)).

Dessa forma, fornece uma interface única e simplificada para commits, diffs, branches, stashes, merges, resolução de conflitos e criação de pull requests.

---

## 🛠️ Dependências e Importações

### Dependências Nativas Node.js
- `child_process`: Execução síncrona de comandos (`execSync`).
- `fs`: Manipulação de arquivos para salvamento e leitura de temporários de conflito.
- `path`: Resolução de caminhos e nomes de arquivo base (`path.join`, `path.basename`).
- `os`: Obtenção do diretório temporário do SO (`os.tmpdir()`).

### Dependências Externas
- `chalk`: Saídas coloridas no terminal.

---

## 🔄 Funções Exportadas

### Operações Principais do Git

- **`executeGitCommand(command)`**:
  - Executa qualquer comando Git síncrono via `execSync(command, { encoding: "utf-8" })` e retorna o resultado limpo de espaços (`.trim()`).

- **`stageAllChanges()`**:
  - Executa `git add .` para adicionar todas as alterações na área de staging.

- **`clearStage()`**:
  - Executa `git reset` para desmarcar todas as alterações da área de staging.

- **`undoLastCommitSoft()`**:
  - Executa `git reset --soft HEAD~1`. Desfaz o último commit mantendo as alterações staged.

- **`commitChangesWithEditor(tempFilePath)`**:
  - Executa `git commit --edit --file="<tempFilePath>" --no-verify` com `stdio: "inherit"`, abrindo o editor configurado do Git com a mensagem pré-preenchida.

- **`pullChanges()`**:
  - Executa `git pull --no-rebase`.

- **`pushChanges()`**:
  - Executa `git push`.

---

### Leitura de Commits, Diffs e Status

- **`getCommits(skip = 0, limit = 5)`**:
  - Consulta o histórico com `git log --skip=<skip> -n <limit> --pretty=format:"%H\x1f%ct\x1f%s"`.
  - Retorna `Array<{ shaFull, shaShort, date, message }>` com data formatada (`en-US`) e mensagem truncada em 100 caracteres.

- **`getModifiedFiles(sha)`**:
  - Executa `git diff-tree --no-commit-id --name-status -r <sha>` e retorna `Array<{ status, file }>`.

- **`getFileDiff(sha, file)`**:
  - Executa `git diff <sha>~1 <sha> -- <file> || true` e retorna a string do diff.

- **`getRepositoryDiff()`**:
  - Retorna a saída de `git diff` para todas as alterações não staged.

- **`getStagedFileDiff(file)`**:
  - Executa `git diff --cached -- "<file>"`. Se falhar por exclusão de arquivo, checa com `git ls-files --deleted` e retorna `"File deleted: <file>"`.

- **`getStagedFilesDiffs()`**:
  - Obtém lista de arquivos em staging com `git diff --cached --name-only` e retorna `Array<{ filename, diff }>`.

---

### Gestão de Branches e Stash

- **`getCurrentBranch()`**:
  - Retorna a branch atual via `git branch --show-current`.

- **`listBranches()`**:
  - Retorna lista de nomes de branches locais via `git branch --list`.

- **`switchBranch(branch)`**:
  - Valida o nome da branch de destino.
  - Salva alterações pendentes via `git stash` (caso existam).
  - Atualiza a branch original com `git pull --no-rebase`.
  - Troca de branch via `git checkout <branch>` e executa `git pull --no-rebase` na branch de destino.
  - Re-aplica o stash com `git stash pop`. Em caso de conflito no `stash pop`, reverte para a branch original, faz pull e restaura o stash na branch original antes de lançar o erro de conflito.

- **`mergeBranch(fromBranch, toBranch)`**:
  - Sincroniza `fromBranch` (`switchBranch` + `git push`), troca para `toBranch` via `switchBranch(toBranch)` (que já executa `git pull --no-rebase`), executa `git merge --no-ff --no-edit <fromBranch>` para preservar o commit de merge e o histórico visual da branch de origem, e finaliza com `pullChanges()` + `pushChanges()`.

---

### Resolução de Conflitos e Integração GH CLI

- **`checkConflicts()`**:
  - Executa `git status --short`, filtra linhas iniciadas com `UU` e retorna array com os nomes dos arquivos em conflito.

- **`getConflictDiff(file)`**:
  - Executa `git diff <file>` para visualizar o diff de conflito.

- **`writeConflictToTempFile(file, diff)`**:
  - Grava o diff de conflito em um arquivo temporário em `os.tmpdir()`.

- **`openFileInEditor(tempFilePath)`**:
  - Abre o arquivo temporário no editor definido em `process.env.EDITOR` (padrão `"vim"`).

- **`updateFileFromTemp(file, tempFilePath)`**:
  - Lê o conteúdo resolvido do arquivo temporário, sobrescreve o arquivo no repositório e executa `git add "<file>"`.

- **`createPullRequest({ base, head, title, body, reviewer })`**:
  - Verifica instalação do GitHub CLI (`gh --version`).
  - Executa `gh pr create --base <base> --head <head> --title "<title>" --body "<body>"` (adicionando `--reviewer <reviewer>` se especificado).
