import { Component, OnInit, OnDestroy } from '@angular/core';
import { Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import { Subscription } from 'rxjs';
import {
  NgMultiSelectDropDownModule,
  IDropdownSettings,
} from 'ng-multiselect-dropdown';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule, NgMultiSelectDropDownModule],
  templateUrl: './results.component.html',
  styleUrl: './results.component.css',
})
export class ResultsComponent implements OnInit, OnDestroy {
  logResults() {
    return '';
  }
  /**
   * Mapea el bloque de Results desde el XML al formato esperado por el componente
   * @param xmlData Objeto parseado del XML
   */
  loadResultsFromXml(xmlData: any) {
    const resultsBlock =
      xmlData?.['dcc:measurementResults']?.['dcc:measurementResult']?.[
        'dcc:results'
      ]?.['dcc:result'];

    if (!resultsBlock) {
      this.results = [];
      return;
    }

    const resultsArray = Array.isArray(resultsBlock)
      ? resultsBlock
      : [resultsBlock];

    this.results = resultsArray.map((res: any) => {
      const name = this.getText(res?.['dcc:name']);
      const refType = res?.['@refType'] || res?.['refType'] || '';
      // Data block
      let data: any[] = [];
      const dataBlock = res?.['dcc:data'];
      if (dataBlock?.['dcc:list']?.['dcc:quantity']) {
        // Lista de quantities
        const quantities = dataBlock['dcc:list']['dcc:quantity'];
        const qtyArray = Array.isArray(quantities) ? quantities : [quantities];
        data = qtyArray.map((qty: any) => {
          const qtyName = this.getText(qty?.['dcc:name']);
          const qtyRefType = qty?.['@refType'] || qty?.['refType'] || '';
          // RealListXMLList
          const realList = qty?.['si:realListXMLList'] || {};
          const valueXMLList = this.getText(realList?.['si:valueXMLList']);
          const unitXMLList = this.getText(realList?.['si:unitXMLList']);
          // Measurement Uncertainty
          let measurementUncertainty;
          if (
            realList?.['si:measurementUncertaintyUnivariateXMLList']?.[
              'si:expandedMUXMLList'
            ]
          ) {
            const mu =
              realList['si:measurementUncertaintyUnivariateXMLList'][
                'si:expandedMUXMLList'
              ];
            measurementUncertainty = {
              expandedMU: {
                valueExpandedMUXMLList: this.getText(
                  mu?.['si:valueExpandedMUXMLList'],
                ),
                coverageFactorXMLList: this.getText(
                  mu?.['si:coverageFactorXMLList'],
                ),
                coverageProbabilityXMLList: this.getText(
                  mu?.['si:coverageProbabilityXMLList'],
                ),
              },
            };
          }
          return {
            name: qtyName,
            refType: qtyRefType,
            dataType: 'realListXMLList',
            valueXMLList,
            unitXMLList,
            measurementUncertainty,
          };
        });
      } else if (dataBlock?.['dcc:quantity']) {
        // Un solo quantity
        const qty = dataBlock['dcc:quantity'];
        const qtyName = this.getText(qty?.['dcc:name']);
        const qtyRefType = qty?.['@refType'] || qty?.['refType'] || '';
        const real = qty?.['si:real'] || {};
        const value = this.getText(real?.['si:value']);
        const unit = this.getText(real?.['si:unit']);
        data = [
          {
            name: qtyName,
            refType: qtyRefType,
            dataType: 'real',
            value,
            unit,
          },
        ];
      }
      return {
        name,
        refType,
        data,
      };
    });
  }
  /**
   * Mapea el bloque de Measuring Equipments desde el XML al formato esperado por el componente
   * @param xmlData Objeto parseado del XML
   */
  loadMeasuringEquipmentsFromXml(xmlData: any) {
    const equipmentsBlock =
      xmlData?.['dcc:measurementResults']?.['dcc:measurementResult']?.[
        'dcc:measuringEquipments'
      ]?.['dcc:measuringEquipment'];

    if (!equipmentsBlock) {
      this.measuringEquipments = [];
      return;
    }

    const equipmentsArray = Array.isArray(equipmentsBlock)
      ? equipmentsBlock
      : [equipmentsBlock];

    this.measuringEquipments = equipmentsArray.map((eq: any) => {
      // Extraer campos principales
      const name = this.getText(eq?.['dcc:name']);
      const refType = eq?.['@refType'] || eq?.['refType'] || '';
      const manufacturer = this.getText(eq?.['dcc:manufacturer']?.['dcc:name']);
      const model = this.getText(eq?.['dcc:model']);

      // Identifications
      const identificationsBlock =
        eq?.['dcc:identifications']?.['dcc:identification'];
      let identifications: any[] = [];
      if (identificationsBlock) {
        const identArray = Array.isArray(identificationsBlock)
          ? identificationsBlock
          : [identificationsBlock];
        identifications = identArray.map((id: any) => ({
          issuer: this.getText(id?.['dcc:issuer']),
          value: this.getText(id?.['dcc:value']),
          name: this.getText(id?.['dcc:name']),
        }));
      }

      return {
        name,
        refType,
        manufacturer,
        model,
        identifications,
      };
    });
  }
  // Helper para extraer texto de un campo XML parseado
  private getText(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (obj['#text']) return obj['#text'];
    if (obj['dcc:content']) return this.getText(obj['dcc:content']);
    if (obj['si:value']) return this.getText(obj['si:value']);
    if (obj['si:unit']) return this.getText(obj['si:unit']);
    return '';
  }
  /**
   * Mapea el bloque de Influence Conditions desde el XML al formato esperado por el componente
   * @param xmlData Objeto parseado del XML
   */
  loadInfluenceConditionsFromXml(xmlData: any) {
    // Navega hasta el bloque de influenceConditions (ajustado a la estructura real del XML parseado)
    const influenceBlock =
      xmlData?.['dcc:measurementResults']?.['dcc:measurementResult']?.[
        'dcc:influenceConditions'
      ]?.['dcc:influenceCondition'];

    if (!influenceBlock) {
      this.influenceConditions = [];
      return;
    }

    // Si solo hay un objeto, conviértelo en array
    const conditionsArray = Array.isArray(influenceBlock)
      ? influenceBlock
      : [influenceBlock];
    this.influenceConditions = conditionsArray.map((cond: any) => {
      // Extraer nombre, refType, y subBlock
      const name = this.getText(cond?.['dcc:name']);
      const refType = cond?.['@refType'] || cond?.['refType'] || '';
      // SubBlock
      const quantity = cond?.['dcc:data']?.['dcc:quantity'] || {};
      const subBlockName = this.getText(quantity?.['dcc:name']);
      const subBlockValue = this.getText(quantity?.['si:real']?.['si:value']);
      const subBlockUnit = this.getText(quantity?.['si:real']?.['si:unit']);
      return {
        name,
        refType,
        active: true,
        required: false,
        subBlock: {
          name: subBlockName,
          value: subBlockValue,
          unit: subBlockUnit,
        },
      };
    });
  }
  // Recibe el modo de operación desde el componente padre
  // Recibe el modo de operación desde el componente padre
  @Input() operationMode: 'create' | 'load' | 'xml' | null = null;
  measurementResult: any = {};
  usedMethods: any[] = [];
  influenceConditions: any[] = [];
  measuringEquipments: any[] = [];
  metrologicalTraceability: any[] = []; // Nuevo: Metrological Traceability
  calibrationStatus: any[] = []; // Estado de calibración de cada patrón
  hasExpiredPatrones: boolean = false; // Flag para saber si hay patrones vencidos
  results: any[] = [];
  editingBlocks: { [key: string]: boolean } = {};
  private subscription: Subscription = new Subscription();
  loadingFromDB: boolean = false;
  coreData: any = {};
  resultsData: any = {};
  mainItem: any;
  items: any;
  database: string = 'calibraciones'; // Ajusta según tu entorno
  availableInfluenceConditions: any[] = [];
  ptDescription: string = ''; // Description del PT para hv_method

  editingMeasurementUncertainty: boolean = false; // NUEVO: modo edición exclusivo
  isEditingMeasurementResult: boolean = false; // Modo edición del nombre
  measurementResultName: string = ''; // Nombre editable

  get showMainResultsBlocks(): boolean {
    return true;
  }

  get showTestedMaterialBlock(): boolean {
    return false;
  }

  // Tested Material (IE only)
  testedMaterial: any = {};
  testedMaterialBackup: any = {};
  isEditingTestedMaterial: boolean = false;

  // Propiedades para Measuring Equipments con multiselect
  isEditingMeasuringEquipments: boolean = false;
  availablePatrones: any[] = [];
  selectedPatrones: any[] = [];
  equipmentsFromPatrones: any[] = []; // Equipos cargados desde equipment_catalog
  patronDropdownSettings: IDropdownSettings = {
    singleSelection: false,
    idField: 'id',
    textField: 'name',
    selectAllText: 'Seleccionar todos',
    unSelectAllText: 'Deseleccionar todos',
    itemsShowLimit: 5,
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar patrón...',
    noDataAvailablePlaceholderText: 'No hay patrones disponibles',
  };

  // Getter to expose the current DCC id (certificate number) for backward compatibility
  private get dccId(): string | undefined {
    return this.coreData?.certificate_number;
  }

  constructor(
    private dccDataService: DccDataService,
    private apiService: ApiService,
  ) {}

  ngOnInit() {
    // Cargar coreData del observable y recargar BD solo cuando cambie el certificado
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        const certificateNumber =
          data.administrativeData?.core?.certificate_number;
        const ptId = data.administrativeData?.core?.pt_id;
        const technicalVerification =
          data.administrativeData?.core?.technical_verification;

        const previousCertificate = this.coreData?.certificate_number;

        this.coreData = {
          ...this.coreData,
          certificate_number: certificateNumber,
          pt_id: ptId,
          technical_verification: Boolean(technicalVerification),
        };

        // Solo recargar de BD si cambió el certificado
        if (certificateNumber && certificateNumber !== previousCertificate) {
          // Si el modo es xml, cargar desde XML
          if (this.operationMode === 'xml' && data.xmlData) {
            this.loadInfluenceConditionsFromXml(data.xmlData);
            this.loadMeasuringEquipmentsFromXml(data.xmlData);
            this.loadResultsFromXml(data.xmlData);
          } else {
            // Cargar TODO desde BD directamente
            this.loadAllDataFromDB(certificateNumber);
          }
        }
      }),
    );
  }

  // Método centralizado para cargar todos los datos desde BD
  private loadAllDataFromDB(dccId: string) {
    // Cargar measurement result name
    this.loadMeasurementResultNameFromDB(dccId);

    // Cargar influence conditions
    this.loadInfluenceConditionsFromDB(dccId);

    // Cargar measuring equipments
    this.loadMeasuringEquipmentsFromDB(dccId);

    // Cargar metrological traceability
    this.loadMetrologicalTraceabilityFromDB(dccId);

    // Cargar used methods
    this.loadUsedMethodsFromDB(dccId);

    // Cargar measurement result
    this.loadMeasurementResultFromDB(dccId);

    // Cargar results (incluye PT-23 si existe)
    this.loadResultsFromDB();
  }

  // Nuevo método para cargar used methods desde BD
  private loadUsedMethodsFromDB(dccId: string) {
    const ptId = this.coreData?.pt_id;
    const isIeCertificate = this.isTestCertificate(
      this.coreData?.certificate_number,
    );
    this.dccDataService
      .getAllUsedMethodsFromDatabase(this.database, ptId)
      .subscribe({
        next: (methods) => {
          const filteredMethods = isIeCertificate
            ? methods.filter((method) => method.refType !== 'basic_uncertainty')
            : methods;

          this.usedMethods = filteredMethods.map((method) => {
            if (ptId && method.refType === 'hv_method' && method.description) {
              method.description = method.description.replace(
                /PT-\d{2}/g,
                ptId,
              );
            }

            // Concatenar norm con el name del primer usedMethodQuantity
            if (
              method.norm &&
              method.usedMethodQuantities &&
              method.usedMethodQuantities.length > 0
            ) {
              const quantityName = method.usedMethodQuantities[0].name;
              method.norm = method.norm + ': ' + quantityName;
            } else {
            }
            return method;
          });
          // Actualizar el observable global para que preview.component tenga acceso
          this.dccDataService.updateUsedMethods(this.usedMethods);
        },
        error: () => {
          console.log('❌ Error loading methods, using defaults');
          this.usedMethods = this.getDefaultUsedMethods().filter(
            (method) =>
              !isIeCertificate || method.refType !== 'basic_uncertainty',
          );
          // Actualizar el observable global con los defaults
          this.dccDataService.updateUsedMethods(this.usedMethods);
        },
      });
  }

  // Nuevo método para cargar measurement result name desde BD
  private loadMeasurementResultNameFromDB(dccId: string) {
    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: dccId },
        attributes: ['name_measurement', 'pt'],
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        const dccData = response?.result?.[0];
        const ptId = dccData?.pt || this.coreData?.pt_id;
        const isTest = this.isTestCertificate(
          this.coreData?.certificate_number,
        );

        if (ptId && !this.coreData?.pt_id) {
          this.coreData = { ...this.coreData, pt_id: ptId };
        }

        this.loadPtDescriptionAndComposeName(
          ptId,
          isTest,
          dccData?.name_measurement,
        );
      },
      error: () => {
        const prefix = this.isTestCertificate(this.coreData?.certificate_number)
          ? 'Test of'
          : 'Calibration of';
        this.pushMeasurementResultName(prefix);
      },
    });
  }

  private loadPtDescriptionAndComposeName(
    ptId: string | undefined,
    isTest: boolean,
    fallbackName?: string,
  ) {
    const prefix = isTest ? 'Test of' : 'Calibration of';

    if (!ptId) {
      this.pushMeasurementResultName(fallbackName || prefix);
      this.ptDescription = '';
      this.dccDataService.updatePtDescription('');
      return;
    }

    const ptQuery = {
      action: 'get',
      bd: this.database,
      table: 'procedimientos_tecnicos',
      opts: {
        where: { id: ptId },
        attributes: ['description'],
      },
    };

    this.dccDataService.post(ptQuery).subscribe({
      next: (resp: any) => {
        const description = resp?.result?.[0]?.description?.trim();
        // Store the raw description for pt_description
        this.ptDescription = description || '';
        // Update dccDataService so preview component can access it
        this.dccDataService.updatePtDescription(this.ptDescription);
        const composedName = description
          ? `${prefix} "${description}"`
          : fallbackName || prefix;
        this.pushMeasurementResultName(composedName);
      },
      error: () => {
        this.ptDescription = '';
        this.dccDataService.updatePtDescription('');
        this.pushMeasurementResultName(fallbackName || prefix);
      },
    });
  }

  private isTestCertificate(certificateNumber?: string | null): boolean {
    return /\bIE\b/i.test(certificateNumber || '');
  }

  get isDccCertificate(): boolean {
    return !this.isTestCertificate(this.coreData?.certificate_number);
  }

  get isTechnicalVerificationActive(): boolean {
    return (
      this.isDccCertificate && Boolean(this.coreData?.technical_verification)
    );
  }

  get hasPtId(): boolean {
    return Boolean(String(this.coreData?.pt_id || '').trim());
  }

  private getPatronFilterPtId(): string | null {
    const normalizedPtId = String(this.coreData?.pt_id || '')
      .trim()
      .toUpperCase();

    return /^PT-\d{2}$/.test(normalizedPtId) ? normalizedPtId : null;
  }

  private pushMeasurementResultName(name: string) {
    this.measurementResultName = name;
    this.dccDataService.updateMeasurementResultName(this.measurementResultName);
  }

  // Nuevo método para cargar measurement result desde BD
  private loadMeasurementResultFromDB(dccId: string) {
    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_results',
      opts: {
        where: { id_dcc: dccId, ref_type: 'measurementResult', deleted: 0 },
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          const measurementResultFromDB = response.result[0];
          if (measurementResultFromDB && measurementResultFromDB.data) {
            this.measurementResult = JSON.parse(measurementResultFromDB.data);
          }
        } else {
          this.measurementResult = {};
        }
      },
      error: () => {
        this.measurementResult = {};
      },
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private updateAvailableConditionsFromLoaded(loadedConditions: any[]) {
    // Actualizar el estado de las condiciones disponibles basándose en las cargadas
    this.availableInfluenceConditions.forEach((condition) => {
      const found = loadedConditions.find(
        (loaded) =>
          loaded.name === condition.name ||
          loaded.refType === condition.refType,
      );
      if (found) {
        condition.active = true;
        condition.subBlock = { ...found.subBlock };
      } else {
        condition.active = condition.required; // Solo mantener activas las requeridas
      }
    });
  }

  private initializeAvailableInfluenceConditions() {
    this.availableInfluenceConditions = [
      {
        id: 'influence_temperature',
        name: 'Ambient condition temperature',
        refType: 'basic_temperature',
        // Removido: status: 'beforeAdjustment',
        active: true,
        required: true,
        subBlock: {
          name: 'Temperature',
          value: '',
          unit: '\\kelvin',
        },
      },
      {
        id: 'influence_humidity',
        name: 'Ambient condition relative air humidity',
        refType: 'basic_humidityRelative',
        // Removido: status: 'beforeAdjustment',
        active: true,
        required: true,
        subBlock: {
          name: 'Relative humidity of the ambient air',
          value: '',
          unit: '\\one',
        },
      },
      {
        id: 'influence_pressure',
        name: 'Ambient condition pressure',
        refType: 'basic_pressure',
        // Removido: status: 'beforeAdjustment',
        active: false,
        required: false,
        subBlock: {
          name: 'Ambient Pressure',
          value: '',
          unit: '\\pascal',
        },
      },
    ];
  }

  getActiveInfluenceConditions() {
    return this.influenceConditions.filter(
      (condition) => condition.active !== false,
    );
  }

  getActiveAvailableConditions() {
    return this.availableInfluenceConditions.filter(
      (condition) => condition.active,
    );
  }

  onConditionActiveChange() {
    // Actualizar la lista de influence conditions basándose en las selecciones
    const activeConditions = this.availableInfluenceConditions
      .filter((condition) => condition.active)
      .map((condition) => ({
        id: condition.id,
        name: condition.name,
        refType: condition.refType,
        // Removido: status: condition.status,
        active: true,
        subBlock: { ...condition.subBlock },
      }));

    this.influenceConditions = activeConditions;
  }

  getUnitsForCondition(refType: string) {
    const unitMap: { [key: string]: any[] } = {
      basic_temperature: [
        { value: '\\kelvin', label: 'K (\\kelvin)' },
        { value: '\\degreecelsius', label: '°C (\\degreecelsius)' },
      ],
      basic_humidityRelative: [
        { value: '\\one', label: 'Ratio (\\one)' },
        { value: '\\percent', label: '% (\\percent)' },
      ],
      basic_pressure: [
        { value: '\\pascal', label: 'Pa (\\pascal)' },
        { value: '\\hectopascal', label: 'hPa (\\hectopascal)' },
        { value: '\\kilopascal', label: 'kPa (\\kilopascal)' },
      ],
    };
    return unitMap[refType] || [];
  }

  private getDefaultUsedMethods(): any[] {
    return [
      {
        id: this.generateId(),
        name: 'Direct comparison with reference measuring system',
        refType: 'basic_calibrationMethod',
        description:
          'The calibration tests have been made by direct comparison with a reference measuring system, according to calibration procedure PT-24 of the Laboratory and as per the requirements in the Standard IEC 60060-2 "High-voltage test techniques - Part 2: Measuring systems".',
        norm: 'IEC 60060-2',
        reference: 'Calibration procedure PT-24 of the Laboratory',
      },
      {
        id: this.generateId(),
        name: 'Expanded uncertainty',
        refType: 'basic_uncertainty',
        description:
          'The reported expanded uncertainty of measurement is stated as the uncertainty of measurement multiplied by the coverage factor k = 2, which for a normal distribution corresponds to a coverage probability of approximately 95 %. The standard uncertainty of measurement has been determined in accordance with the GUM, "Guide to the Expression of Uncertainty in Measurement" (JCGM 100:2008, Evaluation of measurement data – Guide to the expression of uncertainty in measurement).',
        norm: 'GUM',
        reference: 'JCGM 100:2008',
      },
    ];
  }

  private getDefaultInfluenceConditions(): any[] {
    return [
      {
        id: this.generateId(),
        name: 'Ambient condition temperature',
        refType: 'basic_temperature',
        // Removido: status: 'beforeAdjustment',
        subBlock: {
          name: 'Temperature',
          value: '',
          unit: '\\kelvin',
        },
      },
      {
        id: this.generateId(),
        name: 'Ambient condition relative air humidity',
        refType: 'basic_humidityRelative',
        // Removido: status: 'beforeAdjustment',
        subBlock: {
          name: 'Relative humidity of the ambient air',
          value: '',
          unit: '\\one',
        },
      },
      {
        id: this.generateId(),
        name: 'Ambient condition pressure',
        refType: 'basic_pressure',
        // Removido: status: 'beforeAdjustment',
        subBlock: {
          name: 'Ambient Pressure',
          value: '',
          unit: '\\pascal',
        },
      },
    ];
  }

  addMeasuringEquipment() {
    const newEquipment = {
      id: this.generateId(),
      name: '',
      refType: '',
      manufacturer: '',
      model: '',
      identifications: [
        {
          issuer: '',
          value: '',
          name: '',
        },
      ],
    };
    this.measuringEquipments.push(newEquipment);
  }

  private getDefaultMeasuringEquipments(): any[] {
    return [
      {
        id: this.generateId(),
        name: 'Reference Measuring System',
        refType: 'basic_standardUsed',
        manufacturer: '',
        model: '',
        identifications: [
          {
            issuer: 'calibrationLaboratory',
            value: '',
            name: 'Laboratory ID',
          },
        ],
      },
      {
        id: this.generateId(),
        name: 'Baro-Thermohygrometer',
        refType: 'basic_auxiliaryEquipment',
        manufacturer: '',
        model: '',
        identifications: [
          {
            issuer: 'calibrationLaboratory',
            value: '',
            name: 'Laboratory ID',
          },
        ],
      },
    ];
  }

  addDataToResult(resultIndex: number) {
    this.results[resultIndex].data.push(
      this.ensureMeasurementUncertaintyStructure({
        id: this.generateId(),
        refType: '',
        name: '',
        dataType: 'realListXMLList',
        valueXMLList: '',
        unitXMLList: '\\kilovolt', // Default to kilovolt
        value: '',
        unit: '\\one', // Default to one
        hasUncertainty: false,
      }),
    );
  }

  onUncertaintyToggle(data: any) {
    if (!data.hasUncertainty) {
      // Limpiar datos de incertidumbre cuando se desactiva
      if (data.measurementUncertainty?.expandedMU) {
        data.measurementUncertainty.expandedMU.valueExpandedMUXMLList = '';
        data.measurementUncertainty.expandedMU.coverageFactorXMLList = '';
        data.measurementUncertainty.expandedMU.coverageProbabilityXMLList = '';
      }
    } else {
      // Inicializar estructura si no existe
      if (!data.measurementUncertainty) {
        data.measurementUncertainty = {
          expandedMU: {
            valueExpandedMUXMLList: '',
            coverageFactorXMLList: '',
            coverageProbabilityXMLList: '',
          },
        };
      }
    }
  }

  // Block editing methods
  toggleEdit(blockName: string) {
    if (blockName === 'results') {
      this.editingBlocks[blockName] = !this.editingBlocks[blockName];
      this.loadMeasurementUncertaintyFromDB();
    } else {
      this.editingBlocks[blockName] = !this.editingBlocks[blockName];
    }
  }

  isEditing(blockName: string): boolean {
    return this.editingBlocks[blockName] || false;
  }

  // Mostrar solo el formulario de edición de Measurement Uncertainty
  showMeasurementUncertaintyEditor() {
    // Cargar Measurement Uncertainty desde la base de datos antes de editar
    this.loadMeasurementUncertaintyFromDB();
    this.editingMeasurementUncertainty = true;
  }

  hideMeasurementUncertaintyEditor() {
    this.editingMeasurementUncertainty = false;
  }

  // Métodos para editar Measurement Result Name
  toggleEditMeasurementResult() {
    this.isEditingMeasurementResult = !this.isEditingMeasurementResult;
    if (!this.isEditingMeasurementResult) {
      // Si cancela, recargar el valor original
      const dccId = this.coreData?.certificate_number;
      if (dccId) {
        this.loadMeasurementResultNameFromDB(dccId);
      }
    }
  }

  saveMeasurementResultName() {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay un DCC cargado.',
      });
      return;
    }

    if (
      !this.measurementResultName ||
      this.measurementResultName.trim() === ''
    ) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El nombre no puede estar vacío.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando nombre del resultado',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const updateQuery = {
      action: 'update',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: dccId },
        attributes: {
          name_measurement: this.measurementResultName.trim(),
        },
      },
    };

    this.dccDataService.post(updateQuery).subscribe({
      next: (response: any) => {
        Swal.close();
        if (response?.result) {
          this.isEditingMeasurementResult = false;
          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'El nombre del resultado se ha actualizado correctamente.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el nombre.',
          });
        }
      },
      error: (error) => {
        Swal.close();
        console.error('Error saving measurement result name:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al guardar.',
        });
      },
    });
  }

  // Guardar Measurement Uncertainty en la base de datos
  saveMeasurementUncertaintyEditor() {
    this.saveMeasurementUncertaintyToDB();
    this.editingMeasurementUncertainty = false;

    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'Las incertidumbres de medición se han guardado correctamente en la base de datos.',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
    });
  }

  // Guardar solo Measurement Uncertainty y datos en BD para los tres tipos de resultados
  private saveMeasurementUncertaintyToDB() {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) return;

    const checkQuery = {
      action: 'get',
      bd: this.database,
      table: 'dcc_results',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
      },
    };

    this.dccDataService.post(checkQuery).subscribe({
      next: (response: any) => {
        const existingResults = response?.result || [];
        const promises: Promise<any>[] = [];

        this.results.forEach((result: any, index: number) => {
          let dataToSave;

          // Guardado especial para hv_scaleFactorTest (array de quantities)
          if (result.refType === 'hv_scaleFactorTest') {
            dataToSave = result.data.map((qty: any) => ({
              id: qty.id,
              name: qty.name,
              refType: qty.refType,
              dataType: qty.dataType,
              valueXMLList: qty.valueXMLList,
              unitXMLList: qty.unitXMLList,
              measurementUncertainty: qty.measurementUncertainty,
            }));
          }
          // Guardado especial para hv_scaleFactorMean y hv_linearity (solo nombre, valor, unidad)
          else if (
            result.refType === 'hv_scaleFactorMean' ||
            result.refType === 'hv_linearity'
          ) {
            // Puede ser array de uno o objeto simple
            if (Array.isArray(result.data)) {
              dataToSave = result.data.map((qty: any) => ({
                id: qty.id,
                refType: qty.refType,
                name: qty.name,
                dataType: qty.dataType,
                value: qty.value,
                unit: qty.unit,
              }));
            } else {
              dataToSave = {
                id: result.data.id,
                refType: result.data.refType,
                name: result.data.name,
                dataType: result.data.dataType,
                value: result.data.value,
                unit: result.data.unit,
              };
            }
          }
          // Otros resultados: guarda como antes
          else {
            dataToSave = result.data;
          }

          const attributes = {
            id_dcc: dccId,
            name: result.name,
            ref_type: result.refType,
            data: JSON.stringify(dataToSave),
            orden: index + 1,
          };

          // Buscar resultado existente por nombre Y ref_type (no por índice)
          const existingResult = existingResults.find(
            (r: any) => r.name === result.name && r.ref_type === result.refType,
          );

          if (existingResult) {
            const updateQuery = {
              action: 'update',
              bd: this.database,
              table: 'dcc_results',
              opts: {
                attributes: {
                  name: attributes.name,
                  ref_type: attributes.ref_type,
                  data: attributes.data,
                  orden: attributes.orden,
                },
                where: { id: existingResult.id },
              },
            };
            promises.push(this.dccDataService.post(updateQuery).toPromise());
          } else {
            const createQuery = {
              action: 'create',
              bd: this.database,
              table: 'dcc_results',
              opts: { attributes },
            };
            promises.push(this.dccDataService.post(createQuery).toPromise());
          }
        });

        Promise.all(promises)
          .then(() => {
            // Actualiza el servicio para que Preview reciba los datos reales guardados
            this.dccDataService.updateResults(this.results);
            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: 'Los resultados se han guardado correctamente en la base de datos.',
              timer: 2000,
              showConfirmButton: false,
              position: 'top-end',
            });
          })
          .catch(() => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un error al guardar los resultados en la base de datos.',
              timer: 3000,
              showConfirmButton: true,
            });
          });
      },
      error: () => {
        // Opcional: notificación de error
      },
    });
  }

  // Mantén solo UNA implementación de getDefaultResults:
  // Removed default results to avoid overriding DB values

  // Cargar Measurement Uncertainty desde BD y actualizar los datos en memoria
  private loadMeasurementUncertaintyFromDB() {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) return;

    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_results',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
        order_by: ['orden', 'ASC'],
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          // Sincronizar con los resultados actuales en memoria
          response.result
            .filter(
              (dbResult: any) => dbResult.ref_type !== 'measurementResult',
            )
            .forEach((dbResult: any) => {
              const dbData = dbResult.data ? JSON.parse(dbResult.data) : [];
              const resultInMemory = this.results.find(
                (r) => r.id === dbResult.id,
              );

              if (
                resultInMemory &&
                Array.isArray(resultInMemory.data) &&
                Array.isArray(dbData)
              ) {
                resultInMemory.data.forEach((qty: any) => {
                  const dbQty = dbData.find((q: any) => q.id === qty.id);
                  if (dbQty && dbQty.measurementUncertainty) {
                    qty.measurementUncertainty = dbQty.measurementUncertainty;
                  }
                });
              }
            });
        }
      },
      error: () => {
        console.error('Error loading measurement uncertainties from DB');
      },
    });
  }

  // Método público para refrescar resultados (usado por componentes hijos)
  refreshResultsFromDB() {
    this.loadResultsFromDB();
  }

  // Modifica loadResultsFromDB para cargar directamente sin limpiar
  private loadResultsFromDB() {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) {
      return;
    }

    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_results',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
        order_by: ['orden', 'ASC'],
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          // Cargar TODOS los resultados sin filtrar por ref_type
          this.results = response.result
            .filter((dbResult: any) => {
              const isMeasurementResult =
                dbResult.ref_type === 'measurementResult';
              if (isMeasurementResult) {
              }
              return !isMeasurementResult;
            })
            .map((dbResult: any) => {
              const dbData = dbResult.data ? JSON.parse(dbResult.data) : [];
              return {
                id: dbResult.id,
                name: dbResult.name,
                refType: dbResult.ref_type,
                data: Array.isArray(dbData) ? dbData : [],
              };
            });
        } else {
          this.results = [];
        }
      },
      error: (err) => {
        console.error('❌ Error loading results from DB:', err);
        this.results = [];
      },
    });
  }

  // Modifica ensureMeasurementUncertaintyStructure para solo inicializar measurementUncertainty en 'Voltage Error'
  private ensureMeasurementUncertaintyStructure(qty: any): any {
    // No crear valores por defecto; preservar lo que venga de la BD
    return qty;
  }

  // Agrega el método generateId a la clase ResultsComponent
  private generateId(): string {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private loadInfluenceConditionsFromDB(dccId: string) {
    // Cargar las condiciones de influencia desde la tabla dcc_influencecondition
    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_influencecondition',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          // Mapear los datos de la BD al formato esperado por el componente
          this.influenceConditions = response.result.map((row: any) => ({
            id: row.id,
            name: row.name,
            refType: row.ref_type,
            active: true,
            required: false,
            subBlock: {
              name: row.quantity_name,
              value: row.quantity_value,
              unit: row.quantity_unit,
            },
          }));
          // Actualizar el observable global para que Preview reciba los datos reales
          this.dccDataService.updateInfluenceConditions(
            this.influenceConditions,
          );
        } else {
          // Si no hay datos en BD, inicializa con los valores por defecto
          this.influenceConditions = this.getDefaultInfluenceConditions();
          this.dccDataService.updateInfluenceConditions(
            this.influenceConditions,
          );
        }
      },
      error: () => {
        this.influenceConditions = this.getDefaultInfluenceConditions();
        this.dccDataService.updateInfluenceConditions(this.influenceConditions);
      },
    });
  }

  // Guardar edición de Influence Conditions en la BD
  saveBlock(blockName: string) {
    if (blockName === 'influence-conditions') {
      const dccId = this.coreData?.certificate_number;
      if (!dccId) return;

      // Guardar cada condición en la tabla dcc_influencecondition
      const promises = this.influenceConditions.map((cond) => {
        const attributes = {
          id_dcc: dccId,
          name: cond.name,
          ref_type: cond.refType,
          quantity_name: cond.subBlock.name,
          quantity_value: cond.subBlock.value,
          quantity_unit: cond.subBlock.unit,
        };

        // Buscar existencia por claves naturales (id_dcc + name [+ ref_type])
        const existsQuery = {
          action: 'get',
          bd: this.database,
          table: 'dcc_influencecondition',
          opts: {
            where: {
              id_dcc: dccId,
              name: cond.name,
              ref_type: cond.refType,
              deleted: 0,
            },
          },
        };

        return this.dccDataService
          .post(existsQuery)
          .toPromise()
          .then((getResp: any) => {
            const existing = Array.isArray(getResp?.result)
              ? getResp.result[0]
              : null;

            if (existing) {
              // UPDATE por id encontrado
              const updateQuery = {
                action: 'update',
                bd: this.database,
                table: 'dcc_influencecondition',
                opts: {
                  attributes,
                  where: { id: existing.id },
                },
              };
              return this.dccDataService
                .post(updateQuery)
                .toPromise()
                .then((r) => {
                  // Sincronizar id en memoria
                  cond.id = existing.id;
                  return r;
                });
            } else {
              // CREATE porque no existe
              const createQuery = {
                action: 'create',
                bd: this.database,
                table: 'dcc_influencecondition',
                opts: { attributes },
              };

              return this.dccDataService
                .post(createQuery)
                .toPromise()
                .then((createResp: any) => {
                  // Intentar recuperar el ID del insert si el backend lo retorna
                  const insertedId =
                    createResp?.result?.insertId ||
                    createResp?.insertId ||
                    null;
                  if (insertedId) {
                    cond.id = insertedId;

                    return createResp;
                  }
                  // Si no viene insertId, hacer una consulta para obtenerlo por claves
                  const fetchQuery = {
                    action: 'get',
                    bd: this.database,
                    table: 'dcc_influencecondition',
                    opts: {
                      where: {
                        id_dcc: dccId,
                        name: cond.name,
                        ref_type: cond.refType,
                        deleted: 0,
                      },
                    },
                  };
                  return this.dccDataService
                    .post(fetchQuery)
                    .toPromise()
                    .then((fetchResp: any) => {
                      const rec = Array.isArray(fetchResp?.result)
                        ? fetchResp.result[0]
                        : null;
                      if (rec?.id) {
                        cond.id = rec.id;
                      }
                      return createResp;
                    });
                });
            }
          });
      });

      Promise.all(promises)
        .then(() => {
          this.editingBlocks[blockName] = false;
          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Las condiciones de influencia se han guardado correctamente.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
          // Recargar desde BD para reflejar cambios
          this.loadInfluenceConditionsFromDB(dccId);
        })
        .catch(() => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al guardar las condiciones de influencia.',
            timer: 3000,
            showConfirmButton: true,
          });
        });
    }
  }

  // Método para obtener el Measurement Uncertainty de un quantity (sin logs)
  getMeasurementUncertainty(qty: any): string {
    if (
      qty &&
      qty.measurementUncertainty &&
      qty.measurementUncertainty.expandedMU &&
      qty.measurementUncertainty.expandedMU.valueExpandedMUXMLList
    ) {
      return qty.measurementUncertainty.expandedMU.valueExpandedMUXMLList;
    }
    return '';
  }

  // Métodos para Measuring Equipments con multiselect
  toggleEditMeasuringEquipments() {
    this.isEditingMeasuringEquipments = !this.isEditingMeasuringEquipments;
    if (this.isEditingMeasuringEquipments) {
      this.loadAvailablePatrones();
      this.loadSelectedPatronesFromDB();
    }
  }

  cancelEditMeasuringEquipments() {
    this.isEditingMeasuringEquipments = false;
    this.selectedPatrones = [];
    this.equipmentsFromPatrones = [];
    // Recargar datos originales
    const dccId = this.coreData?.certificate_number;
    if (dccId) {
      this.loadMeasuringEquipmentsFromDB(dccId);
    }
  }

  // Cargar patrones disponibles desde calibraciones.patron
  // Si hay PT, filtra por PT; si no hay PT, carga todos
  private loadAvailablePatrones() {
    const ptId = this.getPatronFilterPtId();

    const query = {
      action: 'get',
      bd: this.database,
      table: 'patron',
      opts: ptId
        ? {
            where: {
              pt: ptId,
            },
          }
        : {},
    };

    this.apiService.post(query, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          this.availablePatrones = response.result.map((p: any) => ({
            id: p.id,
            name: p.name, // Este campo tiene formato "810-0000+620-0000"
            months_calibration: p.months_calibration,
          }));
        } else {
          this.availablePatrones = [];
        }
      },
      error: (error) => {
        console.error('Error loading patrones:', error);
        this.availablePatrones = [];
      },
    });
  }

  // Cargar patrones ya seleccionados desde la BD
  private loadSelectedPatronesFromDB() {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) return;

    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_measuringequipments',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
        attributes: ['id_patron'],
        group_by: ['id_patron'],
      },
    };

    this.apiService.post(query, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          const patronIds = response.result
            .map((r: any) => r.id_patron)
            .filter((id: any) => id);
          // Seleccionar los patrones que ya están guardados
          this.selectedPatrones = this.availablePatrones.filter((p) =>
            patronIds.includes(p.id),
          );
          // Cargar equipos de los patrones seleccionados
          if (this.selectedPatrones.length > 0) {
            this.loadEquipmentsFromPatrones();
          }
        }
      },
      error: (error) => {
        console.error('Error loading selected patrones:', error);
      },
    });
  }

  onPatronSelect(item: any) {
    this.loadEquipmentsFromPatrones();
  }

  onPatronDeSelect(item: any) {
    this.loadEquipmentsFromPatrones();
  }

  // Cargar equipos desde hvtest2.equipment_catalog basándose en los patrones seleccionados
  private loadEquipmentsFromPatrones() {
    this.equipmentsFromPatrones = [];

    if (this.selectedPatrones.length === 0) {
      return;
    }

    // Recopilar todos los asset_ids de los patrones seleccionados
    const allAssetIds: {
      assetId: string;
      patronId: number;
      patronName: string;
      calibrationInterval: number;
    }[] = [];

    for (const patron of this.selectedPatrones) {
      // El name del patrón tiene formato "810-0000+620-0000"
      const fullPatron = this.availablePatrones.find((p) => p.id === patron.id);
      if (fullPatron && fullPatron.name) {
        // Separar por + para obtener los asset IDs individuales
        const assetIds = fullPatron.name
          .split('+')
          .map((id: string) => id.trim());
        for (const assetId of assetIds) {
          if (assetId) {
            allAssetIds.push({
              assetId,
              patronId: fullPatron.id,
              patronName: fullPatron.name,
              calibrationInterval: fullPatron.months_calibration || 0,
            });
          }
        }
      }
    }

    if (allAssetIds.length === 0) {
      return;
    }

    // Buscar cada asset_id en hvtest2.equipment_catalog
    const promises = allAssetIds.map((item) => {
      const query = {
        action: 'get',
        bd: 'hvtest2',
        table: 'equipment_catalog',
        opts: {
          where: {
            idequipment: item.assetId,
          },
          attributes: [
            'idequipment',
            'name',
            'Name',
            'Description',
            'description',
            'maker',
            'Maker',
            'model',
            'Model',
            'serial_number',
            'Serial_number',
            'months',
          ],
        },
      };

      return this.apiService
        .post(query, UrlClass.URLNuevo)
        .toPromise()
        .then((response: any) => {
          if (response?.result && response.result.length > 0) {
            const eq = response.result[0];
            // Prioridad: name > Name > Description > description
            const equipmentName =
              eq.name || eq.Name || eq.Description || eq.description || '';

            return {
              assetId: item.assetId,
              patronId: item.patronId,
              patronName: item.patronName,
              calibrationInterval: eq.months || item.calibrationInterval,
              idEquipment: eq.idequipment,
              name: equipmentName,
              manufacturer: eq.maker || eq.Maker || '',
              model: eq.model || eq.Model || '',
              serialNumber: eq.serial_number || eq.Serial_number || '',
            };
          }
          return null;
        })
        .catch((error) => {
          console.error(
            `Error loading equipment for asset ${item.assetId}:`,
            error,
          );
          return null;
        });
    });

    Promise.all(promises).then((results) => {
      this.equipmentsFromPatrones = results.filter((r) => r !== null);
    });
  }

  saveMeasuringEquipments() {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay un DCC cargado.',
      });
      return;
    }

    if (this.equipmentsFromPatrones.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin equipos',
        text: 'No hay equipos seleccionados para guardar.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Guardando equipos de medición',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    // Primero eliminar los registros anteriores (soft delete)
    const deleteQuery = {
      action: 'update',
      bd: this.database,
      table: 'dcc_measuringequipments',
      opts: {
        attributes: { deleted: 1 },
        where: { id_dcc: dccId },
      },
    };

    this.apiService.post(deleteQuery, UrlClass.URLNuevo).subscribe({
      next: (deleteResponse) => {
        // Insertar los nuevos equipos
        const insertPromises = this.equipmentsFromPatrones.map((eq, index) => {
          const attributes = {
            id_dcc: dccId,
            id_patron: eq.patronId,
            id_equipment: null, // No usamos este campo, el asset_id es suficiente
            asset_id: eq.assetId,
            name: eq.name,
            manufacturer: eq.manufacturer,
            model: eq.model,
            serial_number: eq.serialNumber,
            calibration_interval: eq.calibrationInterval,
            ref_type: 'basic_standardUsed',
            orden: index + 1,
            deleted: 0,
          };

          const insertQuery = {
            action: 'create',
            bd: this.database,
            table: 'dcc_measuringequipments',
            opts: {
              attributes: attributes,
            },
          };

          return this.apiService
            .post(insertQuery, UrlClass.URLNuevo)
            .toPromise();
        });

        Promise.all(insertPromises)
          .then((insertResponses) => {
            Swal.close();
            this.isEditingMeasuringEquipments = false;
            // Limpiar arrays de edición
            this.selectedPatrones = [];
            this.equipmentsFromPatrones = [];
            // Recargar los datos guardados para actualizar la vista
            this.loadMeasuringEquipmentsFromDB(dccId);
            // Recargar Metrological Traceability para mostrar el bloque si hay patrones
            this.loadMetrologicalTraceabilityFromDB(dccId);
            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: `Se guardaron ${insertResponses.length} equipos correctamente.`,
              timer: 2000,
              showConfirmButton: false,
              position: 'top-end',
            });
          })
          .catch((error) => {
            Swal.close();
            console.error('Error saving equipments:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un error al guardar los equipos.',
            });
          });
      },
      error: (error) => {
        Swal.close();
        console.error('Error deleting old equipments:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al actualizar los equipos.',
        });
      },
    });
  }

  private loadMeasuringEquipmentsFromDB(dccId: string) {
    if (!dccId) return;

    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_measuringequipments',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
        order_by: ['orden', 'ASC'],
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          this.measuringEquipments = response.result.map((row: any) => ({
            id: row.id,
            name: row.name,
            refType: row.ref_type || 'basic_standardUsed',
            manufacturer: row.manufacturer,
            model: row.model,
            identifications: [
              {
                name: 'Asset ID',
                value: row.asset_id,
                issuer: 'calibrationLaboratory',
              },
              {
                name: 'Serial Number',
                value: row.serial_number,
                issuer: 'manufacturer',
              },
              ...(row.calibration_interval
                ? [
                    {
                      name: 'Calibration Interval',
                      value: `${row.calibration_interval} months`,
                      issuer: 'calibrationLaboratory',
                    },
                  ]
                : []),
            ],
          }));
          // Actualizar el observable global para que Preview reciba los datos reales
          this.dccDataService.updateMeasuringEquipments(
            this.measuringEquipments,
          );
        } else {
          this.measuringEquipments = [];
          this.dccDataService.updateMeasuringEquipments([]);
        }
      },
      error: () => {
        this.measuringEquipments = [];
        this.dccDataService.updateMeasuringEquipments([]);
      },
    });
  }

  private loadMetrologicalTraceabilityFromDB(dccId: string) {
    if (!dccId) return;

    // Cargar los patrones (measuring equipments) desde dcc_measuringequipments
    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_measuringequipments',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
        order_by: ['orden', 'ASC'],
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          const patrones = response.result;

          // Cargar datos directamente desde equipment_catalog
          this.loadTraceabilityFromEquipmentCatalog(patrones, dccId);
        } else {
          this.metrologicalTraceability = [];
          this.calculateCalibrationStatus();
        }
      },
      error: () => {
        this.metrologicalTraceability = [];
        this.calculateCalibrationStatus();
      },
    });
  }

  private loadTraceabilityFromEquipmentCatalog(patrones: any[], dccId: string) {
    // Extraer los asset_id de los patrones (estos son los idequipment en equipment_catalog)
    const equipmentIds = patrones
      .map((eq: any) => eq.asset_id)
      .filter((id: any) => id);

    if (equipmentIds.length === 0) {
      // Si no hay asset_id, usar estructura básica
      this.metrologicalTraceability = patrones.map((eq: any, idx: number) => ({
        id: null,
        id_dcc: dccId,
        id_patron: eq.asset_id || '', // Usar asset_id como ID
        name_patron: eq.name || '',
        tz_name: '', // Por agregar
        tz_by: '',
        tz_date: '',
        tz_quantity: '', // Por agregar
        tz_comm: '', // Por agregar
        calibration_interval: 0, // Sin intervalo sin equipmentIds
        orden: idx + 1,
      }));
      // Actualizar el observable global
      this.dccDataService.updateMetrologicalTraceability(
        this.metrologicalTraceability,
      );
      // Calcular estado de calibración también sin equipmentIds
      this.calculateCalibrationStatus();
      return;
    }

    // Consultar equipment_catalog de hvtest2 para cada asset_id
    const catalogPromises = equipmentIds.map((assetId: string) => {
      const catalogQuery = {
        action: 'get',
        bd: 'hvtest2',
        table: 'equipment_catalog',
        opts: {
          where: { idequipment: assetId },
          attributes: [
            'idequipment',
            'calibratedby',
            'last_calibration',
            'tzname',
            'tzquantity',
            'tzcomm',
            'months', // Agregar intervalo de calibración
          ],
        },
      };

      return this.apiService.post(catalogQuery, UrlClass.URLNuevo).toPromise();
    });

    Promise.all(catalogPromises)
      .then((responses: any[]) => {
        // Aplanar todos los resultados en un solo array
        const catalogData = responses
          .filter((resp) => resp?.result && resp.result.length > 0)
          .flatMap((resp) => resp.result);

        // Mapear cada patrón con los datos del catálogo usando asset_id
        this.metrologicalTraceability = patrones.map((eq: any, idx: number) => {
          const catalogRecord = catalogData.find(
            (cat: any) => cat.idequipment === eq.asset_id,
          );

          return {
            id: null,
            id_dcc: dccId,
            id_patron: eq.asset_id || '', // asset_id es el idequipment
            name_patron: eq.name || '',
            tz_name: catalogRecord?.tzname || '',
            tz_by: catalogRecord?.calibratedby || '',
            tz_date: catalogRecord?.last_calibration || '',
            tz_quantity: catalogRecord?.tzquantity || '',
            tz_comm: catalogRecord?.tzcomm || '',
            calibration_interval: catalogRecord?.months || 0, // Intervalo de calibración en meses
            orden: idx + 1,
          };
        });
        // Actualizar el observable global
        this.dccDataService.updateMetrologicalTraceability(
          this.metrologicalTraceability,
        );
        // Calcular estado de calibración
        this.calculateCalibrationStatus();
      })
      .catch((error) => {
        console.error('Error loading from equipment_catalog:', error);
        // Fallback: estructura básica
        this.metrologicalTraceability = patrones.map(
          (eq: any, idx: number) => ({
            id: null,
            id_dcc: dccId,
            id_patron: eq.asset_id || '',
            name_patron: eq.name || '',
            tz_name: '',
            tz_by: '',
            tz_date: '',
            tz_quantity: '',
            tz_comm: '',
            calibration_interval: 0, // Sin intervalo en fallback
            orden: idx + 1,
          }),
        );
        // Actualizar el observable global
        this.dccDataService.updateMetrologicalTraceability(
          this.metrologicalTraceability,
        );
        // Calcular estado de calibración también en el catch
        this.calculateCalibrationStatus();
      });
  }

  // Calcular el estado de calibración de cada patrón
  private calculateCalibrationStatus() {
    this.calibrationStatus = [];
    this.hasExpiredPatrones = false;

    this.metrologicalTraceability.forEach((patron) => {
      const status = this.getCalibrationStatus(patron);
      this.calibrationStatus.push(status);

      // Solo contar como vencido si tiene información completa pero está vencido
      if (!status.isValid && status.hasCompleteInfo) {
        this.hasExpiredPatrones = true;
      }
    });

    // Actualizar el servicio con el estado de patrones vencidos
    this.dccDataService.updateHasExpiredPatrones(this.hasExpiredPatrones);
  }

  // ========== TESTED MATERIAL (IE only) ==========

  private normalizeTestedMaterialPtNumber(ptId?: string | null): number | null {
    const match = String(ptId || '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .match(/PT-?(\d{1,2})/);
    if (!match) {
      return null;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private inferTestedMaterialType(ptId?: string | null): 'cable' | 'gis' {
    const ptNumber = this.normalizeTestedMaterialPtNumber(ptId);
    return ptNumber !== null && [2, 4, 8].includes(ptNumber) ? 'gis' : 'cable';
  }

  private getEmptyTestedMaterial(materialType: 'cable' | 'gis' = 'cable'): any {
    return {
      id: null,
      material_type: materialType,
      material_description: '',
      cable_fabricante: '',
      cable_modelo: '',
      cable_metrajeA: '',
      cable_metrajeB: '',
      cable_metrajeC: '',
      terminal1_fabricante: '',
      terminal1_modelo: '',
      terminal1_snA: '',
      terminal1_snB: '',
      terminal1_snC: '',
      terminal2_fabricante: '',
      terminal2_modelo: '',
      terminal2_snA: '',
      terminal2_snB: '',
      terminal2_snC: '',
      empalmes_fabricante: '',
      empalmes_modelo: '',
      empalmes_metrajeA: '',
      empalmes_metrajeB: '',
      empalmes_metrajeC: '',
      gis_fabricante: '',
      gis_tipo: '',
      gis_fecha: '',
      gis_lote: '',
      gis_tension_un: '',
      gis_tension_ur: '',
      gis_norma: '',
    };
  }

  private loadTestedMaterialFromDB(dccId: string) {
    const preferredType = this.inferTestedMaterialType(this.coreData?.pt_id);
    const gisQuery = {
      action: 'get',
      bd: this.database,
      table: 'ie_tested_material_gis',
      opts: {
        where: { id_ie: dccId, deleted: 0 },
      },
    };

    this.dccDataService.post(gisQuery).subscribe({
      next: (gisResponse: any) => {
        const gisRow = gisResponse?.result?.[0];
        if (gisRow) {
          this.testedMaterial = {
            ...this.getEmptyTestedMaterial('gis'),
            id: gisRow.id,
            material_type: 'gis',
            gis_fabricante: gisRow.fabricante || '',
            gis_tipo: gisRow.tipo || '',
            gis_fecha: gisRow.fecha_fabricante || '',
            gis_lote: gisRow.lote || '',
            gis_tension_un: gisRow.tension_un || '',
            gis_tension_ur: gisRow.tension_ur || '',
            gis_norma: gisRow.norma || '',
          };
          this.dccDataService.updateTestedMaterial(this.testedMaterial);
          return;
        }

        const cableQuery = {
          action: 'get',
          bd: this.database,
          table: 'ie_tested_material',
          opts: {
            where: { id_ie: dccId, deleted: 0 },
          },
        };

        this.dccDataService.post(cableQuery).subscribe({
          next: (response: any) => {
            const row = response?.result?.[0];
            if (row) {
              this.testedMaterial = {
                ...this.getEmptyTestedMaterial('cable'),
                id: row.id,
                material_type: 'cable',
                material_description: row.material_description || '',
                cable_fabricante: row.cable_fabricante || '',
                cable_modelo: row.cable_modelo || '',
                cable_metrajeA: row.cable_metrajeA || '',
                cable_metrajeB: row.cable_metrajeB || '',
                cable_metrajeC: row.cable_metrajeC || '',
                terminal1_fabricante: row.terminal1_fabricante || '',
                terminal1_modelo: row.terminal1_modelo || '',
                terminal1_snA: row.terminal1_snA || '',
                terminal1_snB: row.terminal1_snB || '',
                terminal1_snC: row.terminal1_snC || '',
                terminal2_fabricante: row.terminal2_fabricante || '',
                terminal2_modelo: row.terminal2_modelo || '',
                terminal2_snA: row.terminal2_snA || '',
                terminal2_snB: row.terminal2_snB || '',
                terminal2_snC: row.terminal2_snC || '',
                empalmes_fabricante: row.empalmes_fabricante || '',
                empalmes_modelo: row.empalmes_modelo || '',
                empalmes_metrajeA: row.empalmes_metrajeA || '',
                empalmes_metrajeB: row.empalmes_metrajeB || '',
                empalmes_metrajeC: row.empalmes_metrajeC || '',
              };
            } else {
              this.testedMaterial = this.getEmptyTestedMaterial(preferredType);
            }
            this.dccDataService.updateTestedMaterial(this.testedMaterial);
          },
          error: () => {
            this.testedMaterial = this.getEmptyTestedMaterial(preferredType);
            this.dccDataService.updateTestedMaterial(this.testedMaterial);
          },
        });
      },
      error: () => {
        this.testedMaterial = this.getEmptyTestedMaterial(preferredType);
        this.dccDataService.updateTestedMaterial(this.testedMaterial);
      },
    });
  }

  toggleEditTestedMaterial() {
    if (this.isEditingTestedMaterial) {
      // Cancel
      this.testedMaterial = JSON.parse(
        JSON.stringify(this.testedMaterialBackup),
      );
      this.isEditingTestedMaterial = false;
    } else {
      this.testedMaterialBackup = JSON.parse(
        JSON.stringify(this.testedMaterial),
      );
      this.isEditingTestedMaterial = true;
    }
  }

  saveTestedMaterial() {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay un certificado cargado.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Guardando material de prueba',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const materialType =
      this.testedMaterial?.material_type === 'gis' ? 'gis' : 'cable';
    const attributes =
      materialType === 'gis'
        ? {
            id_ie: dccId,
            fabricante: this.testedMaterial.gis_fabricante || '',
            tipo: this.testedMaterial.gis_tipo || '',
            fecha_fabricante: this.testedMaterial.gis_fecha || null,
            lote: this.testedMaterial.gis_lote || '',
            tension_un: this.testedMaterial.gis_tension_un || '',
            tension_ur: this.testedMaterial.gis_tension_ur || '',
            norma: this.testedMaterial.gis_norma || '',
          }
        : {
            id_ie: dccId,
            material_description:
              this.testedMaterial.material_description || '',
            cable_fabricante: this.testedMaterial.cable_fabricante || '',
            cable_modelo: this.testedMaterial.cable_modelo || '',
            cable_metrajeA: this.testedMaterial.cable_metrajeA || '',
            cable_metrajeB: this.testedMaterial.cable_metrajeB || '',
            cable_metrajeC: this.testedMaterial.cable_metrajeC || '',
            terminal1_fabricante:
              this.testedMaterial.terminal1_fabricante || '',
            terminal1_modelo: this.testedMaterial.terminal1_modelo || '',
            terminal1_snA: this.testedMaterial.terminal1_snA || '',
            terminal1_snB: this.testedMaterial.terminal1_snB || '',
            terminal1_snC: this.testedMaterial.terminal1_snC || '',
            terminal2_fabricante:
              this.testedMaterial.terminal2_fabricante || '',
            terminal2_modelo: this.testedMaterial.terminal2_modelo || '',
            terminal2_snA: this.testedMaterial.terminal2_snA || '',
            terminal2_snB: this.testedMaterial.terminal2_snB || '',
            terminal2_snC: this.testedMaterial.terminal2_snC || '',
            empalmes_fabricante: this.testedMaterial.empalmes_fabricante || '',
            empalmes_modelo: this.testedMaterial.empalmes_modelo || '',
            empalmes_metrajeA: this.testedMaterial.empalmes_metrajeA || '',
            empalmes_metrajeB: this.testedMaterial.empalmes_metrajeB || '',
            empalmes_metrajeC: this.testedMaterial.empalmes_metrajeC || '',
          };

    const existingId = this.testedMaterial.id;

    if (existingId) {
      const updateQuery = {
        action: 'update',
        bd: this.database,
        table:
          materialType === 'gis'
            ? 'ie_tested_material_gis'
            : 'ie_tested_material',
        opts: { attributes, where: { id: existingId } },
      };
      this.dccDataService.post(updateQuery).subscribe({
        next: () => this.onTestedMaterialSaved(),
        error: () => this.onTestedMaterialSaveError(),
      });
    } else {
      const createQuery = {
        action: 'create',
        bd: this.database,
        table:
          materialType === 'gis'
            ? 'ie_tested_material_gis'
            : 'ie_tested_material',
        opts: { attributes },
      };
      this.dccDataService.post(createQuery).subscribe({
        next: (response: any) => {
          const insertedId =
            response?.result?.insertId || response?.insertId || null;
          if (insertedId) {
            this.testedMaterial.id = insertedId;
          }
          this.testedMaterial.material_type = materialType;
          this.onTestedMaterialSaved();
        },
        error: () => this.onTestedMaterialSaveError(),
      });
    }
  }

  private onTestedMaterialSaved() {
    Swal.close();
    this.isEditingTestedMaterial = false;
    this.dccDataService.updateTestedMaterial(this.testedMaterial);
    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'El material de prueba se ha guardado correctamente.',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
    });
  }

  private onTestedMaterialSaveError() {
    Swal.close();
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo guardar el material de prueba.',
    });
  }

  // Obtener el estado de calibración de un patrón específico
  private getCalibrationStatus(patron: any): any {
    const calibrationDate = patron.tz_date;
    const intervalMonths = patron.calibration_interval || 0;

    if (!calibrationDate || !intervalMonths) {
      return {
        id_patron: patron.id_patron,
        isValid: false,
        hasCompleteInfo: false, // No tiene información completa
        message: `⚠️ El patrón con ID "${patron.id_patron}" no tiene información de calibración completa.`,
        remainingDays: null,
        expirationDate: null,
      };
    }

    // Calcular fecha de vencimiento
    const calDate = new Date(calibrationDate);
    const expirationDate = new Date(calDate);
    expirationDate.setMonth(expirationDate.getMonth() + intervalMonths);

    // Calcular días restantes
    const today = new Date();
    const diffTime = expirationDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isValid = diffDays > 0;

    let message = '';
    if (isValid) {
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const days = diffDays % 30;

      let timeRemaining = '';
      if (years > 0) timeRemaining += `${years} año${years > 1 ? 's' : ''} `;
      if (months > 0)
        timeRemaining += `${months} mes${months > 1 ? 'es' : ''} `;
      if (days > 0 || !timeRemaining)
        timeRemaining += `${days} día${days !== 1 ? 's' : ''}`;

      message = `✅ El patrón con ID "${patron.id_patron}" se encuentra calibrado. Tiempo restante: ${timeRemaining.trim()}`;
    } else {
      const daysExpired = Math.abs(diffDays);
      message = `⚠️ El patrón con ID "${patron.id_patron}" está vencido desde hace ${daysExpired} día${daysExpired !== 1 ? 's' : ''}. Venció el: ${expirationDate.toLocaleDateString()}`;
    }

    return {
      id_patron: patron.id_patron,
      isValid,
      hasCompleteInfo: true, // Tiene información completa
      message,
      remainingDays: diffDays,
      expirationDate: expirationDate.toISOString(),
    };
  }
}

/*
Explicación de por qué se guardan estos valores en Results:

1. **SF 1 - Mean Scale Factor**
   - Este resultado representa el promedio del Scale Factor calculado para la prueba SF 1 antes de cualquier ajuste.
   - Se guarda para documentar el valor obtenido en la calibración inicial, antes de aplicar correcciones o ajustes.
   - Es útil para trazabilidad y para comparar con el valor ajustado final.

2. **SF 1 - Table Results**
   - Este resultado contiene la tabla completa de mediciones (niveles de tensión, valores DUT y patrón) para la prueba SF 1 antes del ajuste.
   - Se guarda para tener el detalle de todas las mediciones y cómo se obtuvo el Scale Factor promedio.
   - Permite reconstruir el proceso de cálculo y validar los datos originales.

3. **SF 1 - Linearity Test**
   - Este resultado representa la prueba de linealidad para SF 1 antes del ajuste.
   - Aunque la configuración de Linearity Test aún no está implementada, el sistema reserva este espacio para cuando se agregue la funcionalidad.
   - Se guarda para mantener la estructura y permitir futuras extensiones sin romper el formato del certificado.

**Resumen:**  
- Todos estos resultados se guardan en la tabla `dcc_results` para documentar el proceso de calibración y asegurar trazabilidad.
- El Scale Factor promedio y la tabla de resultados permiten validar la calidad y consistencia de la calibración.
- El bloque de Linearity Test está preparado para futuras funcionalidades.
*/
