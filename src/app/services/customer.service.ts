import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { UrlClass } from '../shared/models/url.model';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private database: string = 'calibraciones';
  private hvtestDatabase: string = 'hvtest2';

  constructor(private apiService: ApiService) {}

  // Cargar lista de clientes desde hvtest2.account (solo id y name para rapidez)
  loadCustomers(): Observable<any[]> {
    return new Observable((observer) => {
      const getAccounts = {
        action: 'get',
        bd: this.hvtestDatabase,
        table: 'account',
        opts: {
          where: { deleted: 0 },
          order_by: ['name', 'ASC'],
        },
      };

      this.apiService.post(getAccounts, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const accounts = response.result || [];
          // Solo mapear datos básicos sin cargar email/phone
          const basicAccounts = accounts.map((account: any) => ({
            id: account.id,
            name: account.name || '',
            // Datos de dirección directamente del account
            street: account.billing_address_street || '',
            city: account.billing_address_city || '',
            state: account.billing_address_state || '',
            country: account.billing_address_country || '',
            postal_code: account.billing_address_postalcode || '',
            // Email y phone se cargarán cuando se seleccione
            email: '',
            phone: '',
            fax: '',
            street_number: '',
          }));
          observer.next(basicAccounts);
          observer.complete();
        },
        error: (error) => {
          console.error('Error loading accounts:', error);
          observer.error(error);
        },
      });
    });
  }

  // Cargar detalles completos de un cliente específico (email y phone)
  loadCustomerDetails(customerId: string): Observable<any> {
    return new Observable((observer) => {
      // Primero obtener el account básico
      const getAccount = {
        action: 'get',
        bd: this.hvtestDatabase,
        table: 'account',
        opts: {
          where: {
            id: customerId,
            deleted: 0,
          },
        },
      };

      this.apiService.post(getAccount, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const account = response.result?.[0];
          console.log('=== LOAD CUSTOMER DETAILS ===');
          console.log('Raw account object:', account);
          console.log(
            'All account keys:',
            account ? Object.keys(account) : 'no account'
          );

          if (!account) {
            observer.error(new Error('Cliente no encontrado'));
            return;
          }

          // Cargar email y phone en paralelo
          Promise.all([
            this.loadAccountEmail(customerId),
            this.loadAccountPhone(customerId),
          ])
            .then(([email, phone]) => {
              const fullCustomer = {
                id: account.id,
                name: account.name || '',
                email: email,
                phone: phone,
                street: account.billing_address_street || '',
                city: account.billing_address_city || '',
                state: account.billing_address_state || '',
                country: account.billing_address_country || '',
                postal_code: account.billing_address_postalcode || '',
                fax: '',
                street_number: '',
              };
              observer.next(fullCustomer);
              observer.complete();
            })
            .catch((error) => {
              // Si falla, devolver sin email/phone
              const basicCustomer = {
                id: account.id,
                name: account.name || '',
                email: '',
                phone: '',
                street: account.billing_address_street || '',
                city: account.billing_address_city || '',
                state: account.billing_address_state || '',
                country: account.billing_address_country || '',
                postal_code: account.billing_address_postalcode || '',
                fax: '',
                street_number: '',
              };
              observer.next(basicCustomer);
              observer.complete();
            });
        },
        error: (error) => {
          console.error('Error loading account:', error);
          observer.error(error);
        },
      });
    });
  }

  // Cargar detalles de un account (email y phone) - DEPRECATED, usar loadCustomerDetails
  private loadAccountDetails(account: any): Promise<any> {
    return Promise.all([
      this.loadAccountEmail(account.id),
      this.loadAccountPhone(account.id),
    ])
      .then(([email, phone]) => {
        return this.mapAccountToCustomer(account, email, phone);
      })
      .catch(() => {
        return this.mapAccountToCustomer(account, '', '');
      });
  }

  // Cargar email del account usando entity_email_address
  private loadAccountEmail(accountId: string): Promise<string> {
    return new Promise((resolve) => {
      const getEmailRelation = {
        action: 'get',
        bd: this.hvtestDatabase,
        table: 'entity_email_address',
        opts: {
          where: {
            entity_id: accountId,
            entity_type: 'Account',
            deleted: 0,
          },
          limit: 1,
        },
      };

      this.apiService.post(getEmailRelation, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const relation = response.result?.[0];
          if (relation && relation.email_address_id) {
            const getEmail = {
              action: 'get',
              bd: this.hvtestDatabase,
              table: 'email_address',
              opts: {
                where: {
                  id: relation.email_address_id,
                  deleted: 0,
                },
              },
            };

            this.apiService.post(getEmail, UrlClass.URLNuevo).subscribe({
              next: (emailResponse: any) => {
                const emailData = emailResponse.result?.[0];
                resolve(emailData?.name || '');
              },
              error: () => resolve(''),
            });
          } else {
            resolve('');
          }
        },
        error: () => resolve(''),
      });
    });
  }

  // Cargar phone del account usando entity_phone_number
  private loadAccountPhone(accountId: string): Promise<string> {
    return new Promise((resolve) => {
      const getPhoneRelation = {
        action: 'get',
        bd: this.hvtestDatabase,
        table: 'entity_phone_number',
        opts: {
          where: {
            entity_id: accountId,
            entity_type: 'Account',
            deleted: 0,
          },
          limit: 1,
        },
      };

      this.apiService.post(getPhoneRelation, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const relation = response.result?.[0];
          if (relation && relation.phone_number_id) {
            const getPhone = {
              action: 'get',
              bd: this.hvtestDatabase,
              table: 'phone_number',
              opts: {
                where: {
                  id: relation.phone_number_id,
                  deleted: 0,
                },
              },
            };

            this.apiService.post(getPhone, UrlClass.URLNuevo).subscribe({
              next: (phoneResponse: any) => {
                const phoneData = phoneResponse.result?.[0];
                resolve(phoneData?.name || '');
              },
              error: () => resolve(''),
            });
          } else {
            resolve('');
          }
        },
        error: () => resolve(''),
      });
    });
  }

  // Mapear account a formato de customer
  private mapAccountToCustomer(
    account: any,
    email: string,
    phone: string
  ): any {
    console.log('=== MAP ACCOUNT TO CUSTOMER ===');
    console.log('Raw account data:', account);
    console.log('Email:', email);
    console.log('Phone:', phone);

    const mapped = {
      id: account.id,
      name: account.name || '',
      email: email,
      phone: phone,
      street: account.billing_address_street || '',
      city: account.billing_address_city || '',
      state: account.billing_address_state || '',
      country: account.billing_address_country || '',
      postal_code: account.billing_address_postalcode || '',
      fax: '',
      street_number: '',
    };

    console.log('Mapped customer:', mapped);
    return mapped;
  }

  // Guardar id_customer directamente en dcc_data
  saveCustomerRelation(
    certificateNumber: string,
    customerId: string
  ): Observable<boolean> {
    return new Observable((observer) => {
      if (!certificateNumber || !customerId) {
        observer.error(
          new Error('Certificate Number o Customer ID no definidos.')
        );
        return;
      }

      Swal.fire({
        title: 'Guardando Cliente...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // Actualizar directamente el campo id_customer en dcc_data
      const updateDccData = {
        action: 'update',
        bd: this.database,
        table: 'dcc_data',
        opts: {
          where: {
            id: certificateNumber,
          },
          attributes: {
            id_customer: customerId,
          },
        },
      };

      console.log('=== SAVE CUSTOMER TO DCC_DATA ===');
      console.log('certificateNumber:', certificateNumber);
      console.log('customerId:', customerId);
      console.log('Request payload:', JSON.stringify(updateDccData, null, 2));

      this.apiService.post(updateDccData, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          console.log('Update dcc_data response:', response);
          Swal.close();
          if (response.result) {
            Swal.fire({
              icon: 'success',
              title: 'Cliente Guardado',
              text: 'El cliente ha sido vinculado correctamente.',
              timer: 1500,
              showConfirmButton: false,
            });
            observer.next(true);
            observer.complete();
          } else {
            console.error(
              'Update failed - response.result is false:',
              response
            );
            observer.error(new Error('No se pudo guardar el cliente.'));
          }
        },
        error: (error) => {
          Swal.close();
          console.error('Error saving customer:', error);
          observer.error(error);
        },
      });
    });
  }

  // Cargar id_customer desde dcc_data
  loadSavedCustomer(certificateNumber: string): Observable<any> {
    return new Observable((observer) => {
      const getDccData = {
        action: 'get',
        bd: this.database,
        table: 'dcc_data',
        opts: {
          where: {
            id: certificateNumber,
          },
          attributes: ['id_customer'],
        },
      };

      this.apiService.post(getDccData, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const dccData = response.result?.[0];
          if (dccData && dccData.id_customer) {
            // Devolver un objeto con id_customer para mantener compatibilidad
            observer.next({ id_customer: dccData.id_customer });
          } else {
            observer.next(null);
          }
          observer.complete();
        },
        error: (error) => {
          console.error('Error loading saved customer:', error);
          observer.next(null);
          observer.complete();
        },
      });
    });
  }

  // Cargar un customer por ID desde hvtest2
  loadCustomerById(customerId: string): Observable<any> {
    return new Observable((observer) => {
      const getAccount = {
        action: 'get',
        bd: this.hvtestDatabase,
        table: 'account',
        opts: {
          where: {
            id: customerId,
            deleted: 0,
          },
        },
      };

      this.apiService.post(getAccount, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const account = response.result?.[0];
          if (account) {
            this.loadAccountDetails(account).then((customer) => {
              observer.next(customer);
              observer.complete();
            });
          } else {
            observer.next(null);
            observer.complete();
          }
        },
        error: (error) => {
          console.error('Error loading customer by ID:', error);
          observer.next(null);
          observer.complete();
        },
      });
    });
  }

  // Mapear datos de cliente seleccionado (para compatibilidad)
  mapSelectedCustomerData(selectedCustomer: any): any {
    return {
      name: selectedCustomer.name || '',
      email: selectedCustomer.email || '',
      phone: selectedCustomer.phone || '',
      fax: selectedCustomer.fax || '',
      postal_code: selectedCustomer.postal_code || '',
      city: selectedCustomer.city || '',
      street: selectedCustomer.street || '',
      street_number: selectedCustomer.street_number || '',
      state: selectedCustomer.state || '',
      country: selectedCustomer.country || '',
      customer_id: selectedCustomer.id || '',
    };
  }
}
