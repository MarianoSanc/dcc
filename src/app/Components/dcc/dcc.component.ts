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
  // Variable para guardar el modo de operación actual
  operationMode: 'create' | 'load' | 'xml' | null = null;
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
    this.operationMode = 'load';
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
            (u: any) => String(u.no_nomina) === String(person.no_nomina)
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
            };
          });
      }
    }

    // Cargar todos los datos de items en paralelo
    Promise.all([
      this.loadMainItemData(dccData.id),
      this.loadObjectIdentificationGroups(dccData.id),
      this.loadSubItems(dccData.id),
    ])
      .then(([mainItemData, objectGroups, subItems]) => {
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
                identifications: [],
                itemQuantities: [],
                subItems: [],
              },
            ];
          }
        }

        // Procesar Object Identifications Groups
        if (objectGroups && objectGroups.length > 0) {
          mergedData.objectIdentifications = objectGroups.map(
            (group: any, index: number) => ({
              id: `group_${group.id}`,
              groupId: `group_${index + 1}`,
              groupName: group.name || `Grupo ${index + 1}`,
              groupIndex: index,
              assignedMeasurementRange: {
                label: 'Rated voltage',
                value: group.range_voltage || '',
                unit: '\\volt',
              },
              assignedScaleFactor: {
                label: 'Scale factor',
                value: group.scale_factor || '',
                unit: '\\one',
              },
              ratedFrequency: {
                label: 'Rated Frequency',
                value: group.rated_frequency || '',
                unit: '\\one',
              },
            })
          );
        } else {
        }

        // Procesar SubItems
        if (subItems && subItems.length > 0) {
          // Mapear SubItems desde la BD
          const subItemPromises = subItems.map((subItem: any) => {
            return this.loadSubItemIdentifiers(subItem.id).then(
              (identifiers: any[]) => {
                return {
                  id: `subitem_${subItem.id}`,
                  dbId: subItem.id,
                  name: subItem.description || '',
                  manufacturer: subItem.manufacturer || '',
                  model: subItem.model || '',
                  identifiers: identifiers,
                };
              }
            );
          });

          Promise.all(subItemPromises).then((subItemsWithIdentifiers) => {
            mergedData.items[0].subItems = subItemsWithIdentifiers;
            // Cargar los datos con los identificadores
            this.dccDataService.loadFromObject(mergedData);
            this.showInitialOptions = false;
            this.showMainInterface = true;
            this.showDccSelect = false;
          });
        } else {
          // Sin subItems, cargar datos directamente
          this.dccDataService.loadFromObject(mergedData);
          this.showInitialOptions = false;
          this.showMainInterface = true;
          this.showDccSelect = false;
        }
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

  // Nuevo método para cargar Object Identification Groups
  private loadObjectIdentificationGroups(dccId: string): Promise<any[]> {
    const getObjectGroups = {
      action: 'get',
      bd: this.database,
      table: 'dcc_item_config',
      opts: {
        where: { id_dcc: dccId },
        order_by: ['id_item', 'ASC'],
      },
    };

    return this.apiService
      .post(getObjectGroups, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        return response?.result || [];
      })
      .catch((error) => {
        console.error('❌ Error loading object groups:', error);
        return [];
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

  // Nuevo método para cargar identificadores de un subitem desde dcc_subitem_identificador
  private loadSubItemIdentifiers(subItemId: number): Promise<any[]> {
    const getIdentifiers = {
      action: 'get',
      bd: this.database,
      table: 'dcc_subitem_identificador',
      opts: {
        where: {
          id_subitem: subItemId,
          deleted: 0,
        },
        order_by: ['id', 'ASC'],
      },
    };

    return this.apiService
      .post(getIdentifiers, UrlClass.URLNuevo)
      .toPromise()
      .then((response: any) => {
        const identifiers = response?.result || [];
        return identifiers.map((id: any) => ({
          id: id.id,
          name: id.name || '',
          value: id.value || '',
        }));
      })
      .catch((error) => {
        console.error('Error loading subitem identifiers:', error);
        return [];
      });
  }

  // Método auxiliar para crear identifications desde subitem de BD
  private createIdentificationsFromSubItem(subItem: any): any[] {
    const identifications: any[] = [];

    // Serial Number
    if (subItem.serial_number && subItem.serial_number.trim() !== '') {
      identifications.push({
        issuer: 'Manufacturer',
        name: 'Serial Number',
        value: subItem.serial_number,
        selectedOption: {
          issuer: 'Manufacturer',
          name: 'Serial Number',
          saveAs: 'identification',
        },
      });
    }

    // Customer Asset
    if (subItem.costumer_asset && subItem.costumer_asset.trim() !== '') {
      identifications.push({
        issuer: 'Customer',
        name: "Customer's asset ID",
        value: subItem.costumer_asset,
        selectedOption: {
          issuer: 'Customer',
          name: "Customer's asset ID",
          saveAs: 'identification',
        },
      });
    }

    return identifications;
  }

  // Método auxiliar para crear quantities desde subitem de BD
  private createQuantitiesFromSubItem(subItem: any): any[] {
    const quantities: any[] = [];

    // Rated Voltage
    if (subItem.rated_voltage && subItem.rated_voltage.trim() !== '') {
      quantities.push({
        refType: 'hv_ratedVoltage',
        name: 'Rated voltage',
        value: subItem.rated_voltage,
        unit: '\\volt',
        selectedOption: {
          issuer: 'Manufacturer',
          name: 'Rated voltage',
          saveAs: 'itemQuantity',
          unit: '\\volt',
        },
        originalIssuer: 'Manufacturer',
        saveAs: 'itemQuantity',
      });
    }

    // Length
    if (subItem.length && subItem.length.trim() !== '') {
      quantities.push({
        refType: 'basic_length',
        name: 'Length',
        value: subItem.length,
        unit: '\\meter',
        selectedOption: {
          issuer: 'Manufacturer',
          name: 'Length',
          saveAs: 'itemQuantity',
          unit: '\\meter',
        },
        originalIssuer: 'Manufacturer',
        saveAs: 'itemQuantity',
      });
    }

    return quantities;
  }

  // Cambia la tab activa
  selectTab(tabId: string) {
    this.activeTab = tabId;
  }

  // Navega al siguiente step/tab
  nextStep() {
    const currentIndex = this.tabs.findIndex(
      (tab) => tab.id === this.activeTab
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
      (tab) => tab.id === this.activeTab
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
    this.newDccProjectId = [item]; // Asegurar que sea un array con un solo elemento
    this.updateCertificateNumber();
  }

  // Maneja la deselección de proyecto
  onProjectDeselect(item: any) {
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
      this.generatedCertificateNumber = `${projectId}-00 DCC ${ptNumber} ${dutFormatted}`;
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
}
