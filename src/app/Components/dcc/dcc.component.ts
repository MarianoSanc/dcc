import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdministrativeDataComponent } from '../administrative-data/administrative-data.component';
import { ItemsComponent } from '../items/items.component';
import { StatementsComponent } from '../statements/statements.component';
import { ResultsComponent } from '../results/results.component';
import { PreviewComponent } from '../preview/preview.component';
import { FormsModule } from '@angular/forms';
import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import { ApiService } from '../../api/api.service';
import { DccDataService } from '../../services/dcc-data.service';
import Swal from 'sweetalert2';
import { UrlClass } from '../../shared/models/url.model';

@Component({
  selector: 'app-dcc',
  standalone: true,
  imports: [
    CommonModule,
    AdministrativeDataComponent,
    ItemsComponent,
    StatementsComponent,
    ResultsComponent,
    PreviewComponent,
    FormsModule,
    NgMultiSelectDropDownModule,
  ],
  templateUrl: './dcc.component.html',
  styleUrl: './dcc.component.css',
})
export class DccComponent implements OnInit {
  // Controla la pantalla inicial de opciones
  showInitialOptions: boolean = true;
  // Controla la visualización de la interfaz principal (tabs)
  showMainInterface: boolean = false;
  // Controla la visualización del modal para cargar XML
  showUploadModal: boolean = false;
  // Tab activa en la interfaz principal
  activeTab: string = 'administrative-data';

  // Definición de tabs disponibles
  tabs = [
    { id: 'administrative-data', label: 'Administrative Data' },
    { id: 'items', label: 'Items' },
    { id: 'statements', label: 'Statements' },
    { id: 'results', label: 'Results' },
    { id: 'preview', label: 'Preview' },
  ];

  // Selección de base de datos (pruebas o producción)
  isTesting: boolean = false; // Definir el entorno de pruebas
  database: string = this.isTesting ? 'prueba' : 'calibraciones';
  databaseName = 'nombre_de_tu_bd'; // Cambia esto por el nombre real de tu base de datos

  // Lista de DCCs existentes para el select de cargar DCC
  existingDccList: any[] = [];
  // ID seleccionado en el select de cargar DCC
  selectedDccId: string = '';
  // Controla la visualización del modal para seleccionar DCC existente
  showDccSelect: boolean = false;
  // Controla la visualización del modal para crear un nuevo DCC
  showCreateDccModal: boolean = false;

  // Variables para el modal de creación de DCC
  newDccProjectId: any = [];
  newDccPtId: string = '';
  newDccDutNumber: number | null = null;
  generatedCertificateNumber: string = '';

  // Configuración para el multiselect de proyectos
  projectDropdownSettings = {
    singleSelection: true,
    idField: 'id',
    textField: 'name',
    selectAllText: 'Seleccionar todos',
    unSelectAllText: 'Deseleccionar todos',
    itemsShowLimit: 1,
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar proyecto...',
    noDataAvailablePlaceholderText: 'No hay proyectos disponibles',
    noFilteredDataAvailablePlaceholderText: 'No se encontraron proyectos',
    closeDropDownOnSelection: true,
    showSelectedItemsAtTop: false,
    defaultOpen: false,
  };

  @ViewChild(StatementsComponent)
  statementsComponent!: StatementsComponent;

  constructor(
    private apiService: ApiService,
    private dccDataService: DccDataService
  ) {}

  // Al iniciar el componente, carga la lista de DCCs existentes
  ngOnInit() {
    this.loadExistingDccList();
    this.loadProjects();
  }

  // Carga la lista de proyectos desde la base de datos para el modal de creación de DCC
  projects: any[] = [];
  // Optimizar la carga de proyectos para que sea más rápida
  loadProjects() {
    const requests = [
      // Request 1: Opportunity
      this.apiService.post(
        {
          action: 'get',
          bd: 'hvtest2',
          table: 'opportunity',
          opts: {
            attributes: ['id', 'name'],
            where: { deleted: 0 },
            order_by: ['created_at', 'DESC'],
          },
        },
        UrlClass.URLNuevo
      ),

      // Request 2: Opportunity Calpro
      this.apiService.post(
        {
          action: 'get',
          bd: 'hvtest2',
          table: 'opportunity_calpro',
          opts: {
            attributes: ['id', 'name'],
            where: { deleted: 0 },
            order_by: ['created_at', 'DESC'],
          },
        },
        UrlClass.URLNuevo
      ),
    ];

    // Ejecutar ambos requests en paralelo usando forkJoin para mayor velocidad
    import('rxjs').then((rxjs) => {
      rxjs.forkJoin(requests).subscribe({
        next: ([response1, response2]: any[]) => {
          const projectsPh = (response1.result || []).map((p: any) => ({
            id: p.id,
            name: p.name,
          }));

          const projectsPc = (response2.result || []).map((p: any) => ({
            id: p.id,
            name: p.name,
          }));

          this.projects = [...projectsPh, ...projectsPc];
        },
        error: (error) => {
          console.error('Error loading projects:', error);
          this.projects = []; // Fallback a array vacío
        },
      });
    });
  }

  // Inicia la creación de un nuevo DCC (pantalla principal)
  createNewDCC() {
    this.dccDataService.resetData();
    this.showInitialOptions = false;
    this.showMainInterface = true;
    this.activeTab = 'administrative-data';
  }

  // Abre el modal para cargar un archivo XML
  loadExistingDCC() {
    console.log('🔄 Loading existing DCC from XML');

    // Si hay datos en el DCC current, mostrar confirmación
    const currentData = this.dccDataService.getCurrentData();
    const hasCurrentData =
      currentData.administrativeData.core.certificate_number ||
      currentData.items.length > 0 ||
      currentData.administrativeData.responsiblePersons.some(
        (p) => p.role || p.full_name
      );

    if (hasCurrentData) {
      Swal.fire({
        title: '¿Cargar nuevo DCC?',
        text: 'Se perderán todos los cambios no guardados del DCC actual.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2196f3',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cargar nuevo',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          this.showUploadModal = true;
        }
      });
    } else {
      this.showUploadModal = true;
    }
  }

  // Cierra el modal de carga de XML
  closeUploadModal() {
    this.showUploadModal = false;
  }

  // Maneja la selección de archivo XML
  onFileSelected(event: any): void {
    this.handleFileUpload(event);
  }

  // Lógica para leer y cargar el archivo XML
  private handleFileUpload(event: any): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    if (file.type === 'text/xml' || file.name.toLowerCase().endsWith('.xml')) {
      const reader = new FileReader();

      reader.onload = (loadEvent: any) => {
        try {
          const xmlContent = loadEvent.target.result;
          this.dccDataService.loadFromXML(xmlContent);

          // Cierra el modal y muestra la interfaz principal
          this.showUploadModal = false;
          this.showInitialOptions = false;
          this.showMainInterface = true;
          this.activeTab = 'administrative-data';

          // Mensaje de éxito
          alert(
            'XML cargado exitosamente. Los datos han sido importados a todas las pestañas.'
          );
        } catch (error) {
          console.error('Error loading XML:', error);
          alert(
            'Error al cargar el archivo XML. Por favor verifica que el formato sea correcto.'
          );
        }
      };

      reader.onerror = () => {
        alert('Error al leer el archivo. Por favor intenta nuevamente.');
      };

      reader.readAsText(file);
    } else {
      alert('Por favor selecciona un archivo XML válido');
    }

    // Resetea el input
    (event.target as HTMLInputElement).value = '';
  }

  // Carga la lista de DCCs existentes solo si se muestra el select
  ngDoCheck() {
    if (this.showDccSelect && this.existingDccList.length === 0) {
      this.loadExistingDccList();
    }
  }

  // Solicita la lista de DCCs desde la base de datos (solo id y pt)
  loadExistingDccList() {
    const getDccList = {
      action: 'get',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        attributes: ['id', 'pt'],
        order_by: ['id', 'DESC'],
      },
    };
    this.apiService
      .post(getDccList, UrlClass.URLNuevo)
      .subscribe((response: any) => {
        this.existingDccList = response.result || [];
      });
  }

  // Abre el modal para seleccionar un DCC existente
  openDccSelectModal() {
    console.log('🔄 Opening DCC select modal');

    // Si hay datos en el DCC current, mostrar confirmación
    const currentData = this.dccDataService.getCurrentData();
    const hasCurrentData =
      currentData.administrativeData.core.certificate_number ||
      currentData.items.length > 0 ||
      currentData.administrativeData.responsiblePersons.some(
        (p) => p.role || p.full_name
      );

    if (hasCurrentData) {
      Swal.fire({
        title: '¿Cargar DCC existente?',
        text: 'Se perderán todos los cambios no guardados del DCC actual.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2196f3',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cargar existente',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          this.loadExistingDccList();
          this.showDccSelect = true;
        }
      });
    } else {
      this.loadExistingDccList();
      this.showDccSelect = true;
    }
  }

  // Cierra el modal de selección de DCC
  closeDccSelectModal() {
    this.showDccSelect = false;
    this.selectedDccId = '';
  }

  // Al seleccionar un DCC, busca los datos completos en la base de datos y los carga
  onSelectExistingDcc() {
    if (!this.selectedDccId) return;

    // Mostrar loading mientras se carga
    Swal.fire({
      title: 'Cargando DCC...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const getDcc = {
      action: 'get',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: this.selectedDccId },
        // Incluir id_laboratory e id_customer en los campos solicitados
        attributes: [
          'id',
          'pt',
          'country',
          'language',
          'receipt_date',
          'date_calibration',
          'date_range',
          'date_end',
          'location',
          'issue_date',
          'id_laboratory',
          'id_customer',
          'dcc_data',
        ],
      },
    };

    this.apiService.post(getDcc, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        let dccData = response.result[0];
        if (!dccData) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontraron datos completos para este DCC.',
          });
          return;
        }

        // Cargar datos adicionales (laboratorio y cliente) si existen
        this.loadAdditionalData(dccData);
      },
      error: (err: any) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message || 'No se pudo cargar el DCC.',
        });
      },
    });
  }

  // Nuevo método para cargar datos adicionales (laboratorio y cliente)
  private loadAdditionalData(dccData: any) {
    const loadTasks: Promise<any>[] = [];

    // Si hay id_laboratory, cargar datos del laboratorio
    if (dccData.id_laboratory) {
      const loadLabPromise = this.loadLaboratoryData(dccData.id_laboratory)
        .then((labData) => {
          if (labData) {
            dccData.laboratoryInfo = labData;
            console.log('🏢 Laboratory data loaded:', labData);
          }
        })
        .catch(() => {
          console.log('❌ Failed to load laboratory data');
        });
      loadTasks.push(loadLabPromise);
    }

    // Si hay id_customer, cargar datos del cliente
    if (dccData.id_customer) {
      const loadCustomerPromise = this.loadCustomerData(dccData.id_customer)
        .then((customerData) => {
          if (customerData) {
            dccData.customerInfo = customerData;
            console.log('👤 Customer data loaded:', customerData);
          }
        })
        .catch(() => {
          console.log('❌ Failed to load customer data');
        });
      loadTasks.push(loadCustomerPromise);
    }

    // Cargar datos de responsible persons para este DCC
    const loadResponsiblePromise = this.loadResponsiblePersons(dccData.id)
      .then((responsibleData) => {
        if (responsibleData && responsibleData.length > 0) {
          dccData.responsibleInfo = responsibleData;
          console.log('👥 Responsible persons data loaded:', responsibleData);
        }
      })
      .catch(() => {
        console.log('❌ Failed to load responsible persons data');
      });
    loadTasks.push(loadResponsiblePromise);

    // Cuando todas las tareas terminen, procesar los datos
    Promise.all(loadTasks).finally(() => {
      this.processDccData(dccData);
    });
  }

  // Método para cargar datos del laboratorio (convertir a Promise)
  private loadLaboratoryData(laboratoryId: string): Promise<any> {
    const getLaboratory = {
      action: 'get',
      bd: this.database,
      table: 'dcc_laboratory',
      opts: {
        where: { id: laboratoryId, deleted: 0 },
      },
    };

    return this.apiService
      .post(getLaboratory, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        return response?.result?.[0] || null;
      });
  }

  // Nuevo método para cargar datos del cliente
  private loadCustomerData(customerId: string): Promise<any> {
    const getCustomer = {
      action: 'get',
      bd: this.database,
      table: 'dcc_customer',
      opts: {
        where: { id: customerId, deleted: 0 },
      },
    };

    return this.apiService
      .post(getCustomer, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        return response?.result?.[0] || null;
      });
  }

  // Nuevo método para cargar responsible persons
  private loadResponsiblePersons(dccId: string): Promise<any> {
    const getResponsiblePersons = {
      action: 'get',
      bd: this.database,
      table: 'dcc_responsiblepersons',
      opts: {
        relationship: {
          'administracion.user': [
            'dcc_responsiblepersons.no_nomina',
            'administracion.user.no_nomina',
          ],
        },
        customSelect: `
      dcc_responsiblepersons.*,
      CONCAT(administracion.user.first_name, ' ', administracion.user.last_name) AS name
    `,
        where: { id_dcc: dccId },
        order_by: ['dcc_responsiblepersons.id', 'ASC'],
      },
    };

    return this.apiService
      .post(getResponsiblePersons, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        return response?.result || [];
      });
  }

  // Método separado para procesar los datos del DCC
  private processDccData(dccData: any) {
    Swal.close();

    let mergedData;
    if (dccData.dcc_data && typeof dccData.dcc_data === 'object') {
      mergedData = dccData.dcc_data;
    } else {
      mergedData = this.dccDataService.getCurrentData();
    }

    // Asignar los campos básicos de la base de datos
    if (mergedData.administrativeData && mergedData.administrativeData.core) {
      mergedData.administrativeData.core.certificate_number = dccData.id;
      mergedData.administrativeData.core.pt_id = dccData.pt;

      // Asignar campos básicos
      if (dccData.country)
        mergedData.administrativeData.core.country_code = dccData.country;
      if (dccData.language)
        mergedData.administrativeData.core.language = dccData.language;
      if (dccData.receipt_date)
        mergedData.administrativeData.core.receipt_date = dccData.receipt_date;
      if (dccData.date_calibration)
        mergedData.administrativeData.core.performance_date =
          dccData.date_calibration;
      if (dccData.date_range !== undefined)
        mergedData.administrativeData.core.is_range_date = Boolean(
          dccData.date_range
        );
      if (dccData.date_end)
        mergedData.administrativeData.core.end_performance_date =
          dccData.date_end;
      if (dccData.location)
        mergedData.administrativeData.core.performance_localition =
          dccData.location;
      if (dccData.issue_date)
        mergedData.administrativeData.core.issue_date = dccData.issue_date;

      // Asignar datos del laboratorio si existen
      if (dccData.laboratoryInfo) {
        const labInfo = dccData.laboratoryInfo;
        mergedData.administrativeData.laboratory = {
          name: labInfo.name || '',
          email: labInfo.email || '',
          phone: labInfo.phone || '',
          fax: labInfo.fax || '',
          postal_code: labInfo.postal_code || '',
          city: labInfo.city || '',
          street: labInfo.street || '',
          street_number: labInfo.number || '',
          state: labInfo.state || '',
          country: labInfo.country || '',
          laboratory_id: dccData.id_laboratory,
        };
      }

      // Asignar datos del cliente si existen
      if (dccData.customerInfo) {
        const custInfo = dccData.customerInfo;
        mergedData.administrativeData.customer = {
          name: custInfo.name || '',
          email: custInfo.email || '',
          phone: custInfo.phone || '',
          fax: custInfo.fax || '',
          postal_code: custInfo.postal_code || '',
          city: custInfo.city || '',
          street: custInfo.street || '',
          street_number: custInfo.number || '',
          state: custInfo.state || '',
          country: custInfo.country || '',
          customer_id: dccData.id_customer,
        };

        console.log(
          '🔗 Setting customer ID from DCC data:',
          dccData.id_customer
        );
      } else if (dccData.id_customer) {
        // Si tenemos ID pero no datos del cliente, al menos asignar el ID
        mergedData.administrativeData.customer.customer_id =
          dccData.id_customer;
        console.log(
          '🔗 Setting customer ID only (no additional data):',
          dccData.id_customer
        );
      }

      console.log('🔍dccData.responsibleInfo', dccData.responsibleInfo);

      // Asignar datos de responsible persons si existen
      if (dccData.responsibleInfo && dccData.responsibleInfo.length > 0) {
        mergedData.administrativeData.responsiblePersons =
          dccData.responsibleInfo.map((person: any) => ({
            role: person.role || '',
            no_nomina: person.no_nomina || '',
            name: person.name || '',
            full_name: person.name || '', // Usar el nombre de la BD como full_name
            email: '', // Los datos adicionales del usuario se cargarán después si es necesario
            phone: '',
            mainSigner: Boolean(person.main), // Mapear el campo 'main' desde la BD
          }));

        console.log(
          '👥 Setting responsible persons from database:',
          dccData.responsibleInfo
        );
      }
    }

    console.log('✅ Final merged data:', mergedData);

    this.dccDataService.loadFromObject(mergedData);

    this.showInitialOptions = false;
    this.showMainInterface = true;
    this.showDccSelect = false;
  }

  // Cambia la tab activa
  selectTab(tabId: string) {
    this.activeTab = tabId;
  }

  // Método actualizado para volver a las opciones iniciales y limpiar todo
  backToOptions(): void {
    // Mostrar confirmación antes de limpiar todo
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Se perderán todos los cambios no guardados del DCC actual.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f44336',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, volver',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        console.log('🔄 User confirmed - proceeding with cleanup');

        // Limpiar completamente el servicio DCC
        this.cleanupDccData();

        // Limpiar variables del componente
        this.cleanupComponentData();

        // Volver a la pantalla inicial
        this.showMainInterface = false;
        this.showInitialOptions = true;
        this.activeTab = 'administrative-data';

        console.log('🔄 Successfully returned to initial options');
        console.log('🔄 === backToOptions DEBUG END ===');

        // Mostrar mensaje de confirmación
        Swal.fire({
          icon: 'success',
          title: 'Limpieza completada',
          text: 'Todos los datos han sido limpiados correctamente.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
      } else {
        console.log('🔄 User cancelled - staying in current view');
      }
    });
  }

  // Nuevo método para limpiar completamente los datos del DCC
  private cleanupDccData(): void {
    console.log('🧹 === cleanupDccData DEBUG START ===');
    console.log('🧹 Resetting DCC data service to initial state');

    // Resetear el servicio DCC a su estado inicial
    this.dccDataService.resetData();

    console.log('🧹 DCC data service reset completed');
    console.log('🧹 === cleanupDccData DEBUG END ===');
  }

  // Nuevo método para limpiar las variables del componente
  private cleanupComponentData(): void {
    console.log('🧹 === cleanupComponentData DEBUG START ===');

    // Limpiar variables de creación de DCC
    this.newDccProjectId = [];
    this.newDccPtId = '';
    this.newDccDutNumber = null;
    this.generatedCertificateNumber = '';

    // Limpiar variables de selección de DCC
    this.selectedDccId = '';
    this.existingDccList = [];

    // Limpiar estado de modales
    this.showCreateDccModal = false;
    this.showDccSelect = false;
    this.showUploadModal = false;

    console.log('🧹 Component variables cleaned:');
    console.log('  - newDccProjectId:', this.newDccProjectId);
    console.log('  - newDccPtId:', this.newDccPtId);
    console.log('  - newDccDutNumber:', this.newDccDutNumber);
    console.log('  - selectedDccId:', this.selectedDccId);
    console.log('🧹 === cleanupComponentData DEBUG END ===');
  }

  // Abre el modal para crear un nuevo DCC
  openCreateDccModal(): void {
    console.log('🔄 Opening create DCC modal');

    // Si hay datos en el DCC actual, mostrar confirmación
    const currentData = this.dccDataService.getCurrentData();
    const hasCurrentData =
      currentData.administrativeData.core.certificate_number ||
      currentData.items.length > 0 ||
      currentData.administrativeData.responsiblePersons.some(
        (p) => p.role || p.full_name
      );

    if (hasCurrentData) {
      Swal.fire({
        title: '¿Crear nuevo DCC?',
        text: 'Se perderán todos los cambios no guardados del DCC actual.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2196f3',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, crear nuevo',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          this.loadProjects();
          this.showCreateDccModal = true;
        }
      });
    } else {
      this.loadProjects();
      this.showCreateDccModal = true;
    }
  }

  // Cierra el modal de creación de DCC
  closeCreateDccModal() {
    this.showCreateDccModal = false;
    this.newDccProjectId = [];
    this.newDccPtId = '';
    this.newDccDutNumber = null;
    this.generatedCertificateNumber = '';
  }

  // Maneja la selección de proyecto
  onProjectSelect(item: any) {
    console.log('Proyecto seleccionado:', item);
    this.newDccProjectId = [item]; // Asegurar que sea un array con un solo elemento
    this.updateCertificateNumber();
  }

  // Maneja la deselección de proyecto
  onProjectDeselect(item: any) {
    console.log('Proyecto deseleccionado:', item);
    this.newDccProjectId = [];
    this.updateCertificateNumber();
  }

  // Actualiza el número de certificado generado
  updateCertificateNumber() {
    const projectId =
      this.newDccProjectId && this.newDccProjectId.length > 0
        ? this.newDccProjectId[0].id
        : '';

    if (
      projectId &&
      this.newDccPtId &&
      this.newDccDutNumber &&
      this.newDccDutNumber > 0
    ) {
      const ptNumber = this.newDccPtId.replace('PT-', '');
      const dutFormatted = this.newDccDutNumber.toString().padStart(2, '0');
      this.generatedCertificateNumber = `${projectId} DCC ${ptNumber} ${dutFormatted}`;
    } else {
      this.generatedCertificateNumber = '';
    }
  }

  // Inicia un nuevo DCC con los datos ingresados en el modal
  startNewDcc() {
    const projectId =
      this.newDccProjectId && this.newDccProjectId.length > 0
        ? this.newDccProjectId[0].id
        : '';

    if (!projectId || !this.newDccPtId || !this.newDccDutNumber) {
      return;
    }

    this.dccDataService.resetData();
    // Asigna PT ID y Certificate Number
    const currentData = this.dccDataService.getCurrentData();
    currentData.administrativeData.core.pt_id = this.newDccPtId;
    currentData.administrativeData.core.certificate_number =
      this.generatedCertificateNumber;
    this.dccDataService.loadFromObject(currentData);

    // Prepara los atributos base para guardar en la base de datos
    let attributes: any = {
      id: this.generatedCertificateNumber,
      pt: this.newDccPtId,
    };

    const createDcc = {
      action: 'create',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        attributes: attributes,
      },
    };

    console.log('Atributos preparados para el nuevo DCC:', createDcc);

    this.apiService.post(createDcc, UrlClass.URLNuevo).subscribe(
      (response: any) => {
        Swal.close();
        if (response.result) {
          Swal.fire({
            icon: 'success',
            title: '¡DCC Creado!',
            text: `Se ha creado el DCC ${this.generatedCertificateNumber} correctamente`,
            timer: 2500,
            showConfirmButton: false,
            position: 'top-end',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al crear el DCC.',
          });
        }
      },
      (error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición.',
        });
      }
    );

    this.showInitialOptions = false;
    this.showMainInterface = true;
    this.activeTab = 'administrative-data';
    this.closeCreateDccModal();

    this.statementsComponent?.loadStatementsFromDatabase(this.databaseName);
  }
}
