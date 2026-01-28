import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { UrlClass } from '../shared/models/url.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private database: string = 'orden';

  constructor(private apiService: ApiService) {}

  /**
   * Carga todos los servicios (service) para un proyecto específico
   * @param projectId ID del proyecto seleccionado
   * @returns Observable con la lista de servicios
   */
  loadServicesByProject(projectId: string): Observable<any[]> {
    return new Observable((observer) => {
      const getServices = {
        action: 'get',
        bd: this.database,
        table: 'service',
        opts: {
          where: {
            id_project: projectId,
            deleted: 0,
          },
        },
      };

      this.apiService.post(getServices, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const services = response.result || [];
          observer.next(services);
          observer.complete();
        },
        error: (error) => {
          console.error('❌ ERROR LOADING SERVICES:', error);
          observer.error(error);
        },
      });
    });
  }

  /**
   * Carga todos los DUT services relacionados con los servicios cargados
   * Relaciona orden.service.id con orden.dut_service.id_service
   * @param serviceIds Array de IDs de servicios
   * @returns Observable con la lista de DUT services
   */
  loadDutServicesByServices(serviceIds: string[]): Observable<any[]> {
    return new Observable((observer) => {
      if (!serviceIds || serviceIds.length === 0) {
        console.log('⚠️ NO SERVICE IDS PROVIDED');
        observer.next([]);
        observer.complete();
        return;
      }

      const getDutServices = {
        action: 'get',
        bd: this.database,
        table: 'dut_service',
        opts: {
          where: {
            id_service: serviceIds,
            deleted: 0,
          },
        },
      };

      this.apiService.post(getDutServices, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const dutServices = response.result || [];
          observer.next(dutServices);
          observer.complete();
        },
        error: (error) => {
          console.error('❌ ERROR LOADING DUT SERVICES:', error);
          observer.error(error);
        },
      });
    });
  }

  /**
   * Carga servicios y sus DUT services en una sola operación
   * @param projectId ID del proyecto
   * @returns Promise con objeto containing both services y dutServices
   */
  loadProjectData(projectId: string): Promise<{
    services: any[];
    dutServices: any[];
  }> {
    return new Promise((resolve, reject) => {
      this.loadServicesByProject(projectId).subscribe({
        next: (services) => {
          const serviceIds = services.map((s) => s.id);

          this.loadDutServicesByServices(serviceIds).subscribe({
            next: (dutServices) => {
              resolve({ services, dutServices });
            },
            error: (error) => {
              reject(error);
            },
          });
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }
}
