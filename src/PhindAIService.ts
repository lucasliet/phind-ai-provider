import { LanguageModelV1, LanguageModelV1FinishReason, LanguageModelV1CallWarning, LanguageModelV1StreamPart } from '@ai-sdk/provider';

/** 
 * Service for communicating with the Phind AI API.
 * Implements the LanguageModelV1 interface from the AI SDK.
 */
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

  /**
   * @param model Model identifier (e.g., 'Phind-70B')
   */
  constructor(model: string = 'Phind-70B') {
    this.modelId = model;
  }

  /** Name of this service provider */
  get provider(): string {
    return 'phind';
  }

  /**
   * Convert SDK prompt (string or message array) into API-compatible format.
   * @param prompt Prompt to normalize
   * @returns Array of message objects with role and content
   */
  private _normalizeMessages(
    prompt: string | Array<{ role: string; content: any }>,
  ): { role: string; content: string }[] {
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

  /**
   * Generate text synchronously (full) using the API.
   * @param options Generation options (prompt, settings, etc.)
   */
  async doGenerate(
    options: Parameters<LanguageModelV1['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
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

  /**
   * Stream text generation from the API.
   * @param options Generation options (prompt, settings, etc.)
   * @returns Stream of text parts
   */
  async doStream(
    options: Parameters<LanguageModelV1['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
    const messages = this._normalizeMessages(options.prompt);
    const reader = await this.chatReader(messages);
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
        reader.releaseLock();
      }
    });
    return { stream, rawCall: { rawPrompt: options.prompt, rawSettings: {} }, rawResponse: {}, request: {}, warnings: [] };
  }

  /**
   * Execute a chat request and return the complete response text.
   * @param messages Message history
   * @returns Full text returned by the API
   */
  async chat(messages: { role: string; content: string }[]): Promise<string> {
    const raw = await this._fetchChatResponse(messages);
    const text = await raw.text();
    const lines = text.split('\n');
    return this._mapResponse(lines);
  }

  /**
   * Execute a chat request in streaming mode and return a reader.
   * @param messages Message history
   * @returns Reader for the response stream
   */
  async chatReader(
    messages: { role: string; content: string }[],
  ): Promise<ReadableStreamDefaultReader> {
    const response = await this._fetchChatResponse(messages);
    const reader = response.body!.getReader();
    return this.streamMapResponse(reader, this._mapResponse);
  }

  /**
   * Async generator yielding chunks from the chat stream.
   * @param messages Message history
   */
  async *chatStream(
    messages: { role: string; content: string }[],
  ): AsyncGenerator<string> {
    const reader = await this.chatReader(messages);
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        let delta = line;
        if (delta) yield delta;
      }
    }
    reader.releaseLock();
  }

  /**
   * Maps raw stream data using the provided mapResponse function.
   * @param reader Raw stream reader
   * @param mapResponse Function to map SSE lines to text
   * @returns Reader for the mapped stream
   */
  async streamMapResponse(
    reader: ReadableStreamDefaultReader,
    mapResponse: (lines: string[]) => string,
  ): Promise<ReadableStreamDefaultReader> {
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
        reader.releaseLock();
      }
    }).getReader();
  }

  /**
   * Send chat request to the API and return the raw Response object.
   * @param messageHistory Chat message history for the payload
   * @throws Error on HTTP failure
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
      console.error('Phind Error:', err);
      throw new Error(`Failed to generate text (Phind): ${response.status} ${response.statusText}`);
    }
    return response;
  }

  /**
   * Build the final text output from SSE lines.
   * @param lines SSE event lines
   * @returns Parsed text content
   */
  private _mapResponse(lines: string[]): string {
    let result = '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        result += JSON.parse(line.substring(5))?.choices?.[0]?.delta?.content ?? '';
      } catch { /* ignore parse errors */ }
    }
    return result.replace(/\\n/g, '\n');
  }
}
