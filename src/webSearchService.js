// webSearchService.js
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { ConfigKeys } from "./models.js";

export const DEFAULT_SCRAPING_BASE_URL = "https://global.ntapp.com.br/bkp-intra/api";
const DEFAULT_TIMEOUT_MS = 8000;

export function getDeps(deps = {}) {
  return {
    fetchFn: deps.fetchFn || globalThis.fetch,
    loadConfigFn: deps.loadConfigFn || loadConfig,
  };
}

export function resolveBaseUrl(d) {
  const config = d.loadConfigFn();
  return (
    process.env.SCRAPING_API_BASEURL ||
    config[ConfigKeys.SCRAPING_API_BASEURL] ||
    DEFAULT_SCRAPING_BASE_URL
  ).replace(/\/+$/, "");
}

export function buildAuthHeaders(d = {}) {
  const config = d?.loadConfigFn ? d.loadConfigFn() : {};
  let auth =
    process.env.SCRAPING_API_AUTH ||
    process.env.NTAPP_BASIC_AUTH ||
    config[ConfigKeys.SCRAPING_API_AUTH];

  if (!auth) {
    const user = process.env.SCRAPING_API_USER || process.env.NTAPP_BASIC_USER;
    const pass = process.env.SCRAPING_API_PASS || process.env.NTAPP_BASIC_PASS;
    if (user && pass) {
      auth = `${user}:${pass}`;
    }
  }

  if (!auth) return {};
  const base64Auth = Buffer.from(auth).toString("base64");
  return { Authorization: `Basic ${base64Auth}` };
}

function buildSearchUrl(baseUrl, query, options) {
  const limit = options.limit || 5;
  const format = options.format || "markdown";
  const ai = options.ai !== undefined ? options.ai : true;
  const encodedQuery = encodeURIComponent(query);
  return `${baseUrl}/scraping_google_search/?query=${encodedQuery}&limit=${limit}&format=${format}&ai=${ai}`;
}

/**
 * Searches Google using the internal scraping API.
 */
export async function searchGoogle(query, options = {}, deps = {}) {
  const d = getDeps(deps);
  if (!query || !query.trim()) return { success: false, results: "", error: "Empty query" };
  
  const baseUrl = resolveBaseUrl(d);
  const endpoint = buildSearchUrl(baseUrl, query.trim(), options);
  const headers = buildAuthHeaders(d);

  try {
    const response = await d.fetchFn(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { success: false, results: "", error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return { success: true, results: data, raw: data };
    }
    const textData = await response.text();
    return { success: true, results: textData, raw: textData };
  } catch (error) {
    return { success: false, results: "", error: error.message };
  }
}

/**
 * Scrapes a web page using the internal scraping API.
 */
export async function scrapeUrl(targetUrl, options = {}, deps = {}) {
  const d = getDeps(deps);
  if (!targetUrl || !targetUrl.trim()) return { success: false, content: "", error: "Empty URL" };

  const baseUrl = resolveBaseUrl(d);
  const format = options.format || "markdown";
  const endpoint = `${baseUrl}/scraping_url/?url=${encodeURIComponent(targetUrl.trim())}&format=${format}`;
  const headers = buildAuthHeaders(d);

  try {
    const response = await d.fetchFn(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { success: false, content: "", error: `HTTP ${response.status}` };
    }

    const textData = await response.text();
    return { success: true, content: textData };
  } catch (error) {
    return { success: false, content: "", error: error.message };
  }
}
