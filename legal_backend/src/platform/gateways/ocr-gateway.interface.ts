export interface OcrResult {
  text: string;
  pages: Array<{ pageNumber: number; text: string; confidence: number }>;
  totalConfidence: number;
  provider: string;
}

export interface OcrGateway {
  extractText(fileUrl: string, mimeType: string): Promise<OcrResult>;
  healthCheck(): Promise<{ healthy: boolean }>;
}

export const OCR_GATEWAY = Symbol('OCR_GATEWAY');
