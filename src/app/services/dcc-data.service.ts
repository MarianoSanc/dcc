import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import Swal from 'sweetalert2';
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
    name: string;
    model: string;
    manufacturer: string;
    identifications: Array<{
      issuer: string;
      value: string;
      name: string;
    }>;
  }>;
  objectIdentifications?: Array<{
    issuer: string;
    value: string;
    name: string;
    groupName?: string;
    groupIndex?: number;
  }>;
  statements?: Array<{
    id: string;
    refType: string;
    norm: string;
    reference: string;
    content: string;
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
    status: string;
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
    }>;
  }>;
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
      items: [],
      objectIdentifications: [
        {
          issuer: 'manufacturer',
          value: '',
          name: 'Assigned measurement range(s) [kV]',
          groupName: 'Grupo 1',
          groupIndex: 0,
        },
        {
          issuer: 'manufacturer',
          value: '',
          name: 'Assigned scale factor(s)',
          groupName: 'Grupo 1',
          groupIndex: 0,
        },
        {
          issuer: 'manufacturer',
          value: '',
          name: 'Rated frequency [Hz]',
          groupName: 'Grupo 1',
          groupIndex: 0,
        },
      ],
      statements: [
        {
          id: 'stmt_default_1',
          refType: 'accreditation',
          norm: 'ISO/IEC',
          reference: '17025:2017',
          content:
            'HV Test is a laboratory accredited by the Mexican accreditation body EMA (Entidad Mexicana de Acrediatión) and by the American accreditation body ANAB (ANSI National Accreditation Board), for calibrations in accordance with the International Standard.',
        },
        {
          id: 'stmt_default_2',
          refType: 'results_scope',
          norm: '',
          reference: '',
          content:
            'The results in this document relate only to the device under calibration, at the time and conditions in which the measurments were made. The issuing Laboratory assumes no responsibility for any damages ensuing on account of misuse of the calibrated instruments.',
        },
        {
          id: 'stmt_default_3',
          refType: 'reproduction',
          norm: '',
          reference: '',
          content:
            'The Certificate may not be partially reproduced unless it is permitted in writing by the issuing laboratory.',
        },
        {
          id: 'stmt_default_4',
          refType: 'stabilization',
          norm: '',
          reference: '',
          content:
            'The calibrand was in the test room for at least two hours prior to the calibration measurements.',
        },

        {
          id: 'stmt_default_5',
          refType: 'traceability',
          norm: '',
          reference: '',
          content:
            'The traceability of the measurements is proven by means of unbroken chain of suitable and periodic calibration by national metrology institutes and designated institutes within the CIPM MRA (International Committee of Weights and Measures Mutual Recognition Arrangement), or calibration laboratories that have been accredited by an accreditation body subject to the ILAC (International Laboratory Accreditation Corporation) Arrangement or equivalent.',
        },
        {
          id: 'stmt_default_6',
          refType: 'si_traceability',
          norm: '',
          reference: '',
          content:
            'The calibrations within this certificate are traceable to the International System of Units (SI).',
        },

        {
          id: 'stmt_default_7',
          refType: 'adjustments',
          norm: '',
          reference: '',
          content:
            'No adjustments of the device under test were made before, during or after the calibration tests.',
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
          status: 'beforeAdjustment',
          subBlock: {
            name: 'Temperature',
            value: '',
            unit: '\\degreecelsius',
          },
        },
        {
          id: 'influence_default_2',
          name: 'Ambient condition relative air humidity',
          refType: 'basic_humidityRelative',
          status: 'beforeAdjustment',
          subBlock: {
            name: 'Humidity',
            value: '',
            unit: '\\percent',
          },
        },
        {
          id: 'influence_default_3',
          name: 'Ambient condition pressure',
          refType: 'basic_pressure',
          status: 'beforeAdjustment',
          subBlock: {
            name: 'Ambient Pressure',
            value: '',
            unit: '\\hectopascal',
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
    this.dccDataSubject.next(this.getInitialData());
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
      console.error('Error loading XML:', error);
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
      dccData.administrativeData.responsiblePersons = respPersonNodes.map(
        (node) => {
          const personNode = this.getElementByTagName(node, 'person');
          return {
            role: this.getTextContent(node, 'role') || '',
            name: this.getContentText(personNode, 'name') || '',
            email: this.getTextContent(personNode, 'eMail') || '',
            phone: this.getTextContent(personNode, 'phone') || '',
          };
        }
      );
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

    // Parse Object Identifications (from items root level)
    const itemsNode = this.getElementByTagName(xmlDoc, 'items');
    if (itemsNode) {
      const objectIdentificationsNode = this.getElementByTagName(
        itemsNode,
        'identifications'
      );
      if (objectIdentificationsNode) {
        const objectIdentificationNodes = this.getElementsByTagName(
          objectIdentificationsNode,
          'identification'
        );
        dccData.objectIdentifications = objectIdentificationNodes.map(
          (node) => ({
            issuer: this.mapIssuerToDisplayCase(
              this.getTextContent(node, 'issuer') || ''
            ),
            value: this.getTextContent(node, 'value') || '',
            name: this.getContentText(node, 'name') || '',
          })
        );
      }
    }

    // Parse Items
    if (itemsNode) {
      const itemNodes = this.getElementsByTagName(itemsNode, 'item');
      dccData.items = itemNodes.map((node) => {
        const identificationNodes = this.getElementsByTagName(
          node,
          'identification'
        );
        const manufacturerNode = this.getElementByTagName(node, 'manufacturer');
        return {
          id: this.generateId(),
          name: this.getContentText(node, 'name') || '',
          model: this.getTextContent(node, 'model') || '',
          manufacturer: this.getContentText(manufacturerNode, 'name') || '',
          identifications: identificationNodes.map((idNode) => ({
            issuer: this.mapIssuerToDisplayCase(
              this.getTextContent(idNode, 'issuer') || ''
            ),
            value: this.getTextContent(idNode, 'value') || '',
            name: this.getContentText(idNode, 'name') || '',
          })),
        };
      });
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
        refType: node.getAttribute('refType') || '',
        norm: this.getTextContent(node, 'norm') || '',
        reference: this.getTextContent(node, 'reference') || '',
        content: this.getContentText(node, 'declaration') || '',
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
          const valueNode = this.getElementByTagName(quantityNode, 'value');
          const unitNode = this.getElementByTagName(quantityNode, 'unit');

          return {
            id: this.generateId(),
            name: this.getContentText(node, 'name') || '',
            refType: node.getAttribute('refType') || '',
            status: 'beforeAdjustment',
            subBlock: {
              name: this.getContentText(quantityNode, 'name') || '',
              value: valueNode?.textContent?.trim() || '',
              unit: unitNode?.textContent?.trim() || '',
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
          const quantityNodes = this.getElementsByTagName(listNode, 'quantity');

          return {
            id: this.generateId(),
            name: this.getContentText(node, 'name') || '',
            refType: node.getAttribute('refType') || '',
            data: quantityNodes.map((qNode) => {
              const hybridNode = this.getElementByTagName(qNode, 'hybrid');
              const realListNode = this.getElementByTagName(
                hybridNode,
                'realListXMLList'
              );
              const realNode = this.getElementByTagName(hybridNode, 'real');

              if (realListNode) {
                // Handle realListXMLList type
                const valueXMLListNode = this.getElementByTagName(
                  realListNode,
                  'valueXMLList'
                );
                const unitXMLListNode = this.getElementByTagName(
                  realListNode,
                  'unitXMLList'
                );

                return {
                  id: this.generateId(),
                  refType: qNode.getAttribute('refType') || '',
                  name: this.getContentText(qNode, 'name') || '',
                  dataType: 'realListXMLList' as const,
                  valueXMLList: valueXMLListNode?.textContent?.trim() || '',
                  unitXMLList: unitXMLListNode?.textContent?.trim() || '',
                  value: '',
                  unit: '',
                };
              } else if (realNode) {
                // Handle real type
                const valueNode = this.getElementByTagName(realNode, 'value');
                const unitNode = this.getElementByTagName(realNode, 'unit');

                return {
                  id: this.generateId(),
                  refType: qNode.getAttribute('refType') || '',
                  name: this.getContentText(qNode, 'name') || '',
                  dataType: 'real' as const,
                  valueXMLList: '',
                  unitXMLList: '',
                  value: valueNode?.textContent?.trim() || '',
                  unit: unitNode?.textContent?.trim() || '',
                };
              }

              // Fallback for unknown structure
              return {
                id: this.generateId(),
                refType: qNode.getAttribute('refType') || '',
                name: this.getContentText(qNode, 'name') || '',
                dataType: 'realListXMLList' as const,
                valueXMLList: '',
                unitXMLList: '',
                value: '',
                unit: '',
              };
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

    return dccData;
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
      // Try without namespace prefix
      element = parent.querySelector(tagName);
    }
    if (!element) {
      // Try with getElementsByTagName (works better with namespaces)
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

    // Try with namespace prefix first
    let elements = parent.getElementsByTagName(`dcc:${tagName}`);
    if (elements.length === 0) {
      // Try without namespace prefix
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

    // Try to find content element first
    const contentElement = this.getElementByTagName(element, 'content');
    if (contentElement) {
      return contentElement.textContent?.trim() || null;
    }

    // Fallback to element text content
    return element.textContent?.trim() || null;
  }

  // Remove the old getElementText method and update other helper methods
  private parseDate(dateString: string | null): Date | null {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
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

  private extractPTFromUniqueIdentifier(uniqueIdentifier: string): string {
    if (!uniqueIdentifier) return 'PT-23'; // Default value

    // Split by spaces and get all parts
    const parts = uniqueIdentifier.trim().split(/\s+/);

    // Look for the penultimate number in the identifier
    // Example: "PC0434-00 CC 24 01" -> parts = ["PC0434-00", "CC", "24", "01"]
    // We want the second to last part that is a number
    if (parts.length >= 2) {
      // Get the penultimate part (second to last)
      const penultimatePart = parts[parts.length - 2];

      // Check if it's a valid number
      if (/^\d+$/.test(penultimatePart)) {
        return `PT-${penultimatePart}`;
      }
    }

    // Fallback: try to find any number pattern that could be PT
    const numberMatches = uniqueIdentifier.match(/\b(\d{1,2})\b/g);
    if (numberMatches && numberMatches.length >= 2) {
      // Get the second to last number found
      const ptNumber = numberMatches[numberMatches.length - 2];
      return `PT-${ptNumber}`;
    }

    // Final fallback
    return 'PT-23';
  }

  // Nuevo método para cargar un DCC desde un objeto (por ejemplo, desde la BD)
  loadFromObject(dccData: DCCData): void {
    this.dccDataSubject.next(dccData);
  }

  loadFromDatabase(database: string, dccId: string): Observable<any> {
    const getDcc = {
      action: 'get',
      bd: database,
      table: 'dcc_data',
      opts: {
        where: { id: dccId },
      },
    };

    return this.apiService.post(getDcc, UrlClass.URLNuevo).pipe(
      map((response: any) => {
        const dccData = response?.result?.[0];
        if (!dccData) {
          throw new Error('No se encontraron datos completos para este DCC.');
        }

        const defaultData = this.getCurrentData();
        const mergedData = this.deepMerge(defaultData, dccData);

        // Asignar el certificate_number con el id si no existe
        if (!mergedData.administrativeData.core.certificate_number) {
          mergedData.administrativeData.core.certificate_number = dccData.id;
        }

        this.loadFromObject(mergedData);
        return mergedData;
      })
    );
  }

  // Deep merge (recursivo)
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
}
