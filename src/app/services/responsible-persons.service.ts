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

  // Método para exponer el apiService
  getApiService(): ApiService {
    return this.apiService;
  }

  loadUsers(): Observable<any[]> {
    const info_usuarios = {
      action: 'get',
      bd: 'administracion',
      table: 'user',
      opts: {
        where: {
          deleted: 0,
          organizacion: 0,
        },
        order_by: ['first_name', 'ASC'],
      },
    };

    return new Observable((observer) => {
      this.apiService.post(info_usuarios, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const rawUsers = Array.isArray(response?.result)
            ? response.result
            : [];
          // Mapear usuarios para tener el formato esperado
          const users = rawUsers.map((user: any) => ({
            no_nomina: user.no_nomina,
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            email: user.email || '',
            phone: user.telefono || '',
          }));
          observer.next(users);
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

      // Primero obtener las personas responsables existentes
      this.loadResponsiblePersonsFromDB(certificateNumber).subscribe({
        next: (existingPersons) => {
          this.syncResponsiblePersons(
            certificateNumber,
            responsiblePersons,
            existingPersons,
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
          // Si falla cargar los existentes, insertar todos como nuevos
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

  private syncResponsiblePersons(
    certificateNumber: string,
    newPersons: any[],
    existingPersons: any[],
    listauser: any[]
  ): Observable<boolean> {
    return new Observable((observer) => {
      console.log('🔄 Syncing responsible persons');
      console.log('🔄 New persons:', newPersons);
      console.log('🔄 Existing persons:', existingPersons);

      const operations: Promise<any>[] = [];

      // 1. Preparar datos de nuevas personas con no_nomina
      const preparedNewPersons = newPersons
        .map((person) => {
          let noNomina = '';

          if (typeof person.name === 'string' && person.name) {
            const foundUser = listauser.find(
              (user) => user.name === person.name
            );
            if (foundUser) {
              noNomina = foundUser.no_nomina;
            }
          } else if (person.no_nomina) {
            noNomina = person.no_nomina;
          }

          return {
            ...person,
            no_nomina: noNomina,
            mainSigner: person.mainSigner || false,
          };
        })
        .filter((person) => person.no_nomina && person.role); // Solo personas válidas

      console.log('🔄 Prepared new persons:', preparedNewPersons);

      // 2. Encontrar personas a eliminar (que están en BD pero no en nueva lista)
      const personsToDelete = existingPersons.filter(
        (existingPerson) =>
          !preparedNewPersons.some(
            (newPerson) =>
              String(newPerson.no_nomina) === String(existingPerson.no_nomina)
          )
      );

      console.log('🗑️ Persons to delete:', personsToDelete);

      // 3. Encontrar personas a actualizar (que están en ambas listas)
      const personsToUpdate = preparedNewPersons.filter((newPerson) =>
        existingPersons.some(
          (existingPerson) =>
            String(existingPerson.no_nomina) === String(newPerson.no_nomina)
        )
      );

      console.log('🔄 Persons to update:', personsToUpdate);

      // 4. Encontrar personas a insertar (que están en nueva lista pero no en BD)
      const personsToInsert = preparedNewPersons.filter(
        (newPerson) =>
          !existingPersons.some(
            (existingPerson) =>
              String(existingPerson.no_nomina) === String(newPerson.no_nomina)
          )
      );

      console.log('➕ Persons to insert:', personsToInsert);

      // 5. Eliminar personas que ya no están
      personsToDelete.forEach((person) => {
        const deleteRequest = {
          action: 'update',
          bd: this.database,
          table: 'dcc_responsiblepersons',
          opts: {
            where: {
              id_dcc: certificateNumber,
              no_nomina: person.no_nomina,
              deleted: 0,
            },
            attributes: { deleted: 1 },
          },
        };

        console.log('🗑️ Delete request:', deleteRequest);
        operations.push(
          this.apiService.post(deleteRequest, UrlClass.URLNuevo).toPromise()
        );
      });

      // 6. Actualizar personas existentes
      personsToUpdate.forEach((person) => {
        const updateRequest = {
          action: 'update',
          bd: this.database,
          table: 'dcc_responsiblepersons',
          opts: {
            where: {
              id_dcc: certificateNumber,
              no_nomina: person.no_nomina,
              deleted: 0,
            },
            attributes: {
              role: person.role,
              main: person.mainSigner ? 1 : 0,
            },
          },
        };

        console.log('🔄 Update request:', updateRequest);
        operations.push(
          this.apiService.post(updateRequest, UrlClass.URLNuevo).toPromise()
        );
      });

      // 7. Insertar nuevas personas
      personsToInsert.forEach((person) => {
        const insertRequest = {
          action: 'create',
          bd: this.database,
          table: 'dcc_responsiblepersons',
          opts: {
            attributes: {
              no_nomina: person.no_nomina,
              id_dcc: certificateNumber,
              role: person.role,
              main: person.mainSigner ? 1 : 0,
              deleted: 0,
            },
          },
        };

        console.log('➕ Insert request:', insertRequest);
        operations.push(
          this.apiService.post(insertRequest, UrlClass.URLNuevo).toPromise()
        );
      });

      // 8. Ejecutar todas las operaciones
      if (operations.length > 0) {
        Promise.all(operations)
          .then((responses) => {
            console.log('✅ All operations completed:', responses);
            const allSuccessful = responses.every(
              (response: any) => response.result
            );
            observer.next(allSuccessful);
            observer.complete();
          })
          .catch((error) => {
            console.error('❌ Error in sync operations:', error);
            observer.error(error);
          });
      } else {
        console.log('ℹ️ No operations needed');
        observer.next(true);
        observer.complete();
      }
    });
  }

  mapResponsiblePersonsWithUsers(
    responsibleData: any[],
    listauser: any[]
  ): any[] {
    return responsibleData.map((person) => {
      // Buscar el usuario en listauser por no_nomina
      const foundUser = listauser.find(
        (user) => user.no_nomina === person.no_nomina
      );

      if (foundUser) {
        return {
          role: person.role || '',
          no_nomina: person.no_nomina,
          full_name: foundUser.name, // nombre completo del CONCAT
          email: foundUser.email || '',
          phone: foundUser.phone || '',
          mainSigner: Boolean(person.main),
        };
      } else {
        // Si no se encuentra el usuario, mostrar no_nomina como fallback
        return {
          role: person.role || '',
          no_nomina: person.no_nomina,
          full_name: `Usuario ${person.no_nomina}`,
          email: '',
          phone: '',
          mainSigner: Boolean(person.main),
        };
      }
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
                main: person.mainSigner ? 1 : 0,
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
