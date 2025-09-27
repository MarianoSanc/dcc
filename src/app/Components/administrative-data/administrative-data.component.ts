import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NgMultiSelectDropDownModule,
  IDropdownSettings,
} from 'ng-multiselect-dropdown';
import { DccDataService } from '../../services/dcc-data.service';
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

  // Configuración para qué bloques son editables
  editableBlocks = {
    software: false, // El bloque de software no es editable
    core: true,
    identifications: true,
    laboratory: true,
    responsible: true,
    customer: true,
  };

  // Propiedades de datos
  softwareData: any = {};
  coreData: any = {};
  identifications: any[] = [];
  laboratoryData: any = {};
  responsiblePersons: any[] = [];
  customerData: any = {};

  // Datos de usuario para el dropdown
  listauser: any[] = [];
  selectedUsers: any[] = [];

  // Configuración del dropdown
  dropdownuser: IDropdownSettings = {
    idField: 'full_name',
    textField: 'full_name',
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

      this.identifications = [...data.administrativeData.identifications];
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
      this.customerData = { ...data.administrativeData.customer };

      console.log('🔍 Loaded customer data:', this.customerData);

      // Usar directamente el customer_id si está disponible
      if (data.administrativeData.customer.customer_id) {
        this.selectedCustomerId = data.administrativeData.customer.customer_id;
        console.log('🔍 Using customer_id from data:', this.selectedCustomerId);
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
    this.loadResponsiblePersons();
  }

  // Nuevo método para encontrar el ID del laboratorio
  private findLaboratoryId(): void {
    if (this.laboratoryList.length > 0 && this.laboratoryData.name) {
      const existingLab = this.laboratoryList.find(
        (lab) =>
          lab.name === this.laboratoryData.name &&
          lab.email === this.laboratoryData.email
      );
      if (existingLab) {
        this.selectedLaboratoryId = existingLab.id;
        console.log('🔍 Found laboratory ID:', this.selectedLaboratoryId);
      } else {
        console.log(
          '🔍 Laboratory not found in database, might need to create new one'
        );
      }
    } else {
      // Si la lista aún no está cargada, intentar después de un momento
      setTimeout(() => this.findLaboratoryId(), 500);
    }
  }

  // Nuevo método para cargar laboratorios
  loadLaboratories() {
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
        this.laboratoryList = response.result || [];
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
        this.customerList = response.result || [];
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

  // Nuevo método para cargar responsables
  loadResponsiblePersons() {
    const getCustomers = {
      action: 'get',
      bd: this.database,
      table: 'dcc_responsiblepersons',
      opts: {
        where: { deleted: 0 },
        order_by: ['name', 'ASC'],
      },
    };

    this.apiService.post(getCustomers, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        this.customerList = response.result || [];
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

  loadUsers() {
    const info_usuarios = {
      action: 'get',
      bd: 'administracion',
      table: 'user',
      opts: {
        customSelect:
          'user.no_nomina, user.first_name, user.last_name, user.alias, CONCAT(user.first_name, " ", user.last_name) AS full_name',
        where: {
          deleted: 0,
          organizacion: 0,
        },
        order_by: ['user.first_name', 'ASC'],
      },
    };

    this.apiService.post(info_usuarios, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        this.listauser = response['result'] || [];
      },
      error: (error) => {
        console.error('Error loading users:', error);
      },
    });
  }

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

  // Modificar método para inicializar la edición del laboratorio
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

  // Nuevo método para resetear la acción del laboratorio
  private resetLaboratoryAction(): void {
    this.laboratoryAction = null;
    this.tempLaboratoryId = '';
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

  // Modificar método para cargar laboratorio seleccionado
  loadSelectedLaboratory(): void {
    console.log('🔄 loadSelectedLaboratory called');
    console.log('🔄 tempLaboratoryId:', this.tempLaboratoryId);

    if (!this.tempLaboratoryId) {
      // Si no hay selección, no hacer nada (mantener datos actuales)
      return;
    }

    const selectedLab = this.laboratoryList.find(
      (lab) => lab.id == this.tempLaboratoryId
    );

    console.log('🔄 selectedLab found:', selectedLab);

    if (selectedLab) {
      // Actualizar el ID seleccionado
      this.selectedLaboratoryId = this.tempLaboratoryId;

      // Actualizar los datos del laboratorio con los del seleccionado
      this.laboratoryData = {
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

      // NUEVO: Actualizar inmediatamente en el servicio DCC para que se reflejen los cambios en la interfaz
      const updatedLaboratoryData = {
        ...this.laboratoryData,
        laboratory_id: this.selectedLaboratoryId, // Mantener el ID actual pero no guardarlo aún en BD
      };
      this.dccDataService.updateAdministrativeData(
        'laboratory',
        updatedLaboratoryData
      );

      console.log(
        '🔄 laboratoryData updated with selected lab:',
        this.laboratoryData
      );
      console.log(
        '🔄 selectedLaboratoryId updated to:',
        this.selectedLaboratoryId
      );
      console.log('🔄 Data immediately updated in DCC service for UI display');
    }
  }

  // Nuevo método para obtener texto del botón guardar
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

  // Método para cargar cliente seleccionado
  loadSelectedCustomer(): void {
    console.log('🔄 loadSelectedCustomer called');
    console.log('🔄 tempCustomerId:', this.tempCustomerId);

    if (!this.tempCustomerId) {
      // Si no hay selección, no hacer nada (mantener datos actuales)
      return;
    }

    const selectedCustomer = this.customerList.find(
      (customer) => customer.id == this.tempCustomerId
    );

    console.log('🔄 selectedCustomer found:', selectedCustomer);

    if (selectedCustomer) {
      // Actualizar el ID seleccionado
      this.selectedCustomerId = this.tempCustomerId;

      // Actualizar los datos del cliente con los del seleccionado
      this.customerData = {
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

      // Actualizar inmediatamente en el servicio DCC para que se reflejen los cambios en la interfaz
      const updatedCustomerData = {
        ...this.customerData,
        customer_id: this.selectedCustomerId, // Mantener el ID actual
      };
      this.dccDataService.updateAdministrativeData(
        'customer',
        updatedCustomerData
      );

      console.log(
        '🔄 customerData updated with selected customer:',
        this.customerData
      );
      console.log('🔄 selectedCustomerId updated to:', this.selectedCustomerId);
      console.log('🔄 Data immediately updated in DCC service for UI display');
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

      case 'identifications':
        this.dccDataService.updateAdministrativeData(
          'identifications',
          this.identifications
        );
        dataToSave = {
          identifications: JSON.stringify(this.identifications),
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

  // Nuevo método para crear laboratorio
  private createNewLaboratory(): void {
    console.log('🆕 createNewLaboratory() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('🆕 certificateNumber:', certificateNumber);
    console.log('🆕 laboratoryData to create:', this.laboratoryData);

    if (!certificateNumber) {
      console.log('❌ No certificate number found');
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    // Validar que los campos requeridos estén llenos
    if (!this.laboratoryData.name || !this.laboratoryData.name.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'El nombre del laboratorio es obligatorio.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: 'Creando Laboratorio...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Crear el laboratorio en dcc_laboratory
    const createLabRequest = {
      action: 'create',
      bd: this.database,
      table: 'dcc_laboratory',
      opts: {
        attributes: {
          name: this.laboratoryData.name,
          email: this.laboratoryData.email || '',
          phone: this.laboratoryData.phone || '',
          fax: this.laboratoryData.fax || '',
          postal_code: this.laboratoryData.postal_code || '',
          city: this.laboratoryData.city || '',
          street: this.laboratoryData.street || '',
          number: this.laboratoryData.street_number || '',
          state: this.laboratoryData.state || '',
          country: this.laboratoryData.country || '',
          deleted: 0, // Marcar como activo
        },
      },
    };

    console.log('🆕 createLabRequest:', createLabRequest);

    this.apiService.post(createLabRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Create laboratory response:', response);
        if (response.result) {
          console.log('✅ Laboratory created successfully, now finding its ID');
          // Buscar el ID del laboratorio recién creado
          this.findCreatedLaboratoryId(certificateNumber);
        } else {
          console.log('❌ Failed to create laboratory');
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo crear el laboratorio.',
          });
        }
      },
      error: (error) => {
        console.log('❌ Error creating laboratory:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al crear el laboratorio.',
        });
      },
    });
  }

  // Nuevo método para encontrar el ID del laboratorio recién creado
  private findCreatedLaboratoryId(certificateNumber: string): void {
    console.log('🔍 findCreatedLaboratoryId() called');

    // Buscar el laboratorio recién creado por nombre y email (identificadores únicos)
    const findLabRequest = {
      action: 'get',
      bd: this.database,
      table: 'dcc_laboratory',
      opts: {
        where: {
          name: this.laboratoryData.name,
          email: this.laboratoryData.email || '',
          deleted: 0,
        },
        order_by: ['id', 'DESC'], // Obtener el más reciente
        limit: 1,
      },
    };

    console.log('🔍 findLabRequest:', findLabRequest);

    this.apiService.post(findLabRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Find laboratory response:', response);
        if (response.result && response.result.length > 0) {
          const createdLab = response.result[0];
          this.selectedLaboratoryId = createdLab.id.toString();
          console.log(
            '✅ Found created laboratory ID:',
            this.selectedLaboratoryId
          );

          // Actualizar la referencia en dcc_data (indicando que es un laboratorio nuevo)
          this.updateDccDataLaboratoryReference(certificateNumber, true);

          // Recargar la lista de laboratorios para incluir el nuevo
          this.loadLaboratories();
        } else {
          console.log('❌ Could not find created laboratory');
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo encontrar el laboratorio creado.',
          });
        }
      },
      error: (error) => {
        console.log('❌ Error finding created laboratory:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al buscar el laboratorio creado.',
        });
      },
    });
  }

  // Modificar método updateDccDataLaboratoryReference para manejar mensajes específicos
  private updateDccDataLaboratoryReference(
    certificateNumber: string,
    isNewLab: boolean = false
  ): void {
    console.log('🔗 updateDccDataLaboratoryReference() called');
    console.log('🔗 certificateNumber:', certificateNumber);
    console.log('🔗 selectedLaboratoryId:', this.selectedLaboratoryId);
    console.log('🔗 isNewLab:', isNewLab);

    const updateDccRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: certificateNumber },
        attributes: {
          id_laboratory: this.selectedLaboratoryId,
        },
      },
    };

    console.log('🔗 updateDccRequest:', updateDccRequest);

    this.apiService.post(updateDccRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Update DCC reference response:', response);
        Swal.close();
        if (response.result) {
          console.log('✅ DCC reference updated successfully');

          // Actualizar el laboratory_id en el servicio
          const finalLaboratoryData = {
            ...this.laboratoryData,
            laboratory_id: this.selectedLaboratoryId,
          };
          this.dccDataService.updateAdministrativeData(
            'laboratory',
            finalLaboratoryData
          );

          const successMessage = isNewLab
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

          // Salir del modo edición
          this.editingBlocks['laboratory'] = false;
        } else {
          console.log('❌ Failed to update DCC reference');
          const errorMessage = isNewLab
            ? 'No se pudo vincular el laboratorio creado al DCC.'
            : 'No se pudo vincular el laboratorio al DCC.';

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: errorMessage,
          });
        }
      },
      error: (error) => {
        console.log('❌ Error updating DCC reference:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al vincular el laboratorio.',
        });
      },
    });
  }

  // Modificar las llamadas existentes a updateDccDataLaboratoryReference
  private updateLaboratoryInDatabase(): void {
    console.log('🔄 updateLaboratoryInDatabase() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('🔄 certificateNumber:', certificateNumber);
    console.log('🔄 selectedLaboratoryId:', this.selectedLaboratoryId);
    console.log('🔄 laboratoryData to update:', this.laboratoryData);

    if (!certificateNumber) {
      console.log('❌ No certificate number found');
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    // Si no tenemos selectedLaboratoryId, intentar obtenerlo de los datos
    if (
      !this.selectedLaboratoryId &&
      currentData.administrativeData.laboratory.laboratory_id
    ) {
      this.selectedLaboratoryId =
        currentData.administrativeData.laboratory.laboratory_id;
      console.log(
        '🔄 Using laboratory_id from current data:',
        this.selectedLaboratoryId
      );
    }

    if (!this.selectedLaboratoryId) {
      console.log('❌ No laboratory ID available for update');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se puede actualizar: no se encontró el ID del laboratorio.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: 'Guardando Laboratorio...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Actualizar el laboratorio en dcc_laboratory usando el selectedLaboratoryId
    const updateLabRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_laboratory',
      opts: {
        where: { id: this.selectedLaboratoryId },
        attributes: {
          name: this.laboratoryData.name,
          email: this.laboratoryData.email,
          phone: this.laboratoryData.phone,
          fax: this.laboratoryData.fax,
          postal_code: this.laboratoryData.postal_code,
          city: this.laboratoryData.city,
          street: this.laboratoryData.street,
          number: this.laboratoryData.street_number,
          state: this.laboratoryData.state,
          country: this.laboratoryData.country,
        },
      },
    };

    console.log('🔄 updateLabRequest:', updateLabRequest);

    this.apiService.post(updateLabRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Update laboratory response:', response);
        if (response.result) {
          console.log(
            '✅ Laboratory updated successfully, now updating DCC reference'
          );
          // Actualizar la referencia en dcc_data
          this.updateDccDataLaboratoryReference(certificateNumber, false);
        } else {
          console.log('❌ Failed to update laboratory');
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el laboratorio.',
          });
        }
      },
      error: (error) => {
        console.log('❌ Error updating laboratory:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al actualizar el laboratorio.',
        });
      },
    });
  }

  // Método para crear cliente
  private createNewCustomer(): void {
    console.log('🆕 createNewCustomer() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('🆕 certificateNumber:', certificateNumber);
    console.log('🆕 customerData to create:', this.customerData);

    if (!certificateNumber) {
      console.log('❌ No certificate number found');
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    // Validar que los campos requeridos estén llenos
    if (!this.customerData.name || !this.customerData.name.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'El nombre del cliente es obligatorio.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: 'Creando Cliente...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Crear el cliente en dcc_customer
    const createCustomerRequest = {
      action: 'create',
      bd: this.database,
      table: 'dcc_customer',
      opts: {
        attributes: {
          name: this.customerData.name,
          email: this.customerData.email || '',
          phone: this.customerData.phone || '',
          fax: this.customerData.fax || '',
          postal_code: this.customerData.postal_code || '',
          city: this.customerData.city || '',
          street: this.customerData.street || '',
          number: this.customerData.street_number || '',
          state: this.customerData.state || '',
          country: this.customerData.country || '',
          deleted: 0, // Marcar como activo
        },
      },
    };

    console.log('🆕 createCustomerRequest:', createCustomerRequest);

    this.apiService.post(createCustomerRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Create customer response:', response);
        if (response.result) {
          console.log('✅ Customer created successfully, now finding its ID');
          // Buscar el ID del cliente recién creado
          this.findCreatedCustomerId(certificateNumber);
        } else {
          console.log('❌ Failed to create customer');
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo crear el cliente.',
          });
        }
      },
      error: (error) => {
        console.log('❌ Error creating customer:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al crear el cliente.',
        });
      },
    });
  }

  // Método para encontrar el ID del cliente recién creado
  private findCreatedCustomerId(certificateNumber: string): void {
    console.log('🔍 findCreatedCustomerId() called');

    // Buscar el cliente recién creado por nombre y email (identificadores únicos)
    const findCustomerRequest = {
      action: 'get',
      bd: this.database,
      table: 'dcc_customer',
      opts: {
        where: {
          name: this.customerData.name,
          email: this.customerData.email || '',
          deleted: 0,
        },
        order_by: ['id', 'DESC'], // Obtener el más reciente
        limit: 1,
      },
    };

    console.log('🔍 findCustomerRequest:', findCustomerRequest);

    this.apiService.post(findCustomerRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Find customer response:', response);
        if (response.result && response.result.length > 0) {
          const createdCustomer = response.result[0];
          this.selectedCustomerId = createdCustomer.id.toString();
          console.log('✅ Found created customer ID:', this.selectedCustomerId);

          // Actualizar la referencia en dcc_data (indicando que es un cliente nuevo)
          this.updateDccDataCustomerReference(certificateNumber, true);

          // Recargar la lista de clientes para incluir el nuevo
          this.loadCustomers();
        } else {
          console.log('❌ Could not find created customer');
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo encontrar el cliente creado.',
          });
        }
      },
      error: (error) => {
        console.log('❌ Error finding created customer:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al buscar el cliente creado.',
        });
      },
    });
  }

  // Método para actualizar la referencia del cliente en dcc_data
  private updateDccDataCustomerReference(
    certificateNumber: string,
    isNewCustomer: boolean = false
  ): void {
    console.log('🔗 updateDccDataCustomerReference() called');
    console.log('🔗 certificateNumber:', certificateNumber);
    console.log('🔗 selectedCustomerId:', this.selectedCustomerId);
    console.log('🔗 isNewCustomer:', isNewCustomer);

    const updateDccRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: certificateNumber },
        attributes: {
          id_customer: this.selectedCustomerId,
        },
      },
    };

    console.log('🔗 updateDccRequest:', updateDccRequest);

    this.apiService.post(updateDccRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Update DCC reference response:', response);
        Swal.close();
        if (response.result) {
          console.log('✅ DCC reference updated successfully');

          // Actualizar el customer_id en el servicio
          const finalCustomerData = {
            ...this.customerData,
            customer_id: this.selectedCustomerId,
          };
          this.dccDataService.updateAdministrativeData(
            'customer',
            finalCustomerData
          );

          const successMessage = isNewCustomer
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

          // Salir del modo edición
          this.editingBlocks['customer'] = false;
        } else {
          console.log('❌ Failed to update DCC reference');
          const errorMessage = isNewCustomer
            ? 'No se pudo vincular el cliente creado al DCC.'
            : 'No se pudo vincular el cliente al DCC.';

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: errorMessage,
          });
        }
      },
      error: (error) => {
        console.log('❌ Error updating DCC reference:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al vincular el cliente.',
        });
      },
    });
  }

  // Nuevo método para verificar si hay laboratorio cargado
  hasLoadedLaboratory(): boolean {
    const hasLab =
      this.laboratoryData.name && this.laboratoryData.name.trim() !== '';
    console.log('🔍 hasLoadedLaboratory():', hasLab);
    console.log('🔍 laboratoryData.name:', this.laboratoryData.name);
    console.log('🔍 selectedLaboratoryId:', this.selectedLaboratoryId);
    return hasLab;
  }

  // Nuevo método para verificar si hay cliente cargado
  hasLoadedCustomer(): boolean {
    const hasCustomer =
      this.customerData.name && this.customerData.name.trim() !== '';
    console.log('🔍 hasLoadedCustomer():', hasCustomer);
    console.log('🔍 customerData.name:', this.customerData.name);
    console.log('🔍 selectedCustomerId:', this.selectedCustomerId);
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

  // Nuevo método para seleccionar laboratorio (cambiar referencia y datos)
  private selectLaboratory(): void {
    console.log(
      '🔄 selectLaboratory() called - Only updating database reference'
    );

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('🔄 certificateNumber:', certificateNumber);
    console.log('🔄 selectedLaboratoryId:', this.selectedLaboratoryId);

    if (!certificateNumber) {
      console.log('❌ No certificate number found');
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    if (!this.selectedLaboratoryId) {
      console.log('❌ No laboratory ID selected');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se puede seleccionar: no se ha seleccionado un laboratorio.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: 'Guardando selección...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // SOLO actualizar la referencia en dcc_data
    const updateDccRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: certificateNumber },
        attributes: {
          id_laboratory: this.selectedLaboratoryId,
        },
      },
    };

    console.log('🔄 updateDccRequest (only reference):', updateDccRequest);

    this.apiService.post(updateDccRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Update DCC reference response:', response);
        Swal.close();
        if (response.result) {
          // Actualizar el laboratory_id en el servicio para mantener consistencia
          const finalLaboratoryData = {
            ...this.laboratoryData,
            laboratory_id: this.selectedLaboratoryId,
          };
          this.dccDataService.updateAdministrativeData(
            'laboratory',
            finalLaboratoryData
          );

          console.log('✅ Laboratory reference saved to database successfully');
          Swal.fire({
            icon: 'success',
            title: '¡Laboratorio Seleccionado!',
            text: 'La referencia del laboratorio ha sido guardada correctamente',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
          // Salir del modo edición
          this.editingBlocks['laboratory'] = false;
        } else {
          console.log('❌ Failed to update DCC reference');
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo guardar la selección del laboratorio.',
          });
        }
      },
      error: (error) => {
        console.log('❌ Error updating DCC reference:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al guardar la selección.',
        });
      },
    });
  }

  // Método para seleccionar cliente (cambiar referencia y datos)
  private selectCustomer(): void {
    console.log(
      '🔄 selectCustomer() called - Only updating database reference'
    );

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('🔄 certificateNumber:', certificateNumber);
    console.log('🔄 selectedCustomerId:', this.selectedCustomerId);

    if (!certificateNumber) {
      console.log('❌ No certificate number found');
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    if (!this.selectedCustomerId) {
      console.log('❌ No customer ID selected');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se puede seleccionar: no se ha seleccionado un cliente.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: 'Guardando selección...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // SOLO actualizar la referencia en dcc_data
    const updateDccRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: certificateNumber },
        attributes: {
          id_customer: this.selectedCustomerId,
        },
      },
    };

    console.log('🔄 updateDccRequest (only reference):', updateDccRequest);

    this.apiService.post(updateDccRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Update DCC reference response:', response);
        Swal.close();
        if (response.result) {
          // Actualizar el customer_id en el servicio para mantener consistencia
          const finalCustomerData = {
            ...this.customerData,
            customer_id: this.selectedCustomerId,
          };
          this.dccDataService.updateAdministrativeData(
            'customer',
            finalCustomerData
          );

          console.log('✅ Customer reference saved to database successfully');
          Swal.fire({
            icon: 'success',
            title: '¡Cliente Seleccionado!',
            text: 'La referencia del cliente ha sido guardada correctamente',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
          // Salir del modo edición
          this.editingBlocks['customer'] = false;
        } else {
          console.log('❌ Failed to update DCC reference');
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo guardar la selección del cliente.',
          });
        }
      },
      error: (error) => {
        console.log('❌ Error updating DCC reference:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al guardar la selección.',
        });
      },
    });
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
      identifications: 'Identificaciones',
      laboratory: 'Laboratorio',
      responsible: 'Personas Responsables',
      customer: 'Cliente',
    };
    return displayNames[blockType] || blockType;
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
        break;
      case 'identifications':
        this.identifications = [
          ...currentData.administrativeData.identifications,
        ];
        break;
      case 'laboratory':
        this.laboratoryData = { ...currentData.administrativeData.laboratory };
        // Restaurar selectedLaboratoryId si existe en los datos cargados
        break;
      case 'responsible':
        this.responsiblePersons = [
          ...currentData.administrativeData.responsiblePersons,
        ];
        break;
      case 'customer':
        this.customerData = { ...currentData.administrativeData.customer };
        // Restaurar selectedCustomerId si existe en los datos cargados
        break;
    }
  }

  addIdentification() {
    this.identifications.push({ issuer: '', value: '', name: '' });
  }

  removeIdentification(index: number) {
    this.identifications.splice(index, 1);
  }

  addResponsiblePerson() {
    this.responsiblePersons.push({
      role: '',
      name: [], // Inicializar como array para multiselect
      email: '',
      phone: '',
    });
  }

  removeResponsiblePerson(index: number) {
    this.responsiblePersons.splice(index, 1);
  }

  onUserSelect(selectedItem: any, personIndex: number) {
    // Cuando se selecciona un usuario, actualizar el campo name con full_name
    if (selectedItem && selectedItem.full_name) {
      // Almacenar el nombre completo como cadena, pero mantener el formato de array para multiselect
      const actualName = selectedItem.full_name;
      this.responsiblePersons[personIndex].name = actualName;
      console.log('Selected user name:', actualName);
    }
  }

  // Método para obtener el nombre de pantalla para una persona responsable
  getResponsiblePersonDisplayName(person: any): string {
    // Manejar tanto el formato de array (desde multiselect) como el formato de cadena (desde XML)
    if (Array.isArray(person.name) && person.name.length > 0) {
      return (
        person.name[0].full_name || person.name[0] || 'Usuario seleccionado'
      );
    } else if (typeof person.name === 'string' && person.name) {
      return person.name;
    }
    return 'No asignado';
  }

  isEditing(blockName: string): boolean {
    return this.editingBlocks[blockName] || false;
  }

  isBlockEditable(blockName: string): boolean {
    return this.editableBlocks[blockName as keyof typeof this.editableBlocks];
  }

  // Nuevo método para vincular laboratorio existente sin modificarlo
  private linkExistingLaboratory(): void {
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
      title: 'Vinculando Laboratorio...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Solo actualizar la referencia en dcc_data
    this.updateDccDataLaboratoryReference(certificateNumber);
  }
  // Método para actualizar cliente existente
  private updateCustomerInDatabase(): void {
    console.log('🔄 updateCustomerInDatabase() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('🔄 certificateNumber:', certificateNumber);
    console.log('🔄 selectedCustomerId:', this.selectedCustomerId);
    console.log('🔄 customerData to update:', this.customerData);

    if (!certificateNumber) {
      console.log('❌ No certificate number found');
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    // Si no tenemos selectedCustomerId, intentar obtenerlo de los datos
    if (
      !this.selectedCustomerId &&
      currentData.administrativeData.customer.customer_id
    ) {
      this.selectedCustomerId =
        currentData.administrativeData.customer.customer_id;
      console.log(
        '🔄 Using customer_id from current data:',
        this.selectedCustomerId
      );
    }

    if (!this.selectedCustomerId) {
      console.log('❌ No customer ID available for update');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se puede actualizar: no se encontró el ID del cliente.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: 'Guardando Cliente...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Actualizar el cliente en dcc_customer usando el selectedCustomerId
    const updateCustomerRequest = {
      action: 'update',
      bd: this.database,
      table: 'dcc_customer',
      opts: {
        where: { id: this.selectedCustomerId },
        attributes: {
          name: this.customerData.name,
          email: this.customerData.email,
          phone: this.customerData.phone,
          fax: this.customerData.fax,
          postal_code: this.customerData.postal_code,
          city: this.customerData.city,
          street: this.customerData.street,
          number: this.customerData.street_number,
          state: this.customerData.state,
          country: this.customerData.country,
        },
      },
    };

    console.log('🔄 updateCustomerRequest:', updateCustomerRequest);

    this.apiService.post(updateCustomerRequest, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        console.log('✅ Update customer response:', response);
        if (response.result) {
          console.log(
            '✅ Customer updated successfully, now updating DCC reference'
          );
          // Actualizar la referencia en dcc_data
          this.updateDccDataCustomerReference(certificateNumber, false);
        } else {
          console.log('❌ Failed to update customer');
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el cliente.',
          });
        }
      },
      error: (error) => {
        console.log('❌ Error updating customer:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al actualizar el cliente.',
        });
      },
    });
  }

  // Nuevo método para guardar responsible persons
  private saveResponsiblePersons(): void {
    console.log('💾 saveResponsiblePersons() called');

    const currentData = this.dccDataService.getCurrentData();
    const certificateNumber =
      currentData.administrativeData.core.certificate_number;

    console.log('💾 certificateNumber:', certificateNumber);
    console.log('💾 responsiblePersons to save:', this.responsiblePersons);

    if (!certificateNumber) {
      console.log('❌ No certificate number found');
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No se puede guardar: Certificate Number no está definido.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: 'Guardando Personas Responsables...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Primero eliminar los registros existentes para este DCC
    const deleteExistingRequest = {
      action: 'delete',
      bd: this.database,
      table: 'dcc_responsiblepersons',
      opts: {
        where: { id_dcc: certificateNumber },
      },
    };

    this.apiService.post(deleteExistingRequest, UrlClass.URLNuevo).subscribe({
      next: (deleteResponse: any) => {
        console.log('✅ Deleted existing responsible persons:', deleteResponse);

        // Ahora insertar los nuevos registros
        this.insertResponsiblePersons(certificateNumber);
      },
      error: (error) => {
        console.log('❌ Error deleting existing responsible persons:', error);
        // Continuar con la inserción aunque falle el delete
        this.insertResponsiblePersons(certificateNumber);
      },
    });
  }

  // Método para insertar responsible persons
  private insertResponsiblePersons(certificateNumber: string): void {
    console.log('🆕 insertResponsiblePersons() called');

    if (this.responsiblePersons.length === 0) {
      // Si no hay personas responsables, terminar el proceso
      Swal.close();
      Swal.fire({
        icon: 'success',
        title: '¡Guardado!',
        text: 'Personas Responsables guardadas correctamente (sin registros)',
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
      this.editingBlocks['responsible'] = false;
      return;
    }

    // Preparar los registros para insertar
    const insertPromises: Promise<any>[] = [];

    this.responsiblePersons.forEach((person) => {
      // Obtener el no_nomina del usuario seleccionado
      let noNomina = '';
      let fullName = '';

      if (typeof person.name === 'string') {
        // Si es string, buscar en la lista de usuarios
        fullName = person.name;
        const foundUser = this.listauser.find(
          (user) => user.full_name === person.name
        );
        if (foundUser) {
          noNomina = foundUser.no_nomina;
        }
      } else if (Array.isArray(person.name) && person.name.length > 0) {
        // Si es array (multiselect), tomar el primer elemento
        const selectedUser = person.name[0];
        if (selectedUser && selectedUser.no_nomina) {
          noNomina = selectedUser.no_nomina;
          fullName = selectedUser.full_name;
        }
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
            },
          },
        };

        console.log('🆕 Inserting responsible person:', insertRequest);
        insertPromises.push(
          this.apiService.post(insertRequest, UrlClass.URLNuevo).toPromise()
        );
      } else {
        console.log('⚠️ Skipping person without no_nomina or role:', person);
      }
    });

    // Ejecutar todas las inserciones
    if (insertPromises.length > 0) {
      Promise.all(insertPromises)
        .then((responses) => {
          console.log('✅ All responsible persons inserted:', responses);
          Swal.close();

          const allSuccessful = responses.every(
            (response: any) => response.result
          );
          if (allSuccessful) {
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
              title: 'Parcialmente guardado',
              text: 'Algunas personas responsables no se pudieron guardar.',
            });
          }

          this.editingBlocks['responsible'] = false;
        })
        .catch((error) => {
          console.log('❌ Error inserting responsible persons:', error);
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al guardar las personas responsables.',
          });
        });
    } else {
      Swal.close();
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos válidos',
        text: 'No hay personas responsables válidas para guardar.',
      });
      this.editingBlocks['responsible'] = false;
    }
  }
}
