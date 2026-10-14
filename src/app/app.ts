import { CommonModule, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { QuoteStorageService } from './quote-storage.service';

registerLocaleData(localePt, 'pt-BR');

interface ServiceItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  unitPriceInput: string;
}

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, FormsModule, MatButtonToggleModule],
  styleUrls: ['./app.css'],
  templateUrl: './app.html',
})
export class App {
  private readonly servicesPerPage = 10;

  protected readonly services: ServiceItem[] = Array.from({ length: 4 }, () => ({
    description: '',
    quantity: null,
    unitPrice: null,
    unitPriceInput: '0,00',
  }));

  protected readonly paymentOptions = [
    { label: 'Dinheiro', selected: false },
    { label: 'Pix', selected: false },
    { label: 'Cartão', selected: false },
  ];

  protected otherPaymentMethod = '';
  protected isDarkMode = false;

  protected quote = {
    companyName: '',
    companyPhone: '',
    companyEmail: '',
    companyAddress: '',
    logoPath: '',
    number: '',
    date: this.localDate(),
    client: '',
    taxId: '',
    clientPhone: '',
    clientEmail: '',
    discount: null as number | null,
    discountInput: '0,00',
    discountMode: 'fixed' as 'fixed' | 'percent',
    estimatedTime: '',
    manualEstimatedDate: '',
    validityDays: null as number | null,
    startDate: this.localDate(),
    materialsIncluded: '',
    notes: '',
  };

  constructor(
    private readonly quoteStorage: QuoteStorageService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.isDarkMode = this.quoteStorage.loadDarkMode();
  }

  protected submitted = false;
  protected isSaving = false;
  protected saveError = '';
  protected savedFilePath = '';
  protected isSavingPdf = false;
  protected pdfSaveError = '';
  protected savedPdfFilePath = '';
  protected toastMessage = '';
  protected toastType: 'success' | 'error' = 'success';
  private toastTimeout: number | undefined;
  protected logoError = '';
  protected isSavingLogo = false;
  protected isSavedQuotesOpen = false;
  protected isLoadingQuotes = false;
  protected isLoadingSavedQuote = false;
  protected savedQuotesError = '';
  protected savedQuotes: string[] = [];

  protected get subtotal(): number {
    return this.services.reduce((total, item) => total + this.lineTotal(item), 0);
  }

  protected get total(): number {
    return Math.max(0, this.subtotal - this.discountAmount);
  }

  protected get discountAmount(): number {
    const value = this.quote.discount ?? 0;
    return this.quote.discountMode === 'percent'
      ? this.subtotal * Math.min(value, 100) / 100
      : value;
  }

  protected get hasFinancialValues(): boolean {
    return this.quote.discount !== null
      || this.services.some((item) => item.quantity !== null || item.unitPrice !== null);
  }

  protected get paymentMethodsText(): string {
    const selectedMethods = this.paymentOptions
      .filter((payment) => payment.selected)
      .map((payment) => payment.label);
    const methods = this.otherPaymentMethod.trim()
      ? [...selectedMethods, this.otherPaymentMethod.trim()]
      : selectedMethods;
    return methods.join(', ');
  }

  protected get servicePages(): ServiceItem[][] {
    const pages: ServiceItem[][] = [];
    for (let index = 0; index < this.services.length; index += this.servicesPerPage) {
      pages.push(this.services.slice(index, index + this.servicesPerPage));
    }
    return pages;
  }

  protected get hasMultiplePages(): boolean {
    return this.servicePages.length > 1;
  }

  protected trackPage(index: number): number {
    return index;
  }

  protected lineTotal(item: ServiceItem): number {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return quantity * unitPrice;
  }

  protected updateServicePrice(item: ServiceItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatCurrencyInput(input.value);
    item.unitPriceInput = formatted.text;
    item.unitPrice = formatted.value;
    input.value = formatted.text;
    input.setSelectionRange(input.value.length, input.value.length);
  }

  protected updateDiscount(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatCurrencyInput(input.value);
    const value = this.quote.discountMode === 'percent' && formatted.value !== null
      ? Math.min(formatted.value, 100)
      : formatted.value;
    const text = value === formatted.value ? formatted.text : this.currencyInput(value);
    this.quote.discountInput = text;
    this.quote.discount = value;
    input.value = text;
    input.setSelectionRange(input.value.length, input.value.length);
  }

  protected moveCurrencyCaretToEnd(event: Event): void {
    const input = event.target as HTMLInputElement;
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  protected addService(): void {
    this.services.push({ description: '', quantity: null, unitPrice: null, unitPriceInput: '0,00' });
  }

  protected removeService(index: number): void {
    if (this.services.length > 1 && index >= 0 && index < this.services.length) {
      this.services.splice(index, 1);
    }
  }

  protected formatTaxId(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    const isCnpj = digits.length > 11;
    const groups = isCnpj ? [2, 3, 3, 4, 2] : [3, 3, 3, 2];
    const separators = isCnpj ? ['.', '.', '/', '-'] : ['.', '.', '-'];
    let result = '';
    let offset = 0;

    for (let index = 0; index < groups.length && offset < digits.length; index += 1) {
      const end = Math.min(offset + groups[index], digits.length);
      result += digits.slice(offset, end);
      offset = end;
      if (offset < digits.length) result += separators[index];
    }

    return result;
  }

  protected formatPhoneInput(event: Event, field: 'companyPhone' | 'clientPhone'): void {
    const input = event.target as HTMLInputElement;
    const digitsBeforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, '').length;
    const formatted = this.formatPhone(input.value);
    this.quote[field] = formatted;
    input.value = formatted;

    let caret = 0;
    let digitsSeen = 0;
    while (caret < formatted.length && digitsSeen < digitsBeforeCaret) {
      if (/\d/.test(formatted[caret])) digitsSeen += 1;
      caret += 1;
    }
    input.setSelectionRange(caret, caret);
  }

  protected formatDate(value: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  protected async submitQuote(): Promise<void> {
    this.submitted = true;
    this.isSaving = true;
    this.saveError = '';
    this.savedFilePath = '';

    try {
      this.savedFilePath = await this.quoteStorage.saveQuote({
        quote: this.quote,
        services: this.services.map(({ unitPriceInput, ...service }) => service),
        paymentMethods: this.paymentMethodsText,
        paymentOptions: this.paymentOptions.map((payment) => ({ ...payment })),
        otherPaymentMethod: this.otherPaymentMethod,
        subtotal: this.subtotal,
        total: this.total,
      });
      this.showToast(`Orçamento salvo em: ${this.savedFilePath}`, 'success');
    } catch (error) {
      console.error('Falha ao salvar o orçamento na pasta do programa.', error);
      this.saveError = error instanceof Error ? error.message : 'Falha ao salvar o orçamento.';
      this.showToast(this.saveError, 'error');
    } finally {
      this.isSaving = false;
      this.changeDetector.markForCheck();
    }
  }

  protected printQuote(): void {
    window.print();
  }

  protected async savePdf(): Promise<void> {
    const clientName = this.quote.client.trim();
    if (!clientName) {
      this.pdfSaveError = 'Informe o cliente antes de salvar o PDF.';
      this.savedPdfFilePath = '';
      this.showToast(this.pdfSaveError, 'error');
      return;
    }

    const pages = Array.from(document.querySelectorAll<HTMLElement>('.preview-area .document'));
    if (pages.length === 0) {
      this.pdfSaveError = 'Não há páginas disponíveis para gerar o PDF.';
      this.showToast(this.pdfSaveError, 'error');
      return;
    }

    this.isSavingPdf = true;
    this.pdfSaveError = '';
    this.savedPdfFilePath = '';
    this.changeDetector.markForCheck();
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await document.fonts.ready;
      await Promise.all(
        pages.flatMap((page) => Array.from(page.querySelectorAll('img')).map((image) => image.decode())),
      );
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      for (const [index, page] of pages.entries()) {
        if (index > 0) pdf.addPage('a4', 'portrait');
        const canvas = await html2canvas(page, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      this.savedPdfFilePath = await this.quoteStorage.savePdf(pdf.output('blob'), clientName);
      this.showToast(`PDF salvo em: ${this.savedPdfFilePath}`, 'success');
    } catch (error) {
      console.error('Não foi possível gerar ou salvar o PDF.', error);
      this.pdfSaveError = error instanceof Error ? error.message : 'Falha ao gerar ou salvar o PDF.';
      this.showToast(this.pdfSaveError, 'error');
    } finally {
      this.isSavingPdf = false;
      this.changeDetector.markForCheck();
    }
  }

  protected toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.quoteStorage.saveDarkMode(this.isDarkMode);
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    if (this.toastTimeout !== undefined) window.clearTimeout(this.toastTimeout);
    this.toastMessage = message;
    this.toastType = type;
    this.toastTimeout = window.setTimeout(() => {
      this.toastMessage = '';
      this.toastTimeout = undefined;
      this.changeDetector.markForCheck();
    }, 3000);
    this.changeDetector.markForCheck();
  }

  protected async openSavedQuotes(): Promise<void> {
    this.isSavedQuotesOpen = true;
    this.isLoadingQuotes = true;
    this.savedQuotesError = '';
    try {
      this.savedQuotes = await this.quoteStorage.listQuotes();
    } catch (error) {
      console.error('Não foi possível listar os orçamentos salvos.', error);
      this.savedQuotesError = error instanceof Error ? error.message : 'Falha ao listar os orçamentos.';
    } finally {
      this.isLoadingQuotes = false;
      this.changeDetector.markForCheck();
    }
  }

  protected closeSavedQuotes(): void {
    this.isSavedQuotesOpen = false;
  }

  protected async openSavedQuote(fileName: string): Promise<void> {
    this.isLoadingSavedQuote = true;
    this.savedQuotesError = '';
    this.changeDetector.markForCheck();
    try {
      const saved = await this.quoteStorage.loadQuote(fileName);
      const savedQuote = saved['quote'];
      const savedServices = saved['services'];
      if (!this.isRecord(savedQuote) || !Array.isArray(savedServices)) {
        throw new Error('O arquivo não contém os dados esperados de um orçamento.');
      }
      const savedLogoPath = this.stringValue(savedQuote, 'logoPath', '');
      if (savedLogoPath && !savedLogoPath.startsWith('/logos/')) {
        throw new Error('O arquivo do orçamento contém um caminho de logo inválido.');
      }

      this.quote = {
        ...this.quote,
        companyName: this.stringValue(savedQuote, 'companyName', this.quote.companyName),
        companyPhone: this.formatPhone(this.stringValue(savedQuote, 'companyPhone', '')),
        companyEmail: this.stringValue(savedQuote, 'companyEmail', ''),
        companyAddress: this.stringValue(savedQuote, 'companyAddress', ''),
        logoPath: savedLogoPath,
        number: this.stringValue(savedQuote, 'number', ''),
        date: this.stringValue(savedQuote, 'date', this.quote.date),
        client: this.stringValue(savedQuote, 'client', ''),
        taxId: this.stringValue(savedQuote, 'taxId', ''),
        clientPhone: this.formatPhone(this.stringValue(savedQuote, 'clientPhone', '')),
        clientEmail: this.stringValue(savedQuote, 'clientEmail', ''),
        discount: this.numberOrNull(savedQuote['discount']),
        discountInput: typeof savedQuote['discountInput'] === 'string'
          ? savedQuote['discountInput']
          : this.currencyInput(this.numberOrNull(savedQuote['discount'])),
        discountMode: savedQuote['discountMode'] === 'percent' ? 'percent' : 'fixed',
        estimatedTime: this.stringValue(savedQuote, 'estimatedTime', ''),
        manualEstimatedDate: this.stringValue(savedQuote, 'manualEstimatedDate', ''),
        validityDays: this.numberOrNull(savedQuote['validityDays']),
        startDate: this.stringValue(savedQuote, 'startDate', '') || this.localDate(),
        materialsIncluded: this.stringValue(savedQuote, 'materialsIncluded', ''),
        notes: this.stringValue(savedQuote, 'notes', ''),
      };
      const restoredServices = savedServices.map((value) => {
        if (!this.isRecord(value)) throw new Error('O orçamento contém um serviço inválido.');
        const unitPrice = this.numberOrNull(value['unitPrice']);
        return {
          description: this.stringValue(value, 'description', ''),
          quantity: this.numberOrNull(value['quantity']),
          unitPrice,
          unitPriceInput: this.currencyInput(unitPrice),
        };
      });
      this.services.splice(0, this.services.length, ...restoredServices);

      const storedOptions = saved['paymentOptions'];
      const savedPaymentOptions: unknown[] = Array.isArray(storedOptions) ? storedOptions : [];
      const paymentMethods = saved['paymentMethods'];
      const legacyPaymentMethods = typeof paymentMethods === 'string'
        ? paymentMethods.split(',').map((method) => method.trim())
        : [];
      for (const payment of this.paymentOptions) {
        const matchingOption = savedPaymentOptions.find(
          (option) => this.isRecord(option) && option['label'] === payment.label,
        );
        payment.selected = this.isRecord(matchingOption)
          ? matchingOption['selected'] === true
          : legacyPaymentMethods.includes(payment.label);
      }
      this.otherPaymentMethod = this.stringValue(saved, 'otherPaymentMethod', '');
      this.submitted = true;
      this.savedFilePath = `0- Rascunhos\\${fileName}`;
      this.isSavedQuotesOpen = false;
    } catch (error) {
      console.error('Não foi possível abrir o orçamento salvo.', error);
      this.savedQuotesError = error instanceof Error ? error.message : 'Falha ao abrir o orçamento.';
    } finally {
      this.isLoadingSavedQuote = false;
      this.changeDetector.markForCheck();
    }
  }

  protected async selectLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.logoError = 'Use uma imagem PNG, JPEG ou WebP.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.logoError = 'A logo deve ter até 5 MB.';
      return;
    }

    this.isSavingLogo = true;
    this.logoError = '';
    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      this.quote.logoPath = await this.quoteStorage.saveLogo(file, base64, this.quote.companyName);
    } catch (error) {
      console.error('Não foi possível salvar a logo.', error);
      this.logoError = error instanceof Error ? error.message : 'Falha ao salvar a logo.';
    } finally {
      this.isSavingLogo = false;
      this.changeDetector.markForCheck();
    }
  }

  protected isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private stringValue(record: Record<string, unknown>, key: string, fallback: string): string {
    const value = record[key];
    return typeof value === 'string' ? value : fallback;
  }

  private numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : '';

    const areaCode = digits.slice(0, 2);
    const number = digits.slice(2);
    if (number.length === 0) return `(${areaCode})`;

    if (digits.length > 10) {
      return number.length <= 5
        ? `(${areaCode}) ${number}`
        : `(${areaCode}) ${number.slice(0, 5)}-${number.slice(5)}`;
    }

    return number.length <= 4
      ? `(${areaCode}) ${number}`
      : `(${areaCode}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  private currencyInput(value: number | null): string {
    if (value === null) return '0,00';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Não foi possível ler o arquivo de imagem.'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo de imagem.'));
      reader.readAsDataURL(file);
    });
  }

  private localDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatCurrencyInput(value: string): { text: string; value: number | null } {
    const digits = value.replace(/\D/g, '').slice(0, 15);
    if (!digits) return { text: '', value: null };

    const amount = Number(digits) / 100;
    return {
      text: new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount),
      value: amount,
    };
  }
}
