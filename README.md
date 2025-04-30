# Phind AI Provider

Um provedor para o [Vercel AI SDK](https://sdk.vercel.ai/) que permite integrar facilmente o modelo de IA do Phind em suas aplicações JavaScript/TypeScript.

[![JSR @lucasliet](https://jsr.io/badges/@lucasliet)](https://jsr.io/@lucasliet)
[![publish](https://github.com/lucasliet/phind-ai-provider/actions/workflows/publish.yml/badge.svg)](https://github.com/lucasliet/phind-ai-provider/actions/workflows/publish.yml)
[![JSR Version](https://img.shields.io/jsr/v/%40lucasliet/phind-ai-provider)](https://jsr.io/@lucasliet/phind-ai-provider)
[![NPM](https://img.shields.io/npm/v/phind-ai-provider)](https://www.npmjs.com/package/phind-ai-provider)

## Características

- Compatível com o Vercel AI SDK (implementa `LanguageModelV1`)
- Suporta chat e geração de texto via Phind
- Suporte para ESM, CommonJS, UMD e Deno
- Streaming de respostas em tempo real
- Mínima dependência externa

## Instalação

### npm/Node.js

```bash
npm install phind-ai-provider
```

### Deno (via JSR)

```typescript
import { PhindAIService } from "jsr:@lucasliet/phind-ai-provider";
```

## Uso Básico

```typescript
import { PhindAIService } from "phind-ai-provider";
import { generateText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const { text } = await generateText({
    model: new PhindAIService(),
    messages,
  });
  
  return text;
}
```

### Uso Direto (sem Vercel AI SDK)

```typescript
import { PhindAIService } from "phind-ai-provider";

// Uso síncrono
async function askQuestion() {
  const phind = new PhindAIService();
  const response = await phind.chat([
    { role: "user", content: "Qual é a capital da Suécia?" }
  ]);
  console.log(response); // "A capital da Suécia é Estocolmo."
}

// Uso com streaming
async function askQuestionWithReader() {
  const phind = new PhindAIService();
  const reader = await phind.chatStream([
    { role: "user", content: "Explique brevemente o que é inteligência artificial." }
  ]);
  
  // Ler resposta em partes
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(decoder.decode(value));
  }
}
```

## Opções Avançadas

### Modelos

O Phind tem diferentes modelos disponíveis. Por padrão, usamos o "o3-mini":

```typescript
// Use o modelo Phind-70B (padrão)
const model = new PhindAIService();

// Ou especifique outro modelo
const model = new PhindAIService("Phind-405B"); // Atualmente Phind-70B é o único modelo gratuito
```

## Compatibilidade

Este pacote funciona em:

- Node.js (ESM e CommonJS)
- Navegadores (ESM e UMD)
- Deno (via JSR)
- Bun
- Ambientes edge (Vercel Edge Runtime, Cloudflare Workers, etc.)

## Licença

[MIT](LICENSE)