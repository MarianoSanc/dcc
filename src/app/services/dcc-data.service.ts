import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { UrlClass } from '../shared/models/url.model';

export interface DCCData {
  administrativeData: {
    software: {
      name: string;
      version: string;
      type: string;
      description: string;
    };
    core: {
      pt_id: string;
      country_code: string;
      language: string;
      certificate_number: string;
      receipt_date: Date;
      is_range_date: boolean;
      performance_date: Date;
      end_performance_date: Date;
      issue_date: Date;
      performance_localition: string;
    };
    laboratory: {
      name: string;
      email: string;
      phone: string;
      fax: string;
      postal_code: string;
      city: string;
      street: string;
      street_number: string;
      state: string;
      country: string;
      laboratory_id: string;
    };
    responsiblePersons: Array<{
      role: string;
      no_nomina?: string;
      full_name?: string;
      name?: string;
      email: string;
      phone: string;
      mainSigner?: boolean; // Nueva propiedad para identificar al responsable principal
    }>;
    customer: {
      name: string;
      email: string;
      phone: string;
      fax: string;
      postal_code: string;
      city: string;
      street: string;
      street_number: string;
      state: string;
      country: string;
      customer_id: string;
    };
  };
  items: Array<{
    id: string;
    name: string; // Object name
    model: string;
    manufacturer: string;
    serialNumber: string; // Nuevo campo específico
    customerAssetId: string; // Nuevo campo específico
    identifications: Array<{
      issuer: string;
      value: string;
      name: string;
    }>;
    itemQuantities: Array<{
      refType: string;
      name: string;
      value: string;
      unit: string;
    }>;
    subItems: Array<{
      id: string;
      name: string;
      model: string;
      manufacturer: string;
      identifications: Array<{
        issuer: string;
        value: string;
        name: string;
      }>;
      itemQuantities: Array<{
        refType: string;
        name: string;
        value: string;
        unit: string;
      }>;
    }>;
  }>;
  objectIdentifications?: Array<{
    id: string;
    groupId: string;
    groupName: string;
    groupIndex: number;
    // Removido: name field
    assignedMeasurementRange: {
      label: string;
      value: string;
      unit: string;
    };
    assignedScaleFactor: {
      label: string;
      value: string;
      unit: string;
    };
    ratedFrequency: {
      label: string;
      value: string;
      unit: string;
    };
  }>;
  statements?: Array<{
    id: string;
    convention?: string;
    traceable?: boolean;
    declaration?: string;
    norm?: string;
    reference?: string;
    valid?: 1 | null;
    respAuthority_name?: string;
    respAuthority_countryCode?: string;
    respAuthority_postCode?: string;
  }>;
  measurementResult?: {
    name: string;
    description: string;
  };
  usedMethods?: Array<{
    id: string;
    name: string;
    refType: string;
    description: string;
    norm: string;
    reference: string;
  }>;
  influenceConditions?: Array<{
    id: string;
    name: string;
    refType: string;
    // Removido: status field
    subBlock: {
      name: string;
      value: string;
      unit: string;
    };
  }>;
  measuringEquipments?: Array<{
    id: string;
    name: string;
    refType: string;
    manufacturer?: string;
    model?: string;
    identifications: Array<{
      issuer: string;
      value: string;
      name: string;
    }>;
  }>;
  results?: Array<{
    id: string;
    name: string;
    refType: string;
    data: Array<{
      id: string;
      refType: string;
      name: string;
      dataType: 'realListXMLList' | 'real';
      valueXMLList: string;
      unitXMLList: string;
      value: string;
      unit: string;
      // Agregar soporte para incertidumbre
      measurementUncertainty?: {
        expandedMU?: {
          valueExpandedMUXMLList: string;
          coverageFactorXMLList: string;
          coverageProbabilityXMLList: string;
        };
      };
    }>;
  }>;
}

export interface QuantityData {
  id: string;
  refType: string;
  name: string;
  dataType: 'real' | 'realListXMLList';
  valueXMLList: string;
  unitXMLList: string;
  value: string;
  unit: string;
  // AGREGAR interfaz para Measurement Uncertainty
  measurementUncertainty?: {
    expandedMU?: {
      valueExpandedMUXMLList?: string;
      coverageFactorXMLList?: string;
      coverageProbabilityXMLList?: string;
    };
  };
}

@Injectable({
  providedIn: 'root',
})
export class DccDataService {
  private dccDataSubject = new BehaviorSubject<DCCData>(this.getInitialData());
  public dccData$ = this.dccDataSubject.asObservable();

  constructor(private apiService: ApiService) {}

  private getInitialData(): DCCData {
    return {
      administrativeData: {
        software: {
          name: 'DCC Generator',
          version: '1.0.0',
          type: 'application',
          description: 'Software para la generación de DCC',
        },
        core: {
          pt_id: 'PT-23',
          country_code: 'MX',
          language: 'en',
          certificate_number: '',
          receipt_date: new Date(),
          is_range_date: false,
          performance_date: new Date(),
          end_performance_date: new Date(),
          issue_date: new Date(),
          performance_localition: '',
        },
        laboratory: {
          name: 'HV Test S.A. de C.V.',
          email: '',
          phone: '449 963 6151',
          fax: '',
          postal_code: '20916',
          city: 'Jesús María',
          street: 'Eléctricos',
          street_number: '103 y 105',
          state: 'Aguascalientes',
          country: 'México',
          laboratory_id: '1',
        },
        responsiblePersons: [
          {
            role: '',
            name: '',
            email: '',
            phone: '',
          },
          {
            role: '',
            name: '',
            email: '',
            phone: '',
          },
        ],
        customer: {
          name: 'HV Test',
          email: '',
          phone: '449 963 6151',
          fax: '',
          postal_code: '20916',
          city: 'Jesús María',
          street: 'Eléctricos',
          street_number: '103 y 105',
          state: 'Aguascalientes',
          country: 'México',
          customer_id: '1',
        },
      },
      items: [
        {
          id: this.generateId(),
          name: 'HVAC MEASURING SYSTEM',
          model: '',
          manufacturer: '',
          serialNumber: '',
          customerAssetId: '',
          identifications: [],
          itemQuantities: [
            {
              refType: 'voltage_measurement_range',
              name: 'Assigned measurement range(s)',
              value: '',
              unit: '\\volt',
            },
            {
              refType: 'scale_factor',
              name: 'Assigned scale factor(s)',
              value: '',
              unit: '\\one',
            },
          ],
          subItems: [],
        },
      ],
      objectIdentifications: [
        {
          id: this.generateId(),
          groupId: 'group_1',
          groupName: 'Grupo 1',
          groupIndex: 0,
          assignedMeasurementRange: {
            label: 'Rated voltage',
            value: '',
            unit: '\\volt',
          },
          assignedScaleFactor: {
            label: 'Scale factor',
            value: '',
            unit: '\\one',
          },
          ratedFrequency: {
            label: 'Rated Frequency',
            value: '',
            unit: '\\one',
          },
        },
      ],
      statements: [
        {
          id: 'stmt_default_1',
          convention: '',
          traceable: false,
          declaration:
            'HV Test is a laboratory accredited by the Mexican accreditation body EMA (Entidad Mexicana de Acrediatión) and by the American accreditation body ANAB (ANSI National Accreditation Board), for calibrations in accordance with the International Standard.',
          norm: 'ISO/IEC',
          reference: '17025:2017',
          valid: 1,
          respAuthority_name: '',
          respAuthority_countryCode: '',
          respAuthority_postCode: '',
        },
        {
          id: 'stmt_default_2',
          convention: '',
          traceable: false,
          declaration:
            'The results in this document relate only to the device under calibration, at the time and conditions in which the measurments were made. The issuing Laboratory assumes no responsibility for any damages ensuing on account of misuse of the calibrated instruments.',
          norm: '',
          reference: '',
          valid: null,
          respAuthority_name: '',
          respAuthority_countryCode: '',
          respAuthority_postCode: '',
        },
        {
          id: 'stmt_default_3',
          convention: '',
          traceable: false,
          declaration:
            'The Certificate may not be partially reproduced unless it is permitted in writing by the issuing laboratory.',
          norm: '',
          reference: '',
          valid: null,
          respAuthority_name: '',
          respAuthority_countryCode: '',
          respAuthority_postCode: '',
        },
        {
          id: 'stmt_default_4',
          convention: '',
          traceable: false,
          declaration:
            'The calibrand was in the test room for at least two hours prior to the calibration measurements.',
          norm: '',
          reference: '',
          valid: null,
          respAuthority_name: '',
          respAuthority_countryCode: '',
          respAuthority_postCode: '',
        },
        {
          id: 'stmt_default_5',
          convention: '',
          traceable: false,
          declaration:
            'The traceability of the measurements is proven by means of unbroken chain of suitable and periodic calibration by national metrology institutes and designated institutes within the CIPM MRA (International Committee of Weights and Measures Mutual Recognition Arrangement), or calibration laboratories that have been accredited by an accreditation body subject to the ILAC (International Laboratory Accreditation Corporation) Arrangement or equivalent.',
          norm: '',
          reference: '',
          valid: null,
          respAuthority_name: '',
          respAuthority_countryCode: '',
          respAuthority_postCode: '',
        },
        {
          id: 'stmt_default_6',
          convention: '',
          traceable: false,
          declaration:
            'The calibrations within this certificate are traceable to the International System of Units (SI).',
          norm: '',
          reference: '',
          valid: null,
          respAuthority_name: '',
          respAuthority_countryCode: '',
          respAuthority_postCode: '',
        },
        {
          id: 'stmt_default_7',
          convention: '',
          traceable: false,
          declaration:
            'No adjustments of the device under test were made before, during or after the calibration tests.',
          norm: '',
          reference: '',
          valid: null,
          respAuthority_name: '',
          respAuthority_countryCode: '',
          respAuthority_postCode: '',
        },
      ],
      usedMethods: [
        {
          id: 'method_default_1',
          name: 'Direct comparison with reference measuring system',
          refType: 'basic_calibrationMethod',
          description:
            'The calibration tests have been made by direct comparison with a reference measuring system, according to calibration procedure PT-23 of the Laboratory and as per the requirements in the Standard IEC 60060-2 "High-voltage test techniques - Part 2: Measuring systems".',
          norm: 'IEC 60060-2',
          reference: 'Calibration procedure PT-23 of the Laboratory',
        },
        {
          id: 'method_default_2',
          name: 'Expanded uncertainty',
          refType: 'basic_uncertainty',
          description:
            'The reported expanded uncertainty of measurement is stated as the uncertainty of measurement multiplied by the coverage factor k = 2, which for a normal distribution corresponds to a coverage probability of approximately 95 %. The standard uncertainty of measurement has been determined in accordance with the GUM, "Guide to the Expression of Uncertainty in Measurement" (JCGM 100:2008, Evaluation of measurement data – Guide to the expression of uncertainty in measurement).',
          norm: 'GUM',
          reference: 'JCGM 100:2008',
        },
      ],
      influenceConditions: [
        {
          id: 'influence_default_1',
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
          id: 'influence_default_2',
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
          id: 'influence_default_3',
          name: 'Ambient condition pressure',
          refType: 'basic_pressure',
          // Removido: status: 'beforeAdjustment',
          subBlock: {
            name: 'Ambient Pressure',
            value: '',
            unit: '\\pascal',
          },
        },
      ],
      measuringEquipments: [
        {
          id: 'equipment_default_1',
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
          id: 'equipment_default_2',
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
      ],
      results: [],
    };
  }

  getCurrentData(): DCCData {
    return this.dccDataSubject.value;
  }

  updateAdministrativeData(section: string, data: any): void {
    const currentData = this.getCurrentData();
    (currentData.administrativeData as any)[section] = data;

    // Update PT-dependent method when core data changes
    if (section === 'core' && data.pt_id) {
      this.updatePTDependentMethod(data.pt_id);
    }

    this.dccDataSubject.next(currentData);
  }

  private updatePTDependentMethod(ptId: string): void {
    const currentData = this.getCurrentData();
    const method1 = currentData.usedMethods?.find(
      (method) => method.id === 'method_default_1'
    );

    if (method1) {
      const ptNumber = ptId.replace('PT-', '');
      method1.description = `The calibration tests have been made by direct comparison with a reference measuring system, according to calibration procedure ${ptId} of the Laboratory and as per the requirements in the Standard IEC 60060-2 "High-voltage test techniques - Part 2: Measuring systems".`;
      method1.reference = `Calibration procedure ${ptId} of the Laboratory`;
    }
  }

  updateItems(items: any[]): void {
    const currentData = this.getCurrentData();
    currentData.items = items;
    this.dccDataSubject.next(currentData);
  }

  updateObjectIdentifications(identifications: any[]): void {
    const currentData = this.getCurrentData();
    currentData.objectIdentifications = identifications;
    this.dccDataSubject.next(currentData);
  }

  updateStatements(statements: any[]): void {
    const currentData = this.getCurrentData();
    currentData.statements = statements;
    this.dccDataSubject.next(currentData);
  }

  updateMeasurementResult(measurementResult: any): void {
    const currentData = this.getCurrentData();
    currentData.measurementResult = measurementResult;
    this.dccDataSubject.next(currentData);
  }

  updateUsedMethods(usedMethods: any[]): void {
    const currentData = this.getCurrentData();
    currentData.usedMethods = usedMethods;
    this.dccDataSubject.next(currentData);
  }

  updateInfluenceConditions(influenceConditions: any[]): void {
    const currentData = this.getCurrentData();
    currentData.influenceConditions = influenceConditions;
    this.dccDataSubject.next(currentData);
  }

  updateMeasuringEquipments(measuringEquipments: any[]): void {
    const currentData = this.getCurrentData();
    currentData.measuringEquipments = measuringEquipments;
    this.dccDataSubject.next(currentData);
  }

  updateResults(results: any[]): void {
    const currentData = this.getCurrentData();
    currentData.results = results;
    this.dccDataSubject.next(currentData);
  }

  resetData(): void {
    const initialData = this.getInitialData();

    this.dccDataSubject.next(initialData);
  }

  loadFromXML(xmlContent: string): void {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Invalid XML format');
      }

      const dccData = this.parseXMLToDCCData(xmlDoc);
      this.dccDataSubject.next(dccData);
    } catch (error) {
      throw error;
    }
  }

  private parseXMLToDCCData(xmlDoc: Document): DCCData {
    const dccData: DCCData = this.getInitialData();

    // Parse Software Data
    const softwareNode = this.getElementByTagName(xmlDoc, 'software');
    if (softwareNode) {
      dccData.administrativeData.software = {
        name: this.getTextContent(softwareNode, 'name') || '',
        version: this.getTextContent(softwareNode, 'release') || '',
        type: this.getTextContent(softwareNode, 'type') || '',
        description: this.getTextContent(softwareNode, 'description') || '',
      };
    }

    // Parse Laboratory Data
    const labContactNode = this.getElementByTagName(xmlDoc, 'contact');
    if (labContactNode) {
      const locationNode = this.getElementByTagName(labContactNode, 'location');
      dccData.administrativeData.laboratory = {
        name: this.getContentText(labContactNode, 'name') || '',
        email: '', // Not in the XML example
        phone: this.getTextContent(labContactNode, 'phone') || '',
        fax: this.getTextContent(labContactNode, 'fax') || '',
        postal_code: this.getTextContent(locationNode, 'postCode') || '',
        city: this.getTextContent(locationNode, 'city') || '',
        street: this.getTextContent(locationNode, 'street') || '',
        street_number: this.getTextContent(locationNode, 'streetNo') || '',
        state: this.getTextContent(locationNode, 'state') || '',
        country: this.getTextContent(locationNode, 'countryCode') || '',
        laboratory_id: '', // Agregar campo para el ID del laboratorio
      };
    }

    // Parse Responsible Persons
    const respPersonsNode = this.getElementByTagName(xmlDoc, 'respPersons');
    if (respPersonsNode) {
      const respPersonNodes = this.getElementsByTagName(
        respPersonsNode,
        'respPerson'
      );

      if (respPersonNodes.length > 0) {
        dccData.administrativeData.responsiblePersons = respPersonNodes.map(
          (node) => {
            const personNode = this.getElementByTagName(node, 'person');

            // Verificar si es el mainSigner
            const mainSignerNode = this.getElementByTagName(node, 'mainSigner');
            const isMainSigner =
              mainSignerNode?.textContent?.trim().toLowerCase() === 'true';

            const personData = {
              role: this.getTextContent(node, 'role') || '',
              name: this.getContentText(personNode, 'name') || '',
              full_name: this.getContentText(personNode, 'name') || '', // Usar el nombre del XML como full_name
              no_nomina: '', // Se llenará después si se encuentra en la BD de usuarios
              email: this.getTextContent(personNode, 'eMail') || '',
              phone: this.getTextContent(personNode, 'phone') || '',
              mainSigner: isMainSigner, // Nueva propiedad
            };
            return personData;
          }
        );
      } else {
        dccData.administrativeData.responsiblePersons = [];
      }
    } else {
      dccData.administrativeData.responsiblePersons = [];
    }

    // Parse Customer Data
    const customerNode = this.getElementByTagName(xmlDoc, 'customer');
    if (customerNode) {
      const customerLocationNode = this.getElementByTagName(
        customerNode,
        'location'
      );
      dccData.administrativeData.customer = {
        name: this.getContentText(customerNode, 'name') || '',
        email: this.getTextContent(customerNode, 'eMail') || '',
        phone: this.getTextContent(customerNode, 'phone') || '',
        fax: this.getTextContent(customerNode, 'fax') || '',
        postal_code:
          this.getTextContent(customerLocationNode, 'postCode') || '',
        city: this.getTextContent(customerLocationNode, 'city') || '',
        street: this.getTextContent(customerLocationNode, 'street') || '',
        street_number:
          this.getTextContent(customerLocationNode, 'streetNo') || '',
        state: this.getTextContent(customerLocationNode, 'state') || '',
        country: this.getTextContent(customerLocationNode, 'countryCode') || '',
        customer_id: '', // Add a default or parsed value as needed
      };
    }

    // Parse Items and Object Identifications - Mejorado para ambos formatos
    const itemsRootNode = this.getElementByTagName(xmlDoc, 'items');
    if (itemsRootNode) {
      // Verificar si es el formato nuevo (3.3.0) o viejo (3.2.1)
      const mainItemNode = this.getElementsByTagName(itemsRootNode, 'item')[0];
      const isNewFormat =
        mainItemNode && this.getElementByTagName(mainItemNode, 'subItems');

      if (isNewFormat) {
        // Formato nuevo: items > item > subItems > item
        this.parseNewFormatItems(xmlDoc, dccData, mainItemNode);
      } else {
        // Formato viejo: items > item (múltiples items al mismo nivel)
        this.parseOldFormatItems(xmlDoc, dccData, itemsRootNode);
      }
    } else {
      dccData.items = this.getInitialData().items;
      dccData.objectIdentifications =
        this.getInitialData().objectIdentifications;
    }

    // Parse Statements
    const statementsNode = this.getElementByTagName(xmlDoc, 'statements');
    if (statementsNode) {
      const statementNodes = this.getElementsByTagName(
        statementsNode,
        'statement'
      );
      dccData.statements = statementNodes.map((node) => ({
        id: this.generateId(),
        convention: this.getTextContent(node, 'convention') || '',
        traceable:
          (this.getTextContent(node, 'traceable') || '').toLowerCase() ===
          'true',
        declaration: this.getContentText(node, 'declaration') || '',
        norm: this.getTextContent(node, 'norm') || '',
        reference: this.getTextContent(node, 'reference') || '',
        valid:
          this.getTextContent(node, 'valid') === 'true' ||
          this.getTextContent(node, 'valid') === '1'
            ? 1
            : null,
        respAuthority_name:
          this.getContentText(
            this.getElementByTagName(node, 'respAuthority'),
            'name'
          ) || '',
        respAuthority_countryCode:
          this.getTextContent(
            this.getElementByTagName(node, 'respAuthority'),
            'countryCode'
          ) || '',
        respAuthority_postCode:
          this.getTextContent(
            this.getElementByTagName(node, 'respAuthority'),
            'postCode'
          ) || '',
      }));
    }

    // Parse Measurement Result
    const measurementResultNode = this.getElementByTagName(
      xmlDoc,
      'measurementResult'
    );
    if (measurementResultNode) {
      dccData.measurementResult = {
        name: this.getContentText(measurementResultNode, 'name') || '',
        description:
          this.getContentText(measurementResultNode, 'description') || '',
      };

      // Parse Measuring Equipments
      const measuringEquipmentsNode = this.getElementByTagName(
        measurementResultNode,
        'measuringEquipments'
      );
      if (measuringEquipmentsNode) {
        const equipmentNodes = this.getElementsByTagName(
          measuringEquipmentsNode,
          'measuringEquipment'
        );
        dccData.measuringEquipments = equipmentNodes.map((node) => {
          const identificationNodes = this.getElementsByTagName(
            node,
            'identification'
          );
          return {
            id: this.generateId(),
            name: this.getContentText(node, 'name') || '',
            refType: node.getAttribute('refType') || '',
            manufacturer:
              this.getContentText(
                this.getElementByTagName(node, 'manufacturer'),
                'name'
              ) || '',
            model: this.getTextContent(node, 'model') || '',
            identifications: identificationNodes.map((idNode) => ({
              issuer: this.getTextContent(idNode, 'issuer') || '',
              value: this.getTextContent(idNode, 'value') || '',
              name: this.getContentText(idNode, 'name') || '',
            })),
          };
        });
      }

      // Parse Influence Conditions
      const influenceConditionsNode = this.getElementByTagName(
        measurementResultNode,
        'influenceConditions'
      );
      if (influenceConditionsNode) {
        const conditionNodes = this.getElementsByTagName(
          influenceConditionsNode,
          'influenceCondition'
        );
        dccData.influenceConditions = conditionNodes.map((node) => {
          const dataNode = this.getElementByTagName(node, 'data');
          const quantityNode = this.getElementByTagName(dataNode, 'quantity');

          // Parse hybrid/real structure
          const hybridNode = this.getElementByTagName(quantityNode, 'hybrid');
          const realNode = hybridNode
            ? this.getElementByTagName(hybridNode, 'real')
            : this.getElementByTagName(quantityNode, 'real');

          let value = '';
          let unit = '';

          if (realNode) {
            value = this.getTextContent(realNode, 'value') || '';
            unit = this.getTextContent(realNode, 'unit') || '';
          }

          return {
            id: this.generateId(),
            name: this.getContentText(node, 'name') || '',
            refType: node.getAttribute('refType') || '',
            // Removido: status: 'beforeAdjustment',
            subBlock: {
              name: this.getContentText(quantityNode, 'name') || '',
              value: value,
              unit: unit,
            },
          };
        });
      }

      // Parse Results
      const resultsNode = this.getElementByTagName(
        measurementResultNode,
        'results'
      );
      if (resultsNode) {
        const resultNodes = this.getElementsByTagName(resultsNode, 'result');
        dccData.results = resultNodes.map((node) => {
          const dataNode = this.getElementByTagName(node, 'data');
          const listNode = this.getElementByTagName(dataNode, 'list');

          let quantityNodes: Element[] = [];

          if (listNode) {
            quantityNodes = this.getElementsByTagName(listNode, 'quantity');
          } else {
            // Single quantity case
            const singleQuantity = this.getElementByTagName(
              dataNode,
              'quantity'
            );
            if (singleQuantity) {
              quantityNodes = [singleQuantity];
            }
          }

          return {
            id: this.generateId(),
            name: this.getContentText(node, 'name') || '',
            refType: node.getAttribute('refType') || '',
            data: quantityNodes.map((qNode) => {
              // Try different parsing approaches for both XML formats
              let dataResult: any = {
                id: this.generateId(),
                refType: qNode.getAttribute('refType') || '',
                name: this.getContentText(qNode, 'name') || '',
                dataType: 'realListXMLList' as const,
                valueXMLList: '',
                unitXMLList: '',
                value: '',
                unit: '',
              };

              // Approach 1: Check for direct realListXMLList (rev_3 format)
              const directRealListNode = this.getElementByTagName(
                qNode,
                'realListXMLList'
              );
              if (directRealListNode) {
                const valueXMLListNode = this.getElementByTagName(
                  directRealListNode,
                  'valueXMLList'
                );
                const unitXMLListNode = this.getElementByTagName(
                  directRealListNode,
                  'unitXMLList'
                );

                dataResult.dataType = 'realListXMLList';
                dataResult.valueXMLList =
                  valueXMLListNode?.textContent?.trim() || '';
                dataResult.unitXMLList =
                  unitXMLListNode?.textContent?.trim() || '';

                // Parse measurement uncertainty if present
                const uncertaintyNode = this.getElementByTagName(
                  directRealListNode,
                  'measurementUncertaintyUnivariateXMLList'
                );
                if (uncertaintyNode) {
                  const expandedMUNode = this.getElementByTagName(
                    uncertaintyNode,
                    'expandedMUXMLList'
                  );
                  if (expandedMUNode) {
                    const valueExpandedMUNode = this.getElementByTagName(
                      expandedMUNode,
                      'valueExpandedMUXMLList'
                    );
                    const coverageFactorNode = this.getElementByTagName(
                      expandedMUNode,
                      'coverageFactorXMLList'
                    );
                    const coverageProbabilityNode = this.getElementByTagName(
                      expandedMUNode,
                      'coverageProbabilityXMLList'
                    );

                    dataResult.measurementUncertainty = {
                      expandedMU: {
                        valueExpandedMUXMLList:
                          valueExpandedMUNode?.textContent?.trim() || '',
                        coverageFactorXMLList:
                          coverageFactorNode?.textContent?.trim() || '',
                        coverageProbabilityXMLList:
                          coverageProbabilityNode?.textContent?.trim() || '',
                      },
                    };
                  }
                }

                return dataResult;
              }

              // Approach 2: Check for direct real (rev_3 format)
              const directRealNode = this.getElementByTagName(qNode, 'real');
              if (directRealNode) {
                const valueNode = this.getElementByTagName(
                  directRealNode,
                  'value'
                );
                const unitNode = this.getElementByTagName(
                  directRealNode,
                  'unit'
                );

                dataResult.dataType = 'real';
                dataResult.value = valueNode?.textContent?.trim() || '';
                dataResult.unit = unitNode?.textContent?.trim() || '';
                return dataResult;
              }

              // Approach 3: Check for hybrid structure (3.3.0 and 3.2.1 formats)
              const hybridNode = this.getElementByTagName(qNode, 'hybrid');
              if (hybridNode) {
                const realListNode = this.getElementByTagName(
                  hybridNode,
                  'realListXMLList'
                );
                const realNode = this.getElementByTagName(hybridNode, 'real');

                if (realListNode) {
                  const valueXMLListNode = this.getElementByTagName(
                    realListNode,
                    'valueXMLList'
                  );
                  const unitXMLListNode = this.getElementByTagName(
                    realListNode,
                    'unitXMLList'
                  );

                  dataResult.dataType = 'realListXMLList';
                  dataResult.valueXMLList =
                    valueXMLListNode?.textContent?.trim() || '';
                  dataResult.unitXMLList =
                    unitXMLListNode?.textContent?.trim() || '';

                  // Parse measurement uncertainty from hybrid structure too
                  const uncertaintyNode = this.getElementByTagName(
                    realListNode,
                    'measurementUncertaintyUnivariateXMLList'
                  );
                  if (uncertaintyNode) {
                    const expandedMUNode = this.getElementByTagName(
                      uncertaintyNode,
                      'expandedMUXMLList'
                    );
                    if (expandedMUNode) {
                      const valueExpandedMUNode = this.getElementByTagName(
                        expandedMUNode,
                        'valueExpandedMUXMLList'
                      );
                      const coverageFactorNode = this.getElementByTagName(
                        expandedMUNode,
                        'coverageFactorXMLList'
                      );
                      const coverageProbabilityNode = this.getElementByTagName(
                        expandedMUNode,
                        'coverageProbabilityXMLList'
                      );

                      dataResult.measurementUncertainty = {
                        expandedMU: {
                          valueExpandedMUXMLList:
                            valueExpandedMUNode?.textContent?.trim() || '',
                          coverageFactorXMLList:
                            coverageFactorNode?.textContent?.trim() || '',
                          coverageProbabilityXMLList:
                            coverageProbabilityNode?.textContent?.trim() || '',
                        },
                      };
                    }
                  }

                  return dataResult;
                } else if (realNode) {
                  const valueNode = this.getElementByTagName(realNode, 'value');
                  const unitNode = this.getElementByTagName(realNode, 'unit');

                  dataResult.dataType = 'real';
                  dataResult.value = valueNode?.textContent?.trim() || '';
                  dataResult.unit = unitNode?.textContent?.trim() || '';
                  return dataResult;
                }
              }

              // Fallback: Return empty structure
              return dataResult;
            }),
          };
        });
      }
    }

    // Parse Used Methods
    const usedMethodsNode = this.getElementByTagName(xmlDoc, 'usedMethods');
    if (usedMethodsNode) {
      const methodNodes = this.getElementsByTagName(
        usedMethodsNode,
        'usedMethod'
      );
      dccData.usedMethods = methodNodes.map((node) => ({
        id: this.generateId(),
        name: this.getContentText(node, 'name') || '',
        refType: node.getAttribute('refType') || '',
        description: this.getContentText(node, 'description') || '',
        norm: this.getTextContent(node, 'norm') || '',
        reference: this.getTextContent(node, 'reference') || '',
      }));
    }

    // Parse Core Data (enlazar uniqueIdentifier a certificate_number y pt_id)
    const coreDataNode = this.getElementByTagName(xmlDoc, 'coreData');
    if (coreDataNode) {
      const uniqueIdentifier =
        this.getTextContent(coreDataNode, 'uniqueIdentifier') || '';
      dccData.administrativeData.core.certificate_number = uniqueIdentifier;

      // Extraer PT ID del penúltimo grupo si cumple el patrón esperado
      // Ejemplo: PC0434-00 CC 23 01  => pt_id = 'PT-23'
      // Ejemplo: PH2459-00 DCC 24 01 => pt_id = 'PT-24'
      let ptId = '';
      if (uniqueIdentifier) {
        const parts = uniqueIdentifier.trim().split(/\s+/);
        if (parts.length >= 3) {
          const penultimate = parts[parts.length - 2];
          if (/^\d{2}$/.test(penultimate)) {
            ptId = `PT-${penultimate}`;
          }
        }
      }
      dccData.administrativeData.core.pt_id = ptId || '';
    }

    return dccData;
  }

  // Nuevo método para parsear formato 3.3.0+
  private parseNewFormatItems(
    xmlDoc: Document,
    dccData: DCCData,
    mainItemNode: Element
  ) {
    const manufacturerNode = this.getElementByTagName(
      mainItemNode,
      'manufacturer'
    );
    const mainItemIdentificationsNode = this.getElementByTagName(
      mainItemNode,
      'identifications'
    );
    const subItemsNode = this.getElementByTagName(mainItemNode, 'subItems');

    let identificationNodes: Element[] = [];
    if (mainItemIdentificationsNode) {
      identificationNodes = this.getElementsByTagName(
        mainItemIdentificationsNode,
        'identification'
      );
    }

    // Extraer serial number y customer asset ID del main item
    let serialNumber = '';
    let customerAssetId = '';
    const objectGroups: any[] = [];

    // Procesar itemQuantities del main item para object groups
    const itemQuantityNodes = this.getElementsByTagName(
      mainItemNode,
      'itemQuantity'
    );

    let currentGroup: any = null;
    let groupIndex = 0;

    itemQuantityNodes.forEach((qNode, index) => {
      const refType = qNode.getAttribute('refType') || '';
      const realNode = this.getElementByTagName(qNode, 'real');
      let value = '';
      let label = '';

      if (realNode) {
        value = this.getTextContent(realNode, 'value') || '';
        label = this.getTextContent(realNode, 'label') || '';
      }

      if (refType === 'voltage_measurement_range') {
        currentGroup = {
          id: this.generateId(),
          groupId: `group_${groupIndex + 1}`,
          groupName: `Grupo ${groupIndex + 1}`,
          groupIndex: groupIndex,
          assignedMeasurementRange: {
            label: 'Rated voltage',
            value: value,
            unit: '\\volt',
          },
          assignedScaleFactor: {
            label: 'Scale factor',
            value: '',
            unit: '\\one',
          },
          ratedFrequency: {
            label: 'Rated Frequency',
            value: '',
            unit: '\\one',
          },
        };
        objectGroups.push(currentGroup);
        groupIndex++;
      } else if (refType === 'scale_factor' && currentGroup) {
        currentGroup.assignedScaleFactor = {
          label: 'Scale factor',
          value: value,
          unit: '\\one',
        };
      }
    });

    // Procesar identificaciones del main item
    identificationNodes.forEach((idNode, index) => {
      const name = this.getContentText(idNode, 'name') || '';
      const value = this.getTextContent(idNode, 'value') || '';

      if (name.toLowerCase().includes('serial')) {
        serialNumber = value;
      } else if (
        name.toLowerCase().includes('asset') ||
        (name.toLowerCase().includes('customer') &&
          name.toLowerCase().includes('id'))
      ) {
        customerAssetId = value;
      }
    });

    // Crear grupos por defecto si es necesario
    if (objectGroups.length === 0) {
      objectGroups.push({
        id: this.generateId(),
        groupId: 'group_1',
        groupName: 'Grupo 1',
        groupIndex: 0,
        assignedMeasurementRange: {
          label: 'Rated voltage',
          value: '',
          unit: '\\volt',
        },
        assignedScaleFactor: {
          label: 'Scale factor',
          value: '',
          unit: '\\one',
        },
        ratedFrequency: { label: 'Rated Frequency', value: '', unit: '\\one' },
      });
    }

    // Actualizar nombres de grupos
    if (objectGroups.length === 2) {
      objectGroups[0].groupName = 'BEFORE ADJUSTMENT';
      objectGroups[1].groupName = 'AFTER ADJUSTMENT';
    }

    dccData.objectIdentifications = objectGroups;

    // Crear main item
    const mainItem = {
      id: this.generateId(),
      name: this.getContentText(mainItemNode, 'name') || '',
      model: this.getTextContent(mainItemNode, 'model') || '',
      manufacturer: this.getContentText(manufacturerNode, 'name') || '',
      serialNumber: serialNumber,
      customerAssetId: customerAssetId,
      identifications: [],
      itemQuantities: [],
      subItems: [] as any[],
    };

    // Parse subitems
    if (subItemsNode) {
      const subItemNodes = this.getElementsByTagName(subItemsNode, 'item');

      mainItem.subItems = subItemNodes.map((node, index) => {
        const subManufacturerNode = this.getElementByTagName(
          node,
          'manufacturer'
        );
        const subIdentificationNodes = this.getElementsByTagName(
          node,
          'identification'
        );
        const subItemQuantityNodes = this.getElementsByTagName(
          node,
          'itemQuantity'
        );

        const subItem = {
          id: this.generateId(),
          name: this.getContentText(node, 'name') || '',
          model: this.getTextContent(node, 'model') || '',
          manufacturer: this.getContentText(subManufacturerNode, 'name') || '',
          identifications: [] as any[],
          itemQuantities: [] as any[],
        };

        // Procesar identificaciones del subitem
        subIdentificationNodes.forEach((idNode, idIndex) => {
          const issuer =
            this.getTextContent(idNode, 'issuer') || 'manufacturer';
          const name = this.getContentText(idNode, 'name') || '';
          const value = this.getTextContent(idNode, 'value') || '';

          // Normalizar el name para que coincida exactamente con nuestras opciones
          const normalizedName = this.normalizeIdentificationName(name);
          const mappedIssuer = this.mapIssuerToDisplayCase(issuer);

          // Buscar la opción exacta
          const selectedOption = this.findExactOptionByNameAndIssuer(
            normalizedName,
            mappedIssuer
          );

          if (selectedOption) {
            if (selectedOption.saveAs === 'identification') {
              subItem.identifications.push({
                issuer: mappedIssuer,
                value: value,
                name: normalizedName,
                selectedOption: selectedOption,
              });
            } else {
              // Es itemQuantity - mover a itemQuantities
              const refType = this.generateRefTypeFromName(normalizedName);

              subItem.itemQuantities.push({
                refType: refType,
                name: normalizedName,
                value: value,
                unit: selectedOption.unit || '',
                selectedOption: selectedOption,
                originalIssuer: mappedIssuer,
              });
            }
          } else {
            // Si no encontramos una opción exacta, usar como identification genérica
            subItem.identifications.push({
              issuer: mappedIssuer,
              value: value,
              name: name,
              selectedOption: null, // Sin opción predefinida
            });
          }
        });

        // Procesar itemQuantities del subitem
        subItemQuantityNodes.forEach((qNode, qIndex) => {
          const realNode = this.getElementByTagName(qNode, 'real');
          let value = '';
          let unit = '';

          if (realNode) {
            value = this.getTextContent(realNode, 'value') || '';
            unit = this.getTextContent(realNode, 'unit') || '';
          }

          const name = this.getContentText(qNode, 'name') || '';
          const refType = qNode.getAttribute('refType') || '';

          // Normalizar el name y buscar opción
          const normalizedName = this.normalizeIdentificationName(name);
          const selectedOption = this.findOptionByName(normalizedName);

          subItem.itemQuantities.push({
            refType: refType,
            name: normalizedName,
            value: value,
            unit: unit,
            selectedOption: selectedOption,
            originalIssuer: 'manufacturer',
          });
        });

        return subItem;
      });
    }

    dccData.items = [mainItem];
  }

  // Método para parsear formato viejo (mantener el código existente como está)
  private parseOldFormatItems(
    xmlDoc: Document,
    dccData: DCCData,
    itemsRootNode: Element
  ) {
    // Usar la lógica existente para el formato viejo
    const allItemNodes = this.getElementsByTagName(itemsRootNode, 'item');
    if (allItemNodes.length > 0) {
      const mainItemNode = allItemNodes[0];

      // Parse main item basic info
      const manufacturerNode = this.getElementByTagName(
        mainItemNode,
        'manufacturer'
      );

      // Extraer serial number y customer asset ID del primer item (formato viejo)
      let serialNumber = '';
      let customerAssetId = '';

      // En formato viejo, las identificaciones están en coreData
      const coreDataNode = this.getElementByTagName(xmlDoc, 'coreData');
      if (coreDataNode) {
        const coreIdentificationsNode = this.getElementByTagName(
          coreDataNode,
          'identifications'
        );
        if (coreIdentificationsNode) {
          const coreIdentificationNodes = this.getElementsByTagName(
            coreIdentificationsNode,
            'identification'
          );

          coreIdentificationNodes.forEach((idNode) => {
            const name = this.getContentText(idNode, 'name') || '';
            const value = this.getTextContent(idNode, 'value') || '';

            if (name.toLowerCase().includes('serial')) {
              serialNumber = value;
            } else if (
              name.toLowerCase().includes('asset') ||
              (name.toLowerCase().includes('customer') &&
                name.toLowerCase().includes('id'))
            ) {
              customerAssetId = value;
            }
          });
        }
      }

      // Crear main item
      const mainItem = {
        id: this.generateId(),
        name: this.getContentText(mainItemNode, 'name') || '',
        model: this.getTextContent(mainItemNode, 'model') || '',
        manufacturer: this.getContentText(manufacturerNode, 'name') || '',
        serialNumber: serialNumber,
        customerAssetId: customerAssetId,
        identifications: [],
        itemQuantities: [],
        subItems: [] as any[],
      };

      // Parse otros items como subitems
      for (let i = 1; i < allItemNodes.length; i++) {
        const subItemNode = allItemNodes[i];
        const subManufacturerNode = this.getElementByTagName(
          subItemNode,
          'manufacturer'
        );
        const subIdentificationNodes = this.getElementsByTagName(
          subItemNode,
          'identification'
        );

        const subItem = {
          id: this.generateId(),
          name: this.getContentText(subItemNode, 'name') || '',
          model: this.getTextContent(subItemNode, 'model') || '',
          manufacturer: this.getContentText(subManufacturerNode, 'name') || '',
          identifications: [] as any[],
          itemQuantities: [] as any[],
        };

        // Procesar identificaciones del subitem (formato viejo)
        subIdentificationNodes.forEach((idNode) => {
          const issuer =
            this.getTextContent(idNode, 'issuer') || 'manufacturer';
          const name = this.getContentText(idNode, 'name') || '';
          const value = this.getTextContent(idNode, 'value') || '';

          const normalizedName = this.normalizeIdentificationName(name);
          const mappedIssuer = this.mapIssuerToDisplayCase(issuer);
          const selectedOption = this.findExactOptionByNameAndIssuer(
            normalizedName,
            mappedIssuer
          );

          if (selectedOption) {
            if (selectedOption.saveAs === 'identification') {
              subItem.identifications.push({
                issuer: mappedIssuer,
                value: value,
                name: normalizedName,
                selectedOption: selectedOption,
              });
            } else {
              subItem.itemQuantities.push({
                refType: this.generateRefTypeFromName(normalizedName),
                name: normalizedName,
                value: value,
                unit: selectedOption.unit || '',
                selectedOption: selectedOption,
                originalIssuer: mappedIssuer,
              });
            }
          } else {
            subItem.identifications.push({
              issuer: mappedIssuer,
              value: value,
              name: name,
              selectedOption: null,
            });
          }
        });

        mainItem.subItems.push(subItem);
      }

      dccData.items = [mainItem];

      // Crear grupos por defecto para formato viejo
      dccData.objectIdentifications = [
        {
          id: this.generateId(),
          groupId: 'group_1',
          groupName: 'Grupo 1',
          groupIndex: 0,
          assignedMeasurementRange: {
            label: 'Rated voltage',
            value: '',
            unit: '\\volt',
          },
          assignedScaleFactor: {
            label: 'Scale factor',
            value: '',
            unit: '\\one',
          },
          ratedFrequency: {
            label: 'Rated Frequency',
            value: '',
            unit: '\\one',
          },
        },
      ];
    }
  }

  // Método para determinar unidad basada en el nombre
  private determineUnitFromName(name: string): string {
    const unitMap: { [key: string]: string } = {
      'Rated voltage': '\\volt',
      Length: '\\meter',
      'Characteristic impedance': '\\ohm',
    };
    return unitMap[name] || '';
  }

  // Método mejorado para generar refType
  private generateRefTypeFromName(name: string): string {
    const refTypeMap: { [key: string]: string } = {
      'Rated voltage': 'hv_ratedVoltage',
      Length: 'basic_length',
      'Characteristic impedance': 'basic_impedance',
      'Serial Number': 'basic_serialNumber',
      "Customer's asset ID": 'basic_customerAsset',
    };
    return refTypeMap[name] || 'basic_property';
  }

  // Helper methods for XML parsing
  private getElementByTagName(
    parent: Document | Element | null,
    tagName: string
  ): Element | null {
    if (!parent) return null;

    // Try with namespace prefix first
    let element = parent.querySelector(`dcc\\:${tagName}`);
    if (!element) {
      element = parent.querySelector(tagName);
    }
    if (!element) {
      const elements = parent.getElementsByTagName(`dcc:${tagName}`);
      if (elements.length > 0) {
        element = elements[0];
      } else {
        const elementsNoNS = parent.getElementsByTagName(tagName);
        if (elementsNoNS.length > 0) {
          element = elementsNoNS[0];
        }
      }
    }
    return element;
  }

  private getElementsByTagName(
    parent: Element | null,
    tagName: string
  ): Element[] {
    if (!parent) return [];

    let elements = parent.getElementsByTagName(`dcc:${tagName}`);
    if (elements.length === 0) {
      elements = parent.getElementsByTagName(tagName);
    }
    return Array.from(elements);
  }

  private getTextContent(
    parent: Element | null,
    tagName: string
  ): string | null {
    if (!parent) return null;
    const element = this.getElementByTagName(parent, tagName);
    return element?.textContent?.trim() || null;
  }

  private getContentText(
    parent: Element | null,
    tagName: string
  ): string | null {
    if (!parent) return null;
    const element = this.getElementByTagName(parent, tagName);
    if (!element) return null;

    const contentElement = this.getElementByTagName(element, 'content');
    if (contentElement) {
      return contentElement.textContent?.trim() || null;
    }

    return element.textContent?.trim() || null;
  }

  private mapIssuerToDisplayCase(issuer: string): string {
    const mapping: { [key: string]: string } = {
      manufacturer: 'Manufacturer',
      calibrationLaboratory: 'Calibration Laboratory',
      customer: 'Customer',
      owner: 'Owner',
      other: 'Other',
    };
    return mapping[issuer] || issuer;
  }

  private generateId(): string {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Nuevo método para cargar un DCC desde un objeto
  loadFromObject(dccData: DCCData): void {
    this.dccDataSubject.next(dccData);
  }

  loadFromDatabase(database: string, dccId: string): Observable<any> {
    const getDcc = {
      action: 'get',
      bd: database,
      table: 'dcc_data',
      opts: { where: { id: dccId } },
    };

    return this.apiService.post(getDcc, UrlClass.URLNuevo).pipe(
      map((response: any) => {
        const dccData = response?.result?.[0];
        if (!dccData) {
          throw new Error('No se encontraron datos completos para este DCC.');
        }

        const defaultData = this.getCurrentData();
        const mergedData = this.deepMerge(defaultData, dccData);

        if (!mergedData.administrativeData.core.certificate_number) {
          mergedData.administrativeData.core.certificate_number = dccData.id;
        }

        this.loadFromObject(mergedData);
        return mergedData;
      })
    );
  }

  // Método para obtener todos los statements desde la tabla dcc_statement
  getAllStatementsFromDatabase(database: string): Observable<any[]> {
    const getStatements = {
      action: 'get',
      bd: database,
      table: 'dcc_statement',
      opts: {},
    };
    return this.apiService
      .post(getStatements, UrlClass.URLNuevo)
      .pipe(map((response: any) => response?.result || []));
  }

  // Actualiza un statement en la base de datos
  updateStatementInDatabase(database: string, statement: any): Observable<any> {
    const { deleted, ...cleanStatement } = statement;
    const updateStatement = {
      action: 'update',
      bd: database,
      table: 'dcc_statement',
      opts: {
        attributes: { ...cleanStatement },
        where: { id: statement.id },
      },
    };
    return this.apiService.post(updateStatement, UrlClass.URLNuevo);
  }

  // Método para obtener todos los métodos usados desde la tabla dcc_usedmethod
  getAllUsedMethodsFromDatabase(database: string): Observable<any[]> {
    const getUsedMethods = {
      action: 'get',
      bd: database,
      table: 'dcc_usedmethod',
      opts: {},
    };
    return this.apiService.post(getUsedMethods, UrlClass.URLNuevo).pipe(
      map((response: any) => {
        const rows = response?.result || [];
        // Agrupar por método (por refType, name, description, norm)
        const grouped: { [key: string]: any } = {};
        rows.forEach((row: any) => {
          const key = `${row.refType}|${row.name}|${row.description}|${row.norm}`;
          if (!grouped[key]) {
            grouped[key] = {
              refType: row.refType,
              name: row.name,
              description: row.description,
              norm: row.norm,
              usedMethodQuantities: [],
            };
          }
          if (
            row.usedMethodQuantity_name ||
            row.usedMethodQuantity_value ||
            row.usedMethodQuantity_unit
          ) {
            grouped[key].usedMethodQuantities.push({
              name: row.usedMethodQuantity_name,
              value: row.usedMethodQuantity_value,
              unit: row.usedMethodQuantity_unit,
            });
          }
        });
        return Object.values(grouped);
      })
    );
  }

  private deepMerge(defaultData: any, loadedData: any): any {
    if (!loadedData) return defaultData;
    if (typeof loadedData !== 'object' || Array.isArray(loadedData)) {
      return loadedData;
    }

    const merged: any = Array.isArray(defaultData) ? [] : {};
    for (const key in defaultData) {
      if (Object.prototype.hasOwnProperty.call(defaultData, key)) {
        if (loadedData[key] === undefined || loadedData[key] === null) {
          merged[key] = defaultData[key];
        } else if (
          typeof defaultData[key] === 'object' &&
          defaultData[key] !== null &&
          !Array.isArray(defaultData[key])
        ) {
          merged[key] = this.deepMerge(defaultData[key], loadedData[key]);
        } else {
          merged[key] = loadedData[key];
        }
      }
    }
    for (const key in loadedData) {
      if (
        Object.prototype.hasOwnProperty.call(loadedData, key) &&
        merged[key] === undefined
      ) {
        merged[key] = loadedData[key];
      }
    }
    return merged;
  }

  // Nuevos métodos helper para el parsing unificado
  private determineSaveAsType(name: string): string {
    const itemQuantityNames = [
      'Rated voltage',
      'Length',
      'Characteristic impedance',
    ];
    return itemQuantityNames.includes(name) ? 'itemQuantity' : 'identification';
  }

  private findOptionByName(name: string): any {
    return this.getIdentificationOptions().find(
      (option) => option.name === name
    );
  }

  private findOptionByNameAndIssuer(name: string, issuer: string): any {
    return this.getIdentificationOptions().find(
      (option) => option.name === name && option.issuer === issuer
    );
  }

  private getIdentificationOptions() {
    return [
      {
        issuer: 'Manufacturer',
        name: 'Serial Number',
        displayText: 'Serial Number (Manufacturer)',
        saveAs: 'identification',
      },
      {
        issuer: 'Customer',
        name: "Customer's asset ID",
        displayText: "Customer's asset ID (Customer)",
        saveAs: 'identification',
      },
      {
        issuer: 'Manufacturer',
        name: 'Rated voltage',
        displayText: 'Rated voltage (Manufacturer)',
        saveAs: 'itemQuantity',
        unit: '\\volt',
      },
      {
        issuer: 'Manufacturer',
        name: 'Length',
        displayText: 'Length (Manufacturer)',
        saveAs: 'itemQuantity',
        unit: '\\meter',
      },
      {
        issuer: 'Manufacturer',
        name: 'Characteristic impedance',
        displayText: 'Characteristic impedance (Manufacturer)',
        saveAs: 'itemQuantity',
        unit: '\\ohm',
      },
    ];
  }

  // Nuevo método para normalizar nombres de identificaciones
  private normalizeIdentificationName(name: string): string {
    // Mapeo de variaciones comunes a nombres estándar
    const nameMapping: { [key: string]: string } = {
      // Variaciones de Serial Number
      'serial number': 'Serial Number',
      'serial no': 'Serial Number',
      serialnumber: 'Serial Number',
      'Serial number': 'Serial Number',
      'Serial No': 'Serial Number',
      SerialNumber: 'Serial Number',

      // Variaciones de Customer's asset ID
      "customer's asset id": "Customer's asset ID",
      'customer asset id': "Customer's asset ID",
      "customer's asset": "Customer's asset ID",
      'customer asset': "Customer's asset ID",
      "Customer's asset or ID": "Customer's asset ID",
      "customer's asset or id": "Customer's asset ID",

      // Variaciones de Rated voltage
      'rated voltage': 'Rated voltage',
      'Rated Voltage': 'Rated voltage',
      'rated voltage [kv]': 'Rated voltage',
      'Rated voltage [kV]': 'Rated voltage',

      // Variaciones de Length
      length: 'Length',
      'Length [m]': 'Length',
      'length [m]': 'Length',

      // Variaciones de Characteristic impedance
      'characteristic impedance': 'Characteristic impedance',
      'Characteristic Impedance': 'Characteristic impedance',
    };

    // Limpiar el nombre (remover espacios extra, convertir a lowercase para comparación)
    const cleanName = name.trim();
    const lowerName = cleanName.toLowerCase();

    // Buscar mapeo exacto primero
    if (nameMapping[cleanName]) {
      return nameMapping[cleanName];
    }

    // Buscar mapeo por lowercase
    if (nameMapping[lowerName]) {
      return nameMapping[lowerName];
    }

    // Si no encuentra mapeo, devolver el nombre original limpio
    return cleanName;
  }

  // Método mejorado para buscar opción exacta
  private findExactOptionByNameAndIssuer(name: string, issuer: string): any {
    const identificationOptions = this.getIdentificationOptions();

    // Buscar coincidencia exacta
    const exactMatch = identificationOptions.find(
      (option) => option.name === name && option.issuer === issuer
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Si no hay coincidencia exacta con issuer, buscar solo por name
    const nameMatch = identificationOptions.find(
      (option) => option.name === name
    );

    if (nameMatch) {
      return nameMatch;
    }

    return null;
  }

  // Método para hacer queries a la BD
  post(query: any) {
    return this.apiService.post(query, UrlClass.URLNuevo);
  }

  /**
   * Actualiza los resultados de PT-23
   * Reemplaza completamente los resultados existentes con los nuevos
   */
  updatePT23Results(newResults: any[]): void {
    const currentData = this.dccDataSubject.value;

    // Asegurar que results existe
    const currentResults = currentData.results || [];

    // Filtrar los resultados existentes que NO son de PT-23
    const nonPT23Results = currentResults.filter(
      (result) =>
        !result.refType?.includes('hv_') &&
        !result.name?.includes('SF ') &&
        !result.name?.includes('Scale Factor')
    );

    // Combinar: mantener los resultados no-PT23 + agregar los nuevos resultados PT-23
    const updatedResults = [...nonPT23Results, ...newResults];

    // Actualizar el observable
    this.dccDataSubject.next({
      ...currentData,
      results: updatedResults,
    });
  }
}
