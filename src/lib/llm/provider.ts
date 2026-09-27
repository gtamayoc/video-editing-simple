import type { CropArea, ProjectSettings } from '../../types/project';

export type LLMAction =
  | {
      action: 'trim';
      start: number;
      end: number;
    }
  | {
      action: 'split';
      time?: number;
    }
  | {
      action: 'set_aspect_ratio';
      value: ProjectSettings['aspectRatio'];
    }
  | {
      action: 'crop';
      mode: 'center' | 'reset';
      cropArea?: CropArea;
    };

export interface LLMContext {
  currentDuration: number;
  currentTime: number;
  currentAspectRatio: string;
}

export interface LLMProvider {
  name: string;
  isConfigured(): boolean;
  parseUserInstruction(instruction: string, context: LLMContext): Promise<LLMAction | null>;
}
