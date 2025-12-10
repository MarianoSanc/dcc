import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UrlClass } from '../shared/models/url.model';

@Injectable({
  providedIn: 'root',
})
export class PdfGeneratorService {
  private urlClass = new UrlClass();

  constructor(private http: HttpClient) {}

  /**
   * Genera un PDF a partir de la plantilla Word con los datos del DCC
   * @param data Objeto con los datos del DCC para reemplazar en la plantilla
   * @returns Observable con la respuesta del servidor (URL del PDF generado o blob)
   */
  generatePdf(data: PdfTemplateData): Observable<any> {
    const apiUrl = this.urlClass.pdfURL + 'api/generate-pdf.php';
    console.log('API URL for PDF generation:', apiUrl);
    return this.http.post(apiUrl, data, { responseType: 'json' });
  }

  /**
   * Descarga el PDF generado
   * @param pdfUrl URL del PDF generado
   */
  downloadPdf(pdfUrl: string): void {
    window.open(pdfUrl, '_blank');
  }

  /**
   * Genera el PDF y lo descarga directamente como blob
   * @param data Datos del DCC
   * @returns Observable con el blob del PDF
   */
  generateAndDownloadPdf(data: PdfTemplateData): Observable<Blob> {
    const apiUrl = this.urlClass.pdfURL.replace('/templates/', '/api/');
    return this.http.post(`${apiUrl}generate-pdf.php`, data, {
      responseType: 'blob',
    });
  }
}

/**
 * Interface para los datos que se enviarán a la plantilla
 */
export interface PdfTemplateData {
  results?: Array<any>;
  pt?: string;
  measuringEquipments?: Array<{
    id_patron: string;
    name_patron: string;
    manufacturer_patron: string;
    model_patron: string;
    sn_patron: string;
    interval_patron: string;
  }>;
  influenceConditions?: Array<{
    refType: string;
    value: string;
    name: string;
    unit: string;
  }>;
  // Subitems para el backend
  subitems?: Array<{
    name: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    customerAssetId: string;
  }>;
  // Core Data
  certificate_number: string;
  issue_date: string;
  beginPerformanceDate: string;
  endPerformanceDate: string;
  performanceLocation: string;
  is_range_date?: boolean;

  // Customer Data
  customer_name: string;
  customer_direction: string;
  customer_email: string;
  customer_phone: string;

  // Laboratory Data (opcional, para futuras expansiones)
  laboratory_name?: string;
  laboratory_direction?: string;
  laboratory_phone?: string;

  // Item Data (opcional)
  item_name?: string;
  item_manufacturer?: string;
  item_model?: string;
  item_serial_number?: string;

  // Responsible persons
  responsiblePersons?: Array<{
    full_name: string;
    role: string;
    mainSigner: boolean;
  }>;

  // Fecha de recepción
  date_receipt?: string;

  // Plantilla a usar
  template_name?: string;
}
