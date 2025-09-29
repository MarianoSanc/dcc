import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { UrlClass } from '../shared/models/url.model';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class ResponsiblePersonsService {
  private database: string;

  constructor(private apiService: ApiService) {
    const isTesting = false;
    this.database = isTesting ? 'prueba' : 'calibraciones';
  }

  loadUsers(): Observable<any[]> {
    const info_usuarios = {
      action: 'get',
      bd: 'administracion',
      table: 'user',
      opts: {
        customSelect:
          'user.no_nomina, CONCAT(user.first_name, " ", user.last_name) AS name',
        where: {
          deleted: 0,
          organizacion: 0,
        },
        order_by: ['user.first_name', 'ASC'],
      },
    };

    return new Observable((observer) => {
      this.apiService.post(info_usuarios, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          observer.next(response.result || []);
          observer.complete();
        },
        error: (error) => observer.error(error),
      });
    });
  }

  loadResponsiblePersonsFromDB(dccId: string): Observable<any[]> {
    const getResponsiblePersons = {
      action: 'get',
      bd: this.database,
      table: 'dcc_responsiblepersons',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
        order_by: ['id', 'ASC'],
      },
    };

    return new Observable((observer) => {
      this.apiService.post(getResponsiblePersons, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          observer.next(response.result || []);
          observer.complete();
        },
        error: (error) => observer.error(error),
      });
    });
  }

  mapResponsiblePersonsWithUsers(
    responsibleData: any[],
    listauser: any[]
  ): any[] {
    return responsibleData.map((person) => {
      const foundUser = listauser.find(
        (user) => user.no_nomina === person.no_nomina
      );

      if (foundUser) {
        return {
          role: person.role || '',
          no_nomina: person.no_nomina,
          full_name: foundUser.name,
          email: foundUser.email || '',
          phone: foundUser.phone || '',
        };
      } else {
        return {
          role: person.role || '',
          no_nomina: person.no_nomina,
          full_name: person.no_nomina,
          email: '',
          phone: '',
        };
      }
    });
  }

  saveResponsiblePersons(
    certificateNumber: string,
    responsiblePersons: any[],
    listauser: any[]
  ): Observable<boolean> {
    return new Observable((observer) => {
      Swal.fire({
        title: 'Guardando Personas Responsables...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // Primero marcar como eliminados los existentes
      const deleteExistingRequest = {
        action: 'update',
        bd: this.database,
        table: 'dcc_responsiblepersons',
        opts: {
          where: { id_dcc: certificateNumber },
          attributes: { deleted: 1 },
        },
      };

      this.apiService.post(deleteExistingRequest, UrlClass.URLNuevo).subscribe({
        next: () => {
          this.insertResponsiblePersons(
            certificateNumber,
            responsiblePersons,
            listauser
          ).subscribe({
            next: (success) => {
              Swal.close();
              observer.next(success);
              observer.complete();
            },
            error: (error) => {
              Swal.close();
              observer.error(error);
            },
          });
        },
        error: (error) => {
          // Continuar con la inserción aunque falle el delete
          this.insertResponsiblePersons(
            certificateNumber,
            responsiblePersons,
            listauser
          ).subscribe({
            next: (success) => {
              Swal.close();
              observer.next(success);
              observer.complete();
            },
            error: (insertError) => {
              Swal.close();
              observer.error(insertError);
            },
          });
        },
      });
    });
  }

  private insertResponsiblePersons(
    certificateNumber: string,
    responsiblePersons: any[],
    listauser: any[]
  ): Observable<boolean> {
    return new Observable((observer) => {
      if (responsiblePersons.length === 0) {
        observer.next(true);
        observer.complete();
        return;
      }

      const insertPromises: Promise<any>[] = [];

      responsiblePersons.forEach((person) => {
        let noNomina = '';

        if (typeof person.name === 'string') {
          const foundUser = listauser.find((user) => user.name === person.name);
          if (foundUser) {
            noNomina = foundUser.no_nomina;
          }
        } else if (person.no_nomina) {
          noNomina = person.no_nomina;
        }

        if (noNomina && person.role) {
          const insertRequest = {
            action: 'create',
            bd: this.database,
            table: 'dcc_responsiblepersons',
            opts: {
              attributes: {
                no_nomina: noNomina,
                id_dcc: certificateNumber,
                role: person.role,
                deleted: 0,
              },
            },
          };

          insertPromises.push(
            this.apiService.post(insertRequest, UrlClass.URLNuevo).toPromise()
          );
        }
      });

      if (insertPromises.length > 0) {
        Promise.all(insertPromises)
          .then((responses) => {
            const allSuccessful = responses.every(
              (response: any) => response.result
            );
            observer.next(allSuccessful);
            observer.complete();
          })
          .catch((error) => observer.error(error));
      } else {
        observer.next(false);
        observer.complete();
      }
    });
  }
}
