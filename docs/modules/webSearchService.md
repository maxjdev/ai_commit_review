# Módulo: Web Search & Scraping Service (`src/webSearchService.js`)

## 1. Visão Geral
Serviço responsável por realizar buscas no Google e extração (scraping) de páginas web através das APIs internas da NTAPP (`/scraping_google_search/` e `/scraping_url/`). Fornece contexto de documentação e soluções atualizadas para o assistente de diagnóstico de erros.

## 2. Endpoints e Contratos

### `searchGoogle(query, options, deps)`
- **Objetivo**: Efetua buscas no Google via scraping endpoint.
- **Entrada**:
  - `query` (string): Termo de pesquisa (ex: erro git).
  - `options` (object):
    - `limit` (number, default: 5)
    - `format` (string, default: "markdown")
    - `ai` (boolean, default: true)
    - `timeoutMs` (number, default: 8000)
- **Saída**: `{ success: boolean, results: string|object, error?: string }`
- **Fallback**: Em caso de timeout ou erro HTTP, retorna `{ success: false, results: "", error: message }` sem quebrar o fluxo da aplicação.

### `scrapeUrl(targetUrl, options, deps)`
- **Objetivo**: Extrai o conteúdo sanitizado em formato texto/markdown de uma URL.
- **Entrada**:
  - `targetUrl` (string): URL completa da página.
  - `options` (object): `format`, `timeoutMs`.
- **Saída**: `{ success: boolean, content: string, error?: string }`

## 3. Configurações e Autenticação
- **Base URL**: Configurável via `process.env.SCRAPING_API_BASEURL` ou `.config.json` (`SCRAPING_API_BASEURL`). Padrão: `https://global.ntapp.com.br/bkp-intra/api`.
- **Autenticação**: Suporta Basic Auth via `SCRAPING_API_AUTH` ou `NTAPP_BASIC_AUTH` quando configurado.

## 4. Governança e Testes
- **Testes**: `tests/webSearchService.test.js` (Padrão AAA, 100% isolamento de efeitos colaterais).
- **Limites**: Funções ≤ 30 linhas, arquivo ≤ 250 linhas, complexidade ciclomática ≤ 5.
