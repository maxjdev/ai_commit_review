import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDeps,
  resolveBaseUrl,
  buildAuthHeaders,
  searchGoogle,
  scrapeUrl,
  DEFAULT_SCRAPING_BASE_URL,
} from "../src/webSearchService.js";

test("webSearchService.js - Cobertura 100% de Busca e Scraping Web (Padrão AAA)", async (t) => {
  await t.test("getDeps deve cobrir ramos padrão e injeção de dependências", () => {
    // Arrange & Act
    const defaultDeps = getDeps();
    const customFetch = async () => {};
    const customConfig = () => ({});
    const injectedDeps = getDeps({ fetchFn: customFetch, loadConfigFn: customConfig });

    // Assert
    assert.equal(typeof defaultDeps.fetchFn, "function");
    assert.equal(typeof defaultDeps.loadConfigFn, "function");
    assert.equal(injectedDeps.fetchFn, customFetch);
    assert.equal(injectedDeps.loadConfigFn, customConfig);
  });

  await t.test("resolveBaseUrl deve priorizar process.env e config antes do padrão", () => {
    // Arrange
    const originalEnv = process.env.SCRAPING_API_BASEURL;
    delete process.env.SCRAPING_API_BASEURL;

    // Act 1: Padrão
    const defaultUrl = resolveBaseUrl(getDeps({ loadConfigFn: () => ({}) }));
    assert.equal(defaultUrl, DEFAULT_SCRAPING_BASE_URL);

    // Act 2: Via config
    const configUrl = resolveBaseUrl(
      getDeps({ loadConfigFn: () => ({ SCRAPING_API_BASEURL: "https://custom.api.com/" }) })
    );
    assert.equal(configUrl, "https://custom.api.com");

    // Act 3: Via process.env
    process.env.SCRAPING_API_BASEURL = "https://env.api.com///";
    const envUrl = resolveBaseUrl(getDeps({ loadConfigFn: () => ({}) }));
    assert.equal(envUrl, "https://env.api.com");

    // Cleanup
    if (originalEnv) process.env.SCRAPING_API_BASEURL = originalEnv;
    else delete process.env.SCRAPING_API_BASEURL;
  });

  await t.test("buildAuthHeaders deve gerar cabeçalho Basic Auth quando variável estiver definida", () => {
    // Arrange
    const originalAuth = process.env.SCRAPING_API_AUTH;
    delete process.env.SCRAPING_API_AUTH;
    delete process.env.NTAPP_BASIC_AUTH;
    delete process.env.SCRAPING_API_USER;
    delete process.env.SCRAPING_API_PASS;

    // Act 1: Sem auth
    const headersEmpty = buildAuthHeaders();
    assert.deepEqual(headersEmpty, {});
    const headersNull = buildAuthHeaders(null);
    assert.deepEqual(headersNull, {});

    // Act 1.1: Apenas usuário sem senha e apenas senha sem usuário
    process.env.SCRAPING_API_USER = "single_user";
    assert.deepEqual(buildAuthHeaders(), {});
    delete process.env.SCRAPING_API_USER;
    process.env.SCRAPING_API_PASS = "single_pass";
    assert.deepEqual(buildAuthHeaders(), {});
    delete process.env.SCRAPING_API_PASS;

    // Act 2: Com auth combinada "user:pass"
    process.env.SCRAPING_API_AUTH = "user:password123";
    const headersAuth = buildAuthHeaders();
    const expectedBase64 = Buffer.from("user:password123").toString("base64");
    assert.deepEqual(headersAuth, { Authorization: `Basic ${expectedBase64}` });
    delete process.env.SCRAPING_API_AUTH;

    // Act 3: Com usuário e senha separados via env
    process.env.SCRAPING_API_USER = "admin";
    process.env.SCRAPING_API_PASS = "secret456";
    const headersUserPass = buildAuthHeaders();
    const expectedUserPass = Buffer.from("admin:secret456").toString("base64");
    assert.deepEqual(headersUserPass, { Authorization: `Basic ${expectedUserPass}` });
    delete process.env.SCRAPING_API_USER;
    delete process.env.SCRAPING_API_PASS;

    // Act 3.1: Com NTAPP_BASIC_USER e NTAPP_BASIC_PASS
    process.env.NTAPP_BASIC_USER = "ntuser";
    process.env.NTAPP_BASIC_PASS = "ntpass";
    const headersNtUserPass = buildAuthHeaders();
    const expectedNtUserPass = Buffer.from("ntuser:ntpass").toString("base64");
    assert.deepEqual(headersNtUserPass, { Authorization: `Basic ${expectedNtUserPass}` });
    delete process.env.NTAPP_BASIC_USER;
    delete process.env.NTAPP_BASIC_PASS;

    // Act 3.2: Com NTAPP_BASIC_AUTH
    process.env.NTAPP_BASIC_AUTH = "ntauth:secret";
    const headersNtAuth = buildAuthHeaders();
    const expectedNtAuth = Buffer.from("ntauth:secret").toString("base64");
    assert.deepEqual(headersNtAuth, { Authorization: `Basic ${expectedNtAuth}` });
    delete process.env.NTAPP_BASIC_AUTH;

    // Act 4: Com config no .config.json
    const dConfig = { loadConfigFn: () => ({ SCRAPING_API_AUTH: "cfguser:cfgpass" }) };
    const headersConfig = buildAuthHeaders(dConfig);
    const expectedCfg = Buffer.from("cfguser:cfgpass").toString("base64");
    assert.deepEqual(headersConfig, { Authorization: `Basic ${expectedCfg}` });

    // Cleanup
    if (originalAuth) process.env.SCRAPING_API_AUTH = originalAuth;
  });

  await t.test("searchGoogle deve tratar query vazia, sucesso em JSON, sucesso em texto e erro HTTP/Timeout", async () => {
    // Act 1: Query vazia (null, undefined, vazia, whitespace)
    assert.equal((await searchGoogle("   ")).success, false);
    assert.equal((await searchGoogle("")).success, false);
    assert.equal((await searchGoogle(null)).success, false);
    assert.equal((await searchGoogle(undefined)).success, false);

    // Act 2: Sucesso em JSON
    const mockJsonData = { google_search: [{ title: "Result 1", link: "https://link.com" }] };
    const mockFetchJson = async (url, opts) => ({
      ok: true,
      headers: { get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : "") },
      json: async () => mockJsonData,
    });
    const jsonRes = await searchGoogle("git error", { ai: false, timeoutMs: 3000 }, { fetchFn: mockFetchJson, loadConfigFn: () => ({}) });
    assert.equal(jsonRes.success, true);
    assert.deepEqual(jsonRes.results, mockJsonData);

    // Act 3: Sucesso em Texto/Markdown sem header content-type (retorna null)
    const mockFetchNoHeaders = async () => ({
      ok: true,
      headers: { get: () => null },
      text: async () => "# Raw text without content-type",
    });
    const noHeaderRes = await searchGoogle("git error", {}, { fetchFn: mockFetchNoHeaders, loadConfigFn: () => ({}) });
    assert.equal(noHeaderRes.success, true);
    assert.equal(noHeaderRes.results, "# Raw text without content-type");

    // Act 3.1: Sucesso com opções customizadas (limit, format, ai: true)
    const mockFetchOpts = async (url) => {
      assert.ok(url.includes("limit=10"));
      assert.ok(url.includes("format=json"));
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ results: "ok" }),
      };
    };
    await searchGoogle("git test", { limit: 10, format: "json", ai: true }, { fetchFn: mockFetchOpts, loadConfigFn: () => ({}) });

    // Act 4: HTTP status de erro (ex: 500)
    const mockFetch500 = async () => ({ ok: false, status: 500 });
    const res500 = await searchGoogle("git error", {}, { fetchFn: mockFetch500, loadConfigFn: () => ({}) });
    assert.equal(res500.success, false);
    assert.equal(res500.error, "HTTP 500");

    // Act 5: Exceção de rede / timeout
    const mockFetchThrow = async () => { throw new Error("Network timeout"); };
    const resThrow = await searchGoogle("git error", {}, { fetchFn: mockFetchThrow, loadConfigFn: () => ({}) });
    assert.equal(resThrow.success, false);
    assert.equal(resThrow.error, "Network timeout");
  });

  await t.test("scrapeUrl deve tratar URL vazia, sucesso, erro HTTP e falha de rede", async () => {
    // Act 1: URL vazia (null, undefined, vazia, whitespace)
    assert.equal((await scrapeUrl("")).success, false);
    assert.equal((await scrapeUrl("   ")).success, false);
    assert.equal((await scrapeUrl(null)).success, false);
    assert.equal((await scrapeUrl(undefined)).success, false);

    // Act 2: Sucesso com opções customizadas
    const mockFetch = async (url) => {
      assert.ok(url.includes("format=html"));
      return {
        ok: true,
        text: async () => "<html>Conteudo raspado</html>",
      };
    };
    const scrapeRes = await scrapeUrl("https://example.com/docs", { format: "html" }, { fetchFn: mockFetch, loadConfigFn: () => ({}) });
    assert.equal(scrapeRes.success, true);
    assert.equal(scrapeRes.content, "<html>Conteudo raspado</html>");

    // Act 2.1: Sucesso sem opções (padrão format=markdown e timeout padrão)
    const mockFetchDefault = async (url) => {
      assert.ok(url.includes("format=markdown"));
      return {
        ok: true,
        text: async () => "Markdown padrao",
      };
    };
    const scrapeDefault = await scrapeUrl("https://example.com/padrao", {}, { fetchFn: mockFetchDefault, loadConfigFn: () => ({}) });
    assert.equal(scrapeDefault.success, true);

    // Act 3: Erro HTTP (ex: 404)
    const mockFetch404 = async () => ({ ok: false, status: 404 });
    const scrape404 = await scrapeUrl("https://example.com/404", {}, { fetchFn: mockFetch404, loadConfigFn: () => ({}) });
    assert.equal(scrape404.success, false);
    assert.equal(scrape404.error, "HTTP 404");

    // Act 4: Exceção
    const mockFetchThrow = async () => { throw new Error("Fetch failed"); };
    const scrapeThrow = await scrapeUrl("https://example.com", {}, { fetchFn: mockFetchThrow, loadConfigFn: () => ({}) });
    assert.equal(scrapeThrow.success, false);
    assert.equal(scrapeThrow.error, "Fetch failed");
  });
});
