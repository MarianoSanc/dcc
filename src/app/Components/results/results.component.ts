import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import { Subscription } from 'rxjs';
import { Pt23ResultsComponent } from './pt23-results/pt23-results.component';
import { Pt24ResultsComponent } from './pt24-results/pt24-results.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Pt23ResultsComponent,
    Pt24ResultsComponent,
  ],
  templateUrl: './results.component.html',
  styleUrl: './results.component.css',
})
export class ResultsComponent implements OnInit, OnDestroy {
  measurementResult: any = {};
  usedMethods: any[] = [];
  influenceConditions: any[] = [];
  measuringEquipments: any[] = [];
  results: any[] = [];
  editingBlocks: { [key: string]: boolean } = {};
  private subscription: Subscription = new Subscription();
  coreData: any = {};
  resultsData: any = {};
  mainItem: any;
  items: any;
  database: string = 'calibraciones'; // Ajusta según tu entorno
  availableInfluenceConditions: any[] = [];

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    console.log('ResultsComponent initialized');
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        this.coreData = data.administrativeData.core;
        this.resultsData = data.results;

        // Cargar influence conditions desde BD si hay certificate_number
        if (data.administrativeData?.core?.certificate_number) {
          this.loadInfluenceConditionsFromDB(
            data.administrativeData.core.certificate_number
          );
        } else {
          // Solo inicializar con defaults si no hay datos en el servicio
          if (
            !this.influenceConditions ||
            this.influenceConditions.length === 0
          ) {
            this.initializeAvailableInfluenceConditions();
          }
        }

        // Solo sobreescribe otros datos si no hay datos locales
        if (
          !this.measurementResult ||
          Object.keys(this.measurementResult).length === 0
        ) {
          this.measurementResult = data.measurementResult
            ? { ...data.measurementResult }
            : {};
        }
        if (!this.usedMethods || this.usedMethods.length === 0) {
          this.usedMethods = data.usedMethods
            ? [...data.usedMethods]
            : this.getDefaultUsedMethods();
        }
        if (
          !this.measuringEquipments ||
          this.measuringEquipments.length === 0
        ) {
          this.measuringEquipments = data.measuringEquipments
            ? [...data.measuringEquipments]
            : this.getDefaultMeasuringEquipments();
        }
        if (!this.results || this.results.length === 0) {
          this.results = data.results
            ? [...data.results]
            : this.getDefaultResults();
        }

        // Actualizar la descripción del método hv_method si corresponde
        if (this.coreData?.pt_id && this.usedMethods?.length) {
          const ptId = this.coreData.pt_id;
          this.usedMethods = this.usedMethods.map((method) => {
            if (method.refType === 'hv_method' && method.description) {
              method.description = method.description.replace(
                /PT-\d{2}/g,
                ptId
              );
            }
            return method;
          });
        }
      })
    );

    // Cargar métodos usados desde la base de datos
    this.dccDataService
      .getAllUsedMethodsFromDatabase(this.database)
      .subscribe((methods) => {
        const ptId = this.coreData?.pt_id;
        this.usedMethods = methods.map((method) => {
          if (ptId && method.refType === 'hv_method' && method.description) {
            method.description = method.description.replace(/PT-\d{2}/g, ptId);
          }
          return method;
        });
        console.log('Used methods loaded from DB:', this.usedMethods);
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
    this.results[resultIndex].data.push({
      id: this.generateId(),
      refType: '',
      name: '',
      dataType: 'realListXMLList',
      valueXMLList: '',
      unitXMLList: '\\kilovolt', // Default to kilovolt
      value: '',
      unit: '\\one', // Default to one
      hasUncertainty: false,
      measurementUncertainty: {
        expandedMU: {
          valueExpandedMUXMLList: '',
          coverageFactorXMLList: '2',
          coverageProbabilityXMLList: '0.95',
        },
      },
    });
  }

  onUncertaintyToggle(data: any) {
    if (!data.hasUncertainty) {
      // Limpiar datos de incertidumbre cuando se desactiva
      if (data.measurementUncertainty?.expandedMU) {
        data.measurementUncertainty.expandedMU.valueExpandedMUXMLList = '';
        data.measurementUncertainty.expandedMU.coverageFactorXMLList = '2';
        data.measurementUncertainty.expandedMU.coverageProbabilityXMLList =
          '0.95';
      }
    } else {
      // Inicializar estructura si no existe
      if (!data.measurementUncertainty) {
        data.measurementUncertainty = {
          expandedMU: {
            valueExpandedMUXMLList: '',
            coverageFactorXMLList: '2',
            coverageProbabilityXMLList: '0.95',
          },
        };
      }
    }
  }

  private getDefaultResults(): any[] {
    return [
      {
        id: this.generateId(),
        name: 'Table Results',
        refType: '',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_range',
            name: 'Range',
            dataType: 'realListXMLList',
            valueXMLList: '',
            unitXMLList: '\\volt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_measurementError',
            name: 'Voltage Error',
            dataType: 'realListXMLList',
            valueXMLList: '',
            unitXMLList: '\\one',
            value: '',
            unit: '',
            hasUncertainty: false,
            measurementUncertainty: {
              expandedMU: {
                valueExpandedMUXMLList: '',
                coverageFactorXMLList: '2',
                coverageProbabilityXMLList: '0.95',
              },
            },
          },
        ],
      },
    ];
  }

  // Block editing methods
  toggleEdit(blockName: string) {
    this.editingBlocks[blockName] = !this.editingBlocks[blockName];
  }

  isEditing(blockName: string): boolean {
    return this.editingBlocks[blockName] || false;
  }

  saveBlock(blockName: string) {
    this.editingBlocks[blockName] = false;

    if (blockName === 'influence-conditions') {
      this.saveInfluenceConditionsToDB();
    } else {
      this.updateServiceData(blockName);
    }

    console.log(`Saving ${blockName} data`);
  }

  private saveInfluenceConditionsToDB() {
    console.log('💾 ===== SAVING INFLUENCE CONDITIONS TO DB =====');

    const dccId = this.coreData?.certificate_number;
    if (!dccId) {
      console.error('  ❌ No certificate_number found');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró el Certificate Number para guardar.',
      });
      return;
    }

    console.log('  📋 DCC ID:', dccId);
    console.log('  📊 Conditions to save:', this.influenceConditions);

    // Mostrar loading
    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando Influence Conditions',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Primero, verificar qué condiciones existen en BD
    const checkQuery = {
      action: 'get',
      bd: this.database,
      table: 'dcc_influencecondition',
      opts: {
        where: { id_dcc: dccId },
      },
    };

    this.dccDataService.post(checkQuery).subscribe({
      next: (response: any) => {
        const existingConditions = response?.result || [];
        console.log('  📊 Existing conditions in DB:', existingConditions);

        const promises: Promise<any>[] = [];

        // Obtener solo las condiciones activas
        const activeConditions = this.getActiveAvailableConditions();
        console.log('  ✅ Active conditions:', activeConditions);

        activeConditions.forEach((condition: any) => {
          const existingCond = existingConditions.find(
            (existing: any) => existing.name === condition.name
          );

          const attributes = {
            id_dcc: dccId,
            name: condition.name,
            quantity_name: condition.subBlock.name,
            quantity_value: condition.subBlock.value || '',
            quantity_unit: condition.subBlock.unit,
          };

          if (existingCond) {
            // UPDATE
            const updateQuery = {
              action: 'update',
              bd: this.database,
              table: 'dcc_influencecondition',
              opts: {
                attributes: {
                  quantity_name: attributes.quantity_name,
                  quantity_value: attributes.quantity_value,
                  quantity_unit: attributes.quantity_unit,
                },
                where: { id: existingCond.id },
              },
            };

            console.log('  🔄 UPDATE query:', updateQuery);
            promises.push(this.dccDataService.post(updateQuery).toPromise());
          } else {
            // CREATE
            const createQuery = {
              action: 'create',
              bd: this.database,
              table: 'dcc_influencecondition',
              opts: { attributes },
            };

            console.log('  ➕ CREATE query:', createQuery);
            promises.push(this.dccDataService.post(createQuery).toPromise());
          }
        });

        // Eliminar condiciones que ya no están activas
        existingConditions.forEach((existing: any) => {
          const stillActive = activeConditions.some(
            (active: any) => active.name === existing.name
          );

          if (!stillActive) {
            const deleteQuery = {
              action: 'delete',
              bd: this.database,
              table: 'dcc_influencecondition',
              opts: { where: { id: existing.id } },
            };

            console.log('  🗑️ DELETE query:', deleteQuery);
            promises.push(this.dccDataService.post(deleteQuery).toPromise());
          }
        });

        Promise.all(promises)
          .then((responses) => {
            console.log('  ✅ All operations completed:', responses);

            // Verificar que todas las operaciones fueron exitosas
            const allSuccess = responses.every(
              (resp: any) => resp?.result || resp?.success
            );

            Swal.close();

            if (allSuccess) {
              this.dccDataService.updateInfluenceConditions(
                this.influenceConditions
              );
              this.editingBlocks['influence-conditions'] = false;

              Swal.fire({
                icon: 'success',
                title: '¡Guardado!',
                text: 'Las Influence Conditions se han guardado correctamente.',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
              });
            } else {
              Swal.fire({
                icon: 'warning',
                title: 'Guardado parcial',
                text: 'Algunas condiciones no se pudieron guardar correctamente.',
              });
            }
          })
          .catch((error) => {
            Swal.close();
            console.error('  ❌ Error saving conditions:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un error al guardar las Influence Conditions.',
            });
          });
      },
      error: (error) => {
        Swal.close();
        console.error('  ❌ Error checking existing conditions:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al verificar las condiciones existentes.',
        });
      },
    });
  }

  private updateServiceData(blockName: string) {
    switch (blockName) {
      case 'measurement-result':
        this.dccDataService.updateMeasurementResult(this.measurementResult);
        break;
      case 'used-methods':
        this.dccDataService.updateUsedMethods(this.usedMethods);
        break;
      case 'influence-conditions':
        this.dccDataService.updateInfluenceConditions(this.influenceConditions);
        break;
      case 'measuring-equipments':
        this.dccDataService.updateMeasuringEquipments(this.measuringEquipments);
        break;
      case 'results':
        this.dccDataService.updateResults(this.results);
        break;
    }
  }

  private loadFromService() {
    const currentData = this.dccDataService.getCurrentData();
    // Solo sobreescribe si no hay datos locales (para no perder cambios no guardados)
    if (
      !this.measurementResult ||
      Object.keys(this.measurementResult).length === 0
    ) {
      this.measurementResult = currentData.measurementResult
        ? { ...currentData.measurementResult }
        : {};
    }
    if (!this.usedMethods || this.usedMethods.length === 0) {
      this.usedMethods = currentData.usedMethods
        ? [...currentData.usedMethods]
        : this.getDefaultUsedMethods();
    }
    if (!this.influenceConditions || this.influenceConditions.length === 0) {
      this.influenceConditions = currentData.influenceConditions
        ? [...currentData.influenceConditions]
        : this.getDefaultInfluenceConditions();
    }
    if (!this.measuringEquipments || this.measuringEquipments.length === 0) {
      this.measuringEquipments = currentData.measuringEquipments
        ? [...currentData.measuringEquipments]
        : this.getDefaultMeasuringEquipments();
    }
    if (!this.results || this.results.length === 0) {
      this.results = currentData.results
        ? [...currentData.results]
        : this.getDefaultResults();
    }
  }

  // Used Methods management
  addMethod() {
    const newMethod = {
      id: this.generateId(),
      name: '',
      refType: '',
      description: '',
      norm: '',
      reference: '',
    };
    this.usedMethods.push(newMethod);
  }

  removeMethod(methodId: string) {
    this.usedMethods = this.usedMethods.filter(
      (method) => method.id !== methodId
    );
  }

  removeMeasuringEquipment(equipmentId: string) {
    this.measuringEquipments = this.measuringEquipments.filter(
      (equipment) => equipment.id !== equipmentId
    );
  }

  addIdentificationToEquipment(equipmentIndex: number) {
    this.measuringEquipments[equipmentIndex].identifications.push({
      issuer: '',
      value: '',
      name: '',
    });
  }

  removeIdentificationFromEquipment(
    equipmentIndex: number,
    identificationIndex: number
  ) {
    this.measuringEquipments[equipmentIndex].identifications.splice(
      identificationIndex,
      1
    );
  }

  // Results management
  addResult() {
    const newResult = {
      id: this.generateId(),
      name: '',
      refType: '',
      data: [
        {
          id: this.generateId(),
          refType: '',
          name: '',
          dataType: 'realListXMLList',
          valueXMLList: '',
          unitXMLList: '',
          value: '',
          unit: '',
        },
      ],
    };
    this.results.push(newResult);
  }

  removeResult(resultId: string) {
    this.results = this.results.filter((result) => result.id !== resultId);
  }

  removeDataFromResult(resultIndex: number, dataIndex: number) {
    this.results[resultIndex].data.splice(dataIndex, 1);
  }

  private generateId(): string {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private loadInfluenceConditionsFromDB(dccId: string) {
    console.log('🔍 ===== LOADING INFLUENCE CONDITIONS FROM DB =====');
    console.log('  DCC ID:', dccId);

    const checkQuery = {
      action: 'get',
      bd: this.database,
      table: 'dcc_influencecondition',
      opts: {
        where: { id_dcc: dccId },
      },
    };

    this.dccDataService.post(checkQuery).subscribe({
      next: (response: any) => {
        console.log('  📊 DB Response:', response);

        if (
          response?.result &&
          Array.isArray(response.result) &&
          response.result.length > 0
        ) {
          const dbConditions = response.result;
          console.log('  ✅ Found conditions in DB:', dbConditions.length);

          // Mapear condiciones de BD a formato local
          const mappedConditions = dbConditions.map((dbCond: any) => {
            const refType = this.getRefTypeFromName(dbCond.name);
            return {
              id: this.generateId(),
              name: dbCond.name,
              refType: refType,
              active: true,
              required: this.isRequiredCondition(dbCond.name),
              subBlock: {
                name: dbCond.quantity_name,
                value: dbCond.quantity_value || '',
                unit: dbCond.quantity_unit || this.getDefaultUnit(refType),
              },
            };
          });

          this.influenceConditions = mappedConditions;

          // Actualizar availableInfluenceConditions
          this.initializeAvailableInfluenceConditions();
          this.availableInfluenceConditions.forEach((condition) => {
            const found = mappedConditions.find(
              (mapped: any) => mapped.name === condition.name
            );
            if (found) {
              condition.active = true;
              condition.subBlock = { ...found.subBlock };
            } else {
              condition.active = condition.required;
            }
          });

          console.log(
            '  ✅ Conditions loaded successfully:',
            this.influenceConditions
          );
        } else {
          console.log('  ℹ️ No conditions found in DB, using defaults');
          this.initializeAvailableInfluenceConditions();
          this.influenceConditions = this.getDefaultInfluenceConditions();
        }
      },
      error: (error) => {
        console.error('  ❌ Error loading influence conditions:', error);
        this.initializeAvailableInfluenceConditions();
        this.influenceConditions = this.getDefaultInfluenceConditions();
      },
    });
  }

  private getRefTypeFromName(name: string): string {
    const nameMap: { [key: string]: string } = {
      'Ambient condition temperature': 'basic_temperature',
      'Ambient condition relative air humidity': 'basic_humidityRelative',
      'Ambient condition pressure': 'basic_pressure',
    };
    return nameMap[name] || '';
  }

  private isRequiredCondition(name: string): boolean {
    const requiredConditions = [
      'Ambient condition temperature',
      'Ambient condition relative air humidity',
    ];
    return requiredConditions.includes(name);
  }

  private getDefaultUnit(refType: string): string {
    const unitMap: { [key: string]: string } = {
      basic_temperature: '\\kelvin',
      basic_humidityRelative: '\\one',
      basic_pressure: '\\pascal',
    };
    return unitMap[refType] || '';
  }
}
