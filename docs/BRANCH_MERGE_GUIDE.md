# 🚀 Guia de Operação: Merge Seguro de Branches (`acr mergeBranch`)

Este guia detalha o funcionamento, as regras de segurança e o passo a passo da funcionalidade **Merge Seguro de Branches** (`acr mergeBranch`), desenvolvida para integrar branches locais e remotas com histórico preservado, múltiplos pulls defensivos e resolução assistida de conflitos.

---

## 🎯 Objetivo da Funcionalidade

A funcionalidade permite integrar com segurança a branch em que você está trabalhando para qualquer branch de destino (seja `develop`, `teste`, `master` ou branches de release/customizadas):
1. **Flexibilidade total de destino**: Identifica a branch atual e permite selecionar ou informar a branch de destino desejada.
2. **Mitigação de Defasagem**: Se a branch de destino tiver commits mais novos, alerta e permite sincronizar previamente para resolver conflitos antes de tocar no destino.
3. **Pulls Defensivos**: Executa pulls defensivos nas branches envolvidas para que nenhum commit remoto recente seja sobrescrito.
4. **Preservação de Histórico**: Cria formalmente um **Merge Commit** (`--no-ff`), mantendo os commits da funcionalidade agrupados no grafo do Git.

---

## 💻 Como Invocar o Comando

### Opção 1: Linha de Comando Direta com Destino
```bash
# Mesclar para a master
acr mergeBranch master

# Mesclar para a develop
acr mergeBranch develop

# Mesclar para teste
acr mergeBranch teste
```

### Opção 2: Linha de Comando Interativa (Sem parâmetros)
Estando na sua branch de trabalho:
```bash
acr mergeBranch
```
O assistente listará as branches disponíveis do repositório para você escolher o destino.

### Opção 3: Menu Interativo Principal
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
❯ Merge current branch into another branch
  Reset configuration
```

---

## 📋 Passo a Passo das Operações

```
[1. Sanidade] ➔ [2. Seleção de Destino] ➔ [3. Pull Origem] ➔ [4. Análise de Defasagem]
                                                                        │
[7. Push Destino] ⇦ [6. Merge Commit (--no-ff)] ⇦ [5. Switch & Pull Destino] ⇦─┘
```

1. **Tratamento de Alterações Pendentes:** Se houver alterações não commitadas na branch, pergunta se você deseja commitar antes de mesclar (usando o fluxo padrão com IA). Caso prefira não commitar, guarda as alterações automaticamente no Git Stash e prossegue com o merge.
2. **Seleção de Destino:** Identifica para qual branch o merge será realizado.
3. **Pull na Origem:** Sincroniza a branch de origem com o remote.
4. **Análise de Divergência:** Compara commits com a branch de destino remota. Se a branch de destino estiver à frente, oferece sincronização prévia com resolução assistida de conflitos.
5. **Preparação do Destino:** Alterna para a branch de destino e faz pull de segurança.
6. **Merge Commit (`--no-ff`):** Cria o commit formal de união das branches.
7. **Publicação:** Envia a branch de destino atualizada para o GitHub.
