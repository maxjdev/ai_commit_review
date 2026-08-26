import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHARS_PER_TOKEN,
  estimateTokens,
  tokensToChars,
  computePromptBudget,
  truncateToTokenBudget,
  fitPromptToBudget,
} from "../src/tokenBudget.js";

test("tokenBudget.js - Orçamento de tokens (Padrão AAA)", async (t) => {
  await t.test("estimateTokens deve estimar tokens de forma conservadora e tratar vazios", () => {
    // Arrange
    const texto = "A".repeat(300);

    // Act & Assert
    assert.equal(estimateTokens(texto), 300 / CHARS_PER_TOKEN);
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens(null), 0);
  });

  await t.test("tokensToChars deve converter tokens em caracteres sem valores negativos", () => {
    // Act & Assert
    assert.equal(tokensToChars(10), 10 * CHARS_PER_TOKEN);
    assert.equal(tokensToChars(-5), 0);
  });

  await t.test("computePromptBudget deve reservar espaço para resposta e aplicar piso mínimo", () => {
    // Act
    const budget = computePromptBudget(8192, 2000);
    const budgetMinimo = computePromptBudget(1000, 2000);

    // Assert
    assert.ok(budget < 8192 - 2000);
    assert.equal(budgetMinimo, 256);
  });

  await t.test("truncateToTokenBudget deve preservar textos pequenos e cortar textos grandes", () => {
    // Arrange
    const pequeno = "texto curto";
    const grande = "Z".repeat(10000);

    // Act
    const resultadoPequeno = truncateToTokenBudget(pequeno, 100);
    const resultadoGrande = truncateToTokenBudget(grande, 100);

    // Assert
    assert.equal(resultadoPequeno, pequeno);
    assert.ok(estimateTokens(resultadoGrande) <= 100);
    assert.match(resultadoGrande, /truncated due to model context limit/);
  });

  await t.test("truncateToTokenBudget deve retornar corte puro quando não há espaço para o aviso", () => {
    // Act
    const resultado = truncateToTokenBudget("W".repeat(500), 1);

    // Assert
    assert.equal(resultado, "");
  });

  await t.test("fitPromptToBudget deve manter o prompt intacto quando já cabe no orçamento", () => {
    // Arrange
    const files = [{ filename: "a.js", diff: "const a = 1;" }];
    const buildPrompt = (f) => f.map((file) => file.diff).join("\n");

    // Act
    const { prompt, truncated } = fitPromptToBudget(files, buildPrompt, 1000);

    // Assert
    assert.equal(prompt, "const a = 1;");
    assert.equal(truncated, false);
  });

  await t.test("fitPromptToBudget deve reduzir diffs até respeitar o orçamento de tokens", () => {
    // Arrange
    const files = [
      { filename: "a.js", diff: "A".repeat(60000) },
      { filename: "b.js", diff: "B".repeat(30000) },
      { filename: "c.js", diff: "" },
    ];
    const buildPrompt = (f) => `INSTRUCOES\n${f.map((file) => file.diff).join("\n")}\nFIM`;

    // Act
    const { prompt, files: ajustados, truncated } = fitPromptToBudget(files, buildPrompt, 500);

    // Assert
    assert.ok(estimateTokens(prompt) <= 500);
    assert.equal(truncated, true);
    assert.ok(ajustados[0].diff.length < 60000);
  });
});
