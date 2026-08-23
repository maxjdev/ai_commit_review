# 📄 Documentação do Arquivo: `.env.develop`

## 📌 Visão Geral
O arquivo [`.env.develop`](file:///d:/GitHub/ai_commit_review/.env.develop) armazena as variáveis de ambiente utilizadas no ambiente de desenvolvimento do projeto `ai-commit-review`. Elas provêm as chaves necessárias para as operações de criptografia/descriptografia local, integração com a API da OpenAI e configurações do serviço SMTP para envio de relatórios e notificações por e-mail.

---

## ⚙️ Variáveis de Ambiente Definidas

| Variável | Consumida por (Módulo) | Finalidade Técnica Explícita |
| :--- | :--- | :--- |
| `PASSWORD_CRYPTO_KEY` | [`src/crypto.js`](file:///d:/GitHub/ai_commit_review/src/crypto.js) | Chave secreta de criptografia utilizada no algoritmo AES-256-CBC para cifrar e decifrar a chave da OpenAI e dados locais. |
| `CRIPTO_OPENAI_KEY` | [`src/crypto.js`](file:///d:/GitHub/ai_commit_review/src/crypto.js) | String hexadecimal criptografada contendo a chave de acesso da API OpenAI. |
| `SMTP_HOST` | [`src/validateEmail.js`](file:///d:/GitHub/ai_commit_review/src/validateEmail.js) | Endereço do servidor SMTP (`smtp.office365.com`) para conexão via Nodemailer. |
| `SMTP_PORT` | [`src/validateEmail.js`](file:///d:/GitHub/ai_commit_review/src/validateEmail.js) | Porta de conexão do serviço SMTP (`587` - TLS/STARTTLS). |
| `SMTP_USER` | [`src/validateEmail.js`](file:///d:/GitHub/ai_commit_review/src/validateEmail.js) | Nome de usuário / conta de e-mail utilizada na autenticação SMTP (`automacao@ntadvogados.com.br`). |
| `SMTP_PASS` | [`src/validateEmail.js`](file:///d:/GitHub/ai_commit_review/src/validateEmail.js) | Senha de autenticação do usuário no servidor SMTP. |
| `FROM_EMAIL` | [`src/validateEmail.js`](file:///d:/GitHub/ai_commit_review/src/validateEmail.js) | Endereço de e-mail remetente (`no-reply@ntapp.com.br`) exibido nas notificações disparadas pela aplicação. |
| `SCRAPING_API_BASEURL` | [`src/webSearchService.js`](file:///d:/GitHub/ai_commit_review/src/webSearchService.js) | Endpoint base da API de busca/scraping (`https://global.ntapp.com.br/bkp-intra/api`). |
| `SCRAPING_API_AUTH` | [`src/webSearchService.js`](file:///d:/GitHub/ai_commit_review/src/webSearchService.js) | Credenciais HTTP Basic Auth no formato `usuario:senha` para autenticação nas rotas de busca/scraping. |

---

## 🔗 Relação com o Build do Webpack

Durante a compilação de produção (`npm run build`), o [`webpack.config.js`](file:///d:/GitHub/ai_commit_review/webpack.config.js) verifica se o arquivo `.env` existe na raiz. Caso não exista, utiliza as variáveis contidas em [`.env.develop`](file:///d:/GitHub/ai_commit_review/.env.develop) via plugin `dotenv-webpack` para embuti-las no bundle compilado (`dist/bundle.cjs`).
