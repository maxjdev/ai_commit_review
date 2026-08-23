# Módulo: Git Conflict Handlers (`src/gitConflictHandlers.js`)

## 1. Visão Geral
Submódulo desacoplado extraído de `commitFlowHandlers.js` para manter coesão e respeito ao limite de 250 linhas por arquivo. É responsável por verificar e resolver conflitos do repositório Git.

## 2. Contratos e Métodos Principais
- `verifyConflicts(deps)`: Verifica se existem arquivos em conflito no repositório e apresenta opções de resolução (manual, automática via mergetool ou cancelamento).
- `resolveConflictsManually(conflicts, deps)`: Abre os arquivos em conflito no editor configurado e sincroniza após resolução.
- `resolveConflictsAutomatically(conflicts, deps)`: Aciona o `git mergetool` para resolução automatizada e solicita confirmação de staging.

## 3. Governança e Testes
- **Testes**: `tests/gitConflictHandlers.test.js` e `tests/commitFlowHandlers.test.js` (Padrão AAA).
- **Limites**: Funções ≤ 30 linhas, arquivo ≤ 250 linhas, complexidade ciclomática ≤ 5.
