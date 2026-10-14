import { Injectable } from '@angular/core';

interface SaveQuoteResponse {
  filePath: string;
}

interface SavedQuotesResponse {
  quotes: string[];
}

interface SaveLogoResponse {
  logoPath: string;
}

interface SavePdfResponse {
  filePath: string;
}

@Injectable({ providedIn: 'root' })
export class QuoteStorageService {
  private readonly themeKey = 'orcamento-servicos-dark-mode';
  private savedQuoteNames: string[] | null = null;

  loadDarkMode(): boolean {
    return localStorage.getItem(this.themeKey) === 'true';
  }

  saveDarkMode(isDarkMode: boolean): void {
    localStorage.setItem(this.themeKey, String(isDarkMode));
  }

  async saveQuote(quote: object): Promise<string> {
    const result = await this.request('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote),
    });

    if (!this.isSaveQuoteResponse(result)) {
      throw new Error('Resposta inválida do serviço de salvamento.');
    }

    const fileName = result.filePath.split(/[\\/]/).pop();
    if (fileName && this.savedQuoteNames !== null) {
      this.savedQuoteNames = [fileName, ...this.savedQuoteNames.filter((name) => name !== fileName)]
        .sort((left, right) => right.localeCompare(left, 'pt-BR'));
    }
    return result.filePath;
  }

  async listQuotes(): Promise<string[]> {
    if (this.savedQuoteNames !== null) return [...this.savedQuoteNames];

    const result = await this.request('/api/quotes');
    if (!this.isSavedQuotesResponse(result)) {
      throw new Error('Resposta inválida ao listar os orçamentos salvos.');
    }
    this.savedQuoteNames = result.quotes;
    return [...this.savedQuoteNames];
  }

  async loadQuote(fileName: string): Promise<Record<string, unknown>> {
    const result = await this.request(`/api/quotes/${encodeURIComponent(fileName)}`);
    if (typeof result !== 'object' || result === null) {
      throw new Error('O arquivo salvo não contém um orçamento válido.');
    }
    return result as Record<string, unknown>;
  }

  async saveLogo(file: File, base64: string, companyName: string): Promise<string> {
    const result = await this.request('/api/logos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName,
        mimeType: file.type,
        base64,
      }),
    });
    if (!this.isSaveLogoResponse(result)) {
      throw new Error('Resposta inválida ao salvar a logo.');
    }
    return result.logoPath;
  }

  async savePdf(pdf: Blob, clientName: string): Promise<string> {
    const response = await fetch(`/api/pdfs?client=${encodeURIComponent(clientName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdf,
    });
    let result: unknown;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('O serviço local retornou uma resposta inválida ao salvar o PDF.', { cause: error });
    }
    if (!response.ok) {
      const message = this.isErrorResponse(result) ? result.error : 'Falha ao salvar o PDF no serviço local.';
      throw new Error(message);
    }
    if (typeof result !== 'object' || result === null
      || !('filePath' in result) || typeof result.filePath !== 'string') {
      throw new Error('Resposta inválida ao salvar o PDF.');
    }
    return result.filePath;
  }

  private async request(url: string, options?: RequestInit): Promise<unknown> {
    const response = await fetch(url, options);
    let result: unknown;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('O serviço local retornou uma resposta inválida.', { cause: error });
    }

    if (!response.ok) {
      const message = this.isErrorResponse(result) ? result.error : 'Falha na solicitação ao serviço local.';
      throw new Error(message);
    }
    return result;
  }

  private isErrorResponse(value: unknown): value is { error: string } {
    return typeof value === 'object'
      && value !== null
      && 'error' in value
      && typeof value.error === 'string';
  }

  private isSaveQuoteResponse(value: unknown): value is SaveQuoteResponse {
    return typeof value === 'object'
      && value !== null
      && 'filePath' in value
      && typeof value.filePath === 'string';
  }

  private isSavedQuotesResponse(value: unknown): value is SavedQuotesResponse {
    return typeof value === 'object'
      && value !== null
      && 'quotes' in value
      && Array.isArray(value.quotes)
      && value.quotes.every((quote) => typeof quote === 'string');
  }

  private isSaveLogoResponse(value: unknown): value is SaveLogoResponse {
    return typeof value === 'object'
      && value !== null
      && 'logoPath' in value
      && typeof value.logoPath === 'string';
  }

}
