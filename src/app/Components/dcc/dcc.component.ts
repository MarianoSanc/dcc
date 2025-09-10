import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdministrativeDataComponent } from '../administrative-data/administrative-data.component';
import { ItemsComponent } from '../items/items.component';
import { StatementsComponent } from '../statements/statements.component';
import { ResultsComponent } from '../results/results.component';
import { PreviewComponent } from '../preview/preview.component';
import { FormsModule } from '@angular/forms';
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

  // Lista de DCCs existentes para el select de cargar DCC
  existingDccList: any[] = [];
  // ID seleccionado en el select de cargar DCC
  selectedDccId: string = '';
  // Controla la visualización del modal para seleccionar DCC existente
  showDccSelect: boolean = false;
  // Controla la visualización del modal para crear un nuevo DCC
  showCreateDccModal: boolean = false;

  // Variables para el modal de creación de DCC
  newDccPtId: string = '';
  newDccCertificateNumber: string = '';

  constructor(
    private apiService: ApiService,
    private dccDataService: DccDataService
  ) {}

  // Al iniciar el componente, carga la lista de DCCs existentes
  ngOnInit() {
    this.loadExistingDccList();
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
    this.showUploadModal = true;
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
    this.showDccSelect = true;
    if (this.existingDccList.length === 0) {
      this.loadExistingDccList();
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

    const getDcc = {
      action: 'get',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: this.selectedDccId },
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

        // Si tienes muchas variables, usa un solo objeto y mergea todo
        // mergedData contendrá todos los campos cargados y los que falten se completan con los defaults
        const defaultData = this.dccDataService.getCurrentData();
        const mergedData = defaultData;

        console.log('Datos del DCC cargados:', mergedData);
        console.log('Datos del DCC originales:', dccData);

        // Si necesitas personalizar algunos campos principales, hazlo aquí
        if (
          mergedData.administrativeData &&
          mergedData.administrativeData.core
        ) {
          mergedData.administrativeData.core.certificate_number = dccData.id;
          mergedData.administrativeData.core.pt_id = dccData.pt;
          mergedData.administrativeData.core.country_code = dccData.country;
          mergedData.administrativeData.core.language = dccData.language;
          mergedData.administrativeData.core.receipt_date =
            dccData.receipt_date;
          mergedData.administrativeData.core.performance_date =
            dccData.date_calibration;
          mergedData.administrativeData.core.is_range_date = dccData.date_range;
          mergedData.administrativeData.core.end_performance_date =
            dccData.date_end;
          mergedData.administrativeData.core.is_range_date = dccData.date_range;
          mergedData.administrativeData.core.is_range_date = dccData.date_range;
        }

        // Solo actualiza el servicio con el objeto completo
        this.dccDataService.loadFromObject(mergedData);

        console.log('Datos del DCC cargados en el servicio:', mergedData);

        this.showInitialOptions = false;
        this.showMainInterface = true;
        this.showDccSelect = false;
      },
      error: (err: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message || 'No se pudo cargar el DCC.',
        });
      },
    });
  }

  // Cambia la tab activa
  selectTab(tabId: string) {
    this.activeTab = tabId;
  }

  // Vuelve a la pantalla de opciones iniciales
  backToOptions() {
    this.showInitialOptions = true;
    this.showMainInterface = false;
    this.activeTab = 'administrative-data';
    this.showDccSelect = false;
    this.selectedDccId = '';
  }

  // Abre el modal para crear un nuevo DCC
  openCreateDccModal() {
    this.showCreateDccModal = true;
    this.newDccPtId = '';
    this.newDccCertificateNumber = '';
  }

  // Cierra el modal de creación de DCC
  closeCreateDccModal() {
    this.showCreateDccModal = false;
    this.newDccPtId = '';
    this.newDccCertificateNumber = '';
  }

  // Inicia un nuevo DCC con los datos ingresados en el modal
  startNewDcc() {
    this.dccDataService.resetData();
    // Asigna PT ID y Certificate Number
    const currentData = this.dccDataService.getCurrentData();
    currentData.administrativeData.core.pt_id = this.newDccPtId;
    currentData.administrativeData.core.certificate_number =
      this.newDccCertificateNumber;
    this.dccDataService.loadFromObject(currentData);

    // Prepara los atributos base para guardar en la base de datos
    let attributes: any = {
      id: this.newDccCertificateNumber,
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

    // Muestra en consola los atributos preparados
    console.log('Atributos preparados para el nuevo DCC:', createDcc);

    // Llama a la API para crear el registro en la base de datos
    this.apiService.post(createDcc, UrlClass.URLNuevo).subscribe(
      (response: any) => {
        Swal.close();
        if (response.result) {
          Swal.fire({
            icon: 'success',
            title: '¡Modificado!',
            text: 'Se ha modificado correctamente',
            timer: 2500,
            showConfirmButton: false,
            position: 'top-end',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al modificar.',
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
  }
}
