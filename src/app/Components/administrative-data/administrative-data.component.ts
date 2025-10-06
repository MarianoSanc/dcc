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

  constructor(
    private dccDataService: DccDataService,
    private laboratoryService: LaboratoryService,
    private customerService: CustomerService,
    private responsiblePersonsService: ResponsiblePersonsService,
    private administrativeDataService: AdministrativeDataService
  ) {}

  ngOnInit() {
    this.dccDataService.dccData$.subscribe((data) => {
      console.log('🔧 === ngOnInit dccData subscription DEBUG START ===');
      console.log(
        '📄 New DCC data received:',
        JSON.stringify(data.administrativeData.core.certificate_number, null, 2)
      );

      this.softwareData = { ...data.administrativeData.software };
      this.coreData = this.administrativeDataService.formatCoreDates(
        data.administrativeData.core
      );
      this.laboratoryData = { ...data.administrativeData.laboratory };

      // Limpiar personas responsables antes de cargar las nuevas
      console.log('👥 Clearing previous responsible persons');
      console.log(
        '👥 Previous responsible persons:',
        JSON.stringify(this.responsiblePersons, null, 2)
      );

      this.responsiblePersons = [...data.administrativeData.responsiblePersons];
      this.selectedUsers = []; // Limpiar también los usuarios seleccionados

      console.log(
        '👥 New responsible persons loaded:',
        JSON.stringify(this.responsiblePersons, null, 2)
      );

      this.customerData = { ...data.administrativeData.customer };

      // Inicializar selectedUsers array después de cargar los nuevos datos
      this.initializeSelectedUsers();

      this.initializeIds(data);
      console.log('🔧 === ngOnInit dccData subscription DEBUG END ===');
    });

    this.loadInitialData();
  }

  // Nuevo método para inicializar selectedUsers
  private initializeSelectedUsers() {
    console.log('🔧 === initializeSelectedUsers DEBUG START ===');
    console.log(
      '👥 Current responsible persons:',
      JSON.stringify(this.responsiblePersons, null, 2)
    );
    console.log('👥 Current listauser length:', this.listauser.length);

    // Limpiar el array completamente
    this.selectedUsers = [];

    // Crear un nuevo array con la longitud correcta
    for (let i = 0; i < this.responsiblePersons.length; i++) {
      const person = this.responsiblePersons[i];
      console.log(`👥 Processing person ${i}:`, person);

      if (person.no_nomina && this.listauser.length > 0) {
        // Buscar el usuario correspondiente en listauser
        const foundUser = this.listauser.find(
          (user) => user.no_nomina === person.no_nomina
        );
        if (foundUser) {
          this.selectedUsers[i] = [foundUser];
          console.log(`👥 Found and set user for index ${i}:`, foundUser.name);
        } else {
          this.selectedUsers[i] = [];
          console.log(`👥 User not found for no_nomina: ${person.no_nomina}`);
        }
      } else {
        this.selectedUsers[i] = [];
        console.log(`👥 No no_nomina or no users loaded for index ${i}`);
      }
    }

    console.log('👥 Final selectedUsers array:', this.selectedUsers);
    console.log('👥 selectedUsers length:', this.selectedUsers.length);
    console.log(
      '👥 responsiblePersons length:',
      this.responsiblePersons.length
    );
    console.log('🔧 === initializeSelectedUsers DEBUG END ===');
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
    console.log('🔧 === loadUsers DEBUG START ===');
    this.responsiblePersonsService.loadUsers().subscribe({
      next: (users) => {
        this.listauser = users;
        console.log('✅ Loaded users count:', this.listauser.length);
        console.log('✅ First 3 users sample:', this.listauser.slice(0, 3));
        console.log(
          '✅ Users structure check - first user keys:',
          this.listauser.length > 0
            ? Object.keys(this.listauser[0])
            : 'No users'
        );

        // Después de cargar usuarios, sincronizar selectedUsers
        this.initializeSelectedUsers();

        this.checkIfNeedToLoadResponsiblePersonsFromDB();
        console.log('🔧 === loadUsers DEBUG END ===');
      },
      error: (error) => {
        console.error('❌ Error loading users:', error);
        console.log('🔧 === loadUsers DEBUG END (ERROR) ===');
      },
    });
  }

  // Método para alternar edición de bloques
  toggleEdit(blockName: string) {
    // Solo alternar si el bloque es editable
    if (this.editableBlocks[blockName as keyof typeof this.editableBlocks]) {
      this.editingBlocks[blockName] = !this.editingBlocks[blockName];

      // Si se está abriendo la edición de responsible persons, sincronizar selectedUsers
      if (blockName === 'responsible' && this.editingBlocks[blockName]) {
        console.log('👥 Opening responsible persons edit mode');
        this.initializeSelectedUsers();
      }

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
  private createNewLaboratory(certificateNumber: string): void {
    console.log('🆕 createNewLaboratory() called');

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
  private updateLaboratoryInDatabase(certificateNumber: string): void {
    console.log('🔄 updateLaboratoryInDatabase() called');

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
    console.log('🔄 selectLaboratory() called');

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
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
          });
        },
      });
  }

  // Customer methods
  private createNewCustomer(certificateNumber: string): void {
    this.customerService.createCustomer(this.customerData).subscribe({
      next: (customerId) => {
        this.selectedCustomerId = customerId;
        this.linkCustomerToDcc(certificateNumber, true);
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

  private updateCustomerInDatabase(certificateNumber: string): void {
    if (!this.selectedCustomerId) {
      this.selectedCustomerId =
        this.dccDataService.getCurrentData().administrativeData.customer.customer_id;
    }

    this.customerService
      .updateCustomer(this.selectedCustomerId, this.customerData)
      .subscribe({
        next: (success) => {
          if (success) {
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

  private selectCustomer(certificateNumber: string): void {
    this.linkCustomerToDcc(certificateNumber, false);
  }

  private linkCustomerToDcc(certificateNumber: string, isNew: boolean): void {
    this.customerService
      .linkCustomerToDcc(certificateNumber, this.selectedCustomerId)
      .subscribe({
        next: (success) => {
          if (success) {
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
        this.saveCustomerBlock();
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
    console.log('🔧 === saveResponsibleBlock DEBUG START ===');
    console.log('💾 Starting saveResponsibleBlock');
    console.log(
      '💾 Current responsible persons to save:',
      JSON.stringify(this.responsiblePersons, null, 2)
    );

    this.dccDataService.updateAdministrativeData(
      'responsiblePersons',
      this.responsiblePersons
    );

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('💾 Certificate number:', certificateNumber);

    if (!certificateNumber) {
      console.log('❌ No certificate number found');
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    console.log(
      '💾 Calling responsiblePersonsService.saveResponsiblePersons...'
    );
    console.log('💾 Parameters:');
    console.log('  - certificateNumber:', certificateNumber);
    console.log(
      '  - responsiblePersons:',
      JSON.stringify(this.responsiblePersons, null, 2)
    );
    console.log('  - listauser length:', this.listauser.length);

    this.responsiblePersonsService
      .saveResponsiblePersons(
        certificateNumber,
        this.responsiblePersons,
        this.listauser
      )
      .subscribe({
        next: (success) => {
          console.log('💾 Save operation result:', success);
          if (success) {
            console.log('✅ Responsible persons saved successfully');
            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: 'Personas Responsables guardadas correctamente',
              timer: 2000,
              showConfirmButton: false,
              position: 'top-end',
            });
          } else {
            console.log('⚠️ Save operation returned false');
            Swal.fire({
              icon: 'warning',
              title: 'Sin datos válidos',
              text: 'No hay personas responsables válidas para guardar.',
            });
          }
          this.editingBlocks['responsible'] = false;
          console.log('🔧 === saveResponsibleBlock DEBUG END ===');
        },
        error: (error) => {
          console.error('❌ Error saving responsible persons:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al guardar las personas responsables.',
          });
          console.log('🔧 === saveResponsibleBlock DEBUG END (ERROR) ===');
        },
      });
  }

  private saveCustomerBlock() {
    this.dccDataService.updateAdministrativeData('customer', this.customerData);

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

    if (this.customerAction === 'edit') {
      this.updateCustomerInDatabase(certificateNumber);
    } else if (this.customerAction === 'select' && this.selectedCustomerId) {
      this.selectCustomer(certificateNumber);
    } else if (this.customerAction === 'create') {
      this.createNewCustomer(certificateNumber);
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Acción requerida',
        text: 'Seleccione una acción válida para el cliente.',
      });
    }
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
          console.log('🔍 Customer from XML not in database, can create new');
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

  // Método para verificar si necesitamos cargar responsible persons desde BD
  private checkIfNeedToLoadResponsiblePersonsFromDB() {
    console.log(
      '🔧 === checkIfNeedToLoadResponsiblePersonsFromDB DEBUG START ==='
    );
    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('🔍 Checking if need to load responsible persons from DB');
    console.log('🔍 Certificate number:', certificateNumber);
    console.log(
      '🔍 Current responsible persons:',
      JSON.stringify(this.responsiblePersons, null, 2)
    );
    console.log(
      '🔍 Responsible persons length:',
      this.responsiblePersons.length
    );

    // Verificar si necesita cargar desde BD
    const needsToLoad = certificateNumber && this.shouldLoadFromDatabase();

    console.log('🔍 Needs to load from DB:', needsToLoad);

    if (needsToLoad) {
      console.log(
        '📋 Loading responsible persons from database for existing DCC'
      );
      this.loadResponsiblePersonsFromDB(certificateNumber);
    } else {
      console.log('📋 No need to load from DB - using default or XML data');
      // Si no hay datos válidos de responsible persons, crear los predeterminados
      if (this.responsiblePersons.length === 0) {
        console.log('📋 Creating default responsible persons');
        this.createDefaultResponsiblePersons();
      }
    }
    console.log(
      '🔧 === checkIfNeedToLoadResponsiblePersonsFromDB DEBUG END ==='
    );
  }

  // Nuevo método para determinar si debe cargar desde base de datos
  private shouldLoadFromDatabase(): boolean {
    // Si no hay responsible persons, definitivamente necesita cargar desde BD (si existe)
    if (this.responsiblePersons.length === 0) {
      console.log('🔍 No responsible persons found - will check DB');
      return true;
    }

    // Si hay responsible persons pero son los predeterminados vacíos, cargar desde BD
    const hasValidData = this.responsiblePersons.some(
      (person) =>
        person.role ||
        person.full_name ||
        person.name ||
        person.email ||
        person.phone
    );

    if (!hasValidData) {
      console.log(
        '🔍 Only default empty responsible persons found - will check DB'
      );
      return true;
    }

    // Si hay datos válidos del XML, no cargar desde BD
    console.log('🔍 Valid responsible persons data found - using XML data');
    return false;
  }

  // Método para manejar el cambio de mainSigner
  onMainSignerChange(personIndex: number) {
    console.log('🔧 === onMainSignerChange DEBUG START ===');
    console.log('👤 Person index:', personIndex);
    console.log(
      '👤 Current mainSigner value:',
      this.responsiblePersons[personIndex].mainSigner
    );

    // Si se está marcando como principal, desmarcar a todos los demás
    if (this.responsiblePersons[personIndex].mainSigner) {
      console.log('👤 Marking as main signer - unmarking others');
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

    console.log(
      '👤 Final responsible persons state:',
      JSON.stringify(this.responsiblePersons, null, 2)
    );
    console.log('🔧 === onMainSignerChange DEBUG END ===');
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
      mainSigner: false, // Nueva propiedad inicializada en false
    });
    // Agregar un elemento vacío al array de usuarios seleccionados
    this.selectedUsers[newIndex] = [];
    console.log('👥 Added new responsible person at index:', newIndex);
    console.log('👥 Updated selectedUsers array:', this.selectedUsers);
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
    console.log('🔧 === createDefaultResponsiblePersons DEBUG START ===');

    this.responsiblePersons = [
      {
        role: '',
        no_nomina: '',
        full_name: '',
        name: '',
        email: '',
        phone: '',
        mainSigner: false, // Agregar propiedad mainSigner
      },
      {
        role: '',
        no_nomina: '',
        full_name: '',
        name: '',
        email: '',
        phone: '',
        mainSigner: false, // Agregar propiedad mainSigner
      },
    ];

    // Inicializar selectedUsers para las personas predeterminadas
    this.selectedUsers = [[], []];

    // Actualizar en el servicio DCC
    this.dccDataService.updateAdministrativeData(
      'responsiblePersons',
      this.responsiblePersons
    );

    console.log(
      '👥 Created default responsible persons:',
      JSON.stringify(this.responsiblePersons, null, 2)
    );
    console.log('👥 Initialized selectedUsers:', this.selectedUsers);
    console.log('🔧 === createDefaultResponsiblePersons DEBUG END ===');
  }

  // Método para cargar responsible persons desde la base de datos por DCC ID
  loadResponsiblePersonsFromDB(dccId: string) {
    console.log('🔧 === loadResponsiblePersonsFromDB DEBUG START ===');
    console.log('📋 Loading responsible persons for DCC:', dccId);

    this.responsiblePersonsService
      .loadResponsiblePersonsFromDB(dccId)
      .subscribe({
        next: (responsibleData) => {
          console.log(
            '✅ Raw responsible persons from DB:',
            JSON.stringify(responsibleData, null, 2)
          );

          // Si no hay datos en la BD, crear los predeterminados
          if (!responsibleData || responsibleData.length === 0) {
            console.log(
              '📋 No responsible persons found in DB - creating defaults'
            );
            this.createDefaultResponsiblePersons();
            console.log(
              '🔧 === loadResponsiblePersonsFromDB DEBUG END (NO DATA) ==='
            );
            return;
          }

          // Mapear los datos de la BD con la información de usuarios
          const mappedResponsiblePersons =
            this.responsiblePersonsService.mapResponsiblePersonsWithUsers(
              responsibleData,
              this.listauser
            );

          console.log(
            '✅ Mapped responsible persons:',
            JSON.stringify(mappedResponsiblePersons, null, 2)
          );

          // Actualizar los datos en el servicio DCC y localmente
          this.responsiblePersons = mappedResponsiblePersons;

          // Inicializar selectedUsers después de cargar los datos
          this.initializeSelectedUsers();

          this.dccDataService.updateAdministrativeData(
            'responsiblePersons',
            mappedResponsiblePersons
          );

          console.log(
            '✅ Final responsible persons in component:',
            JSON.stringify(this.responsiblePersons, null, 2)
          );
          console.log('🔧 === loadResponsiblePersonsFromDB DEBUG END ===');
        },
        error: (error) => {
          console.error('❌ Error loading responsible persons:', error);
          console.log('📋 Error loading from DB - creating defaults');
          this.createDefaultResponsiblePersons();
          console.log(
            '🔧 === loadResponsiblePersonsFromDB DEBUG END (ERROR) ==='
          );
        },
      });
  }

  // Método modificado para manejar la selección de usuario
  onUserSelect(selectedItem: any, personIndex: number) {
    console.log('🔧 === onUserSelect DEBUG START ===');
    console.log('👤 User selected:', selectedItem);
    console.log('👤 Person index:', personIndex);
    console.log('👤 selectedUsers array before update:', this.selectedUsers);
    console.log('👤 selectedUsers length:', this.selectedUsers.length);
    console.log(
      '👤 responsiblePersons length:',
      this.responsiblePersons.length
    );
    console.log(
      '👤 Current responsible persons before update:',
      JSON.stringify(this.responsiblePersons, null, 2)
    );

    if (selectedItem) {
      console.log('👤 selectedItem.no_nomina:', selectedItem.no_nomina);
      console.log('👤 selectedItem.name (CONCAT):', selectedItem.name);
      console.log('👤 selectedItem.email:', selectedItem.email);
      console.log('👤 selectedItem.phone:', selectedItem.phone);

      // Asegurar que el índice existe en el array
      while (personIndex >= this.selectedUsers.length) {
        this.selectedUsers.push([]);
        console.log(
          `👤 Extended selectedUsers to index ${this.selectedUsers.length - 1}`
        );
      }

      // Almacenar el usuario seleccionado
      this.selectedUsers[personIndex] = [selectedItem];
      console.log(
        `👤 Set selectedUsers[${personIndex}] =`,
        this.selectedUsers[personIndex]
      );

      // Asegurar que el responsiblePersons existe
      if (personIndex < this.responsiblePersons.length) {
        // Actualizar los datos de la persona responsable
        this.responsiblePersons[personIndex].no_nomina = selectedItem.no_nomina;
        this.responsiblePersons[personIndex].full_name = selectedItem.name;

        console.log('👤 After setting no_nomina and full_name:');
        console.log(
          '👤 - no_nomina:',
          this.responsiblePersons[personIndex].no_nomina
        );
        console.log(
          '👤 - full_name:',
          this.responsiblePersons[personIndex].full_name
        );

        // Llenar automáticamente email y teléfono si están disponibles
        if (selectedItem.email) {
          this.responsiblePersons[personIndex].email = selectedItem.email;
          console.log(
            '👤 Auto-filled email:',
            this.responsiblePersons[personIndex].email
          );
        }
        if (selectedItem.phone) {
          this.responsiblePersons[personIndex].phone = selectedItem.phone;
          console.log(
            '👤 Auto-filled phone:',
            this.responsiblePersons[personIndex].phone
          );
        }

        console.log(
          '✅ Final updated person data:',
          JSON.stringify(this.responsiblePersons[personIndex], null, 2)
        );
      } else {
        console.log(
          '❌ personIndex out of bounds for responsiblePersons array'
        );
      }

      console.log('✅ Final selectedUsers array:', this.selectedUsers);
    } else {
      console.log('⚠️ selectedItem is null or undefined');
    }
    console.log('🔧 === onUserSelect DEBUG END ===');
  }

  // Método para manejar cuando se deselecciona un usuario
  onUserDeselect(deselectedItem: any, personIndex: number) {
    console.log('🔧 === onUserDeselect DEBUG START ===');
    console.log('👤 User deselected:', deselectedItem);
    console.log('👤 Person index:', personIndex);
    console.log(
      '👤 Person before clearing:',
      JSON.stringify(this.responsiblePersons[personIndex], null, 2)
    );

    // Limpiar el usuario seleccionado
    this.selectedUsers[personIndex] = [];

    // Limpiar los datos del usuario pero mantener email y phone si fueron editados manualmente
    this.responsiblePersons[personIndex].no_nomina = '';
    this.responsiblePersons[personIndex].full_name = '';

    console.log(
      '👤 Person after clearing user data:',
      JSON.stringify(this.responsiblePersons[personIndex], null, 2)
    );
    console.log(
      '👤 Cleared selectedUsers for index',
      personIndex,
      ':',
      this.selectedUsers[personIndex]
    );
    console.log('🔧 === onUserDeselect DEBUG END ===');
  }

  // Método para obtener el nombre de pantalla para una persona responsable
  getResponsiblePersonDisplayName(person: any): string {
    // Si tiene full_name directamente (desde la BD), usarlo
    if (person.full_name) {
      return person.full_name;
    }

    // Si tiene no_nomina, buscar en la lista de usuarios
    if (person.no_nomina && this.listauser.length > 0) {
      console.log('🔍 Searching user by no_nomina:', person.no_nomina);
      console.log(
        '🔍 Available users:',
        this.listauser.map((u) => ({ no_nomina: u.no_nomina, name: u.name }))
      );

      const foundUser = this.listauser.find(
        (user) => user.no_nomina === person.no_nomina
      );

      if (foundUser) {
        console.log('✅ Found user:', foundUser);
        console.log('✅ Using found user name:', foundUser.name);
        console.log('🔧 === getResponsiblePersonDisplayName DEBUG END ===');
        return foundUser.name; // Usar 'name' que es el CONCAT del servicio
      } else {
        console.log('❌ User not found in listauser');
      }
    }

    // Fallback para compatibilidad con formato anterior
    if (typeof person.name === 'string' && person.name) {
      console.log('⚠️ Using fallback person.name:', person.name);
      console.log('🔧 === getResponsiblePersonDisplayName DEBUG END ===');
      return person.name;
    }

    console.log('❌ No display name found, returning "No asignado"');
    console.log('🔧 === getResponsiblePersonDisplayName DEBUG END ===');
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
