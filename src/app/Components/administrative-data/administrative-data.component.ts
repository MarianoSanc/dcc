import { Component, OnInit } from '@angular/core';
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
import { AdministrativeDataService } from '../../services/administrative-data.service';
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

  editableBlocks = {
    software: false,
    core: true,
    laboratory: true,
    responsible: true,
    customer: true,
  };

  // Propiedades de datos
  softwareData: any = {};
  coreData: any = {};
  laboratoryData: any = {};
  responsiblePersons: any[] = [];
  customerData: any = {};

  // Datos de usuario para el dropdown
  listauser: any[] = [];
  selectedUsers: any[] = []; // Agregar esta línea

  dropdownuser: IDropdownSettings = {
    idField: 'no_nomina',
    textField: 'name',
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar usuario',
    enableCheckAll: false,
    singleSelection: true,
    noDataAvailablePlaceholderText: 'Usuario no Disponible',
    noFilteredDataAvailablePlaceholderText: 'No Existe el Usuario',
  };

  // Listas y variables de estado
  laboratoryList: any[] = [];
  selectedLaboratoryId: string = '';
  laboratoryAction: 'edit' | 'select' | 'create' | null = null;
  tempLaboratoryId: string = '';

  customerList: any[] = [];
  selectedCustomerId: string = '';
  customerAction: 'edit' | 'select' | 'create' | null = null;
  tempCustomerId: string = '';
  loadingCustomers: boolean = false;
  selectedCustomerDropdown: any[] = [];

  // Dropdown settings para customer
  dropdownCustomer: IDropdownSettings = {
    idField: 'id',
    textField: 'name',
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar cliente',
    enableCheckAll: false,
    singleSelection: true,
    noDataAvailablePlaceholderText: 'Cliente no Disponible',
    noFilteredDataAvailablePlaceholderText: 'No Existe el Cliente',
  };

  constructor(
    private dccDataService: DccDataService,
    private laboratoryService: LaboratoryService,
    private customerService: CustomerService,
    private responsiblePersonsService: ResponsiblePersonsService,
    private administrativeDataService: AdministrativeDataService
  ) {}

  ngOnInit() {
    this.dccDataService.dccData$.subscribe((data) => {
      this.softwareData = { ...data.administrativeData.software };
      this.coreData = this.administrativeDataService.formatCoreDates(
        data.administrativeData.core
      );
      this.laboratoryData = { ...data.administrativeData.laboratory };
      this.responsiblePersons = [...data.administrativeData.responsiblePersons];
      this.selectedUsers = [];
      this.customerData = { ...data.administrativeData.customer };
      this.initializeSelectedUsers();
      this.initializeIds(data);
    });

    this.loadInitialData();
  }

  // Nuevo método para inicializar selectedUsers
  private initializeSelectedUsers() {
    this.selectedUsers = [];

    for (let i = 0; i < this.responsiblePersons.length; i++) {
      const person = this.responsiblePersons[i];

      if (person.no_nomina && this.listauser.length > 0) {
        const foundUser = this.listauser.find(
          (user) => user.no_nomina === person.no_nomina
        );
        if (foundUser) {
          this.selectedUsers[i] = [foundUser];
        } else {
          this.selectedUsers[i] = [];
        }
      } else {
        this.selectedUsers[i] = [];
      }
    }
  }

  private initializeIds(data: any) {
    // Laboratory ID
    if (data.administrativeData.laboratory.laboratory_id) {
      this.selectedLaboratoryId =
        data.administrativeData.laboratory.laboratory_id;
    } else if (this.laboratoryData.name) {
      this.findLaboratoryId();
    }

    // Customer ID
    if (data.administrativeData.customer.customer_id) {
      this.selectedCustomerId = data.administrativeData.customer.customer_id;
    } else if (
      this.customerData.name &&
      this.customerData.name.trim() !== '' &&
      this.customerData.name !== 'HV Test'
    ) {
      this.findCustomerId();
    } else {
      this.selectedCustomerId = '1';
    }
  }

  private loadInitialData() {
    this.loadUsers();
    this.loadLaboratories();
    this.loadCustomers();
  }

  // Método simplificado para cargar usuarios
  loadUsers() {
    this.responsiblePersonsService.loadUsers().subscribe({
      next: (users) => {
        this.listauser = users;
        this.initializeSelectedUsers();
        this.checkIfNeedToLoadResponsiblePersonsFromDB();
      },
      error: (error) => {
        console.error('Error loading users:', error);
      },
    });
  }

  // Método para alternar edición de bloques
  toggleEdit(blockName: string) {
    if (this.editableBlocks[blockName as keyof typeof this.editableBlocks]) {
      this.editingBlocks[blockName] = !this.editingBlocks[blockName];

      if (blockName === 'responsible' && this.editingBlocks[blockName]) {
        this.initializeSelectedUsers();
      }

      if (blockName === 'laboratory' && this.editingBlocks[blockName]) {
        this.initializeLaboratoryEdit();
      } else if (blockName === 'laboratory') {
        this.resetLaboratoryAction();
      }

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
        if (this.laboratoryData.name) {
          this.findLaboratoryId();
        }
      },
      error: (error) => {
        console.error('Error loading laboratories:', error);
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
    } else {
      setTimeout(() => this.findLaboratoryId(), 500);
    }
  }

  // Nuevo método para encontrar el ID del cliente
  private findCustomerId(): void {
    if (this.customerList.length > 0 && this.customerData.name) {
      const existingCustomer = this.customerList.find(
        (customer) =>
          customer.name === this.customerData.name &&
          (customer.email === this.customerData.email ||
            (!customer.email && !this.customerData.email))
      );

      if (existingCustomer) {
        this.selectedCustomerId = existingCustomer.id.toString();
      } else {
        this.selectedCustomerId = '';
      }
    } else {
      setTimeout(() => this.findCustomerId(), 500);
    }
  }

  // Nuevo método para cargar clientes (solo lista básica, rápido)
  loadCustomers() {
    console.log('=== LOADING CUSTOMERS (basic list) ===');
    this.customerService.loadCustomers().subscribe({
      next: (customers) => {
        console.log('Customers loaded:', customers.length, 'items');
        this.customerList = customers;
        // Cargar el customer guardado para este DCC
        this.loadSavedCustomerForDcc();
      },
      error: (error) => {
        console.error('Error loading customers:', error);
      },
    });
  }

  // Cargar el customer guardado para el DCC actual
  private loadSavedCustomerForDcc() {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    if (certificateNumber) {
      this.customerService.loadSavedCustomer(certificateNumber).subscribe({
        next: (relationData) => {
          if (relationData && relationData.id_customer) {
            this.selectedCustomerId = relationData.id_customer;

            // Set the dropdown selection con datos básicos
            const foundCustomer = this.customerList.find(
              (c) => c.id === relationData.id_customer
            );
            if (foundCustomer) {
              this.selectedCustomerDropdown = [foundCustomer];

              // Cargar detalles completos del cliente
              this.loadingCustomers = true;
              this.customerService
                .loadCustomerDetails(relationData.id_customer)
                .subscribe({
                  next: (fullCustomer) => {
                    this.customerData =
                      this.customerService.mapSelectedCustomerData(
                        fullCustomer
                      );
                    this.dccDataService.updateAdministrativeData(
                      'customer',
                      this.customerData
                    );
                    this.loadingCustomers = false;
                  },
                  error: () => {
                    this.customerData =
                      this.customerService.mapSelectedCustomerData(
                        foundCustomer
                      );
                    this.loadingCustomers = false;
                  },
                });
            }
          }
        },
        error: (error) => {
          console.error('Error loading saved customer:', error);
        },
      });
    }
  }

  // Método para manejar la selección de cliente
  onCustomerSelect() {
    if (!this.selectedCustomerId) {
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
      return;
    }

    const selectedCustomer = this.customerList.find(
      (customer) => customer.id === this.selectedCustomerId
    );

    if (selectedCustomer) {
      this.customerData =
        this.customerService.mapSelectedCustomerData(selectedCustomer);
    }
  }

  // Método para manejar selección desde ng-multiselect-dropdown
  onCustomerDropdownSelect(item: any) {
    console.log('=== CUSTOMER DROPDOWN SELECT ===');
    console.log('Item received:', item);

    if (item) {
      this.selectedCustomerId = item.id;
      this.selectedCustomerDropdown = [item];

      // Mostrar loading mientras carga los detalles
      this.loadingCustomers = true;

      // Cargar detalles completos del cliente seleccionado (email, phone, etc.)
      this.customerService.loadCustomerDetails(item.id).subscribe({
        next: (fullCustomer) => {
          console.log('Full customer details loaded:', fullCustomer);
          this.customerData =
            this.customerService.mapSelectedCustomerData(fullCustomer);
          this.loadingCustomers = false;

          // Actualizar el customer en la lista local también
          const index = this.customerList.findIndex((c) => c.id === item.id);
          if (index !== -1) {
            this.customerList[index] = fullCustomer;
          }
        },
        error: (error) => {
          console.error('Error loading customer details:', error);
          this.loadingCustomers = false;
          // Usar datos básicos si falla
          const basicCustomer = this.customerList.find((c) => c.id === item.id);
          if (basicCustomer) {
            this.customerData =
              this.customerService.mapSelectedCustomerData(basicCustomer);
          }
        },
      });
    }
  }

  // Método para manejar deselección desde ng-multiselect-dropdown
  onCustomerDropdownDeselect(item: any) {
    this.selectedCustomerId = '';
    this.selectedCustomerDropdown = [];
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
  }

  // Método para guardar el customer seleccionado
  saveCustomer() {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    if (!certificateNumber) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay un DCC cargado para guardar el cliente.',
      });
      return;
    }

    if (!this.selectedCustomerId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor seleccione un cliente.',
      });
      return;
    }

    this.customerService
      .saveCustomerRelation(certificateNumber, this.selectedCustomerId)
      .subscribe({
        next: (success) => {
          if (success) {
            // Actualizar el servicio de datos con el customer seleccionado
            this.dccDataService.updateAdministrativeData('customer', {
              ...this.customerData,
              customer_id: this.selectedCustomerId,
            });
            this.editingBlocks['customer'] = false;
          }
        },
        error: (error) => {
          console.error('Error saving customer:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al guardar el cliente.',
          });
        },
      });
  }

  // Nuevo método para establecer la acción del laboratorio
  setLaboratoryAction(action: 'edit' | 'select' | 'create'): void {
    this.laboratoryAction = action;
    this.tempLaboratoryId = '';

    if (action === 'create') {
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
      // Mantener datos actuales para editar
      // Los datos ya están cargados en laboratoryData
    } else if (action === 'select') {
      // Para seleccionar otro, mantener los datos actuales hasta que se seleccione uno nuevo
      // No limpiar los datos inicialmente
    }
  }

  // Método simplificado para cargar laboratorio seleccionado
  loadSelectedLaboratory(): void {
    if (!this.tempLaboratoryId) {
      return;
    }

    const selectedLab = this.laboratoryList.find(
      (lab) => lab.id == this.tempLaboratoryId
    );

    if (selectedLab) {
      this.selectedLaboratoryId = this.tempLaboratoryId;
      this.laboratoryData =
        this.laboratoryService.mapSelectedLaboratoryData(selectedLab);

      const updatedLaboratoryData = {
        ...this.laboratoryData,
        laboratory_id: this.selectedLaboratoryId,
      };
      this.dccDataService.updateAdministrativeData(
        'laboratory',
        updatedLaboratoryData
      );
    }
  }

  // Nuevo método para resetear la acción del laboratorio
  private resetLaboratoryAction(): void {
    this.laboratoryAction = null;
    this.tempLaboratoryId = '';
  }

  // Método simplificado para crear nuevo laboratorio
  private createNewLaboratory(certificateNumber: string): void {
    this.laboratoryService.createLaboratory(this.laboratoryData).subscribe({
      next: (labId) => {
        this.selectedLaboratoryId = labId;
        this.linkLaboratoryToDcc(certificateNumber, true);
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
  private updateLaboratoryInDatabase(certificateNumber: string): void {
    if (!this.selectedLaboratoryId) {
      this.selectedLaboratoryId =
        this.dccDataService.getCurrentData().administrativeData.laboratory.laboratory_id;
    }

    this.laboratoryService
      .updateLaboratory(this.selectedLaboratoryId, this.laboratoryData)
      .subscribe({
        next: (success) => {
          if (success) {
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
  private selectLaboratory(certificateNumber: string): void {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumbera =
      currentData.administrativeData.core.certificate_number;

    this.linkLaboratoryToDcc(certificateNumbera, false);
  }

  // Método helper para vincular laboratorio al DCC
  private linkLaboratoryToDcc(certificateNumber: string, isNew: boolean): void {
    this.laboratoryService
      .linkLaboratoryToDcc(certificateNumber, this.selectedLaboratoryId)
      .subscribe({
        next: (success) => {
          if (success) {
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
        error: (error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
          });
        },
      });
  }

  // Métodos de cancelación simplificados
  cancelEdit(blockName: string) {
    this.editingBlocks[blockName] = false;

    if (blockName === 'laboratory') {
      this.resetLaboratoryAction();
    }
    if (blockName === 'customer') {
      this.resetCustomerAction();
    }

    // Revertir cambios
    const currentData = this.dccDataService.getCurrentData();
    switch (blockName) {
      case 'software':
        this.softwareData = { ...currentData.administrativeData.software };
        break;
      case 'core':
        this.coreData = this.administrativeDataService.formatCoreDates(
          currentData.administrativeData.core
        );
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

  // Date handling methods
  onIsRangeDateChange() {
    if (this.coreData.is_range_date && this.coreData.performance_date) {
      this.coreData.end_performance_date = this.coreData.performance_date;
    } else {
      this.coreData.end_performance_date = null;
    }
  }

  onDateChange() {
    this.updateIsRangeDate();
  }

  onEndDateChange() {
    if (
      this.coreData.is_range_date &&
      this.coreData.performance_date &&
      this.coreData.end_performance_date
    ) {
      const performanceDate = new Date(this.coreData.performance_date);
      const endDate = new Date(this.coreData.end_performance_date);

      if (endDate < performanceDate) {
        this.coreData.end_performance_date = this.coreData.performance_date;
      }
    }
  }

  getMinEndDate(): string {
    if (this.coreData.is_range_date && this.coreData.performance_date) {
      return this.coreData.performance_date;
    }
    return '';
  }

  private updateIsRangeDate() {
    if (this.coreData.performance_date && this.coreData.end_performance_date) {
      const performanceDate = new Date(this.coreData.performance_date);
      const endPerformanceDate = new Date(this.coreData.end_performance_date);
      const isSameDate =
        performanceDate.toDateString() === endPerformanceDate.toDateString();
      this.coreData.is_range_date = !isSameDate;
    }
  }

  // Métodos simplificados de guardado
  saveBlock(blockType: string): void {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    switch (blockType) {
      case 'software':
        this.saveSoftwareBlock(certificateNumber);
        break;
      case 'core':
        this.saveCoreBlock(certificateNumber);
        break;
      case 'laboratory':
        this.saveLaboratoryBlock();
        break;
      case 'responsible':
        this.saveResponsibleBlock();
        break;
      case 'customer':
        this.saveCustomer();
        break;
    }
  }

  private saveSoftwareBlock(certificateNumber: string) {
    this.dccDataService.updateAdministrativeData('software', this.softwareData);
    const dataToSave =
      this.administrativeDataService.prepareSoftwareDataForSave(
        this.softwareData
      );

    this.administrativeDataService
      .saveToDatabase(dataToSave, 'software', certificateNumber)
      .subscribe({
        next: (success) => {
          if (success) this.editingBlocks['software'] = false;
        },
      });
  }

  private saveCoreBlock(certificateNumber: string) {
    this.dccDataService.updateAdministrativeData('core', this.coreData);
    const dataToSave = this.administrativeDataService.prepareCoreDataForSave(
      this.coreData
    );

    this.administrativeDataService
      .saveToDatabase(dataToSave, 'core', certificateNumber)
      .subscribe({
        next: (success) => {
          if (success) this.editingBlocks['core'] = false;
        },
      });
  }

  private saveLaboratoryBlock() {
    this.dccDataService.updateAdministrativeData(
      'laboratory',
      this.laboratoryData
    );

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

    if (this.laboratoryAction === 'edit') {
      this.updateLaboratoryInDatabase(certificateNumber);
    } else if (
      this.laboratoryAction === 'select' &&
      this.selectedLaboratoryId
    ) {
      this.selectLaboratory(certificateNumber);
    } else if (this.laboratoryAction === 'create') {
      this.createNewLaboratory(certificateNumber);
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Acción requerida',
        text: 'Seleccione una acción válida para el laboratorio.',
      });
    }
  }

  private saveResponsibleBlock() {
    this.dccDataService.updateAdministrativeData(
      'responsiblePersons',
      this.responsiblePersons
    );

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
          console.error('Error saving responsible persons:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al guardar las personas responsables.',
          });
        },
      });
  }

  // Métodos para inicializar edición
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
        }
      }
    } else {
      // Si no hay datos reales del cliente, crear nuevo
      this.customerAction = 'create';
    }

    this.tempCustomerId = '';
  }

  // Método para resetear la acción del cliente
  private resetCustomerAction(): void {
    this.customerAction = null;
    this.tempCustomerId = '';
  }

  // Nuevo método para establecer la acción del cliente
  setCustomerAction(action: 'edit' | 'select' | 'create'): void {
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
      // Mantener datos actuales para editar
    } else if (action === 'select') {
      // Para seleccionar otro, mantener los datos actuales hasta que se seleccione uno nuevo
    }
  }

  // Método simplificado para cargar cliente seleccionado
  loadSelectedCustomer(): void {
    if (!this.tempCustomerId) {
      return;
    }

    const selectedCustomer = this.customerList.find(
      (customer) => customer.id == this.tempCustomerId
    );

    if (selectedCustomer) {
      this.selectedCustomerId = this.tempCustomerId;
      this.customerData =
        this.customerService.mapSelectedCustomerData(selectedCustomer);

      const updatedCustomerData = {
        ...this.customerData,
        customer_id: this.selectedCustomerId,
      };
      this.dccDataService.updateAdministrativeData(
        'customer',
        updatedCustomerData
      );
    }
  }

  // Método para verificar si necesitamos cargar responsible persons desde BD
  private checkIfNeedToLoadResponsiblePersonsFromDB() {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    const needsToLoad = certificateNumber && this.shouldLoadFromDatabase();

    if (needsToLoad) {
      this.loadResponsiblePersonsFromDB(certificateNumber);
    } else {
      if (this.responsiblePersons.length === 0) {
        this.createDefaultResponsiblePersons();
      }
    }
  }

  // Nuevo método para determinar si debe cargar desde base de datos
  private shouldLoadFromDatabase(): boolean {
    if (this.responsiblePersons.length === 0) {
      return true;
    }

    const hasValidData = this.responsiblePersons.some(
      (person) =>
        person.role ||
        person.full_name ||
        person.name ||
        person.email ||
        person.phone
    );

    if (!hasValidData) {
      return true;
    }

    return false;
  }

  // Método para manejar el cambio de mainSigner
  onMainSignerChange(personIndex: number) {
    // Si se está marcando como principal, desmarcar a todos los demás
    if (this.responsiblePersons[personIndex].mainSigner) {
      this.responsiblePersons.forEach((person, index) => {
        if (index !== personIndex) {
          person.mainSigner = false;
        }
      });

      // Mostrar mensaje informativo
      Swal.fire({
        icon: 'info',
        title: 'Responsable Principal',
        text: 'Solo puede haber un responsable principal. Los demás han sido desmarcados.',
        timer: 3000,
        showConfirmButton: false,
        position: 'top-end',
      });
    }
  }

  // Métodos para responsible persons
  addResponsiblePerson() {
    const newIndex = this.responsiblePersons.length;
    this.responsiblePersons.push({
      role: '',
      no_nomina: '',
      full_name: '',
      email: '',
      phone: '',
      mainSigner: false,
    });
    this.selectedUsers[newIndex] = [];
  }

  // Método para verificar si una persona es el responsable principal
  isMainSigner(person: any): boolean {
    return person.mainSigner === true;
  }

  // Método para obtener el responsable principal
  getMainSigner(): any | null {
    return (
      this.responsiblePersons.find((person) => person.mainSigner === true) ||
      null
    );
  }

  // Nuevo método para crear personas responsables predeterminadas
  private createDefaultResponsiblePersons(): void {
    this.responsiblePersons = [
      {
        role: '',
        no_nomina: '',
        full_name: '',
        name: '',
        email: '',
        phone: '',
        mainSigner: false,
      },
      {
        role: '',
        no_nomina: '',
        full_name: '',
        name: '',
        email: '',
        phone: '',
        mainSigner: false,
      },
    ];

    this.selectedUsers = [[], []];

    this.dccDataService.updateAdministrativeData(
      'responsiblePersons',
      this.responsiblePersons
    );
  }

  // Método para cargar responsible persons desde la base de datos por DCC ID
  loadResponsiblePersonsFromDB(dccId: string) {
    this.responsiblePersonsService
      .loadResponsiblePersonsFromDB(dccId)
      .subscribe({
        next: (responsibleData) => {
          if (!responsibleData || responsibleData.length === 0) {
            this.createDefaultResponsiblePersons();
            return;
          }

          const mappedResponsiblePersons =
            this.responsiblePersonsService.mapResponsiblePersonsWithUsers(
              responsibleData,
              this.listauser
            );

          this.responsiblePersons = mappedResponsiblePersons;
          this.initializeSelectedUsers();

          this.dccDataService.updateAdministrativeData(
            'responsiblePersons',
            mappedResponsiblePersons
          );
        },
        error: (error) => {
          console.error('Error loading responsible persons:', error);
          this.createDefaultResponsiblePersons();
        },
      });
  }

  // Método modificado para manejar la selección de usuario
  onUserSelect(selectedItem: any, personIndex: number) {
    if (selectedItem) {
      while (personIndex >= this.selectedUsers.length) {
        this.selectedUsers.push([]);
      }

      this.selectedUsers[personIndex] = [selectedItem];

      if (personIndex < this.responsiblePersons.length) {
        // Buscar el usuario completo en listauser para obtener email y phone
        const fullUser = this.listauser.find(
          (user) => user.no_nomina === selectedItem.no_nomina
        );

        this.responsiblePersons[personIndex].no_nomina = selectedItem.no_nomina;
        this.responsiblePersons[personIndex].full_name = selectedItem.name;
        this.responsiblePersons[personIndex].email = fullUser?.email || '';
        this.responsiblePersons[personIndex].phone = fullUser?.phone || '';
      }
    }
  }

  // Método para manejar cuando se deselecciona un usuario
  onUserDeselect(deselectedItem: any, personIndex: number) {
    this.selectedUsers[personIndex] = [];
    this.responsiblePersons[personIndex].no_nomina = '';
    this.responsiblePersons[personIndex].full_name = '';
    this.responsiblePersons[personIndex].email = '';
    this.responsiblePersons[personIndex].phone = '';
  }

  // Método para eliminar una persona responsable con confirmación
  removeResponsiblePerson(index: number) {
    const person = this.responsiblePersons[index];
    const personName =
      this.getResponsiblePersonDisplayName(person) || 'esta persona';

    Swal.fire({
      title: '¿Eliminar persona responsable?',
      text: `¿Estás seguro de que deseas eliminar a ${personName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        // Si tiene no_nomina, marcar como deleted en la BD
        if (person.no_nomina) {
          this.deleteResponsiblePersonFromDB(person.no_nomina);
        }

        // Eliminar del array local
        this.responsiblePersons.splice(index, 1);
        this.selectedUsers.splice(index, 1);

        // Actualizar el servicio
        this.dccDataService.updateAdministrativeData(
          'responsiblePersons',
          this.responsiblePersons
        );

        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'La persona responsable ha sido eliminada.',
          timer: 1500,
          showConfirmButton: false,
        });
      }
    });
  }

  // Método para eliminar persona responsable de la BD (soft delete)
  private deleteResponsiblePersonFromDB(noNomina: string) {
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    if (!certificateNumber) return;

    const deleteRequest = {
      action: 'update',
      bd: 'calibraciones',
      table: 'dcc_responsiblepersons',
      opts: {
        where: {
          id_dcc: certificateNumber,
          no_nomina: noNomina,
          deleted: 0,
        },
        attributes: { deleted: 1 },
      },
    };

    this.responsiblePersonsService
      .getApiService()
      .post(deleteRequest, UrlClass.URLNuevo)
      .subscribe({
        next: (response: any) => {
          console.log('Persona eliminada de BD:', response);
        },
        error: (error: any) => {
          console.error('Error al eliminar persona de BD:', error);
        },
      });
  }

  // Método para obtener el nombre de pantalla para una persona responsable
  getResponsiblePersonDisplayName(person: any): string {
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

  // Método para verificar si los campos deben estar deshabilitados
  areFieldsDisabled(): boolean {
    return this.laboratoryAction === 'select';
  }

  // Método para verificar si los campos del cliente deben estar deshabilitados
  areCustomerFieldsDisabled(): boolean {
    return this.customerAction === 'select';
  }
}
