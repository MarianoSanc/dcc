import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { UrlClass } from '../shared/models/url.model';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class AdministrativeDataService {
  private database: string;

  constructor(private apiService: ApiService) {
    const isTesting = false;
    this.database = isTesting ? 'prueba' : 'calibraciones';
  }

  // Formateo de fechas para inputs
  formatDateForInput(dateValue: any): string {
    if (!dateValue) return '';

    if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }

    let date: Date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue + 'T12:00:00');
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return '';
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // Formateo de fechas para base de datos
  formatDateForDatabase(dateValue: any): string {
    if (!dateValue) return '';

    if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }

    let date: Date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue + 'T12:00:00');
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return '';
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // Guardar datos en base de datos
  saveToDatabase(
    dataToSave: any,
    blockType: string,
    certificateNumber: string
  ): Observable<boolean> {
    return new Observable((observer) => {
      if (!certificateNumber) {
        observer.error(new Error('Certificate Number no está definido.'));
        return;
      }

      Swal.fire({
        title: `Guardando ${this.getBlockDisplayName(blockType)}...`,
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const updateRequest = {
        action: 'update',
        bd: this.database,
        table: 'dcc_data',
        opts: {
          where: { id: certificateNumber },
          attributes: dataToSave,
        },
      };

      this.apiService.post(updateRequest, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          Swal.close();
          if (response.result) {
            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: `${this.getBlockDisplayName(
                blockType
              )} guardado correctamente`,
              timer: 2000,
              showConfirmButton: false,
              position: 'top-end',
            });
            observer.next(true);
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: `No se pudo guardar ${this.getBlockDisplayName(
                blockType
              )}.`,
            });
            observer.next(false);
          }
          observer.complete();
        },
        error: (error) => {
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `Ocurrió un error al guardar ${this.getBlockDisplayName(
              blockType
            )}.`,
          });
          observer.error(error);
        },
      });
    });
  }

  private getBlockDisplayName(blockType: string): string {
    const displayNames: { [key: string]: string } = {
      software: 'Software',
      core: 'Datos Principales',
      laboratory: 'Laboratorio',
      responsible: 'Personas Responsables',
      customer: 'Cliente',
    };
    return displayNames[blockType] || blockType;
  }

  // Formatear todas las fechas de core data
  formatCoreDates(coreData: any): any {
    const formatted = { ...coreData };

    if (formatted.receipt_date) {
      formatted.receipt_date = this.formatDateForInput(formatted.receipt_date);
    }
    if (formatted.performance_date) {
      formatted.performance_date = this.formatDateForInput(
        formatted.performance_date
      );
    }
    if (formatted.end_performance_date) {
      formatted.end_performance_date = this.formatDateForInput(
        formatted.end_performance_date
      );
    }
    if (formatted.issue_date) {
      formatted.issue_date = this.formatDateForInput(formatted.issue_date);
    }

    return formatted;
  }

  // Preparar datos para guardar
  prepareCoreDataForSave(coreData: any): any {
    return {
      pt: coreData.pt_id,
      country: coreData.country_code,
      language: coreData.language,
      receipt_date: coreData.receipt_date
        ? this.formatDateForDatabase(coreData.receipt_date)
        : null,
      date_calibration: coreData.performance_date
        ? this.formatDateForDatabase(coreData.performance_date)
        : null,
      date_range: coreData.is_range_date ? 1 : 0,
      date_end: coreData.end_performance_date
        ? this.formatDateForDatabase(coreData.end_performance_date)
        : null,
      location: coreData.performance_localition,
      issue_date: coreData.issue_date
        ? this.formatDateForDatabase(coreData.issue_date)
        : null,
    };
  }

  prepareSoftwareDataForSave(softwareData: any): any {
    return {
      software_name: softwareData.name,
      software_version: softwareData.version,
      software_type: softwareData.type,
      software_description: softwareData.description,
    };
  }
}
