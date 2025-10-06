import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { UrlClass } from '../shared/models/url.model';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class LaboratoryService {
  private database: string;

  constructor(private apiService: ApiService) {
    const isTesting = false;
    this.database = isTesting ? 'prueba' : 'calibraciones';
  }

  // Cargar lista de laboratorios
  loadLaboratories(): Observable<any[]> {
    return new Observable((observer) => {
      const getLaboratories = {
        action: 'get',
        bd: this.database,
        table: 'dcc_laboratory',
        opts: {
          where: { deleted: 0 },
          order_by: ['name', 'ASC'],
        },
      };

      this.apiService.post(getLaboratories, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          observer.next(response.result || []);
          observer.complete();
        },
        error: (error) => {
          console.error('❌ Error loading laboratories:', error);
          observer.error(error);
        },
      });
    });
  }

  // Encontrar laboratorio por nombre y email
  findLaboratoryByData(
    laboratoryData: any,
    laboratoryList: any[]
  ): string | null {
    if (laboratoryList.length > 0 && laboratoryData.name) {
      const existingLab = laboratoryList.find(
        (lab) =>
          lab.name === laboratoryData.name && lab.email === laboratoryData.email
      );

      if (existingLab) {
        console.log('🔍 Found laboratory ID:', existingLab.id);
        return existingLab.id;
      } else {
        return null;
      }
    }
    return null;
  }

  // Crear nuevo laboratorio
  createLaboratory(laboratoryData: any): Observable<string> {
    return new Observable((observer) => {
      // Validar campos requeridos
      if (!laboratoryData.name || !laboratoryData.name.trim()) {
        observer.error(new Error('El nombre del laboratorio es obligatorio.'));
        return;
      }

      Swal.fire({
        title: 'Creando Laboratorio...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const createLabRequest = {
        action: 'create',
        bd: this.database,
        table: 'dcc_laboratory',
        opts: {
          attributes: {
            name: laboratoryData.name,
            email: laboratoryData.email || '',
            phone: laboratoryData.phone || '',
            fax: laboratoryData.fax || '',
            postal_code: laboratoryData.postal_code || '',
            city: laboratoryData.city || '',
            street: laboratoryData.street || '',
            number: laboratoryData.street_number || '',
            state: laboratoryData.state || '',
            country: laboratoryData.country || '',
            deleted: 0,
          },
        },
      };

      console.log('🆕 createLabRequest:', createLabRequest);

      this.apiService.post(createLabRequest, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          console.log('✅ Create laboratory response:', response);
          if (response.result) {
            // Buscar el ID del laboratorio recién creado
            this.findCreatedLaboratoryId(laboratoryData).subscribe({
              next: (labId) => {
                Swal.close();
                observer.next(labId);
                observer.complete();
              },
              error: (error) => {
                Swal.close();
                observer.error(error);
              },
            });
          } else {
            Swal.close();
            observer.error(new Error('No se pudo crear el laboratorio.'));
          }
        },
        error: (error) => {
          console.log('❌ Error creating laboratory:', error);
          Swal.close();
          observer.error(
            new Error('Ocurrió un error al crear el laboratorio.')
          );
        },
      });
    });
  }

  // Buscar ID del laboratorio recién creado
  private findCreatedLaboratoryId(laboratoryData: any): Observable<string> {
    return new Observable((observer) => {
      const findLabRequest = {
        action: 'get',
        bd: this.database,
        table: 'dcc_laboratory',
        opts: {
          where: {
            name: laboratoryData.name,
            email: laboratoryData.email || '',
            deleted: 0,
          },
          order_by: ['id', 'DESC'],
          limit: 1,
        },
      };

      console.log('🔍 findLabRequest:', findLabRequest);

      this.apiService.post(findLabRequest, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          console.log('✅ Find laboratory response:', response);
          if (response.result && response.result.length > 0) {
            const createdLab = response.result[0];
            observer.next(createdLab.id.toString());
            observer.complete();
          } else {
            observer.error(
              new Error('No se pudo encontrar el laboratorio creado.')
            );
          }
        },
        error: (error) => {
          console.log('❌ Error finding created laboratory:', error);
          observer.error(
            new Error('Ocurrió un error al buscar el laboratorio creado.')
          );
        },
      });
    });
  }

  // Actualizar laboratorio existente
  updateLaboratory(
    laboratoryId: string,
    laboratoryData: any
  ): Observable<boolean> {
    return new Observable((observer) => {
      if (!laboratoryId) {
        observer.error(
          new Error(
            'No se puede actualizar: no se encontró el ID del laboratorio.'
          )
        );
        return;
      }

      Swal.fire({
        title: 'Guardando Laboratorio...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const updateLabRequest = {
        action: 'update',
        bd: this.database,
        table: 'dcc_laboratory',
        opts: {
          where: { id: laboratoryId },
          attributes: {
            name: laboratoryData.name,
            email: laboratoryData.email,
            phone: laboratoryData.phone,
            fax: laboratoryData.fax,
            postal_code: laboratoryData.postal_code,
            city: laboratoryData.city,
            street: laboratoryData.street,
            number: laboratoryData.street_number,
            state: laboratoryData.state,
            country: laboratoryData.country,
          },
        },
      };

      console.log('🔄 updateLabRequest:', updateLabRequest);

      this.apiService.post(updateLabRequest, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          console.log('✅ Update laboratory response:', response);
          Swal.close();
          observer.next(response.result);
          observer.complete();
        },
        error: (error) => {
          console.log('❌ Error updating laboratory:', error);
          Swal.close();
          observer.error(
            new Error('Ocurrió un error al actualizar el laboratorio.')
          );
        },
      });
    });
  }

  // Vincular laboratorio al DCC
  linkLaboratoryToDcc(
    certificateNumber: string,
    laboratoryId: string
  ): Observable<boolean> {
    return new Observable((observer) => {
      if (!certificateNumber) {
        observer.error(new Error('Certificate Number no está definido.'));
        return;
      }

      if (!laboratoryId) {
        observer.error(new Error('No se ha seleccionado un laboratorio.'));
        return;
      }

      Swal.fire({
        title: 'Guardando selección...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const updateDccRequest = {
        action: 'update',
        bd: this.database,
        table: 'dcc_data',
        opts: {
          where: { id: certificateNumber },
          attributes: { id_laboratory: laboratoryId },
        },
      };

      console.log('🔗 updateDccRequest:', updateDccRequest);

      this.apiService.post(updateDccRequest, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          console.log('✅ Update DCC reference response:', response);
          Swal.close();
          observer.next(response.result);
          observer.complete();
        },
        error: (error) => {
          console.log('❌ Error updating DCC reference:', error);
          Swal.close();
          observer.error(
            new Error('Ocurrió un error al vincular el laboratorio.')
          );
        },
      });
    });
  }

  // Mapear datos de laboratorio seleccionado
  mapSelectedLaboratoryData(selectedLab: any): any {
    return {
      name: selectedLab.name || '',
      email: selectedLab.email || '',
      phone: selectedLab.phone || '',
      fax: selectedLab.fax || '',
      postal_code: selectedLab.postal_code || '',
      city: selectedLab.city || '',
      street: selectedLab.street || '',
      street_number: selectedLab.number || '', // Mapear desde 'number' de la BD
      state: selectedLab.state || '',
      country: selectedLab.country || '',
    };
  }
}
