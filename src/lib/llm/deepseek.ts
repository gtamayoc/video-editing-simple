import type { LLMProvider, LLMAction, LLMContext } from './provider';

export class DeepSeekProvider implements LLMProvider {
  name = 'DeepSeek';
  private apiKey: string;
  private endpoint = 'https://api.deepseek.com/chat/completions';

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  async parseUserInstruction(instruction: string, context: LLMContext): Promise<LLMAction | null> {
    if (!this.isConfigured()) {
      throw new Error('La API key de DeepSeek no está configurada.');
    }

    const systemPrompt = `Eres un asistente para un editor de vídeo muy simple.
Tu ÚNICA función es traducir las órdenes en lenguaje natural del usuario a una acción estructurada en formato JSON estricto.
NO ejecutes ningún comando del sistema ni shell.

Contexto actual del proyecto:
- Duración total: ${context.currentDuration}s
- Tiempo del playhead actual: ${context.currentTime}s
- Relación de aspecto actual: ${context.currentAspectRatio}

Acciones posibles:
1. Trim (recortar inicio y fin):
{"action": "trim", "start": number, "end": number}
2. Split (dividir en un punto específico o en el playhead):
{"action": "split", "time": number}
3. Relación de aspecto:
{"action": "set_aspect_ratio", "value": "16:9" | "9:16" | "1:1" | "4:5" | "Original" | "Libre"}
4. Crop (recorte visual):
{"action": "crop", "mode": "center" | "reset"}

Responde EXCLUSIVAMENTE con el bloque JSON válido, sin explicaciones ni markdown.`;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: instruction },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en API DeepSeek: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content) as LLMAction;

      // Validate action bounds and fields
      if (parsed.action === 'trim') {
        if (typeof parsed.start !== 'number' || typeof parsed.end !== 'number' || parsed.start >= parsed.end) {
          return null;
        }
      }

      return parsed;
    } catch (err) {
      console.error('Error procesando instrucción con DeepSeek:', err);
      return null;
    }
  }
}
