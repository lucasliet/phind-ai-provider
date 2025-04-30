import { PhindAIService } from '../src/PhindAIService';
import { generateText, streamText } from 'ai';

jest.setTimeout(20000);

describe('PhindAIService - text', () => {

  it('deve retornar uma resposta real do Phind quando prompt text', async () => {
    const { text: result } = await generateText({
      model: new PhindAIService(),
      prompt: 'Qual é a capital da França?',
    });
    console.log('Resposta do Phind (text):', result);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    const lowerResult = result.toLowerCase();
  
    expect(lowerResult).toMatch(/paris/);
  });

  it('deve retornar uma resposta real do Phind quando prompt array', async () => {
    const { text: result } = await generateText({
      model: new PhindAIService(),
      messages: [
        { role: 'system', content: 'Seja conciso.' },
        { role: 'user', content: 'Qual é a capital da Alemanha?' },
        { role: 'assistant', content: 'Berlim' },
        { role: 'user', content: 'E qual é a capital da Itália?' },
      ],
    });
    console.log('Resposta do Phind (array):', result);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    const lowerResult = result.toLowerCase();
    expect(lowerResult).toMatch(/roma|rome/);
  });
});

describe('PhindAIService - stream', () => {
  it('deve retornar uma resposta real do Phind em stream quando prompt text', async () => {
    const { textStream } = streamText({
      model: new PhindAIService(),
      prompt: 'Explique o que é a fotossíntese em uma frase.',
    });
    let result = '';
    for await (const textPart of textStream) {
      result += textPart;
    }
    console.log('Resposta do Phind (stream text):', result);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    const lowerResult = result.toLowerCase();
    expect(lowerResult).toMatch(/planta|luz|energia|açúcar|oxigênio|dióxido de carbono/);
  });

  it('deve retornar uma resposta real do Phind em stream quando prompt array', async () => {
    const { textStream } = streamText({
      model: new PhindAIService(),
      messages: [
        { role: 'system', content: 'Responda de forma curta.' },
        { role: 'user', content: 'Qual o maior planeta do sistema solar?' },
        { role: 'assistant', content: 'Júpiter' },
        { role: 'user', content: 'E o segundo maior?' },
      ],
    });
    let result = '';
    for await (const textPart of textStream) {
      result += textPart;
    }
    console.log('Resposta do Phind (stream array):', result);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    const lowerResult = result.toLowerCase();
    expect(lowerResult).toMatch(/saturno/);
  });
});
