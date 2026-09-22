import { Component, OnInit, Input } from '@angular/core';
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
import { OrderService } from '../../services/order.service';
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
  // Tipo de documento: 'DCC' o 'IE' recibido desde el componente padre
  @Input() documentType: 'DCC' | 'IE' = 'DCC';

  editingBlocks: { [key: string]: boolean } = {};

  editableBlocks = {
    software: false,
    core: true,
    laboratory: true,
    responsible: true,
    customer: true,
    responsibleCustomer: true,
  };

  // Propiedades de datos
  softwareData: any = {};
  coreData: any = {};
  laboratoryData: any = {};
  responsiblePersons: any[] = [];
  customerData: any = {};

  // Flags para N/A
  receiptDateNA: boolean = false;
  nextCalibrationDateNA: boolean = false;

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
  projectContactId: string | null = null;

  // Variable para almacenar la dirección del Performance Location cuando es "Other"
  performanceLocationAddress: string = '';

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
    private administrativeDataService: AdministrativeDataService,
    private orderService: OrderService,
    private apiService: ApiService,
  ) {}

  ngOnInit() {
    this.dccDataService.dccData$.subscribe((data) => {
      this.softwareData = { ...data.administrativeData.software };
      this.coreData = this.administrativeDataService.formatCoreDates(
        data.administrativeData.core,
      );
      this.laboratoryData = { ...data.administrativeData.laboratory };
      this.responsiblePersons = [...data.administrativeData.responsiblePersons];
      this.selectedUsers = [];
      this.customerData = { ...data.administrativeData.customer };

      // Detectar si las fechas son null, undefined o inválidas (00/00/0000) y marcar N/A
      this.receiptDateNA =
        this.isDateNA(this.coreData.receipt_date) ||
        this.coreData.receipt_date_na ||
        false;
      this.nextCalibrationDateNA =
        this.isDateNA(this.coreData.next_calibration) ||
        this.coreData.next_calibration_na ||
        false;

      this.initializeSelectedUsers();
      this.initializeIds(data);
      this.loadProjectContactId();

      // Cargar dirección de performance location si es "Other"
      if (this.coreData.performance_localition === 'Other') {
        this.loadPerformanceLocationAddress();
      }
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
          (user) => user.no_nomina === person.no_nomina,
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
      this.laboratoryList,
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
            (!customer.email && !this.customerData.email)),
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
    this.customerService.loadCustomers().subscribe({
      next: (customers) => {
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
              (c) => c.id === relationData.id_customer,
            );
            if (foundCustomer) {
              this.selectedCustomerDropdown = [foundCustomer];

              // Cargar detalles completos del cliente
              this.loadingCustomers = true;
              this.customerService
                .loadCustomerDetails(
                  relationData.id_customer,
                  this.projectContactId ?? undefined,
                )
                .subscribe({
                  next: (fullCustomer) => {
                    this.customerData =
                      this.customerService.mapSelectedCustomerData(
                        fullCustomer,
                      );
                    this.dccDataService.updateAdministrativeData(
                      'customer',
                      this.customerData,
                    );
                    this.loadingCustomers = false;
                  },
                  error: () => {
                    this.customerData =
                      this.customerService.mapSelectedCustomerData(
                        foundCustomer,
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
      (customer) => customer.id === this.selectedCustomerId,
    );

    if (selectedCustomer) {
      this.customerData =
        this.customerService.mapSelectedCustomerData(selectedCustomer);
    }
  }

  // Método para manejar selección desde ng-multiselect-dropdown
  onCustomerDropdownSelect(item: any) {
    if (item) {
      this.selectedCustomerId = item.id;
      this.selectedCustomerDropdown = [item];

      // Mostrar loading mientras carga los detalles
      this.loadingCustomers = true;

      // Cargar detalles completos del cliente seleccionado (email, phone, etc.)
      this.customerService
        .loadCustomerDetails(item.id, this.projectContactId ?? undefined)
        .subscribe({
          next: (fullCustomer) => {
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
            const basicCustomer = this.customerList.find(
              (c) => c.id === item.id,
            );
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
      (lab) => lab.id == this.tempLaboratoryId,
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
        updatedLaboratoryData,
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
              finalLaboratoryData,
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
          currentData.administrativeData.core,
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
      case 'responsibleCustomer':
        this.coreData = this.administrativeDataService.formatCoreDates(
          currentData.administrativeData.core,
        );
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
      case 'responsibleCustomer':
        this.saveResponsibleCustomerBlock(certificateNumber);
        break;
    }
  }

  private saveResponsibleCustomerBlock(certificateNumber: string) {
    this.dccDataService.updateAdministrativeData('core', this.coreData);
    const dataToSave =
      this.administrativeDataService.prepareResponsibleCustomerDataForSave(
        this.coreData,
      );

    this.administrativeDataService
      .saveToDatabase(dataToSave, 'responsibleCustomer', certificateNumber)
      .subscribe({
        next: (success) => {
          if (success) this.editingBlocks['responsibleCustomer'] = false;
        },
      });
  }

  private saveSoftwareBlock(certificateNumber: string) {
    this.dccDataService.updateAdministrativeData('software', this.softwareData);
    const dataToSave =
      this.administrativeDataService.prepareSoftwareDataForSave(
        this.softwareData,
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
    // Guardar los flags de N/A en coreData antes de actualizar
    this.coreData.receipt_date_na = this.receiptDateNA;
    this.coreData.next_calibration_na = this.nextCalibrationDateNA;

    // Si N/A está marcado, establecer la fecha a '0000-00-00' para BD
    if (this.receiptDateNA) {
      this.coreData.receipt_date = '0000-00-00';
    }
    if (this.nextCalibrationDateNA) {
      this.coreData.next_calibration = '0000-00-00';
    }

    this.dccDataService.updateAdministrativeData('core', this.coreData);
    const dataToSave = this.administrativeDataService.prepareCoreDataForSave(
      this.coreData,
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
      this.laboratoryData,
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
      this.responsiblePersons,
    );

    const currentData = this.dccDataService.getCurrentData();
    let certificateNumber =
      currentData.administrativeData.core.certificate_number;

    if (!certificateNumber) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido. Por favor, asigna un certificado primero.',
      });
      return;
    }

    this.responsiblePersonsService
      .saveResponsiblePersons(
        certificateNumber,
        this.responsiblePersons,
        this.listauser,
        this.documentType,
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
            lab.email === this.laboratoryData.email,
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
              (!customer.email && !this.customerData.email)),
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
      (customer) => customer.id == this.tempCustomerId,
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
        updatedCustomerData,
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
        person.phone,
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

  // Método para manejar el cambio de doneBy
  onDoneByChange(personIndex: number) {
    if (this.responsiblePersons[personIndex].doneBy) {
      this.responsiblePersons.forEach((person, index) => {
        if (index !== personIndex) {
          person.doneBy = false;
        }
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
      doneBy: false,
      head: false,
      coordinator: false,
    });
    this.selectedUsers[newIndex] = [];
  }

  // Método para manejar el cambio de Head of Service
  onHeadChange(personIndex: number) {
    if (this.responsiblePersons[personIndex].head) {
      // Si se marca como Head, deseleccionar Coordinator
      this.responsiblePersons[personIndex].coordinator = false;

      // Deseleccionar todos los otros Head
      this.responsiblePersons.forEach((person, index) => {
        if (index !== personIndex) {
          person.head = false;
        }
      });
    }
  }

  // Método para manejar el cambio de Coordinator
  onCoordinatorChange(personIndex: number) {
    if (this.responsiblePersons[personIndex].coordinator) {
      // Si se marca como Coordinator, deseleccionar Head
      this.responsiblePersons[personIndex].head = false;

      // Deseleccionar todos los otros Coordinators
      this.responsiblePersons.forEach((person, index) => {
        if (index !== personIndex) {
          person.coordinator = false;
        }
      });
    }
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
        doneBy: false,
      },
      {
        role: '',
        no_nomina: '',
        full_name: '',
        name: '',
        email: '',
        phone: '',
        mainSigner: false,
        doneBy: false,
      },
    ];

    this.selectedUsers = [[], []];

    this.dccDataService.updateAdministrativeData(
      'responsiblePersons',
      this.responsiblePersons,
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
              this.listauser,
            );

          this.responsiblePersons = mappedResponsiblePersons;
          this.initializeSelectedUsers();

          this.dccDataService.updateAdministrativeData(
            'responsiblePersons',
            mappedResponsiblePersons,
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
          (user) => user.no_nomina === selectedItem.no_nomina,
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
          this.responsiblePersons,
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
        next: (response: any) => {},
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
        (user) => user.no_nomina === person.no_nomina,
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

  // Obtiene el contacto del proyecto desde orden.service
  private loadProjectContactId() {
    const certificateNumber = this.coreData.certificate_number;
    if (!certificateNumber) {
      this.projectContactId = null;
      return;
    }

    const projectId = certificateNumber.split('-')[0];
    if (!projectId) {
      this.projectContactId = null;
      return;
    }

    this.orderService.loadServicesByProject(projectId).subscribe({
      next: (services) => {
        const contactId = services.find((s) => s.id_contact)?.id_contact;
        this.projectContactId = contactId || null;
      },
      error: (error) => {
        console.error('❌ Error loading project contact:', error);
        this.projectContactId = null;
      },
    });
  }

  /**
   * Carga la dirección del Performance Location cuando es "Other"
   * Obtiene el location del proyecto desde opportunity o opportunity_calpro según el tipo de documento
   */
  loadPerformanceLocationAddress() {
    this.performanceLocationAddress = 'Cargando dirección...';

    const certificateNumber = this.coreData.certificate_number;
    if (!certificateNumber) {
      this.performanceLocationAddress = 'No hay certificado disponible';
      return;
    }

    // Determinar el proyecto ID desde el certificate_number (formato: PC0497-00 DCC 24 01)
    const projectId = certificateNumber.split('-')[0]; // Obtiene "PC0497"

    if (!projectId) {
      this.performanceLocationAddress = 'No se pudo determinar el proyecto';
      return;
    }

    // Determinar la tabla según el tipo de documento
    const table =
      this.documentType === 'DCC' ? 'opportunity_calpro' : 'opportunity';

    const getOpportunity = {
      action: 'get',
      bd: 'hvtest2',
      table: table,
      opts: {
        where: { id: projectId },
        attributes: ['location'],
      },
    };

    this.apiService.post(getOpportunity, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        const opportunity = response?.result?.[0];
        this.performanceLocationAddress =
          opportunity?.location || 'No hay ubicación disponible';

        // Guardar la dirección del proyecto en el servicio DCC para usarla en el PDF
        const currentData = this.dccDataService.getCurrentData();
        (currentData as any).projectLocation = this.performanceLocationAddress;
      },
      error: (error) => {
        console.error('❌ Error loading performance location address:', error);
        this.performanceLocationAddress = 'Error al cargar ubicación';
      },
    });
  }

  /**
   * Verifica si una fecha debe considerarse como N/A
   * Retorna true si la fecha es null, undefined, inválida, o representa 00/00/0000
   */
  private isDateNA(date: any): boolean {
    if (!date) return true;

    // Si es un Date object, verificar si es válido
    if (date instanceof Date) {
      // Verificar si es una fecha inválida
      if (isNaN(date.getTime())) return true;

      // Verificar si es 00/00/0000 (año 0 o año 1900 con mes/día 0)
      const year = date.getFullYear();
      if (year === 0 || year === 1900) return true;
    }

    // Si es un string, verificar si representa 00/00/0000 o está vacío
    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (
        trimmed === '' ||
        trimmed === '0000-00-00' ||
        trimmed === '00/00/0000'
      )
        return true;

      // Intentar parsear y verificar
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) return true;

      const year = parsed.getFullYear();
      if (year === 0 || year === 1900) return true;
    }

    return false;
  }
}
