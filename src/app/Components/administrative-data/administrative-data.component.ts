import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NgMultiSelectDropDownModule,
  IDropdownSettings,
} from 'ng-multiselect-dropdown';
import { DccDataService } from '../../services/dcc-data.service';
import { LaboratoryService } from '../../services/laboratory.service';
import { CustomerService } from '../../services/customer.service';
import { ResponsiblePersonsService } from '../../services/responsible-persons.service';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-administrative-data',
  standalone: true,
  imports: [CommonModule, FormsModule, NgMultiSelectDropDownModule],
  templateUrl: './administrative-data.component.html',
  styleUrl: './administrative-data.component.css',
})
export class AdministrativeDataComponent implements OnInit {
  editingBlocks: { [key: string]: boolean } = {};

  // Configuración para qué bloques son editables (removido identifications)
  editableBlocks = {
    software: false,
    core: true,
    laboratory: true,
    responsible: true,
    customer: true,
  };

  // Propiedades de datos (removido identifications)
  softwareData: any = {};
  coreData: any = {};
  laboratoryData: any = {};
  responsiblePersons: any[] = [];
  customerData: any = {};

  // Datos de usuario para el dropdown
  listauser: any[] = [];
  selectedUsers: any[] = [];

  // Configuración del dropdown CORREGIDA
  dropdownuser: IDropdownSettings = {
    idField: 'no_nomina', // El ID interno sigue siendo no_nomina
    textField: 'name', // Pero muestra el 'name' (que es el CONCAT)
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar usuario',
    enableCheckAll: false,
    singleSelection: true,
    noDataAvailablePlaceholderText: 'Usuario no Disponible',
    noFilteredDataAvailablePlaceholderText: 'No Existe el Usuario',
  };

  // Nueva lista para laboratorios
  laboratoryList: any[] = [];
  selectedLaboratoryId: string = '';

  // Nuevas variables para manejar acciones del laboratorio
  laboratoryAction: 'edit' | 'select' | 'create' | null = null;
  tempLaboratoryId: string = '';

  // Nueva lista para clientes
  customerList: any[] = [];
  selectedCustomerId: string = '';

  // Nuevas variables para manejar acciones del cliente
  customerAction: 'edit' | 'select' | 'create' | null = null;
  tempCustomerId: string = '';

  // Configuración de base de datos
  isTesting: boolean = false;
  database: string = this.isTesting ? 'prueba' : 'calibraciones';

  constructor(
    private dccDataService: DccDataService,
    private laboratoryService: LaboratoryService,
    private customerService: CustomerService,
    private responsiblePersonsService: ResponsiblePersonsService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.dccDataService.dccData$.subscribe((data) => {
      this.softwareData = { ...data.administrativeData.software };
      this.coreData = { ...data.administrativeData.core };

      // Formatear fechas para inputs de tipo date
      if (this.coreData.receipt_date) {
        this.coreData.receipt_date = this.formatDateForInput(
          this.coreData.receipt_date
        );
      }
      if (this.coreData.performance_date) {
        this.coreData.performance_date = this.formatDateForInput(
          this.coreData.performance_date
        );
      }
      if (this.coreData.end_performance_date) {
        this.coreData.end_performance_date = this.formatDateForInput(
          this.coreData.end_performance_date
        );
      }
      if (this.coreData.issue_date) {
        this.coreData.issue_date = this.formatDateForInput(
          this.coreData.issue_date
        );
      }

      this.laboratoryData = { ...data.administrativeData.laboratory };

      console.log('🔍 Loaded laboratory data:', this.laboratoryData);

      // Usar directamente el laboratory_id si está disponible
      if (data.administrativeData.laboratory.laboratory_id) {
        this.selectedLaboratoryId =
          data.administrativeData.laboratory.laboratory_id;
        console.log(
          '🔍 Using laboratory_id from data:',
          this.selectedLaboratoryId
        );
      } else if (this.laboratoryData.name) {
        console.log(
          '🔍 Laboratory data found, but no ID. Searching in list...'
        );
        // Solo buscar en la lista si no tenemos el ID directo
        this.findLaboratoryId();
      }

      this.responsiblePersons = [...data.administrativeData.responsiblePersons];
      console.log(
        '🔍 Loaded responsible persons data:',
        this.responsiblePersons
      );
      this.customerData = { ...data.administrativeData.customer };

      console.log(
        '🔍 Loaded responsible persons data:',
        this.responsiblePersons
      );

      // Usar directamente el customer_id si está disponible
      if (data.administrativeData.customer.customer_id) {
        this.selectedCustomerId = data.administrativeData.customer.customer_id;
      } else if (
        this.customerData.name &&
        this.customerData.name.trim() !== '' &&
        this.customerData.name !== 'HV Test'
      ) {
        console.log(
          '🔍 Customer data found from XML, but no ID. Searching in list...'
        );
        // Solo buscar en la lista si no tenemos el ID directo y hay datos reales (no predeterminados)
        this.findCustomerId();
      } else {
        // Solo usar ID predeterminado si realmente no hay datos de customer o son los predeterminados
        this.selectedCustomerId = '1';
        console.log(
          '🔍 No customer data found or default data, using default ID: 1'
        );
      }
    });

    this.loadUsers();
    this.loadLaboratories();
    this.loadCustomers();
  }

  // Método simplificado para cargar usuarios
  loadUsers() {
    this.responsiblePersonsService.loadUsers().subscribe({
      next: (users) => {
        this.listauser = users;
        console.log('✅ Loaded users:', this.listauser);
        this.checkIfNeedToLoadResponsiblePersonsFromDB();
      },
      error: (error) => {
        console.error('Error loading users:', error);
      },
    });
  }

  // Método para alternar edición de bloques
  toggleEdit(blockName: string) {
    // Solo alternar si el bloque es editable
    if (this.editableBlocks[blockName as keyof typeof this.editableBlocks]) {
      this.editingBlocks[blockName] = !this.editingBlocks[blockName];

      // Si se está abriendo la edición del laboratorio, determinar acción inicial
      if (blockName === 'laboratory' && this.editingBlocks[blockName]) {
        this.initializeLaboratoryEdit();
      } else if (blockName === 'laboratory') {
        this.resetLaboratoryAction();
      }

      // Si se está abriendo la edición del cliente, determinar acción inicial
      if (blockName === 'customer' && this.editingBlocks[blockName]) {
        this.initializeCustomerEdit();
      } else if (blockName === 'customer') {
        this.resetCustomerAction();
      }
    }
  }

  // Método para cargar laboratorios
  loadLaboratories() {
    this.laboratoryService.loadLaboratories().subscribe({
      next: (labs) => {
        this.laboratoryList = labs;
        console.log('✅ Loaded laboratories:', this.laboratoryList);
        // Después de cargar laboratorios, intentar encontrar el ID si hay datos
        if (this.laboratoryData.name) {
          this.findLaboratoryId();
        }
      },
      error: (error) => {
        console.error('❌ Error loading laboratories:', error);
      },
    });
  }

  // Método simplificado para encontrar el ID del laboratorio
  private findLaboratoryId(): void {
    const foundId = this.laboratoryService.findLaboratoryByData(
      this.laboratoryData,
      this.laboratoryList
    );
    if (foundId) {
      this.selectedLaboratoryId = foundId;
      console.log('🔍 Found laboratory ID:', this.selectedLaboratoryId);
    } else {
      // Si la lista aún no está cargada, intentar después de un momento
      setTimeout(() => this.findLaboratoryId(), 500);
    }
  }

  // Nuevo método para encontrar el ID del cliente
  private findCustomerId(): void {
    if (this.customerList.length > 0 && this.customerData.name) {
      console.log('🔍 Customer list:', this.customerList);
      console.log('🔍 Customer data:', this.customerData);

      // Buscar por nombre y email, no por customer_id que puede no estar definido
      const existingCustomer = this.customerList.find(
        (customer) =>
          customer.name === this.customerData.name &&
          (customer.email === this.customerData.email ||
            (!customer.email && !this.customerData.email))
      );

      console.log('🔍 Existing customer found:', existingCustomer);
      if (existingCustomer) {
        this.selectedCustomerId = existingCustomer.id.toString();
        console.log('🔍 Found customer ID:', this.selectedCustomerId);
      } else {
        console.log(
          '🔍 Customer from XML not found in database, will need to create new one'
        );
        this.selectedCustomerId = ''; // No asignar ID predeterminado
      }
    } else {
      // Si la lista aún no está cargada, intentar después de un momento
      setTimeout(() => this.findCustomerId(), 500);
    }
  }

  // Nuevo método para cargar clientes
  loadCustomers() {
    this.customerService.loadCustomers().subscribe({
      next: (customers) => {
        this.customerList = customers;
        console.log('✅ Loaded customers:', this.customerList);
        // Después de cargar clientes, intentar encontrar el ID si hay datos
        if (this.customerData.name) {
          this.findCustomerId();
        }
      },
      error: (error) => {
        console.error('❌ Error loading customers:', error);
      },
    });
  }

  // Nuevo método para establecer la acción del laboratorio
  setLaboratoryAction(action: 'edit' | 'select' | 'create'): void {
    console.log('🔧 setLaboratoryAction called with:', action);
    console.log('🔧 selectedLaboratoryId:', this.selectedLaboratoryId);
    console.log('🔧 laboratoryData before action:', this.laboratoryData);

    this.laboratoryAction = action;
    this.tempLaboratoryId = '';

    if (action === 'create') {
      // Limpiar campos para crear nuevo
      this.laboratoryData = {
        name: '',
        email: '',
        phone: '',
        fax: '',
        postal_code: '',
        city: '',
        street: '',
        street_number: '',
        state: '',
        country: '',
      };
    } else if (action === 'edit' && this.selectedLaboratoryId) {
      console.log(
        '🔧 Edit mode activated for laboratory ID:',
        this.selectedLaboratoryId
      );
      // Mantener datos actuales para editar
      // Los datos ya están cargados en laboratoryData
    } else if (action === 'select') {
      // Para seleccionar otro, mantener los datos actuales hasta que se seleccione uno nuevo
      // No limpiar los datos inicialmente
    }

    console.log('🔧 laboratoryData after action:', this.laboratoryData);
    console.log('🔧 laboratoryAction set to:', this.laboratoryAction);
  }

  // Método simplificado para cargar laboratorio seleccionado
  loadSelectedLaboratory(): void {
    console.log('🔄 loadSelectedLaboratory called');
    console.log('🔄 tempLaboratoryId:', this.tempLaboratoryId);

    if (!this.tempLaboratoryId) {
      return;
    }

    const selectedLab = this.laboratoryList.find(
      (lab) => lab.id == this.tempLaboratoryId
    );

    console.log('🔄 selectedLab found:', selectedLab);

    if (selectedLab) {
      this.selectedLaboratoryId = this.tempLaboratoryId;

      // Usar el servicio para mapear los datos
      this.laboratoryData =
        this.laboratoryService.mapSelectedLaboratoryData(selectedLab);

      // Actualizar inmediatamente en el servicio DCC
      const updatedLaboratoryData = {
        ...this.laboratoryData,
        laboratory_id: this.selectedLaboratoryId,
      };
      this.dccDataService.updateAdministrativeData(
        'laboratory',
        updatedLaboratoryData
      );

      console.log(
        '🔄 laboratoryData updated with selected lab:',
        this.laboratoryData
      );
    }
  }

  // Nuevo método para resetear la acción del laboratorio
  private resetLaboratoryAction(): void {
    this.laboratoryAction = null;
    this.tempLaboratoryId = '';
  }

  // Método simplificado para crear nuevo laboratorio
  private createNewLaboratory(): void {
    console.log('🆕 createNewLaboratory() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    if (!certificateNumber) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    this.laboratoryService.createLaboratory(this.laboratoryData).subscribe({
      next: (labId) => {
        this.selectedLaboratoryId = labId;
        console.log(
          '✅ Laboratory created with ID:',
          this.selectedLaboratoryId
        );

        // Vincular al DCC y mostrar mensaje de éxito
        this.linkLaboratoryToDcc(certificateNumber, true);

        // Recargar la lista de laboratorios
        this.loadLaboratories();
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message,
        });
      },
    });
  }

  // Método simplificado para actualizar laboratorio
  private updateLaboratoryInDatabase(): void {
    console.log('🔄 updateLaboratoryInDatabase() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    // Si no tenemos selectedLaboratoryId, intentar obtenerlo de los datos
    if (
      !this.selectedLaboratoryId &&
      currentData.administrativeData.laboratory.laboratory_id
    ) {
      this.selectedLaboratoryId =
        currentData.administrativeData.laboratory.laboratory_id;
    }

    if (!certificateNumber) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    this.laboratoryService
      .updateLaboratory(this.selectedLaboratoryId, this.laboratoryData)
      .subscribe({
        next: (success) => {
          if (success) {
            console.log('✅ Laboratory updated successfully');
            // Vincular al DCC
            this.linkLaboratoryToDcc(certificateNumber, false);
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo actualizar el laboratorio.',
            });
          }
        },
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
          });
        },
      });
  }

  // Método simplificado para seleccionar laboratorio
  private selectLaboratory(): void {
    console.log('🔄 selectLaboratory() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    this.linkLaboratoryToDcc(certificateNumber, false);
  }

  // Método helper para vincular laboratorio al DCC
  private linkLaboratoryToDcc(certificateNumber: string, isNew: boolean): void {
    this.laboratoryService
      .linkLaboratoryToDcc(certificateNumber, this.selectedLaboratoryId)
      .subscribe({
        next: (success) => {
          if (success) {
            // Actualizar el laboratory_id en el servicio
            const finalLaboratoryData = {
              ...this.laboratoryData,
              laboratory_id: this.selectedLaboratoryId,
            };
            this.dccDataService.updateAdministrativeData(
              'laboratory',
              finalLaboratoryData
            );

            const successMessage = isNew
              ? 'Laboratorio creado y vinculado correctamente'
              : 'Laboratorio guardado correctamente';

            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: successMessage,
              timer: 2000,
              showConfirmButton: false,
              position: 'top-end',
            });

            this.editingBlocks['laboratory'] = false;
          }
        },
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
          });
        },
      });
  }

  // Método para inicializar la edición del cliente
  private initializeCustomerEdit(): void {
    // Verificar si hay datos del cliente cargado
    const hasCustomerData =
      this.customerData.name &&
      this.customerData.name.trim() !== '' &&
      this.customerData.name !== 'HV Test'; // No es el predeterminado

    if (hasCustomerData) {
      // Si hay datos reales del cliente, establecer como "editar" por defecto
      this.customerAction = 'edit';

      // Si no tenemos el selectedCustomerId, intentar encontrarlo
      if (!this.selectedCustomerId) {
        const existingCustomer = this.customerList.find(
          (customer) =>
            customer.name === this.customerData.name &&
            (customer.email === this.customerData.email ||
              (!customer.email && !this.customerData.email))
        );
        if (existingCustomer) {
          this.selectedCustomerId = existingCustomer.id;
        } else {
          // Si no existe en BD, permitir crear uno nuevo
          console.log('🔍 Customer from XML not in database, can create new');
        }
      }
    } else {
      // Si no hay datos reales del cliente, crear nuevo
      this.customerAction = 'create';
    }

    this.tempCustomerId = '';
  }

  // Nuevo método para resetear la acción del cliente
  private resetCustomerAction(): void {
    this.customerAction = null;
    this.tempCustomerId = '';
  }

  // Nuevo método para establecer la acción del cliente
  setCustomerAction(action: 'edit' | 'select' | 'create'): void {
    console.log('🔧 setCustomerAction called with:', action);
    console.log('🔧 selectedCustomerId:', this.selectedCustomerId);
    console.log('🔧 customerData before action:', this.customerData);

    this.customerAction = action;
    this.tempCustomerId = '';

    if (action === 'create') {
      // Limpiar campos para crear nuevo
      this.customerData = {
        name: '',
        email: '',
        phone: '',
        fax: '',
        postal_code: '',
        city: '',
        street: '',
        street_number: '',
        state: '',
        country: '',
      };
    } else if (action === 'edit' && this.selectedCustomerId) {
      console.log(
        '🔧 Edit mode activated for customer ID:',
        this.selectedCustomerId
      );
      // Mantener datos actuales para editar
    } else if (action === 'select') {
      // Para seleccionar otro, mantener los datos actuales hasta que se seleccione uno nuevo
    }

    console.log('🔧 customerData after action:', this.customerData);
    console.log('🔧 customerAction set to:', this.customerAction);
  }

  // Método simplificado para cargar cliente seleccionado
  loadSelectedCustomer(): void {
    console.log('🔄 loadSelectedCustomer called');
    console.log('🔄 tempCustomerId:', this.tempCustomerId);

    if (!this.tempCustomerId) {
      return;
    }

    const selectedCustomer = this.customerList.find(
      (customer) => customer.id == this.tempCustomerId
    );

    console.log('🔄 selectedCustomer found:', selectedCustomer);

    if (selectedCustomer) {
      this.selectedCustomerId = this.tempCustomerId;

      // Usar el servicio para mapear los datos
      this.customerData =
        this.customerService.mapSelectedCustomerData(selectedCustomer);

      // Actualizar inmediatamente en el servicio DCC
      const updatedCustomerData = {
        ...this.customerData,
        customer_id: this.selectedCustomerId,
      };
      this.dccDataService.updateAdministrativeData(
        'customer',
        updatedCustomerData
      );

      console.log(
        '🔄 customerData updated with selected customer:',
        this.customerData
      );
    }
  }

  // Nuevo método para crear nuevo cliente
  private createNewCustomer(): void {
    console.log('🆕 createNewCustomer() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    if (!certificateNumber) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    this.customerService.createCustomer(this.customerData).subscribe({
      next: (customerId) => {
        this.selectedCustomerId = customerId;
        console.log('✅ Customer created with ID:', this.selectedCustomerId);

        // Vincular al DCC y mostrar mensaje de éxito
        this.linkCustomerToDcc(certificateNumber, true);

        // Recargar la lista de clientes
        this.loadCustomers();
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message,
        });
      },
    });
  }

  // Método simplificado para actualizar cliente
  private updateCustomerInDatabase(): void {
    console.log('🔄 updateCustomerInDatabase() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    // Si no tenemos selectedCustomerId, intentar obtenerlo de los datos
    if (
      !this.selectedCustomerId &&
      currentData.administrativeData.customer.customer_id
    ) {
      this.selectedCustomerId =
        currentData.administrativeData.customer.customer_id;
    }

    if (!certificateNumber) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    this.customerService
      .updateCustomer(this.selectedCustomerId, this.customerData)
      .subscribe({
        next: (success) => {
          if (success) {
            console.log('✅ Customer updated successfully');
            // Vincular al DCC
            this.linkCustomerToDcc(certificateNumber, false);
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo actualizar el cliente.',
            });
          }
        },
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
          });
        },
      });
  }

  // Método simplificado para seleccionar cliente
  private selectCustomer(): void {
    console.log('🔄 selectCustomer() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    this.linkCustomerToDcc(certificateNumber, false);
  }

  // Método helper para vincular cliente al DCC
  private linkCustomerToDcc(certificateNumber: string, isNew: boolean): void {
    this.customerService
      .linkCustomerToDcc(certificateNumber, this.selectedCustomerId)
      .subscribe({
        next: (success) => {
          if (success) {
            // Actualizar el customer_id en el servicio
            const finalCustomerData = {
              ...this.customerData,
              customer_id: this.selectedCustomerId,
            };
            this.dccDataService.updateAdministrativeData(
              'customer',
              finalCustomerData
            );

            const successMessage = isNew
              ? 'Cliente creado y vinculado correctamente'
              : 'Cliente guardado correctamente';

            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: successMessage,
              timer: 2000,
              showConfirmButton: false,
              position: 'top-end',
            });

            this.editingBlocks['customer'] = false;
          }
        },
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
          });
        },
      });
  }

  // Método para obtener texto del botón guardar cliente
  getCustomerSaveButtonText(): string {
    switch (this.customerAction) {
      case 'edit':
        return 'Actualizar Cliente';
      case 'select':
        return 'Seleccionar Cliente';
      case 'create':
        return 'Crear Cliente';
      default:
        return 'Guardar';
    }
  }

  saveBlock(blockType: string): void {
    console.log('💾 saveBlock called with blockType:', blockType);

    let dataToSave: any = {};

    switch (blockType) {
      case 'software':
        this.dccDataService.updateAdministrativeData(
          'software',
          this.softwareData
        );
        dataToSave = {
          software_name: this.softwareData.name,
          software_version: this.softwareData.version,
          software_type: this.softwareData.type,
          software_description: this.softwareData.description,
        };
        break;

      case 'core':
        this.dccDataService.updateAdministrativeData('core', this.coreData);
        dataToSave = {
          pt: this.coreData.pt_id,
          country: this.coreData.country_code,
          language: this.coreData.language,
          receipt_date: this.coreData.receipt_date
            ? this.formatDateForDatabase(this.coreData.receipt_date)
            : null,
          date_calibration: this.coreData.performance_date
            ? this.formatDateForDatabase(this.coreData.performance_date)
            : null,
          date_range: this.coreData.is_range_date ? 1 : 0,
          date_end: this.coreData.end_performance_date
            ? this.formatDateForDatabase(this.coreData.end_performance_date)
            : null,
          location: this.coreData.performance_localition, // Cambiar a 'location' para coincidir con la BD
          issue_date: this.coreData.issue_date
            ? this.formatDateForDatabase(this.coreData.issue_date)
            : null,
        };
        break;

      case 'laboratory':
        console.log('💾 Laboratory save block entered');
        console.log('💾 laboratoryAction:', this.laboratoryAction);
        console.log('💾 selectedLaboratoryId:', this.selectedLaboratoryId);
        console.log('💾 laboratoryData:', this.laboratoryData);

        this.dccDataService.updateAdministrativeData(
          'laboratory',
          this.laboratoryData
        );

        // Manejar según la acción seleccionada
        if (this.laboratoryAction === 'edit') {
          console.log('💾 Calling updateLaboratoryInDatabase()');
          this.updateLaboratoryInDatabase();
        } else if (
          this.laboratoryAction === 'select' &&
          this.selectedLaboratoryId
        ) {
          console.log('💾 Calling selectLaboratory()');
          this.selectLaboratory();
        } else if (this.laboratoryAction === 'create') {
          console.log('💾 Calling createNewLaboratory()');
          this.createNewLaboratory();
        } else {
          console.log('💾 No valid action or missing data');
          Swal.fire({
            icon: 'warning',
            title: 'Acción requerida',
            text: 'Seleccione una acción válida para el laboratorio.',
          });
        }
        return;

      case 'responsible':
        console.log('💾 Responsible save block entered');
        console.log('💾 responsiblePersons:', this.responsiblePersons);

        this.dccDataService.updateAdministrativeData(
          'responsiblePersons',
          this.responsiblePersons
        );
        console.log(
          '💾 responsiblePersons after update:',
          this.responsiblePersons
        );

        // Llamar al método específico para guardar responsible persons
        this.saveResponsiblePersons();
        return;

      case 'customer':
        console.log('💾 Customer save block entered');
        console.log('💾 customerAction:', this.customerAction);
        console.log('💾 selectedCustomerId:', this.selectedCustomerId);
        console.log('💾 customerData:', this.customerData);

        this.dccDataService.updateAdministrativeData(
          'customer',
          this.customerData
        );

        // Manejar según la acción seleccionada
        if (this.customerAction === 'edit') {
          console.log('💾 Calling updateCustomerInDatabase()');
          this.updateCustomerInDatabase();
        } else if (
          this.customerAction === 'select' &&
          this.selectedCustomerId
        ) {
          console.log('💾 Calling selectCustomer()');
          this.selectCustomer();
        } else if (this.customerAction === 'create') {
          console.log('💾 Calling createNewCustomer()');
          this.createNewCustomer();
        } else {
          console.log('💾 No valid action or missing data');
          Swal.fire({
            icon: 'warning',
            title: 'Acción requerida',
            text: 'Seleccione una acción válida para el cliente.',
          });
        }
        return;
    }

    // Guardar en base de datos solo los datos específicos del bloque
    this.saveToDatabaseById(dataToSave, blockType);

    // Salir del modo edición
    this.editingBlocks[blockType] = false;
  }

  // Método para verificar si los campos deben estar deshabilitados
  areFieldsDisabled(): boolean {
    return this.laboratoryAction === 'select';
  }

  // Método para verificar si los campos del cliente deben estar deshabilitados
  areCustomerFieldsDisabled(): boolean {
    return this.customerAction === 'select';
  }

  // Método para inicializar la edición del laboratorio
  private initializeLaboratoryEdit(): void {
    // Verificar si hay datos del laboratorio cargado
    const hasLaboratoryData =
      this.laboratoryData.name && this.laboratoryData.name.trim() !== '';

    if (hasLaboratoryData) {
      // Si hay datos del laboratorio, establecer como "editar" por defecto
      this.laboratoryAction = 'edit';

      // Si no tenemos el selectedLaboratoryId, intentar encontrarlo
      if (!this.selectedLaboratoryId) {
        const existingLab = this.laboratoryList.find(
          (lab) =>
            lab.name === this.laboratoryData.name &&
            lab.email === this.laboratoryData.email
        );
        if (existingLab) {
          this.selectedLaboratoryId = existingLab.id;
        }
      }
    } else {
      // Si no hay datos del laboratorio, crear nuevo
      this.laboratoryAction = 'create';
    }

    this.tempLaboratoryId = '';
  }

  // Método para sincronizar la fecha de fin de rendimiento cuando cambia is_range_date
  onIsRangeDateChange() {
    if (this.coreData.is_range_date && this.coreData.performance_date) {
      // Si es un rango de fechas, establecer la fecha de fin igual a la de inicio
      this.coreData.end_performance_date = this.coreData.performance_date;
    } else {
      // Si no es un rango de fechas, poner null la fecha de fin
      this.coreData.end_performance_date = null;
    }
  }

  // Función para formatear fechas para inputs de tipo date
  private formatDateForInput(dateValue: any): string {
    if (!dateValue) return '';

    // Si ya es string en formato YYYY-MM-DD, devolverlo directamente
    if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }

    // Si es Date object o string de fecha, convertir cuidadosamente
    let date: Date;
    if (typeof dateValue === 'string') {
      // Agregar tiempo para evitar problemas de zona horaria
      date = new Date(dateValue + 'T12:00:00');
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return '';
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    // Formatear usando métodos locales
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // Nueva función para formatear fechas para la base de datos sin problemas de zona horaria
  private formatDateForDatabase(dateValue: any): string {
    if (!dateValue) return '';

    // Si es string en formato YYYY-MM-DD (desde input type="date"), devolverlo directamente
    if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }

    // Para cualquier otro formato, convertir cuidadosamente
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

    // Formatear usando métodos locales para evitar problemas de zona horaria
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private saveToDatabaseById(dataToSave: any, blockType: string): void {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    if (!certificateNumber) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: `Guardando ${this.getBlockDisplayName(blockType)}...`,
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
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

    console.log('updateRequest:', updateRequest);
    console.log(`Guardando ${blockType}:`, dataToSave);

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
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudo guardar ${this.getBlockDisplayName(blockType)}.`,
          });
        }
      },
      error: (error) => {
        Swal.close();
        console.error(`Error al guardar ${blockType}:`, error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Ocurrió un error al guardar ${this.getBlockDisplayName(
            blockType
          )}.`,
        });
      },
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

  // Métodos para responsible persons
  private saveResponsiblePersons(): void {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    if (!certificateNumber) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    this.responsiblePersonsService
      .saveResponsiblePersons(
        certificateNumber,
        this.responsiblePersons,
        this.listauser
      )
      .subscribe({
        next: (success) => {
          if (success) {
            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: 'Personas Responsables guardadas correctamente',
              timer: 2000,
              showConfirmButton: false,
              position: 'top-end',
            });
          } else {
            Swal.fire({
              icon: 'warning',
              title: 'Sin datos válidos',
              text: 'No hay personas responsables válidas para guardar.',
            });
          }
          this.editingBlocks['responsible'] = false;
        },
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al guardar las personas responsables.',
          });
        },
      });
  }

  // Método para verificar si necesitamos cargar responsible persons desde BD
  private checkIfNeedToLoadResponsiblePersonsFromDB() {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('🔍 Checking if need to load responsible persons from DB');
    console.log('🔍 Certificate number:', certificateNumber);
    console.log('🔍 Current responsible persons:', this.responsiblePersons);

    // Si hay un certificate number y los responsible persons están vacíos o son los predeterminados
    if (
      certificateNumber &&
      (this.responsiblePersons.length === 0 ||
        (this.responsiblePersons.length === 2 &&
          !this.responsiblePersons[0].role &&
          (!this.responsiblePersons[0].no_nomina ||
            !this.responsiblePersons[0].name)))
    ) {
      console.log(
        '📋 Loading responsible persons from database for existing DCC'
      );
      this.loadResponsiblePersonsFromDB(certificateNumber);
    }
  }

  // Método para cargar responsible persons desde la base de datos por DCC ID
  loadResponsiblePersonsFromDB(dccId: string) {
    console.log('📋 Loading responsible persons for DCC:', dccId);

    this.responsiblePersonsService
      .loadResponsiblePersonsFromDB(dccId)
      .subscribe({
        next: (responsibleData) => {
          console.log(
            '✅ Loaded responsible persons from DB:',
            responsibleData
          );

          // Mapear los datos de la BD con la información de usuarios
          const mappedResponsiblePersons =
            this.responsiblePersonsService.mapResponsiblePersonsWithUsers(
              responsibleData,
              this.listauser
            );

          console.log(
            '✅ Mapped responsible persons:',
            mappedResponsiblePersons
          );

          // Actualizar los datos en el servicio DCC y localmente
          this.responsiblePersons = mappedResponsiblePersons;
          this.dccDataService.updateAdministrativeData(
            'responsiblePersons',
            mappedResponsiblePersons
          );
        },
        error: (error) => {
          console.error('❌ Error loading responsible persons:', error);
        },
      });
  }

  // Método modificado para manejar la selección de usuario
  onUserSelect(selectedItem: any, personIndex: number) {
    console.log(
      '👤 User selected:',
      selectedItem,
      'for person index:',
      personIndex
    );

    if (selectedItem) {
      // Almacenar tanto no_nomina como full_name en el objeto person
      this.responsiblePersons[personIndex].no_nomina = selectedItem.no_nomina;
      this.responsiblePersons[personIndex].full_name = selectedItem.name; // 'name' es el campo CONCAT

      // Opcional: llenar automáticamente email y teléfono si están disponibles
      if (selectedItem.email) {
        this.responsiblePersons[personIndex].email = selectedItem.email;
      }
      if (selectedItem.phone) {
        this.responsiblePersons[personIndex].phone = selectedItem.phone;
      }

      console.log(
        '✅ Updated person data:',
        this.responsiblePersons[personIndex]
      );
    }
  }

  // Método para manejar cuando se deselecciona un usuario
  onUserDeselect(deselectedItem: any, personIndex: number) {
    console.log(
      '👤 User deselected:',
      deselectedItem,
      'for person index:',
      personIndex
    );

    // Limpiar los datos del usuario
    this.responsiblePersons[personIndex].no_nomina = '';
    this.responsiblePersons[personIndex].full_name = '';

    // Opcional: limpiar email y teléfono también si fueron llenados automáticamente
    // this.responsiblePersons[personIndex].email = '';
    // this.responsiblePersons[personIndex].phone = '';
  }

  // Método para obtener el nombre de pantalla para una persona responsable
  getResponsiblePersonDisplayName(person: any): string {
    console.log('🔍 Getting display name for person:', person);

    // Si tiene full_name directamente (desde la BD), usarlo
    if (person.full_name) {
      return person.full_name;
    }

    // Si tiene no_nomina, buscar en la lista de usuarios
    if (person.no_nomina && this.listauser.length > 0) {
      const foundUser = this.listauser.find(
        (user) => user.no_nomina === person.no_nomina
      );
      if (foundUser) {
        return foundUser.name; // Usar 'name' que es el CONCAT del servicio
      }
    }

    // Fallback para compatibilidad con formato anterior
    if (typeof person.name === 'string' && person.name) {
      return person.name;
    }

    return 'No asignado';
  }

  // Métodos de control de estado
  isEditing(blockName: string): boolean {
    return this.editingBlocks[blockName] || false;
  }

  isBlockEditable(blockName: string): boolean {
    return this.editableBlocks[blockName as keyof typeof this.editableBlocks];
  }

  // Método para obtener texto del botón guardar laboratorio
  getLaboratorySaveButtonText(): string {
    switch (this.laboratoryAction) {
      case 'edit':
        return 'Actualizar Laboratorio';
      case 'select':
        return 'Seleccionar Laboratorio';
      case 'create':
        return 'Crear Laboratorio';
      default:
        return 'Guardar';
    }
  }

  // Método para verificar si hay laboratorio cargado
  hasLoadedLaboratory(): boolean {
    const hasLab =
      this.laboratoryData.name && this.laboratoryData.name.trim() !== '';
    return hasLab;
  }

  // Método para verificar si hay cliente cargado
  hasLoadedCustomer(): boolean {
    const hasCustomer =
      this.customerData.name && this.customerData.name.trim() !== '';
    return hasCustomer;
  }

  // Método para manejar cambios de fecha y actualizar is_range_date
  onDateChange() {
    this.updateIsRangeDate();
  }

  private updateIsRangeDate() {
    if (this.coreData.performance_date && this.coreData.end_performance_date) {
      const performanceDate = new Date(this.coreData.performance_date);
      const endPerformanceDate = new Date(this.coreData.end_performance_date);

      // Comparar fechas (ignorar componente de tiempo)
      const isSameDate =
        performanceDate.toDateString() === endPerformanceDate.toDateString();

      if (isSameDate) {
        this.coreData.is_range_date = false;
      } else {
        this.coreData.is_range_date = true;
      }
    }
  }

  // Nuevo método para validar la fecha de fin
  onEndDateChange() {
    if (
      this.coreData.is_range_date &&
      this.coreData.performance_date &&
      this.coreData.end_performance_date
    ) {
      const performanceDate = new Date(this.coreData.performance_date);
      const endDate = new Date(this.coreData.end_performance_date);

      // Si la fecha de fin es menor que la de inicio, resetearla a la de inicio
      if (endDate < performanceDate) {
        this.coreData.end_performance_date = this.coreData.performance_date;
      }
    }
  }

  // Método para obtener la fecha mínima permitida para end_performance_date
  getMinEndDate(): string {
    if (this.coreData.is_range_date && this.coreData.performance_date) {
      return this.coreData.performance_date;
    }
    return '';
  }

  // Método para cancelar la edición y revertir cambios
  cancelEdit(blockName: string) {
    this.editingBlocks[blockName] = false;

    // Resetear acción del laboratorio si es necesario
    if (blockName === 'laboratory') {
      this.resetLaboratoryAction();
    }

    // Resetear acción del cliente si es necesario
    if (blockName === 'customer') {
      this.resetCustomerAction();
    }

    // Recargar datos del servicio para revertir cambios
    const currentData = this.dccDataService.getCurrentData();
    switch (blockName) {
      case 'software':
        this.softwareData = { ...currentData.administrativeData.software };
        break;
      case 'core':
        this.coreData = { ...currentData.administrativeData.core };
        // Formatear fechas nuevamente al cancelar edición
        if (this.coreData.receipt_date) {
          this.coreData.receipt_date = this.formatDateForInput(
            this.coreData.receipt_date
          );
        }
        if (this.coreData.performance_date) {
          this.coreData.performance_date = this.formatDateForInput(
            this.coreData.performance_date
          );
        }
        if (this.coreData.end_performance_date) {
          this.coreData.end_performance_date = this.formatDateForInput(
            this.coreData.end_performance_date
          );
        }
        if (this.coreData.issue_date) {
          this.coreData.issue_date = this.formatDateForInput(
            this.coreData.issue_date
          );
        }
        break;
      case 'laboratory':
        this.laboratoryData = { ...currentData.administrativeData.laboratory };
        break;
      case 'responsible':
        this.responsiblePersons = [
          ...currentData.administrativeData.responsiblePersons,
        ];
        break;
      case 'customer':
        this.customerData = { ...currentData.administrativeData.customer };
        break;
    }
  }
}
