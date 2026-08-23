# 📄 Documentação do Módulo: `src/commitFlowHandlers.js`

## 📌 Visão Geral
O módulo `src/commitFlowHandlers.js` unifica e centraliza os fluxos interativos compartilhados de terminal utilizados pelos comandos de criação de commit (`createCommit.js` e `commitStaged.js`).

---

## 🛠️ Dependências
- `src/gitUtils.js`, `src/openaiUtils.js`, `src/contextManager.js`, `src/models.js`
- `inquirer`, `chalk`, `fs`, `path`, `os`

---

## 🔄 Funções Exportadas
- `confirmOrSwitchBranch(deps = {})`: Confirma ou alterna branch ativa.
- `verifyConflicts(deps = {})`: Re-exportado de `gitConflictHandlers.js`. Detecta e guia a resolução manual ou automática de conflitos.
- `obtainCommitMessage(stagedFiles, deps = {})`: Gerencia o ciclo de vida da mensagem de commit (gerada por IA ou manual) e abertura do editor, utilizando nomes de arquivos temporários exclusivos com PID e timestamp. Em caso de falha no editor externo (ex: `core.editor` não encontrado), fornece menu de auto-recuperação inteligente (commit direto, diagnóstico com IA para corrigir editor ou input manual no terminal).
- `handleCommitAbortOrPush(deps = {})`: Oferece a opção de abortar o commit (`git reset --soft HEAD~1`).

---

## 🧪 Testes e Isolamento de Efeitos Colaterais
- Funções de Git e de editor devem ser passadas via injeção (`deps`) nos testes automatizados para garantir que nenhuma operação real de commit/push/reset ocorra no repositório. Cobertura: **100% lines**, **100% branches** e **100% functions** em `tests/commitFlowHandlers.test.js`.
