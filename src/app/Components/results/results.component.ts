import { ViewChild } from '@angular/core';
import { Pt23ResultsComponent } from './pt23-results/pt23-results.component';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import { Subscription } from 'rxjs';
// import already present above
import Swal from 'sweetalert2';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule, Pt23ResultsComponent],
  templateUrl: './results.component.html',
  styleUrl: './results.component.css',
})
export class ResultsComponent implements OnInit, OnDestroy {
  logResults() {
    console.log('RENDER this.results:', this.results);
    return '';
  }
  @ViewChild('pt23ResultsComponent')
  pt23ResultsComponent?: Pt23ResultsComponent;
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
                  mu?.['si:valueExpandedMUXMLList']
                ),
                coverageFactorXMLList: this.getText(
                  mu?.['si:coverageFactorXMLList']
                ),
                coverageProbabilityXMLList: this.getText(
                  mu?.['si:coverageProbabilityXMLList']
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

    console.log('influenceBlock extracted from XML:', influenceBlock);
    if (!influenceBlock) {
      console.log('No influence conditions found in XML.');
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
    console.log('Final influenceConditions:', this.influenceConditions);
  }
  // Recibe el modo de operación desde el componente padre
  // Recibe el modo de operación desde el componente padre
  @Input() operationMode: 'create' | 'load' | 'xml' | null = null;
  measurementResult: any = {};
  usedMethods: any[] = [];
  influenceConditions: any[] = [];
  measuringEquipments: any[] = [];
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

  editingMeasurementUncertainty: boolean = false; // NUEVO: modo edición exclusivo

  // Getter to expose the current DCC id (certificate number) for backward compatibility
  private get dccId(): string | undefined {
    return this.coreData?.certificate_number;
  }

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    console.log('ResultsComponent initialized');

    // Cargar coreData una sola vez del observable solo para obtener el certificate_number
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        const certificateNumber =
          data.administrativeData?.core?.certificate_number;
        const ptId = data.administrativeData?.core?.pt_id;

        // Solo actualizar coreData si cambió el certificado
        if (
          certificateNumber &&
          certificateNumber !== this.coreData?.certificate_number
        ) {
          this.coreData = {
            certificate_number: certificateNumber,
            pt_id: ptId,
          };

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
      })
    );
  }

  // Método centralizado para cargar todos los datos desde BD
  private loadAllDataFromDB(dccId: string) {
    console.log('Loading all data from DB for dccId:', dccId);

    // Cargar influence conditions
    this.loadInfluenceConditionsFromDB(dccId);

    // Cargar measuring equipments
    this.loadMeasuringEquipmentsFromDB(dccId);

    // Cargar used methods
    this.loadUsedMethodsFromDB(dccId);

    // Cargar measurement result
    this.loadMeasurementResultFromDB(dccId);

    // Cargar results (incluye PT-23 si existe)
    this.loadResultsFromDB();
  }

  // Nuevo método para cargar used methods desde BD
  private loadUsedMethodsFromDB(dccId: string) {
    this.dccDataService.getAllUsedMethodsFromDatabase(this.database).subscribe({
      next: (methods) => {
        const ptId = this.coreData?.pt_id;
        this.usedMethods = methods.map((method) => {
          if (ptId && method.refType === 'hv_method' && method.description) {
            method.description = method.description.replace(/PT-\d{2}/g, ptId);
          }
          return method;
        });
        console.log('Used methods loaded from DB:', this.usedMethods.length);
      },
      error: () => {
        console.log('No used methods in DB, using defaults');
        this.usedMethods = this.getDefaultUsedMethods();
      },
    });
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
            console.log('Measurement result loaded from DB');
          }
        } else {
          this.measurementResult = {};
          console.log('No measurement result in DB');
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
          loaded.name === condition.name || loaded.refType === condition.refType
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
      (condition) => condition.active !== false
    );
  }

  getActiveAvailableConditions() {
    return this.availableInfluenceConditions.filter(
      (condition) => condition.active
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
      })
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
            (r: any) => r.name === result.name && r.ref_type === result.refType
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
            console.log(
              '✅ All results saved to DB. Total:',
              this.results.length
            );
            console.log('Saved results breakdown:');
            this.results.forEach((r, i) => {
              console.log(`  ${i + 1}. ${r.name} (${r.refType})`);
            });

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
              (dbResult: any) => dbResult.ref_type !== 'measurementResult'
            )
            .forEach((dbResult: any) => {
              const dbData = dbResult.data ? JSON.parse(dbResult.data) : [];
              const resultInMemory = this.results.find(
                (r) => r.id === dbResult.id
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
          console.log('Measurement uncertainties synced from DB');
        }
      },
      error: () => {
        console.error('Error loading measurement uncertainties from DB');
      },
    });
  }

  // Modifica loadResultsFromDB para cargar directamente sin limpiar
  private loadResultsFromDB() {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) {
      console.log('No dccId available for loading results');
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
          console.log('📦 Raw DB response:', response.result.length, 'rows');

          // Cargar TODOS los resultados sin filtrar por ref_type
          this.results = response.result
            .filter((dbResult: any) => {
              const isMeasurementResult =
                dbResult.ref_type === 'measurementResult';
              if (isMeasurementResult) {
                console.log('  ⏭️  Skipping measurementResult');
              }
              return !isMeasurementResult;
            })
            .map((dbResult: any) => {
              const dbData = dbResult.data ? JSON.parse(dbResult.data) : [];
              console.log(
                `  ✅ Loading: ${dbResult.name} (${dbResult.ref_type})`
              );
              return {
                id: dbResult.id,
                name: dbResult.name,
                refType: dbResult.ref_type,
                data: Array.isArray(dbData) ? dbData : [],
              };
            });
          console.log(
            '✅ Results loaded from DB:',
            this.results.length,
            'items'
          );
          console.log('Results breakdown:');
          this.results.forEach((r, i) => {
            console.log(
              `  ${i + 1}. ${r.name} (${r.refType}) - ${
                Array.isArray(r.data) ? r.data.length : 1
              } quantities`
            );
          });
        } else {
          console.log('⚠️  No results found in DB.');
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
        } else {
          // Si no hay datos en BD, inicializa con los valores por defecto
          this.influenceConditions = this.getDefaultInfluenceConditions();
          console.log(
            'No influence conditions found in DB, using default.',
            this.influenceConditions
          );
        }
      },
      error: () => {
        this.influenceConditions = this.getDefaultInfluenceConditions();
      },
    });
  }

  // Guardar edición de Influence Conditions en la BD
  saveBlock(blockName: string) {
    if (blockName === 'influence-conditions') {
      const dccId = this.coreData?.certificate_number;
      if (!dccId) return;

      // Guardar cada condición en la tabla dcc_influencecondition
      const promises = this.influenceConditions.map((cond, idx) => {
        const attributes = {
          id_dcc: dccId,
          name: cond.name,
          ref_type: cond.refType,
          quantity_name: cond.subBlock.name,
          quantity_value: cond.subBlock.value,
          quantity_unit: cond.subBlock.unit,
        };
        console.log('Saving condition attributes:', attributes);

        // Si existe id, actualiza; si no, crea
        if (cond.id) {
          const updateQuery = {
            action: 'update',
            bd: this.database,
            table: 'dcc_influencecondition',
            opts: {
              attributes,
              where: { id: cond.id },
            },
          };
          console.log('Updating condition with query:', updateQuery);
          return this.dccDataService.post(updateQuery).toPromise();
        } else {
          const createQuery = {
            action: 'create',
            bd: this.database,
            table: 'dcc_influencecondition',
            opts: { attributes },
          };
          return this.dccDataService.post(createQuery).toPromise();
        }
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

  // Agrega el método faltante para cargar equipos de medición desde la BD
  private loadMeasuringEquipmentsFromDB(dccId: string) {
    if (!dccId) return;

    const query = {
      action: 'get',
      bd: this.database,
      table: 'dcc_measuringequipments',
      opts: {
        where: { id_dcc: dccId, deleted: 0 },
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        if (response?.result && response.result.length > 0) {
          this.measuringEquipments = response.result.map((row: any) => ({
            id: row.id,
            name: row.name,
            refType: row.ref_type,
            manufacturer: row.manufacturer,
            model: row.model,
            // Adaptar identifications para incluir id_asset y serial_number
            identifications: [
              ...(Array.isArray(row.identifications)
                ? row.identifications
                : []),
              ...(row.id_asset
                ? [
                    {
                      name: 'Asset ID',
                      value: row.id_asset,
                      issuer: 'Laboratory',
                    },
                  ]
                : []),
              ...(row.serial_number
                ? [
                    {
                      name: 'Serial Number',
                      value: row.serial_number,
                      issuer: 'Manufacturer',
                    },
                  ]
                : []),
            ],
          }));
        } else {
          this.measuringEquipments = this.getDefaultMeasuringEquipments();
        }
      },
      error: () => {
        this.measuringEquipments = this.getDefaultMeasuringEquipments();
      },
    });
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
