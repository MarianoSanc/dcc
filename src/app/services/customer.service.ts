import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { UrlClass } from '../shared/models/url.model';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private database: string;

  constructor(private apiService: ApiService) {
    const isTesting = false;
    this.database = isTesting ? 'prueba' : 'calibraciones';
  }

  // Cargar lista de clientes
  loadCustomers(): Observable<any[]> {
    return new Observable((observer) => {
      const getCustomers = {
        action: 'get',
        bd: this.database,
        table: 'dcc_customer',
        opts: {
          where: { deleted: 0 },
          order_by: ['name', 'ASC'],
        },
      };

      this.apiService.post(getCustomers, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          observer.next(response.result || []);
          observer.complete();
        },
        error: (error) => {
          console.error('❌ Error loading customers:', error);
          observer.error(error);
        },
      });
    });
  }

  // Encontrar cliente por nombre y email
  findCustomerByData(customerData: any, customerList: any[]): string | null {
    if (customerList.length > 0 && customerData.name) {
      console.log('🔍 Customer list:', customerList);
      console.log('🔍 Customer data:', customerData);

      // Buscar por nombre y email, no por customer_id que puede no estar definido
      const existingCustomer = customerList.find(
        (customer) =>
          customer.name === customerData.name &&
          (customer.email === customerData.email ||
            (!customer.email && !customerData.email))
      );

      console.log('🔍 Existing customer found:', existingCustomer);
      if (existingCustomer) {
        console.log('🔍 Found customer ID:', existingCustomer.id.toString());
        return existingCustomer.id.toString();
      } else {
        console.log(
          '🔍 Customer from XML not found in database, will need to create new one'
        );
        return null;
      }
    }
    return null;
  }

  // Crear nuevo cliente
  createCustomer(customerData: any): Observable<string> {
    return new Observable((observer) => {
      // Validar campos requeridos
      if (!customerData.name || !customerData.name.trim()) {
        observer.error(new Error('El nombre del cliente es obligatorio.'));
        return;
      }

      Swal.fire({
        title: 'Creando Cliente...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const createCustomerRequest = {
        action: 'create',
        bd: this.database,
        table: 'dcc_customer',
        opts: {
          attributes: {
            name: customerData.name,
            email: customerData.email || '',
            phone: customerData.phone || '',
            fax: customerData.fax || '',
            postal_code: customerData.postal_code || '',
            city: customerData.city || '',
            street: customerData.street || '',
            number: customerData.street_number || '',
            state: customerData.state || '',
            country: customerData.country || '',
            deleted: 0,
          },
        },
      };

      console.log('🆕 createCustomerRequest:', createCustomerRequest);

      this.apiService.post(createCustomerRequest, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          console.log('✅ Create customer response:', response);
          if (response.result) {
            // Buscar el ID del cliente recién creado
            this.findCreatedCustomerId(customerData).subscribe({
              next: (customerId) => {
                Swal.close();
                observer.next(customerId);
                observer.complete();
              },
              error: (error) => {
                Swal.close();
                observer.error(error);
              },
            });
          } else {
            Swal.close();
            observer.error(new Error('No se pudo crear el cliente.'));
          }
        },
        error: (error) => {
          console.log('❌ Error creating customer:', error);
          Swal.close();
          observer.error(new Error('Ocurrió un error al crear el cliente.'));
        },
      });
    });
  }

  // Buscar ID del cliente recién creado
  private findCreatedCustomerId(customerData: any): Observable<string> {
    return new Observable((observer) => {
      const findCustomerRequest = {
        action: 'get',
        bd: this.database,
        table: 'dcc_customer',
        opts: {
          where: {
            name: customerData.name,
            email: customerData.email || '',
            deleted: 0,
          },
          order_by: ['id', 'DESC'],
          limit: 1,
        },
      };

      console.log('🔍 findCustomerRequest:', findCustomerRequest);

      this.apiService.post(findCustomerRequest, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          console.log('✅ Find customer response:', response);
          if (response.result && response.result.length > 0) {
            const createdCustomer = response.result[0];
            observer.next(createdCustomer.id.toString());
            observer.complete();
          } else {
            observer.error(
              new Error('No se pudo encontrar el cliente creado.')
            );
          }
        },
        error: (error) => {
          console.log('❌ Error finding created customer:', error);
          observer.error(
            new Error('Ocurrió un error al buscar el cliente creado.')
          );
        },
      });
    });
  }

  // Actualizar cliente existente
  updateCustomer(customerId: string, customerData: any): Observable<boolean> {
    return new Observable((observer) => {
      if (!customerId) {
        observer.error(
          new Error('No se puede actualizar: no se encontró el ID del cliente.')
        );
        return;
      }

      Swal.fire({
        title: 'Guardando Cliente...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const updateCustomerRequest = {
        action: 'update',
        bd: this.database,
        table: 'dcc_customer',
        opts: {
          where: { id: customerId },
          attributes: {
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            fax: customerData.fax,
            postal_code: customerData.postal_code,
            city: customerData.city,
            street: customerData.street,
            number: customerData.street_number,
            state: customerData.state,
            country: customerData.country,
          },
        },
      };

      console.log('🔄 updateCustomerRequest:', updateCustomerRequest);

      this.apiService.post(updateCustomerRequest, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          console.log('✅ Update customer response:', response);
          Swal.close();
          observer.next(response.result);
          observer.complete();
        },
        error: (error) => {
          console.log('❌ Error updating customer:', error);
          Swal.close();
          observer.error(
            new Error('Ocurrió un error al actualizar el cliente.')
          );
        },
      });
    });
  }

  // Vincular cliente al DCC
  linkCustomerToDcc(
    certificateNumber: string,
    customerId: string
  ): Observable<boolean> {
    return new Observable((observer) => {
      if (!certificateNumber) {
        observer.error(new Error('Certificate Number no está definido.'));
        return;
      }

      if (!customerId) {
        observer.error(new Error('No se ha seleccionado un cliente.'));
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
          attributes: { id_customer: customerId },
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
          observer.error(new Error('Ocurrió un error al vincular el cliente.'));
        },
      });
    });
  }

  // Mapear datos de cliente seleccionado
  mapSelectedCustomerData(selectedCustomer: any): any {
    return {
      name: selectedCustomer.name || '',
      email: selectedCustomer.email || '',
      phone: selectedCustomer.phone || '',
      fax: selectedCustomer.fax || '',
      postal_code: selectedCustomer.postal_code || '',
      city: selectedCustomer.city || '',
      street: selectedCustomer.street || '',
      street_number: selectedCustomer.number || '', // Mapear desde 'number' de la BD
      state: selectedCustomer.state || '',
      country: selectedCustomer.country || '',
    };
  }
}
