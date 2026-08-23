# 📄 Documentação do Módulo: `src/prompts.js`

## 📌 Visão Geral
O módulo `src/prompts.js` isola e centraliza a construção de instruções e templates de prompts estruturados para a IA para análise de código e mensagens de commit.

---

## 🛠️ Dependências
- `src/models.js`: `PromptType`, `SupportedLanguages`

---

## 🔄 Funções Exportadas
- `generateLanguageInstruction(langcode)`: Retorna instrução de idioma para a IA.
- `generatePrompt(files, promptType, config)`: Constrói o prompt formatado em Markdown para `ANALYZE` ou `CREATE`.
- `generateErrorDiagnosticPrompt(errorData, webContext, config)`: Constrói o prompt para diagnóstico de erro combinando contexto técnico do SO, mensagem/stderr de erro e documentação extraída da web.
