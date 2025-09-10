import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import { Subscription } from 'rxjs';
import { Pt23ResultsComponent } from './pt23-results/pt23-results.component';
import { Pt24ResultsComponent } from './pt24-results/pt24-results.component';

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

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        this.coreData = data.administrativeData.core;
        this.resultsData = data.results;

        // Solo sobreescribe si no hay datos locales (para no perder cambios no guardados)
        if (
          !this.measurementResult ||
          Object.keys(this.measurementResult).length === 0
        ) {
          this.measurementResult = data.measurementResult
            ? { ...data.measurementResult }
            : this.getDefaultMeasurementResult();
        }
        if (!this.usedMethods || this.usedMethods.length === 0) {
          this.usedMethods = data.usedMethods
            ? [...data.usedMethods]
            : this.getDefaultUsedMethods();
        }
        if (
          !this.influenceConditions ||
          this.influenceConditions.length === 0
        ) {
          this.influenceConditions = data.influenceConditions
            ? [...data.influenceConditions]
            : this.getDefaultInfluenceConditions();
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
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private getDefaultMeasurementResult(): any {
    return {
      name: 'Determination of Scale Factor / Voltage Measurement Error & Linearity Test.',
      description:
        'Determination of Scale Factor / Measurement Error by direct comparison with reference measurement system.\nLinearity test.',
    };
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
        status: 'beforeAdjustment',
        subBlock: {
          name: 'Temperature',
          value: '21.6',
          unit: '\\degreecelsius',
        },
      },
      {
        id: this.generateId(),
        name: 'Ambient condition relative air humidity',
        refType: 'basic_humidityRelative',
        status: 'beforeAdjustment',
        subBlock: {
          name: 'Relative humidity of the ambient air',
          value: '48.1',
          unit: '\\percent',
        },
      },
    ];
  }

  private getDefaultMeasuringEquipments(): any[] {
    return [
      {
        id: this.generateId(),
        name: 'Reference Measuring System',
        refType: 'basic_standardUsed',
        identifications: [
          {
            issuer: 'calibrationLaboratory',
            value: '810-0000+620-0000',
            name: 'Laboratory ID',
          },
        ],
      },
      {
        id: this.generateId(),
        name: 'Baro-Thermohygrometer',
        refType: 'basic_auxiliaryEquipment',
        identifications: [
          {
            issuer: 'calibrationLaboratory',
            value: '626-0000',
            name: 'Laboratory ID',
          },
        ],
      },
    ];
  }

  private getDefaultResults(): any[] {
    return [
      {
        id: this.generateId(),
        name: 'Table Results',
        refType: 'hv_scaleFactor',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_range',
            name: 'Range',
            dataType: 'realListXMLList',
            valueXMLList: '1 10 20 30 40 50 60 70 80 90 100',
            unitXMLList: '\\kilovolt',
            value: '',
            unit: '',
          },
          {
            id: this.generateId(),
            refType: 'basic_measuredValue',
            name: 'Voltage Measured',
            dataType: 'realListXMLList',
            valueXMLList:
              '1.50 10.71 21.62 32.56 43.01 53.38 64.13 74.25 83.11 91.93 103.15',
            unitXMLList: '\\kilovolt',
            value: '',
            unit: '',
          },
        ],
      },
      {
        id: this.generateId(),
        name: 'Linearity Test Results',
        refType: 'hv_linearity',
        data: [
          {
            id: this.generateId(),
            refType: 'hv_meanScaleFactor',
            name: 'Mean Value of Scale Factor Obtained',
            dataType: 'real',
            valueXMLList: '',
            unitXMLList: '',
            value: '0.932',
            unit: '\\one',
          },
          {
            id: this.generateId(),
            refType: 'hv_linearity',
            name: 'Linearity of Scale Factor (voltage dependace) obtained',
            dataType: 'real',
            valueXMLList: '',
            unitXMLList: '',
            value: '3.96',
            unit: '\\percent',
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
    this.updateServiceData(blockName);
    console.log(`Saving ${blockName} data`);
  }

  cancelEdit(blockName: string) {
    this.editingBlocks[blockName] = false;
    this.loadFromService();
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
        : this.getDefaultMeasurementResult();
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

  // Influence Conditions management
  addInfluenceCondition() {
    const newCondition = {
      id: this.generateId(),
      name: '',
      refType: '',
      status: 'beforeAdjustment',
      subBlock: {
        name: '',
        value: '',
        unit: '',
      },
    };
    this.influenceConditions.push(newCondition);
  }

  removeInfluenceCondition(conditionId: string) {
    this.influenceConditions = this.influenceConditions.filter(
      (condition) => condition.id !== conditionId
    );
  }

  // Measuring Equipments management
  addMeasuringEquipment() {
    const newEquipment = {
      id: this.generateId(),
      name: '',
      refType: '',
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
    });
  }

  removeDataFromResult(resultIndex: number, dataIndex: number) {
    this.results[resultIndex].data.splice(dataIndex, 1);
  }

  private generateId(): string {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
