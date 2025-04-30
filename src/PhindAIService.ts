import { LanguageModelV1, LanguageModelV1FinishReason, LanguageModelV1CallWarning, LanguageModelV1StreamPart } from '@ai-sdk/provider';

export class PhindAIService implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly defaultObjectGenerationMode = 'json';
  readonly supportsImageUrls = false;
  readonly supportsStructuredOutputs = false;
  readonly modelId: string;
  private static readonly API_URL = 'https://https.extension.phind.com/agent/';
  private readonly headers = {
    'Content-Type': 'application/json',
    Accept: '*/*',
    'Accept-Encoding': 'Identity',
    'User-Agent': '',
  };

  constructor(model: string = 'Phind-70B') {
    this.modelId = model;
  }

  get provider(): string {
    return 'phind';
  }

  /**
   * Converte o prompt do SDK (string ou array de mensagens) para o formato aceito pela API
   */
  private _normalizeMessages(prompt: string | Array<{ role: string; content: any }>): { role: string, content: string }[] {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }
    return (prompt as Array<{ role: string; content: any }>).map(msg => {
      let content = msg.content;
      if (Array.isArray(content)) {
        content = content.map((p: any) => typeof p === 'string' ? p : p.text ?? '').join(' ');
      } else {
        content = String(content);
      }
      return { role: msg.role, content };
    });
  }

  async doGenerate(options: Parameters<LanguageModelV1['doGenerate']>[0]) {
    const messages = this._normalizeMessages(options.prompt);
    const text = await this.chat(messages);
    return {
      text,
      finishReason: 'stop' as LanguageModelV1FinishReason,
      usage: { promptTokens: NaN, completionTokens: NaN },
      rawCall: { rawPrompt: options.prompt, rawSettings: {} },
      rawResponse: {},
      request: {},
      response: {},
      warnings: [] as LanguageModelV1CallWarning[],
    };
  }

  async doStream(options: Parameters<LanguageModelV1['doStream']>[0]) {
    const messages = this._normalizeMessages(options.prompt);
    const reader = await this.chatStream(messages);
    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      async start(controller) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value, { stream: true }).split('\n');
          for (const line of lines) {
            let delta = line;
            if (delta) controller.enqueue({ type: 'text-delta', textDelta: delta });
          }
        }
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { promptTokens: NaN, completionTokens: NaN } });
        controller.close();
      }
    });
    return { stream, rawCall: { rawPrompt: options.prompt, rawSettings: {} }, rawResponse: {}, request: {}, warnings: [] };
  }

  async chat(messages: { role: string, content: string }[]): Promise<string> {
    const raw = await this._fetchChatResponse(messages);
    const text = await raw.text();
    const lines = text.split('\n');
    return this._mapResponse(lines);
  }

  async chatStream(messages: { role: string, content: string }[]): Promise<ReadableStreamDefaultReader> {
    const response = await this._fetchChatResponse(messages);
    const reader = response.body!.getReader();
    return this.streamMapResponse(reader, this._mapResponse);
  }

  async streamMapResponse(reader: ReadableStreamDefaultReader, mapResponse: (lines: string[]) => string): Promise<ReadableStreamDefaultReader> {
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const mappedResponse = mapResponse(decoder.decode(value, { stream: true }).split('\n'));
          controller.enqueue(new TextEncoder().encode(mappedResponse));
        }
        controller.close();
      }
    }).getReader();
  }

  /**
   * Executa a requisição de chat e retorna o corpo completo como texto.
   */
  private async _fetchChatResponse(
    messageHistory: Array<{ content: string; role: string }>,
  ): Promise<Response> {
    const payload = {
      additional_extension_context: '',
      allow_magic_buttons: true,
      is_vscode_extension: true,
      message_history: messageHistory,
      requested_model: this.modelId,
      user_input: messageHistory.filter(m => m.role === 'user').pop()?.content ?? '',
    };
    const response = await fetch(PhindAIService.API_URL, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('Erro Phind:', err);
      throw new Error(`Falha ao gerar texto (Phind): ${response.status} ${response.statusText}`);
    }
    return response;
  }

  private _mapResponse(lines: string[]): string {
    let out = '';
    for (const l of lines) {
      if (!l.startsWith('data: ') || l.includes('[DONE]')) continue;
      try {
        out += JSON.parse(l.substring(5))?.choices?.[0]?.delta?.content ?? '';
      } catch { /* ignore parse errors */ }
    }
    return out.replace(/\\n/g, '\n');
  }
}
