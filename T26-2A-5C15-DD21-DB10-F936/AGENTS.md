# Documentação de Engenharia de Agentes e Harness (T26-2A-5C15-DD21-DB10-F936)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** GitHub Copilot SDK integrado ao VS Code.
- **Modelo(s) Base:** O runtime não expõe o identificador exato do modelo; por isso, nenhum nome de modelo foi presumido.
- **Estratégia de Coordenação:** Três agentes especializados trabalharam em escopos separados dentro desta pasta: backend, interface e validação. A integração segue o contrato JSON das Cloudflare Pages Functions, o esquema D1 e o verificador local do projeto.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (`migrations/0001_init.sql`), implementação do fluxo de autenticação Discord OAuth2 e validação das regras de negócio no servidor (`functions/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Implementação e validação do fluxo de sessão Discord e das rotas Cloudflare Pages Functions.
  - Uso de consultas parametrizadas e validação das operações persistidas no D1.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** Construção da interface responsiva e acessível utilizando exclusivamente HTML5 semântico, CSS3 moderno (sem sombras em fontes) e JavaScript puro (Vanilla JS), consumindo as rotas serverless via `fetch`.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:**
  - Interface Vanilla responsiva em `public/index.html`, `public/styles.css` e `public/app.js`.
  - Exibição do perfil autenticado e do rodapé oficial com a Chave Única `T26-2A-5C15-DD21-DB10-F936`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** Verificação independente de ponta a ponta: inspeção de contratos de API, tentativa de contorno das validações do servidor, auditoria da rubrica de 100 pontos e execução de testes funcionais.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - Execução do verificador local e checagens de sintaxe e de contratos da aplicação.
  - Registro explícito de itens que dependem do ambiente externo, como deploy, bindings e credenciais do Cloudflare.
