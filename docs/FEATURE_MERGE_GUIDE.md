# 🚀 Guia de Operação: Merge de Feature Branches (`acr mergeFeature`)

Este guia detalha o funcionamento, as regras de segurança e o passo a passo da funcionalidade **Merge de Feature Branches para a Develop** (`acr mergeFeature`), desenvolvida para garantir que a integração de código ocorra com histórico preservado, múltiplos pulls defensivos e resolução assistida de conflitos.

---

## 🎯 Objetivo da Funcionalidade

Ao finalizar o desenvolvimento de uma branch de feature (ex.: `feature/agenda`, `fix/login-bug`, `chore/docker-setup`):
1. **Evita quebra direta da branch `develop`**: Se a feature estiver defasada (muitos commits atrás), permite trazer a `develop` para dentro da feature primeiro, isolando a resolução de conflitos no ambiente da funcionalidade.
2. **Garante sincronização com o remoto**: Executa pulls defensivos nas branches envolvidas para que nenhum commit recente de outros desenvolvedores seja sobrescrito.
3. **Preserva a rastreabilidade**: Cria formalmente um **Merge Commit** (`--no-ff`), mantendo os commits da funcionalidade agrupados no grafo do Git.
4. **Conexão fluida com o servidor de testes**: Ao final do merge, oferece a opção de disparar diretamente o fluxo de atualização do servidor de testes (`acr updateTestServer`).

---

## 💻 Como Invocar o Comando

### Opção 1: Linha de Comando Direta
Na pasta do projeto, estando na branch de feature:
```bash
acr mergeFeature
```

### Opção 2: Menu Interativo
Execute o utilitário sem argumentos:
```bash
acr
```
Navegue com as setas do teclado e selecione:
```text
? What do you want to do?
  Analyze commits
  Create a new commit
  Commit staged changes
  Encrypt/Decrypt text
  Update server to test
  Update server to production
❯ Merge feature branch into develop
  Reset configuration
```

---

## 📋 Passo a Passo Detalhado das Operações

Abaixo está o ciclo de vida completo executado pelo comando:

```
[1. Sanidade] ➔ [2. Pull Feature] ➔ [3. Análise de Defasagem] ➔ [4. Sync Develop ➔ Feature (Opcional)]
                                                                                │
[7. Push Develop] ⇦ [6. Merge Commit (--no-ff)] ⇦ [5. Switch & Pull Develop] ⇦──┘
       │
[8. Test Server? (updateTestServer)]
```

---

### Passo 1: Verificação de Sanidade e Segurança
* **O que acontece:** O sistema executa `git status --porcelain` e consulta a branch ativa (`getCurrentBranch`).
* **Proteções aplicadas:**
  * **Alterações Pendentes:** Se houver arquivos modificados não salvos, a execução é interrompida com:
    ```text
    ❌ Uncommitted changes detected. Commit or stash them before merging.
    ```
    *Ação recomendada:* Faça o commit via `acr commit` ou `acr create` antes de continuar.
  * **Branches Protegidas:** Impede a execução caso o usuário já esteja em `develop`, `teste`, `test`, `master` ou `main`.

---

### Passo 2: Sincronização da Feature com o Remoto (`Pull 1`)
* **O que acontece:** O sistema executa `git pull --no-rebase` na branch de feature.
* **Por que é feito:** Garante que alterações enviadas recentemente por outros membros da equipe ou pela pipeline de CI sejam incorporadas localmente antes de qualquer integração.

---

### Passo 3: Análise de Defasagem (Drift da Develop)
* **O que acontece:** O sistema consulta o estado do repositório remoto (`git fetch origin develop`) e calcula a diferença de commits entre a feature e a `develop`:
  * Commits que a `develop` avançou em relação à feature (`HEAD..origin/develop`).
  * Commits locais novos da feature (`origin/develop..HEAD`).
* **Alerta no terminal:** Se a feature estiver atrás da `develop`, o sistema notifica:
  ```text
  ⚠️ Your branch 'feature/agenda' is 5 commit(s) behind 'develop'.
  ```

---

### Passo 4: Atualização Preventiva (`develop` ➔ `feature`)
* **Pergunta interativa:**
  ```text
  ? Do you want to sync the latest 'develop' code into your feature first? (Y/n)
  ```
* **Se o desenvolvedor aceitar (Recomendado):**
  1. Executa `git merge origin/develop -m "Sync develop into feature/agenda"`.
  2. **Se houver conflitos:** Aciona o módulo de conflitos do projeto:
     * **Manual:** Abre os arquivos no editor de texto configurado para resolução e pede confirmação para salvar.
     * **Automático:** Dispara a ferramenta `git mergetool`.
     * **Cancelar/Abortar:** Se optar por cancelar, executa `git merge --abort` e encerra com segurança sem deixar o repositório em estado inconsistente.
  3. **Envio da Feature Atualizada:** Executa `git push` para salvar a feature compatibilizada no repositório remoto.
* **Se o desenvolvedor recusar:** O fluxo segue diretamente para a etapa seguinte.

---

### Passo 5: Preparação e Sincronização da Develop (`Pull 2`)
* **O que acontece:**
  1. Alterna para a branch de desenvolvimento: `git checkout develop`.
  2. Atualiza a branch local: `git pull --no-rebase`.
* **Por que é feito:** Garante que a branch `develop` local esteja 100% atualizada com o servidor remoto no instante em que receberá o merge da feature.

---

### Passo 6: Criação do Merge Commit Explícito
* **O que acontece:** O sistema executa:
  ```bash
  git merge --no-ff -m "Merge branch 'feature/agenda' into develop" "feature/agenda"
  ```
* **Por que `--no-ff` (No Fast-Forward)?**
  * Cria formalmente um commit de merge.
  * Mantém o histórico visual e estruturado no Git, identificando claramente que todos aqueles commits pertenceram ao ciclo da `feature/agenda`.

---

### Passo 7: Tratamento de Conflitos no Destino
* **O que acontece:** Caso ocorra algum conflito no merge final para a `develop`:
  * O assistente detecta os arquivos em conflito e oferece as opções de resolução.
  * **Em caso de desistência/cancelamento:** Executa `git merge --abort`, retorna para a branch de feature original (`git checkout feature/agenda`) e deixa a `develop` intacta.

---

### Passo 8: Publicação na Develop
* **O que acontece:** Executa `git push` na branch `develop`.
* **Mensagem de sucesso:**
  ```text
  🎉 Feature branch 'feature/agenda' integrated into 'develop' with merge commit!
  ```

---

### Passo 9: Encadeamento com o Servidor de Testes
* **Pergunta final:**
  ```text
  ? Do you want to deploy to the test server now (updateTestServer)? (y/N)
  ```
* **Opções:**
  * **Sim:** Dispara imediatamente a rotina `updateServerToTest`, que valida as pastas Docker, atualiza a versão em `versao.txt`, faz o commit e mescla `develop` na branch `teste`.
  * **Não:** Finaliza a operação deixando o desenvolvedor posicionado na branch `develop` atualizada e pronta para novos comandos.

---

## 🛡️ Resumo dos Comportamentos de Segurança

| Situação Encontrada | Ação do `acr mergeFeature` | Efeito no Repositório |
| :--- | :--- | :--- |
| Arquivos modificados não commitados | Interrompe imediatamente | Nenhuma alteração é feita |
| Branch atual é `develop`, `master` ou `teste` | Interrompe imediatamente | Impede merge acidental |
| Feature com commits atrás da `develop` | Alerta e pergunta se deseja sincronizar antes | Evita que conflitos quebrem a `develop` |
| Conflitos na sincronização ou no merge final | Abre menu assistido de conflitos | Usuário resolve ou aborta com `git merge --abort` |
| Usuário cancela resolução de conflito | Aborta o merge e restaura a branch | Repositório volta ao estado limpo original |
