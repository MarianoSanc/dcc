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
  // Items - Nuevo sistema (itemsList del nuevo dcc_items)
  itemsList?: Array<{
    object?: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    costumer_asset?: string;
    comment?: string;
    description?: string;
  }>;
  // Subitems para el backend (legacy)
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
  accredited?: boolean;
  technical_verification?: boolean;
  next_calibration?: string;
  circuito?: string;

  // Performance Location
  performance_location_type?: string; // 'Laboratory', 'Customer', 'Other'
  project_location?: string; // Dirección del proyecto cuando es 'Other'

  // Customer Data
  customer_name: string;
  customer_direction: string;
  customer_email: string;
  customer_phone: string;
  customer_rep?: string;
  customer_rep_tel?: string;
  test_number?: string;
  PerformanceDate?: string;
  norma?: string;
  approved_by?: string;
  approved_by_role?: string;
  approved_by_email?: string;
  calibrated_by?: string;
  calibrated_by_role?: string;
  calibrated_by_email?: string;
  faseA?: string;
  faseB?: string;
  faseC?: string;

  // Laboratory Data (opcional, para futuras expansiones)
  laboratory_name?: string;
  laboratory_direction?: string;
  laboratory_phone?: string;

  // Item Data (opcional)
  item_name?: string;
  item_manufacturer?: string;
  item_model?: string;
  item_serial_number?: string;
  item_customer_asset_id?: string;
  item_comment?: string;

  // PT Description from hv_method
  pt_description?: string;

  // PT Method (PT + name)
  pt_method?: string;
  descripcion_servicio?: string;
  objeto_test?: string;
  equipamiento?: string;

  // Tested Material (IE only)
  material_description?: string;
  cable_fabricante?: string;
  cable_modelo?: string;
  cable_metrajeA?: string;
  cable_metrajeB?: string;
  cable_metrajeC?: string;
  terminal1_fabricante?: string;
  terminal1_modelo?: string;
  terminal1_snA?: string;
  terminal1_snB?: string;
  terminal1_snC?: string;
  terminal2_fabricante?: string;
  terminal2_modelo?: string;
  terminal2_snA?: string;
  terminal2_snB?: string;
  terminal2_snC?: string;
  empalmes_fabricante?: string;
  empalmes_modelo?: string;
  empalmes_metrajeA?: string;
  empalmes_metrajeB?: string;
  empalmes_metrajeC?: string;
  material_type?: string;
  gis_fabricante?: string;
  gis_tipo?: string;
  gis_fecha?: string;
  gis_lote?: string;
  gis_tension_un?: string;
  gis_tension_ur?: string;
  gis_norma?: string;

  // Metrological Traceability
  metrologicalTraceability?: Array<{
    id_patron: string;
    name_patron: string;
    tz_name: string;
    tz_by: string;
    tz_date: string;
    tz_quantity: string;
    tz_comm: string;
  }>;

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
