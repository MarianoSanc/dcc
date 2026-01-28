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
import { OrderService } from '../../services/order.service';
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
  // Variable para guardar el modo de operación actual
  operationMode: 'create' | 'load' | 'xml' | null = null;
  // Tipo de documento: 'DCC' o 'IE'
  documentType: 'DCC' | 'IE' = 'DCC';
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
  // Opciones y selección para cargar por proyecto existente
  loadProjectOptions: any[] = [];
  loadSelectedProjects: any[] = [];
  loadCertificatesForProject: any[] = [];
  // Controla la visualización del modal para crear un nuevo DCC
  showCreateDccModal: boolean = false;
  // Controla la visualización del modal para crear un nuevo IE
  showCreateIeModal: boolean = false;

  // Variables para el modal de creación de DCC
  newDccProjectId: any = [];
  newDccPtId: string = '';
  newDccDutNumber: number | null = null;
  generatedCertificateNumber: string = '';

  // Variables para el modal de creación de IE
  newIeProjectId: any = [];
  newIePtId: string = '';
  newIeDutNumber: number | null = null;
  generatedIeCertificateNumber: string = '';

  // Variables comunes para fechas de DCC
  dccLocation: string = '';
  dccLocationAddress: string = ''; // Dirección del Performance Location
  dccReceiptDate: string = '';
  dccCalibrationDate: string = '';
  dccIsRangeDate: boolean = false;
  dccEndDate: string = '';

  // Variables comunes para fechas de IE
  ieLocation: string = '';
  ieLocationAddress: string = ''; // Dirección del Performance Location
  ieReceiptDate: string = '';
  ieTestDate: string = '';
  ieIsRangeDate: boolean = false;
  ieEndDate: string = '';

  ptOptions: string[] = [
    'PT-05',
    'PT-08',
    'PT-14',
    'PT-23',
    'PT-24',
    'PT-25',
    'PT-33',
    'PT-36',
    'PT-37',
    'PT-38',
    'PT-39',
    'PT-40',
    'PT-41',
    'PT-42',
    'PT-43',
    'PT-45',
  ];

  // Datos de certificados generados desde dutServices
  dccCertificatesList: any[] = []; // Lista de certificados para DCC
  ieCertificatesList: any[] = []; // Lista de certificados para IE
  dccCurrentDutService: any = null; // DutService actual seleccionado para DCC
  ieCurrentDutService: any = null; // DutService actual seleccionado para IE
  dccAccountId: string | null = null; // Account ID del proyecto DCC (de opportunity_calpro)
  ieAccountId: string | null = null; // Account ID del proyecto IE (de opportunity)
  dccSelectedCertificateIndex: number = -1; // Índice del certificado seleccionado para DCC
  ieSelectedCertificateIndex: number = -1; // Índice del certificado seleccionado para IE
  dccSelectedCertificate: any = null; // Certificado seleccionado para mostrar detalles (DCC)
  ieSelectedCertificate: any = null; // Certificado seleccionado para mostrar detalles (IE)

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
    private dccDataService: DccDataService,
    private orderService: OrderService,
  ) {}

  /**
   * Extrae el ID del usuario de la URL
   * Ejemplo: http://192.168.1.200:81/DCC/view?id=63c704bfb9c9d8482
   * Retorna: 63c704bfb9c9d8482
   */
  private getUserIdFromUrl(): string {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    return userId || '';
  }

  /**
   * Obtiene el account_id desde la tabla opportunity_calpro (para DCC)
   * @param projectId ID del proyecto seleccionado
   * @returns Promise con el account_id
   */
  private getAccountIdFromOpportunityCalpro(
    projectId: string,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const getOpportunity = {
        action: 'get',
        bd: 'hvtest2',
        table: 'opportunity_calpro',
        opts: {
          where: { id: projectId },
          attributes: ['account_id'],
        },
      };

      this.apiService.post(getOpportunity, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const opportunity = response?.result?.[0];
          const accountId = opportunity?.account_id || null;
          console.log('🏛️ Account ID from opportunity_calpro:', accountId);
          resolve(accountId);
        },
        error: (error) => {
          console.error('❌ Error loading opportunity_calpro:', error);
          resolve(null);
        },
      });
    });
  }

  /**
   * Obtiene el account_id desde la tabla opportunity (para IE)
   * @param projectId ID del proyecto seleccionado
   * @returns Promise con el account_id
   */
  private getAccountIdFromOpportunity(
    projectId: string,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const getOpportunity = {
        action: 'get',
        bd: 'hvtest2',
        table: 'opportunity',
        opts: {
          where: { id: projectId },
          attributes: ['account_id'],
        },
      };

      this.apiService.post(getOpportunity, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const opportunity = response?.result?.[0];
          const accountId = opportunity?.account_id || null;
          console.log('🏛️ Account ID from opportunity:', accountId);
          resolve(accountId);
        },
        error: (error) => {
          console.error('❌ Error loading opportunity:', error);
          resolve(null);
        },
      });
    });
  }

  // Al iniciar el componente, carga la lista de DCCs existentes
  ngOnInit() {
    this.loadExistingDccList();
    // Suscribirse a cambios en el certificate_number para detectar tipo automáticamente
    this.dccDataService.dccData$.subscribe((data) => {
      this.detectDocumentType(data.administrativeData.core.certificate_number);
    });
  }

  // Método para detectar automáticamente si es DCC o IE basándose en el certificate_number
  private detectDocumentType(certificateNumber: string): void {
    if (!certificateNumber) {
      return; // No hacer nada si no hay número de certificado
    }

    if (certificateNumber.includes(' DCC ')) {
      this.documentType = 'DCC';
    } else if (certificateNumber.includes(' IE ')) {
      this.documentType = 'IE';
    } else if (certificateNumber.includes(' CC ')) {
      // Formato antiguo CC también es DCC
      this.documentType = 'DCC';
    }
  }

  // Carga la lista de proyectos desde la base de datos para el modal de creación de DCC
  projects: any[] = [];
  // Método flexible para cargar proyectos según el tipo (dcc, ie, o ambos)
  loadProjects(type: 'dcc' | 'ie' | 'both' = 'both') {
    let requests: any[] = [];

    if (type === 'dcc' || type === 'both') {
      // Request para opportunity_calpro (para DCC)
      requests.push(
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
          UrlClass.URLNuevo,
        ),
      );
    }

    if (type === 'ie' || type === 'both') {
      // Request para opportunity (para IE)
      requests.push(
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
          UrlClass.URLNuevo,
        ),
      );
    }

    // Ejecutar requests en paralelo usando forkJoin para mayor velocidad
    import('rxjs').then((rxjs) => {
      rxjs.forkJoin(requests).subscribe({
        next: (responses: any[]) => {
          let combinedProjects: any[] = [];

          if (type === 'dcc') {
            // Solo oportunidades Calpro (para DCC)
            combinedProjects = (responses[0]?.result || []).map((p: any) => ({
              id: p.id,
              name: p.name,
            }));
          } else if (type === 'ie') {
            // Solo oportunidades normales (para IE)
            combinedProjects = (responses[0]?.result || []).map((p: any) => ({
              id: p.id,
              name: p.name,
            }));
          } else if (type === 'both') {
            // Ambos tipos
            const projectsDcc = (responses[0]?.result || []).map((p: any) => ({
              id: p.id,
              name: p.name,
            }));

            const projectsIe = (responses[1]?.result || []).map((p: any) => ({
              id: p.id,
              name: p.name,
            }));

            combinedProjects = [...projectsDcc, ...projectsIe];
          }

          this.projects = combinedProjects;
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
    this.operationMode = 'create';
    this.dccDataService.resetData();
    this.showInitialOptions = false;
    this.showMainInterface = true;
    this.activeTab = 'administrative-data';
  }

  // Abre el modal para cargar un archivo XML
  loadExistingDCC() {
    this.operationMode = 'xml';
    // Si hay datos en el DCC current, mostrar confirmación
    const currentData = this.dccDataService.getCurrentData();
    const hasCurrentData =
      currentData.administrativeData.core.certificate_number ||
      currentData.items.length > 0 ||
      currentData.administrativeData.responsiblePersons.some(
        (p) => p.role || p.full_name,
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
            'XML cargado exitosamente. Los datos han sido importados a todas las pestañas.',
          );
        } catch (error) {
          console.error('Error loading XML:', error);
          alert(
            'Error al cargar el archivo XML. Por favor verifica que el formato sea correcto.',
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
        this.buildLoadProjectOptions();
      });
  }

  // Construye la lista de proyectos únicos a partir de los IDs de certificado
  private buildLoadProjectOptions() {
    const projectMap = new Map<string, any>();

    this.existingDccList.forEach((dcc: any) => {
      const projectKey = this.getProjectPrefix(dcc.id);
      if (projectKey && !projectMap.has(projectKey)) {
        projectMap.set(projectKey, { id: projectKey, name: projectKey });
      }
    });

    this.loadProjectOptions = Array.from(projectMap.values());
  }

  // Obtiene el prefijo del ID (antes del primer espacio)
  private getProjectPrefix(certificateId: string): string {
    if (!certificateId) return '';
    const parts = certificateId.split(' ');
    return parts.length > 0 ? parts[0] : '';
  }

  // Actualiza los certificados disponibles para el proyecto seleccionado
  private updateCertificatesForSelectedProject() {
    const selectedProject = this.loadSelectedProjects?.[0]?.id;

    if (!selectedProject) {
      this.loadCertificatesForProject = [];
      this.selectedDccId = '';
      return;
    }

    this.loadCertificatesForProject = this.existingDccList
      .filter((dcc: any) => this.getProjectPrefix(dcc.id) === selectedProject)
      .map((dcc: any) => ({
        id: dcc.id,
        pt: dcc.pt,
        display: dcc.id,
      }))
      .sort((a: any, b: any) => {
        // Extraer los dos últimos números del certificado (ej: "PC0497-00 DCC 45 14" -> 45, 14)
        const partsA = a.display.split(' ');
        const partsB = b.display.split(' ');

        const lastNumA = parseInt(partsA[partsA.length - 1]) || 0;
        const lastNumB = parseInt(partsB[partsB.length - 1]) || 0;
        const penultimateA = parseInt(partsA[partsA.length - 2]) || 0;
        const penultimateB = parseInt(partsB[partsB.length - 2]) || 0;

        // Ordenar primero por el último número
        if (lastNumA !== lastNumB) {
          return lastNumA - lastNumB;
        }

        // Si el último número es igual, ordenar por el penúltimo
        return penultimateA - penultimateB;
      });

    this.selectedDccId = '';
  }

  onLoadProjectSelect() {
    this.updateCertificatesForSelectedProject();
  }

  onLoadProjectDeselect() {
    this.updateCertificatesForSelectedProject();
  }

  // Abre el modal para seleccionar un DCC existente
  openDccSelectModal() {
    this.operationMode = 'load';
    this.loadSelectedProjects = [];
    this.loadCertificatesForProject = [];
    this.selectedDccId = '';
    // Si hay datos en el DCC current, mostrar confirmación
    const currentData = this.dccDataService.getCurrentData();
    const hasCurrentData =
      currentData.administrativeData.core.certificate_number ||
      currentData.items.length > 0 ||
      currentData.administrativeData.responsiblePersons.some(
        (p) => p.role || p.full_name,
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
    this.loadSelectedProjects = [];
    this.loadCertificatesForProject = [];
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
          'next_calibration',
          'accredited',
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
          }
        })
        .catch(() => {});
      loadTasks.push(loadLabPromise);
    }

    // Cargar customer desde dcc_data.id_customer -> hvtest2.account
    if (dccData.id_customer) {
      const loadCustomerPromise = this.loadCustomerData(dccData.id_customer)
        .then((customerData) => {
          if (customerData) {
            dccData.customerInfo = customerData;
          }
        })
        .catch(() => {});
      loadTasks.push(loadCustomerPromise);
    }

    // Cargar datos de responsible persons para este DCC
    const loadResponsiblePromise = this.loadResponsiblePersons(dccData.id)
      .then((responsibleData) => {
        if (responsibleData && responsibleData.length > 0) {
          dccData.responsibleInfo = responsibleData;
        }
      })
      .catch(() => {});
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

  // Nuevo método para cargar datos del cliente desde hvtest2.account
  private loadCustomerData(customerId: string): Promise<any> {
    const getCustomer = {
      action: 'get',
      bd: 'hvtest2',
      table: 'account',
      opts: {
        where: { id: customerId, deleted: 0 },
      },
    };

    return this.apiService
      .post(getCustomer, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        const account = response?.result?.[0];
        if (account) {
          // Mapear campos de account al formato de customer
          return {
            name: account.name || '',
            email: '', // Se cargará después si es necesario
            phone: '', // Se cargará después si es necesario
            street: account.billing_address_street || '',
            city: account.billing_address_city || '',
            state: account.billing_address_state || '',
            country: account.billing_address_country || '',
            postal_code: account.billing_address_postalcode || '',
            fax: '',
            number: '',
          };
        }
        return null;
      });
  }

  // Nuevo método para cargar responsible persons
  private loadResponsiblePersons(dccId: string): Promise<any> {
    const getResponsiblePersons = {
      action: 'get',
      bd: this.database,
      table: 'dcc_responsiblepersons',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
        order_by: ['id', 'ASC'],
      },
    };

    return this.apiService
      .post(getResponsiblePersons, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        const responsibleData = response?.result || [];

        // Si hay datos, cargar usuarios para mapear nombres
        if (responsibleData.length > 0) {
          return this.loadUsersForMapping(responsibleData);
        }
        return responsibleData;
      })
      .catch((error) => {
        console.error('Error en loadResponsiblePersons:', error);
        return [];
      });
  }

  // Nuevo método para cargar usuarios y mapear con responsible persons
  private loadUsersForMapping(responsibleData: any[]): Promise<any[]> {
    const getUsersQuery = {
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

    return this.apiService
      .post(getUsersQuery, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        const rawUsers = Array.isArray(response?.result) ? response.result : [];

        // Mapear usuarios para tener el formato esperado
        const users = rawUsers.map((user: any) => ({
          no_nomina: user.no_nomina,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email || '',
          phone: user.telefono || '',
        }));

        // Mapear responsible persons con datos de usuarios
        const mapped = responsibleData.map((person: any) => {
          const foundUser = users.find(
            (u: any) => String(u.no_nomina) === String(person.no_nomina),
          );
          return {
            ...person,
            user_name: foundUser ? foundUser.name : null,
            user_email: foundUser ? foundUser.email : null,
            user_phone: foundUser ? foundUser.phone : null,
          };
        });
        return mapped;
      })
      .catch((error) => {
        console.error('Error en loadUsersForMapping:', error);
        // Si falla cargar usuarios, devolver datos sin mapear
        return responsibleData;
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
          dccData.date_range,
        );
      if (dccData.date_end)
        mergedData.administrativeData.core.end_performance_date =
          dccData.date_end;
      if (dccData.location)
        mergedData.administrativeData.core.performance_localition =
          dccData.location;
      if (dccData.issue_date)
        mergedData.administrativeData.core.issue_date = dccData.issue_date;
      if (dccData.next_calibration)
        mergedData.administrativeData.core.next_calibration =
          dccData.next_calibration;
      if (dccData.accredited !== undefined)
        mergedData.administrativeData.core.accredited = Boolean(
          dccData.accredited,
        );

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
      } else if (dccData.id_customer) {
        // Si tenemos ID pero no datos del cliente, al menos asignar el ID
        mergedData.administrativeData.customer.customer_id =
          dccData.id_customer;
      }

      // Asignar datos de responsible persons si existen
      if (dccData.responsibleInfo && dccData.responsibleInfo.length > 0) {
        mergedData.administrativeData.responsiblePersons =
          dccData.responsibleInfo.map((person: any) => {
            return {
              role: person.role || '',
              no_nomina: person.no_nomina || '',
              name: person.user_name || person.no_nomina || '',
              full_name: person.user_name || person.no_nomina || '',
              email: person.user_email || '',
              phone: person.user_phone || '',
              mainSigner: Boolean(person.main),
              head: Boolean(person.head),
              coordinator: Boolean(person.coordinator),
            };
          });
      }
    }

    // Cargar todos los datos de items en paralelo
    Promise.all([
      this.loadMainItemData(dccData.id),
      this.loadSubItems(dccData.id),
    ])
      .then(([mainItemData, subItems]) => {
        // Procesar Main Item Data
        if (mainItemData) {
          // Asegurar que el array de items existe
          if (!mergedData.items || mergedData.items.length === 0) {
            mergedData.items = [
              {
                id: 'main_item',
                name: '',
                manufacturer: '',
                model: '',
                serialNumber: '',
                customerAssetId: '',
                identifications: [],
                itemQuantities: [],
                subItems: [],
              },
            ];
          }

          // Mapear datos del main item desde la BD
          mergedData.items[0] = {
            ...mergedData.items[0],
            name: mainItemData.object || '',
            manufacturer: mainItemData.manufacturer || '',
            model: mainItemData.model || '',
            serialNumber: mainItemData.serial_number || '',
            customerAssetId: mainItemData.costumer_asset || '',
            comment: mainItemData.comment || '',
          };
        } else {
          // Asegurar que al menos existe un item vacío
          if (!mergedData.items || mergedData.items.length === 0) {
            mergedData.items = [
              {
                id: 'main_item',
                name: '',
                manufacturer: '',
                model: '',
                serialNumber: '',
                customerAssetId: '',
                comment: '',
                identifications: [],
                itemQuantities: [],
                subItems: [],
              },
            ];
          }
        }

        // Procesar Object Identifications Groups
        // Eliminado: objectGroups y mergedData.objectIdentifications

        // Procesar SubItems
        if (subItems && subItems.length > 0) {
          // Mapear SubItems desde la BD (sin identificadores)
          mergedData.items[0].subItems = subItems.map((subItem: any) => ({
            id: `subitem_${subItem.id}`,
            dbId: subItem.id,
            name: subItem.description || '',
            manufacturer: subItem.manufacturer || '',
            model: subItem.model || '',
            identifiers: [],
          }));
        }
        // Cargar los datos (con o sin subitems)
        this.dccDataService.loadFromObject(mergedData);
        this.showInitialOptions = false;
        this.showMainInterface = true;
        this.showDccSelect = false;
      })
      .catch((error) => {
        console.error('❌ Error loading item data:', error);
        // Aún así cargar los datos administrativos sin los items
        this.dccDataService.loadFromObject(mergedData);
        this.showInitialOptions = false;
        this.showMainInterface = true;
        this.showDccSelect = false;
      });
  }

  // Nuevo método para cargar datos del main item
  private loadMainItemData(dccId: string): Promise<any> {
    const getMainItem = {
      action: 'get',
      bd: this.database,
      table: 'dcc_item',
      opts: {
        where: { id_dcc: dccId },
        limit: 1,
      },
    };

    return this.apiService
      .post(getMainItem, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        return response?.result?.[0] || null;
      })
      .catch((error) => {
        console.error('❌ Error loading main item:', error);
        return null;
      });
  }

  // Nuevo método para cargar SubItems
  private loadSubItems(dccId: string): Promise<any[]> {
    const getSubItems = {
      action: 'get',
      bd: this.database,
      table: 'dcc_subitem',
      opts: {
        where: { id_dcc: dccId },
        order_by: ['id_item', 'ASC'],
      },
    };

    return this.apiService
      .post(getSubItems, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        return response?.result || [];
      })
      .catch((error) => {
        console.error('❌ Error loading subitems:', error);
        return [];
      });
  }

  // Cambia la tab activa
  selectTab(tabId: string) {
    this.activeTab = tabId;
  }

  // Navega al siguiente step/tab
  nextStep() {
    const currentIndex = this.tabs.findIndex(
      (tab) => tab.id === this.activeTab,
    );
    if (currentIndex < this.tabs.length - 1) {
      this.activeTab = this.tabs[currentIndex + 1].id;
      // Scroll al inicio de la página
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Navega al step/tab anterior
  previousStep() {
    const currentIndex = this.tabs.findIndex(
      (tab) => tab.id === this.activeTab,
    );
    if (currentIndex > 0) {
      this.activeTab = this.tabs[currentIndex - 1].id;
      // Scroll al inicio de la página
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        // Limpiar completamente el servicio DCC
        this.cleanupDccData();

        // Limpiar variables del componente
        this.cleanupComponentData();

        // Volver a la pantalla inicial
        this.showMainInterface = false;
        this.showInitialOptions = true;
        this.activeTab = 'administrative-data';

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
      }
    });
  }

  // Nuevo método para limpiar completamente los datos del DCC
  private cleanupDccData(): void {
    // Resetear el servicio DCC a su estado inicial
    this.dccDataService.resetData();
  }

  // Nuevo método para limpiar las variables del componente
  private cleanupComponentData(): void {
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
  }

  // Abre el modal para crear un nuevo DCC
  openCreateDccModal(): void {
    // Si hay datos en el DCC actual, mostrar confirmación
    const currentData = this.dccDataService.getCurrentData();
    const hasCurrentData =
      currentData.administrativeData.core.certificate_number ||
      currentData.items.length > 0 ||
      currentData.administrativeData.responsiblePersons.some(
        (p) => p.role || p.full_name,
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
          this.documentType = 'DCC';
          this.loadProjects('dcc');
          this.showCreateDccModal = true;
        }
      });
    } else {
      this.documentType = 'DCC';
      this.loadProjects('dcc');
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
    this.dccCertificatesList = [];
    this.dccSelectedCertificateIndex = -1;
    this.dccCurrentDutService = null;
    this.dccSelectedCertificate = null;
    // Limpiar campos de fecha y location
    this.dccLocation = '';
    this.dccLocationAddress = '';
    this.dccReceiptDate = '';
    this.dccCalibrationDate = '';
    this.dccIsRangeDate = false;
    this.dccEndDate = '';
  }

  // Abre el modal para crear un nuevo IE
  openCreateIeModal(): void {
    // Si hay datos en el IE actual, mostrar confirmación
    const currentData = this.dccDataService.getCurrentData();
    const hasCurrentData =
      currentData.administrativeData.core.certificate_number ||
      currentData.items.length > 0 ||
      currentData.administrativeData.responsiblePersons.some(
        (p) => p.role || p.full_name,
      );

    if (hasCurrentData) {
      Swal.fire({
        title: '¿Crear nuevo IE?',
        text: 'Se perderán todos los cambios no guardados del IE actual.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2196f3',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, crear nuevo',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          this.documentType = 'IE';
          this.loadProjects('ie');
          this.showCreateIeModal = true;
        }
      });
    } else {
      this.documentType = 'IE';
      this.loadProjects('ie');
      this.showCreateIeModal = true;
    }
  }

  // Cierra el modal de creación de IE
  closeCreateIeModal() {
    this.showCreateIeModal = false;
    this.newIeProjectId = [];
    this.newIePtId = '';
    this.newIeDutNumber = null;
    this.generatedIeCertificateNumber = '';
    this.ieCertificatesList = [];
    this.ieSelectedCertificateIndex = -1;
    this.ieCurrentDutService = null;
    this.ieSelectedCertificate = null;
    // Limpiar campos de fecha y location
    this.ieLocation = '';
    this.ieLocationAddress = '';
    this.ieReceiptDate = '';
    this.ieTestDate = '';
    this.ieIsRangeDate = false;
    this.ieEndDate = '';
  }

  /**
   * Maneja el cambio de Performance Location para DCC
   * Carga la dirección correspondiente según la selección
   */
  onDccLocationChange() {
    this.dccLocationAddress = ''; // Limpiar dirección anterior

    if (!this.dccLocation) {
      return;
    }

    if (this.dccLocation === 'Customer') {
      // Obtener dirección del customer (account_id)
      if (this.dccAccountId) {
        this.loadAddressFromCustomer(this.dccAccountId).then((address) => {
          this.dccLocationAddress = address;
        });
      }
    } else if (this.dccLocation === 'Laboratory') {
      // Obtener dirección del laboratorio (id_laboratory = 1)
      this.loadAddressFromLaboratory(1).then((address) => {
        this.dccLocationAddress = address;
      });
    } else if (this.dccLocation === 'Other') {
      // Obtener location del proyecto (opportunity_calpro)
      const projectId = this.newDccProjectId?.[0]?.id;
      if (projectId) {
        this.loadLocationFromOpportunityCalpro(projectId).then((location) => {
          this.dccLocationAddress = location;
        });
      }
    }
  }

  /**
   * Maneja el cambio de Performance Location para IE
   * Carga la dirección correspondiente según la selección
   */
  onIeLocationChange() {
    this.ieLocationAddress = ''; // Limpiar dirección anterior

    if (!this.ieLocation) {
      return;
    }

    if (this.ieLocation === 'Customer') {
      // Obtener dirección del customer (account_id)
      if (this.ieAccountId) {
        this.loadAddressFromCustomer(this.ieAccountId).then((address) => {
          this.ieLocationAddress = address;
        });
      }
    } else if (this.ieLocation === 'Laboratory') {
      // Obtener dirección del laboratorio (id_laboratory = 1)
      this.loadAddressFromLaboratory(1).then((address) => {
        this.ieLocationAddress = address;
      });
    } else if (this.ieLocation === 'Other') {
      // Obtener location del proyecto (opportunity)
      const projectId = this.newIeProjectId?.[0]?.id;
      if (projectId) {
        this.loadLocationFromOpportunity(projectId).then((location) => {
          this.ieLocationAddress = location;
        });
      }
    }
  }

  /**
   * Carga la dirección de un customer desde hvtest2.account
   */
  private loadAddressFromCustomer(customerId: string): Promise<string> {
    return new Promise((resolve) => {
      const getCustomer = {
        action: 'get',
        bd: 'hvtest2',
        table: 'account',
        opts: {
          where: { id: customerId, deleted: 0 },
        },
      };

      this.apiService.post(getCustomer, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const account = response?.result?.[0];
          if (account) {
            const addressParts: string[] = [];

            if (account.billing_address_street)
              addressParts.push(account.billing_address_street);
            if (account.billing_address_city)
              addressParts.push(account.billing_address_city);
            if (account.billing_address_state)
              addressParts.push(account.billing_address_state);
            if (account.billing_address_postalcode)
              addressParts.push(account.billing_address_postalcode);
            if (account.billing_address_country)
              addressParts.push(account.billing_address_country);

            const address =
              addressParts.join(', ') || 'No hay dirección disponible';
            resolve(address);
          } else {
            resolve('Customer no encontrado');
          }
        },
        error: (error) => {
          console.error('❌ Error loading customer address:', error);
          resolve('Error al cargar dirección');
        },
      });
    });
  }

  /**
   * Carga la dirección de un laboratorio desde dcc_laboratory
   */
  private loadAddressFromLaboratory(laboratoryId: number): Promise<string> {
    return new Promise((resolve) => {
      const getLaboratory = {
        action: 'get',
        bd: this.database,
        table: 'dcc_laboratory',
        opts: {
          where: { id: laboratoryId, deleted: 0 },
        },
      };

      this.apiService.post(getLaboratory, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const laboratory = response?.result?.[0];
          if (laboratory) {
            const addressParts: string[] = [];

            if (laboratory.street) addressParts.push(laboratory.street);
            if (laboratory.number) addressParts.push(laboratory.number);
            if (laboratory.city) addressParts.push(laboratory.city);
            if (laboratory.state) addressParts.push(laboratory.state);
            if (laboratory.postal_code)
              addressParts.push(laboratory.postal_code);
            if (laboratory.country) addressParts.push(laboratory.country);

            const address =
              addressParts.join(', ') || 'No hay dirección disponible';
            resolve(address);
          } else {
            resolve('Laboratory no encontrado');
          }
        },
        error: (error) => {
          console.error('❌ Error loading laboratory address:', error);
          resolve('Error al cargar dirección');
        },
      });
    });
  }

  /**
   * Carga el location desde opportunity_calpro para DCC
   */
  private loadLocationFromOpportunityCalpro(
    projectId: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      const getOpportunity = {
        action: 'get',
        bd: 'hvtest2',
        table: 'opportunity_calpro',
        opts: {
          where: { id: projectId },
          attributes: ['location'],
        },
      };

      this.apiService.post(getOpportunity, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const opportunity = response?.result?.[0];
          const location =
            opportunity?.location || 'No hay ubicación disponible';
          resolve(location);
        },
        error: (error) => {
          console.error('❌ Error loading opportunity location:', error);
          resolve('Error al cargar ubicación');
        },
      });
    });
  }

  /**
   * Carga el location desde opportunity para IE
   */
  private loadLocationFromOpportunity(projectId: string): Promise<string> {
    return new Promise((resolve) => {
      const getOpportunity = {
        action: 'get',
        bd: 'hvtest2',
        table: 'opportunity',
        opts: {
          where: { id: projectId },
          attributes: ['location'],
        },
      };

      this.apiService.post(getOpportunity, UrlClass.URLNuevo).subscribe({
        next: (response: any) => {
          const opportunity = response?.result?.[0];
          const location =
            opportunity?.location || 'No hay ubicación disponible';
          resolve(location);
        },
        error: (error) => {
          console.error('❌ Error loading opportunity location:', error);
          resolve('Error al cargar ubicación');
        },
      });
    });
  }

  /**
   * Genera una lista de certificados desde los DUT Services
   * - Ordena los DUT Services por id
   * - Numera consecutivamente del 1 al n
   * - Si un DUT tiene múltiples PTs (PT-24, PT-44), crea un certificado por cada PT
   * - Si PT está vacío, no incluye nada entre DCC y el número
   * Formato: {projectId}-00 {DCC|IE} {ptNumber} {contador} o {projectId}-00 {DCC|IE} {contador} si PT está vacío
   * Ejemplo: PC0497-00 DCC 24 01, PC0497-00 DCC 44 01 (con PT)
   * Ejemplo: PC0497-00 DCC 01 (sin PT)
   */
  private generateCertificatesFromDutServices(
    projectId: string,
    dutServices: any[],
    documentType: 'DCC' | 'IE',
  ): any[] {
    if (!dutServices || dutServices.length === 0) {
      console.warn('⚠️ NO DUT SERVICES PROVIDED');
      return [];
    }

    // Ordenar dutServices por id
    const sortedDutServices = [...dutServices].sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idA - idB;
    });

    const certificates: any[] = [];

    sortedDutServices.forEach((dut, index) => {
      // Número consecutivo del 1 al n
      const counter = (index + 1).toString().padStart(2, '0');

      // El PT puede tener múltiples valores separados por comas: "PT-24, PT-44"
      // O puede tener otros valores que no sean PT-XX
      const ptString = dut.pt || '';
      let ptList = ptString
        .split(',')
        .map((pt: string) => pt.trim())
        .filter((pt: string) => pt.length > 0);

      // Si no hay PTs, crear certificado sin PT
      if (ptList.length === 0) {
        console.warn('⚠️ DUT SERVICE WITHOUT PT, CREATING WITHOUT PT:', dut);
        const certificateName = `${projectId}-00 ${documentType} ${counter}`;
        certificates.push({
          name: certificateName,
          dutService: dut,
          pt: '',
          counter: counter,
        });
        return;
      }

      // Crear un certificado por cada PT
      ptList.forEach((pt: string) => {
        // Extraer el número: si es "PT-24" obtiene "24", si es "Calibración" obtiene "Calibración"
        const ptNumber = pt.replace(/^PT-/, ''); // Remover "PT-" solo si existe
        const certificateName = `${projectId}-00 ${documentType} ${ptNumber} ${counter}`;

        certificates.push({
          name: certificateName,
          dutService: dut,
          pt: pt,
          counter: counter,
        });
      });
    });

    console.log('✅ GENERATED CERTIFICATES:', certificates);
    return certificates;
  }

  // Maneja la selección de proyecto
  onProjectSelect(item: any) {
    this.newDccProjectId = [item]; // Asegurar que sea un array con un solo elemento
    console.log('🎯 PROJECT SELECTED (DCC):', item.id, item);

    // Cargar account_id desde opportunity_calpro
    this.getAccountIdFromOpportunityCalpro(item.id).then((accountId) => {
      this.dccAccountId = accountId;
      console.log('💼 DCC Account ID guardado:', this.dccAccountId);
    });

    // Cargar servicios y DUT services de la BD orden
    this.orderService.loadProjectData(item.id).then(
      (data) => {
        console.log('📊 PROJECT DATA LOADED:', {
          projectId: item.id,
          services: data.services,
          dutServices: data.dutServices,
        });

        // Generar lista de certificados desde dutServices
        this.dccCertificatesList = this.generateCertificatesFromDutServices(
          item.id,
          data.dutServices,
          'DCC',
        );
      },
      (error) => {
        console.error('❌ ERROR LOADING PROJECT DATA:', error);
      },
    );

    this.updateCertificateNumber();
  }

  // Maneja la deselección de proyecto
  onProjectDeselect(item: any) {
    this.newDccProjectId = [];
    this.updateCertificateNumber();
  }

  // Maneja la selección de proyecto para IE
  onIeProjectSelect(item: any) {
    this.newIeProjectId = [item]; // Asegurar que sea un array con un solo elemento
    console.log('🎯 PROJECT SELECTED (IE):', item.id, item);

    // Cargar account_id desde opportunity
    this.getAccountIdFromOpportunity(item.id).then((accountId) => {
      this.ieAccountId = accountId;
      console.log('💼 IE Account ID guardado:', this.ieAccountId);
    });

    // Cargar servicios y DUT services de la BD orden
    this.orderService.loadProjectData(item.id).then(
      (data) => {
        console.log('📊 PROJECT DATA LOADED:', {
          projectId: item.id,
          services: data.services,
          dutServices: data.dutServices,
        });

        // Generar lista de certificados desde dutServices
        this.ieCertificatesList = this.generateCertificatesFromDutServices(
          item.id,
          data.dutServices,
          'IE',
        );
      },
      (error) => {
        console.error('❌ ERROR LOADING PROJECT DATA:', error);
      },
    );

    this.updateIeCertificateNumber();
  }

  /**
   * Maneja la selección de un certificado desde la lista generada
   * Carga los datos del DUT Service seleccionado
   */
  onDccCertificateSelect(index: number) {
    if (index < 0 || index >= this.dccCertificatesList.length) {
      return;
    }

    const certificate = this.dccCertificatesList[index];
    console.log('🎯 DCC CERTIFICATE SELECTED:', certificate.name);
    console.log('📋 DUT SERVICE DATA:', certificate.dutService);

    this.dccCurrentDutService = certificate.dutService;
    this.newDccPtId = certificate.pt;
    this.newDccDutNumber = parseInt(certificate.counter);
    this.dccSelectedCertificate = certificate; // Guardar certificado seleccionado

    // Actualizar el nombre del certificado
    this.generatedCertificateNumber = certificate.name;
    console.log('✅ DCC CERTIFICATE DATA LOADED:', {
      name: certificate.name,
      pt: certificate.pt,
      dutNumber: certificate.counter,
      dutService: certificate.dutService,
    });
  }

  /**
   * Maneja la selección de un certificado para IE
   */
  onIeCertificateSelect(index: number) {
    if (index < 0 || index >= this.ieCertificatesList.length) {
      return;
    }

    const certificate = this.ieCertificatesList[index];
    console.log('🎯 IE CERTIFICATE SELECTED:', certificate.name);
    console.log('📋 DUT SERVICE DATA:', certificate.dutService);

    this.ieCurrentDutService = certificate.dutService;
    this.newIePtId = certificate.pt;
    this.newIeDutNumber = parseInt(certificate.counter);
    this.ieSelectedCertificate = certificate; // Guardar certificado seleccionado

    // Actualizar el nombre del certificado
    this.generatedIeCertificateNumber = certificate.name;
    console.log('✅ IE CERTIFICATE DATA LOADED:', {
      name: certificate.name,
      pt: certificate.pt,
      dutNumber: certificate.counter,
      dutService: certificate.dutService,
    });
  }

  // Maneja la deselección de proyecto para IE
  onIeProjectDeselect(item: any) {
    this.newIeProjectId = [];
    this.updateIeCertificateNumber();
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
      this.generatedCertificateNumber = `${projectId}-00 DCC ${ptNumber} ${dutFormatted}`;
    } else {
      this.generatedCertificateNumber = '';
    }
  }

  // Actualiza el número de certificado para IE
  updateIeCertificateNumber() {
    const projectId =
      this.newIeProjectId && this.newIeProjectId.length > 0
        ? this.newIeProjectId[0].id
        : '';

    if (
      projectId &&
      this.newIePtId &&
      this.newIeDutNumber &&
      this.newIeDutNumber > 0
    ) {
      const ptNumber = this.newIePtId.replace('PT-', '');
      const dutFormatted = this.newIeDutNumber.toString().padStart(2, '0');
      this.generatedIeCertificateNumber = `${projectId}-00 IE ${ptNumber} ${dutFormatted}`;
    } else {
      this.generatedIeCertificateNumber = '';
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

    // Mostrar loading mientras se crean los registros
    Swal.fire({
      title: 'Creando DCC...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

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

    const createItem = {
      action: 'create',
      bd: this.database,
      table: 'dcc_item',
      opts: {
        attributes: {
          id_dcc: this.generatedCertificateNumber,
        },
      },
    };

    // Crear primero el DCC y luego el item
    this.apiService.post(createDcc, UrlClass.URLNuevo).subscribe({
      next: (dccResponse: any) => {
        if (dccResponse.result) {
          // Si el DCC se creó exitosamente, crear el item
          this.apiService.post(createItem, UrlClass.URLNuevo).subscribe({
            next: (itemResponse: any) => {
              Swal.close();

              if (itemResponse.result) {
                Swal.fire({
                  icon: 'success',
                  title: '¡DCC Creado!',
                  text: `Se ha creado el DCC ${this.generatedCertificateNumber} correctamente con su item asociado`,
                  timer: 2500,
                  showConfirmButton: false,
                  position: 'top-end',
                });

                // Proceder a la interfaz principal
                this.proceedToMainInterface();
              } else {
                Swal.fire({
                  icon: 'warning',
                  title: 'DCC Creado Parcialmente',
                  text: 'El DCC se creó pero hubo un problema al crear el item asociado.',
                });

                // Proceder a la interfaz principal de todos modos
                this.proceedToMainInterface();
              }
            },
            error: (itemError) => {
              Swal.close();
              console.error('❌ Error al crear item:', itemError);
              Swal.fire({
                icon: 'warning',
                title: 'DCC Creado Parcialmente',
                text: 'El DCC se creó pero hubo un error al crear el item asociado.',
              });

              // Proceder a la interfaz principal de todos modos
              this.proceedToMainInterface();
            },
          });
        } else {
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al crear el DCC.',
          });
        }
      },
      error: (dccError) => {
        Swal.close();
        console.error('❌ Error al crear DCC:', dccError);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición para crear el DCC.',
        });
      },
    });
  }

  /**
   * Crea múltiples DCC basados en la lista de certificados cargados
   * Se ejecuta cuando el usuario selecciona crear todos los certificados
   */
  startNewDccMultiple() {
    const projectId =
      this.newDccProjectId && this.newDccProjectId.length > 0
        ? this.newDccProjectId[0].id
        : '';

    if (
      !projectId ||
      !this.dccCertificatesList ||
      this.dccCertificatesList.length === 0
    ) {
      Swal.fire({
        icon: 'warning',
        title: 'Validación',
        text: 'Debe seleccionar un proyecto y tener certificados disponibles.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: `Creando ${this.dccCertificatesList.length} DCC...`,
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    console.log('📋 INICIANDO CREACIÓN DE MÚLTIPLES DCC');
    console.log('📌 Proyecto:', projectId);
    console.log('📌 Certificados a crear:', this.dccCertificatesList.length);
    console.log('� Fechas comunes para todos los certificados:', {
      receipt_date: this.dccReceiptDate || 'No definida',
      date_calibration: this.dccCalibrationDate || 'No definida',
      date_range: this.dccIsRangeDate,
      date_end: this.dccEndDate || 'No definida',
    });
    console.log('�📋 Datos de certificados:', this.dccCertificatesList);

    // Array para almacenar las promesas de creación
    const creationPromises: Promise<any>[] = [];

    // Por cada certificado, crear un DCC
    this.dccCertificatesList.forEach((certificate, index) => {
      console.log(
        `📌 Creando DCC ${index + 1}/${this.dccCertificatesList.length}:`,
        certificate.name,
      );

      const ptNumber = certificate.pt;
      const dutService = certificate.dutService;

      // Usar el account_id cargado previamente desde opportunity_calpro
      const idContact = this.dccAccountId;

      // Obtener el user ID de la URL
      const createdBy = this.getUserIdFromUrl();

      // Datos que se guardarán para cada DCC
      const attributes: any = {
        id: certificate.name, // Certificate Number
        pt: ptNumber, // PT ID
        sw_name: 'DCC Generator', // Software name
        sw_version: '1.0.2', // Software version
        sw_type: 'application', // Software type
        country: 'MX', // Country code
        language: 'en', // Language
        id_laboratory: 1, // Laboratory ID (fijo)
      };

      // Agregar id_customer si existe
      if (idContact) {
        attributes.id_customer = idContact;
      }

      // Agregar created_by si existe
      if (createdBy) {
        attributes.created_by = createdBy;
      }

      // Agregar location si está definido
      if (this.dccLocation) {
        attributes.location = this.dccLocation;
      }
      // Agregar campos de fecha si están definidos
      if (this.dccReceiptDate) {
        attributes.receipt_date = this.dccReceiptDate;
      }
      if (this.dccCalibrationDate) {
        attributes.date_calibration = this.dccCalibrationDate;
        // Calcular next_calibration como date_calibration + 1 año
        const calibrationDate = new Date(this.dccCalibrationDate);
        const nextCalibrationDate = new Date(calibrationDate);
        nextCalibrationDate.setFullYear(nextCalibrationDate.getFullYear() + 1);
        attributes.next_calibration = nextCalibrationDate
          .toISOString()
          .split('T')[0];
        console.log(
          `📅 Next Calibration calculada: ${this.dccCalibrationDate} + 1 año = ${attributes.next_calibration}`,
        );
      }
      if (this.dccIsRangeDate) {
        attributes.date_range = 1;
      } else {
        attributes.date_range = 0;
      }
      if (this.dccEndDate && this.dccIsRangeDate) {
        attributes.date_end = this.dccEndDate;
      }

      console.log(`✅ Atributos para ${certificate.name}:`, {
        certificate_number: certificate.name,
        pt_id: ptNumber,
        dut_service_id: dutService.id,
        description: dutService.description,
        serial_number: dutService.serial_number,
        calibration_interval: dutService.calibration_interval,
      });

      const createDcc = {
        action: 'create',
        bd: this.database,
        table: 'dcc_data',
        opts: {
          attributes: attributes,
        },
      };

      // Crear promesa para este DCC
      const promise = this.apiService
        .post(createDcc, UrlClass.URLNuevo)
        .toPromise()
        .then((dccResponse: any) => {
          console.log(`✅ DCC ${certificate.name} creado exitosamente`);
          console.log('DCC Response:', dccResponse);

          // Crear el item asociado con todos los campos requeridos
          const createItem = {
            action: 'create',
            bd: this.database,
            table: 'dcc_item',
            opts: {
              attributes: {
                id_dcc: certificate.name,
                object: dutService.description || '',
                serial_number: dutService.serial_number || '',
              },
            },
          };

          console.log(
            `📝 Creando item para DCC ${certificate.name}:`,
            createItem,
          );

          return this.apiService
            .post(createItem, UrlClass.URLNuevo)
            .toPromise()
            .then((itemResponse: any) => {
              console.log(
                `✅ Item para DCC ${certificate.name} creado exitosamente`,
              );
              console.log('Item Response:', itemResponse);
              return { dcc: dccResponse, item: itemResponse };
            })
            .catch((itemError: any) => {
              console.error(
                `❌ Error creando item para DCC ${certificate.name}:`,
                itemError,
              );
              throw itemError;
            });
        })
        .catch((error) => {
          console.error(`❌ Error creando DCC ${certificate.name}:`, error);
          throw error;
        });

      creationPromises.push(promise);
    });

    // Ejecutar todas las creaciones en paralelo
    Promise.all(creationPromises)
      .then((results) => {
        Swal.close();
        console.log('✅ TODOS LOS DCC CREADOS EXITOSAMENTE');
        console.log('Resultados finales:', results);

        Swal.fire({
          icon: 'success',
          title: '¡DCC Creados!',
          text: `Se han creado ${this.dccCertificatesList.length} DCC correctamente`,
          timer: 2500,
          showConfirmButton: false,
        });

        // Cerrar modal y refrescar lista
        this.closeCreateDccModal();
        this.loadExistingDccList();
      })
      .catch((error) => {
        Swal.close();
        console.error('❌ Error en la creación de DCC:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema al crear los DCC. Revisa la consola para más detalles.',
        });
      });
  }

  // Inicia un nuevo IE con los datos ingresados en el modal
  startNewIe() {
    const projectId =
      this.newIeProjectId && this.newIeProjectId.length > 0
        ? this.newIeProjectId[0].id
        : '';

    if (!projectId || !this.newIePtId || !this.newIeDutNumber) {
      return;
    }

    this.dccDataService.resetData();
    // Asigna PT ID y Certificate Number
    const currentData = this.dccDataService.getCurrentData();
    currentData.administrativeData.core.pt_id = this.newIePtId;
    currentData.administrativeData.core.certificate_number =
      this.generatedIeCertificateNumber;
    this.dccDataService.loadFromObject(currentData);

    // Mostrar loading mientras se crean los registros
    Swal.fire({
      title: 'Creando IE...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Prepara los atributos base para guardar en la base de datos
    let attributes: any = {
      id: this.generatedIeCertificateNumber,
      pt: this.newIePtId,
    };

    const createIe = {
      action: 'create',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        attributes: attributes,
      },
    };

    const createItem = {
      action: 'create',
      bd: this.database,
      table: 'dcc_item',
      opts: {
        attributes: {
          id_dcc: this.generatedIeCertificateNumber,
        },
      },
    };

    // Crear primero el IE y luego el item
    this.apiService.post(createIe, UrlClass.URLNuevo).subscribe({
      next: (ieResponse: any) => {
        if (ieResponse.result) {
          // Si el IE se creó exitosamente, crear el item
          this.apiService.post(createItem, UrlClass.URLNuevo).subscribe({
            next: (itemResponse: any) => {
              Swal.close();

              if (itemResponse.result) {
                Swal.fire({
                  icon: 'success',
                  title: '¡IE Creado!',
                  text: `Se ha creado el IE ${this.generatedIeCertificateNumber} correctamente con su item asociado`,
                  timer: 2500,
                  showConfirmButton: false,
                  position: 'top-end',
                });

                // Proceder a la interfaz principal
                this.proceedToMainInterfaceIe();
              } else {
                Swal.fire({
                  icon: 'warning',
                  title: 'IE Creado Parcialmente',
                  text: 'El IE se creó pero hubo un problema al crear el item asociado.',
                });

                // Proceder a la interfaz principal de todos modos
                this.proceedToMainInterfaceIe();
              }
            },
            error: (itemError) => {
              Swal.close();
              console.error('❌ Error al crear item:', itemError);
              Swal.fire({
                icon: 'warning',
                title: 'IE Creado Parcialmente',
                text: 'El IE se creó pero hubo un error al crear el item asociado.',
              });

              // Proceder a la interfaz principal de todos modos
              this.proceedToMainInterfaceIe();
            },
          });
        } else {
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al crear el IE.',
          });
        }
      },
      error: (ieError) => {
        Swal.close();
        console.error('❌ Error al crear IE:', ieError);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición para crear el IE.',
        });
      },
    });
  }

  /**
   * Crea múltiples IE basados en la lista de certificados cargados
   * Se ejecuta cuando el usuario selecciona crear todos los certificados
   */
  startNewIeMultiple() {
    const projectId =
      this.newIeProjectId && this.newIeProjectId.length > 0
        ? this.newIeProjectId[0].id
        : '';

    if (
      !projectId ||
      !this.ieCertificatesList ||
      this.ieCertificatesList.length === 0
    ) {
      Swal.fire({
        icon: 'warning',
        title: 'Validación',
        text: 'Debe seleccionar un proyecto y tener certificados disponibles.',
      });
      return;
    }

    // Mostrar loading
    Swal.fire({
      title: `Creando ${this.ieCertificatesList.length} IE...`,
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    console.log('📋 INICIANDO CREACIÓN DE MÚLTIPLES IE');
    console.log('📌 Proyecto:', projectId);
    console.log('📌 Certificados a crear:', this.ieCertificatesList.length);
    console.log('� Fechas comunes para todos los certificados:', {
      receipt_date: this.ieReceiptDate || 'No definida',
      date_calibration: this.ieTestDate || 'No definida',
      date_range: this.ieIsRangeDate,
      date_end: this.ieEndDate || 'No definida',
    });
    console.log('�📋 Datos de certificados:', this.ieCertificatesList);

    // Array para almacenar las promesas de creación
    const creationPromises: Promise<any>[] = [];

    // Por cada certificado, crear un IE
    this.ieCertificatesList.forEach((certificate, index) => {
      console.log(
        `📌 Creando IE ${index + 1}/${this.ieCertificatesList.length}:`,
        certificate.name,
      );

      const ptNumber = certificate.pt;
      const dutService = certificate.dutService;

      // Usar el account_id cargado previamente desde opportunity
      const idContact = this.ieAccountId;

      // Obtener el user ID de la URL
      const createdBy = this.getUserIdFromUrl();

      // Datos que se guardarán para cada IE
      const attributes: any = {
        id: certificate.name, // Certificate Number
        pt: ptNumber, // PT ID
        sw_name: 'IE Generator', // Software name
        sw_version: '1.0.2', // Software version
        sw_type: 'application', // Software type
        country: 'MX', // Country code
        language: 'en', // Language
        id_laboratory: 1, // Laboratory ID (fijo)
      };

      // Agregar id_customer si existe
      if (idContact) {
        attributes.id_customer = idContact;
      }

      // Agregar created_by si existe
      if (createdBy) {
        attributes.created_by = createdBy;
      }

      // Agregar location si está definido
      if (this.ieLocation) {
        attributes.location = this.ieLocation;
      }
      // Agregar campos de fecha si están definidos
      if (this.ieReceiptDate) {
        attributes.receipt_date = this.ieReceiptDate;
      }
      if (this.ieTestDate) {
        attributes.date_calibration = this.ieTestDate;
        // IE no tiene next_calibration (se guarda vacío)
      }
      if (this.ieIsRangeDate) {
        attributes.date_range = 1;
      } else {
        attributes.date_range = 0;
      }
      if (this.ieEndDate && this.ieIsRangeDate) {
        attributes.date_end = this.ieEndDate;
      }

      console.log(`✅ Atributos para ${certificate.name}:`, {
        certificate_number: certificate.name,
        pt_id: ptNumber,
        dut_service_id: dutService.id,
        description: dutService.description,
        serial_number: dutService.serial_number,
        calibration_interval: dutService.calibration_interval,
      });

      const createIe = {
        action: 'create',
        bd: this.database,
        table: 'dcc_data',
        opts: {
          attributes: attributes,
        },
      };

      // Crear promesa para este IE
      const promise = this.apiService
        .post(createIe, UrlClass.URLNuevo)
        .toPromise()
        .then((ieResponse: any) => {
          console.log(`✅ IE ${certificate.name} creado exitosamente`);
          console.log('IE Response:', ieResponse);

          // Crear el item asociado con todos los campos requeridos
          const createItem = {
            action: 'create',
            bd: this.database,
            table: 'dcc_item',
            opts: {
              attributes: {
                id_dcc: certificate.name,
                object: dutService.description || '',
                serial_number: dutService.serial_number || '',
              },
            },
          };

          console.log(
            `📝 Creando item para IE ${certificate.name}:`,
            createItem,
          );

          return this.apiService
            .post(createItem, UrlClass.URLNuevo)
            .toPromise()
            .then((itemResponse: any) => {
              console.log(
                `✅ Item para IE ${certificate.name} creado exitosamente`,
              );
              console.log('Item Response:', itemResponse);
              return { ie: ieResponse, item: itemResponse };
            })
            .catch((itemError: any) => {
              console.error(
                `❌ Error creando item para IE ${certificate.name}:`,
                itemError,
              );
              throw itemError;
            });
        })
        .catch((error) => {
          console.error(`❌ Error creando IE ${certificate.name}:`, error);
          throw error;
        });

      creationPromises.push(promise);
    });

    // Ejecutar todas las creaciones en paralelo
    Promise.all(creationPromises)
      .then((results) => {
        Swal.close();
        console.log('✅ TODOS LOS IE CREADOS EXITOSAMENTE');
        console.log('Resultados finales:', results);

        Swal.fire({
          icon: 'success',
          title: '¡IE Creados!',
          text: `Se han creado ${this.ieCertificatesList.length} IE correctamente`,
          timer: 2500,
          showConfirmButton: false,
        });

        // Cerrar modal y refrescar lista
        this.closeCreateIeModal();
        this.loadExistingDccList();
      })
      .catch((error) => {
        Swal.close();
        console.error('❌ Error en la creación de IE:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema al crear los IE. Revisa la consola para más detalles.',
        });
      });
  }

  // Método auxiliar para proceder a la interfaz principal
  private proceedToMainInterface() {
    this.showInitialOptions = false;
    this.showMainInterface = true;
    this.activeTab = 'administrative-data';
    this.closeCreateDccModal();

    // Cargar statements desde la base de datos si el componente está disponible
    if (this.statementsComponent) {
      this.statementsComponent.loadStatementsFromDatabase(this.databaseName);
    }
  }

  // Método auxiliar para proceder a la interfaz principal desde IE
  private proceedToMainInterfaceIe() {
    this.showInitialOptions = false;
    this.showMainInterface = true;
    this.activeTab = 'administrative-data';
    this.closeCreateIeModal();

    // Cargar statements desde la base de datos si el componente está disponible
    if (this.statementsComponent) {
      this.statementsComponent.loadStatementsFromDatabase(this.databaseName);
    }
  }
}
