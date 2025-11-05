import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DccDataService, DCCData } from '../../services/dcc-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.css'],
})
export class PreviewComponent implements OnInit, OnDestroy {
  currentView: 'xml' | 'pdf' = 'xml';
  xmlContent: string = '';
  dccData: DCCData | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        this.dccData = data;
        this.generateXMLContent();
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  switchView(view: 'xml' | 'pdf') {
    this.currentView = view;
  }

  downloadXML() {
    if (!this.xmlContent) return;

    const blob = new Blob([this.xmlContent], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const certificateNumber =
      this.dccData?.administrativeData.core.certificate_number || 'DCC';
    link.download = `${certificateNumber}.xml`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // =======================
  // Generador principal XML
  // =======================
  private generateXMLContent() {
    if (!this.dccData) return;
    const data = this.dccData;

    this.xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet type="text/xsl" href="book.xsl"?>
<dcc:digitalCalibrationCertificate xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:dcc="https://ptb.de/dcc"
  xmlns:si="https://ptb.de/si"
  xsi:schemaLocation="https://ptb.de/dcc https://ptb.de/dcc/v3.3.0/dcc.xsd"
  schemaVersion="3.3.0">

  <!-- ========== Datos administrativos ========== -->
  <dcc:administrativeData>

    <!-- 1️⃣ Datos del software -->
    <dcc:dccSoftware>
      <dcc:software>
        <dcc:name>
          <dcc:content>${this.escapeXml(
            data.administrativeData.software.name
          )}</dcc:content>
        </dcc:name>
        <dcc:release>${this.escapeXml(
          data.administrativeData.software.version
        )}</dcc:release>
        <dcc:type>${this.escapeXml(
          data.administrativeData.software.type
        )}</dcc:type>
        ${
          data.administrativeData.software.description
            ? `<dcc:description>
          <dcc:content>${this.escapeXml(
            data.administrativeData.software.description
          )}</dcc:content>
        </dcc:description>`
            : ''
        }
      </dcc:software>
    </dcc:dccSoftware>

    <!-- 2️⃣ Datos centrales -->
    <dcc:coreData>
      <dcc:countryCodeISO3166_1>${this.escapeXml(
        data.administrativeData.core.country_code
      )}</dcc:countryCodeISO3166_1>
      <dcc:usedLangCodeISO639_1>${this.escapeXml(
        data.administrativeData.core.language
      )}</dcc:usedLangCodeISO639_1>
      <dcc:mandatoryLangCodeISO639_1>${this.escapeXml(
        data.administrativeData.core.language
      )}</dcc:mandatoryLangCodeISO639_1>
      <dcc:uniqueIdentifier>${this.escapeXml(
        data.administrativeData.core.certificate_number
      )}</dcc:uniqueIdentifier>
      ${this.generateCorePerformanceDataXML(data)}
    </dcc:coreData>

    <!-- 3️⃣ Equipos y objetos calibrados -->
    <dcc:items>
      ${this.generateItemsXML(data)}
    </dcc:items>

    <!-- 4️⃣ Laboratorio de calibración -->
    <dcc:calibrationLaboratory>
      <dcc:contact>
        <dcc:name>
          <dcc:content lang="en">${this.escapeXml(
            data.administrativeData.laboratory.name
          )}</dcc:content>
        </dcc:name>
        ${
          data.administrativeData.laboratory.phone
            ? `<dcc:phone>${this.escapeXml(
                data.administrativeData.laboratory.phone
              )}</dcc:phone>`
            : ''
        }
        <dcc:location>
          <dcc:city>${this.escapeXml(
            data.administrativeData.laboratory.city
          )}</dcc:city>
          <dcc:countryCode>${this.escapeXml(
            data.administrativeData.core.country_code
          )}</dcc:countryCode>
          <dcc:postCode>${this.escapeXml(
            data.administrativeData.laboratory.postal_code
          )}</dcc:postCode>
          <dcc:state>${this.escapeXml(
            data.administrativeData.laboratory.state
          )}</dcc:state>
          <dcc:street>${this.escapeXml(
            data.administrativeData.laboratory.street
          )}</dcc:street>
          <dcc:streetNo>${this.escapeXml(
            data.administrativeData.laboratory.street_number
          )}</dcc:streetNo>
        </dcc:location>
      </dcc:contact>
    </dcc:calibrationLaboratory>

    <!-- 5️⃣ Personas responsables -->
    <dcc:respPersons>
      ${data.administrativeData.responsiblePersons
        .filter((person) => person.role && person.role.trim() !== '')
        .map(
          (person) => `
      <dcc:respPerson>
        <dcc:person>
          <dcc:name>
            <dcc:content>${this.escapeXml(
              this.getPersonDisplayName(person)
            )}</dcc:content>
          </dcc:name>
        </dcc:person>
        <dcc:role>${this.escapeXml(person.role)}</dcc:role>
        ${person.mainSigner ? '<dcc:mainSigner>true</dcc:mainSigner>' : ''}
      </dcc:respPerson>`
        )
        .join('')}
    </dcc:respPersons>

    <!-- 6️⃣ Cliente -->
    <dcc:customer>
      <dcc:name>
        <dcc:content>${this.escapeXml(
          data.administrativeData.customer.name
        )}</dcc:content>
      </dcc:name>
      <dcc:location>
        <dcc:street>${this.escapeXml(
          data.administrativeData.customer.street
        )}</dcc:street>
        <dcc:streetNo>${this.escapeXml(
          data.administrativeData.customer.street_number
        )}</dcc:streetNo>
        <dcc:city>${this.escapeXml(
          data.administrativeData.customer.city
        )}</dcc:city>
        <dcc:state>${this.escapeXml(
          data.administrativeData.customer.state
        )}</dcc:state>
        <dcc:countryCode>${this.escapeXml(
          data.administrativeData.core.country_code
        )}</dcc:countryCode>
        <dcc:postCode>${this.escapeXml(
          data.administrativeData.customer.postal_code
        )}</dcc:postCode>
      </dcc:location>
    </dcc:customer>

    <!-- 7️⃣ Declaraciones -->
    <dcc:statements>
      ${this.generateStatementsXML(data)}
    </dcc:statements>

  </dcc:administrativeData>

  <!-- ========== Resultados de medición ========== -->
  <dcc:measurementResults>
    <dcc:measurementResult>
      ${this.generateMeasurementResultNameXML(data)}
      ${this.generateUsedMethodsXML(data)}
      ${this.generateMeasuringEquipmentsXML(data)}
      ${this.generateInfluenceConditionsXML(data)}
      ${this.generateResultsXML(data)}
    </dcc:measurementResult>
  </dcc:measurementResults>

</dcc:digitalCalibrationCertificate>`;
  }

  // =======================
  // Métodos específicos actualizados
  // =======================
  private generateCorePerformanceDataXML(data: DCCData): string {
    return `
      ${
        data.administrativeData.core.performance_date
          ? `<dcc:beginPerformanceDate>${this.formatDate(
              data.administrativeData.core.performance_date
            )}</dcc:beginPerformanceDate>`
          : ''
      }
      ${
        data.administrativeData.core.is_range_date &&
        data.administrativeData.core.end_performance_date
          ? `<dcc:endPerformanceDate>${this.formatDate(
              data.administrativeData.core.end_performance_date
            )}</dcc:endPerformanceDate>`
          : data.administrativeData.core.performance_date
          ? `<dcc:endPerformanceDate>${this.formatDate(
              data.administrativeData.core.performance_date
            )}</dcc:endPerformanceDate>`
          : ''
      }
      <dcc:performanceLocation>${this.escapeXml(
        data.administrativeData.core.performance_localition
      )}</dcc:performanceLocation>
      ${
        data.administrativeData.core.issue_date
          ? `<dcc:issueDate>${this.formatDate(
              data.administrativeData.core.issue_date
            )}</dcc:issueDate>`
          : ''
      }`;
  }

  private generateItemsXML(data: DCCData): string {
    if (!data.items || data.items.length === 0) return '';

    const mainItem = data.items[0];
    return `
      <dcc:item>
        <dcc:name>
          <dcc:content lang="en">${this.escapeXml(mainItem.name)}</dcc:content>
        </dcc:name>
        ${
          mainItem.manufacturer
            ? `
        <dcc:manufacturer>
          <dcc:name>
            <dcc:content>${this.escapeXml(mainItem.manufacturer)}</dcc:content>
          </dcc:name>
        </dcc:manufacturer>`
            : ''
        }
        ${
          mainItem.model
            ? `<dcc:model>${this.escapeXml(mainItem.model)}</dcc:model>`
            : ''
        }
        ${this.generateMainItemIdentificationsXML(mainItem)}
        ${this.generateItemQuantitiesXML(data.objectIdentifications)}
        ${this.generateSubItemsXML(mainItem.subItems)}
      </dcc:item>`;
  }

  private generateMainItemIdentificationsXML(mainItem: any): string {
    const identifications = [];

    if (mainItem.serialNumber) {
      identifications.push({
        issuer: 'manufacturer',
        value: mainItem.serialNumber,
        name: 'Serial number',
      });
    }

    if (mainItem.customerAssetId) {
      identifications.push({
        issuer: 'customer',
        value: mainItem.customerAssetId,
        name: "Customer's asset ID",
      });
    }

    if (identifications.length === 0) return '';

    return `
        <dcc:identifications>
          ${identifications
            .map(
              (id) => `
          <dcc:identification>
            <dcc:issuer>${this.escapeXml(id.issuer)}</dcc:issuer>
            <dcc:value>${this.escapeXml(id.value)}</dcc:value>
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(id.name)}</dcc:content>
            </dcc:name>
          </dcc:identification>`
            )
            .join('')}
        </dcc:identifications>`;
  }

  private generateItemQuantitiesXML(
    objectIdentifications?: any[] | undefined
  ): string {
    if (!objectIdentifications || objectIdentifications.length === 0) return '';

    const group = objectIdentifications[0];
    const quantities = [];

    if (group.assignedMeasurementRange?.value) {
      quantities.push({
        refType: 'voltage_measurement_range',
        name: 'Assigned measurement range(s)',
        label: 'Rated voltage',
        value: group.assignedMeasurementRange.value,
        unit: group.assignedMeasurementRange.unit || '\\volt',
      });
    }

    if (group.assignedScaleFactor?.value) {
      quantities.push({
        refType: 'scale_factor',
        name: 'Assigned scale factor(s)',
        label: 'Scale factor',
        value: group.assignedScaleFactor.value,
        unit: group.assignedScaleFactor.unit || '\\one',
      });
    }

    if (quantities.length === 0) return '';

    return `
        <dcc:itemQuantities>
          ${quantities
            .map(
              (qty) => `
          <dcc:itemQuantity refType="${this.escapeXml(qty.refType)}">
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(qty.name)}</dcc:content>
            </dcc:name>
            <si:real>
              <si:label>${this.escapeXml(qty.label)}</si:label>
              <si:value>${this.escapeXml(qty.value)}</si:value>
              <si:unit>${this.escapeXml(qty.unit)}</si:unit>
            </si:real>
          </dcc:itemQuantity>`
            )
            .join('')}
        </dcc:itemQuantities>`;
  }

  private generateSubItemsXML(subItems: any[]): string {
    if (!subItems || subItems.length === 0) return '';

    return `
        <dcc:subItems>
          ${subItems
            .map(
              (subItem) => `
          <dcc:item>
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(
                subItem.name
              )}</dcc:content>
            </dcc:name>
            ${
              subItem.manufacturer
                ? `
            <dcc:manufacturer>
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(
                  subItem.manufacturer
                )}</dcc:content>
              </dcc:name>
            </dcc:manufacturer>`
                : ''
            }
            ${
              subItem.model
                ? `<dcc:model>${this.escapeXml(subItem.model)}</dcc:model>`
                : ''
            }
            ${this.generateSubItemIdentificationsXML(subItem.identifications)}
            ${this.generateSubItemQuantitiesXML(subItem.itemQuantities)}
          </dcc:item>`
            )
            .join('')}
        </dcc:subItems>`;
  }

  private generateSubItemIdentificationsXML(identifications: any[]): string {
    if (!identifications || identifications.length === 0) return '';

    return `
            <dcc:identifications>
              ${identifications
                .map(
                  (id) => `
              <dcc:identification>
                <dcc:issuer>${this.mapIssuerToLowerCase(id.issuer)}</dcc:issuer>
                <dcc:value>${this.escapeXml(id.value)}</dcc:value>
                ${
                  id.name
                    ? `
                <dcc:name>
                  <dcc:content lang="en">${this.escapeXml(
                    id.name
                  )}</dcc:content>
                </dcc:name>`
                    : ''
                }
              </dcc:identification>`
                )
                .join('')}
            </dcc:identifications>`;
  }

  private generateSubItemQuantitiesXML(itemQuantities: any[]): string {
    if (!itemQuantities || itemQuantities.length === 0) return '';

    return `
            <dcc:itemQuantities>
              ${itemQuantities
                .map(
                  (qty) => `
              <dcc:itemQuantity${
                qty.refType ? ` refType="${this.escapeXml(qty.refType)}"` : ''
              }>
                <dcc:name>
                  <dcc:content lang="en">${this.escapeXml(
                    qty.name
                  )}</dcc:content>
                </dcc:name>
                <si:real>
                  <si:value>${this.escapeXml(qty.value)}</si:value>
                  <si:unit>${this.escapeXml(qty.unit)}</si:unit>
                </si:real>
              </dcc:itemQuantity>`
                )
                .join('')}
            </dcc:itemQuantities>`;
  }

  private generateMeasurementResultNameXML(data: DCCData): string {
    let name = '';

    if (data.measurementResult?.name) {
      name = data.measurementResult.name;
    } else {
      name = `Calibration ${
        data.administrativeData.core.certificate_number || ''
      }`;
    }

    return `
      <dcc:name>
        <dcc:content lang="en">${this.escapeXml(name)}</dcc:content>
      </dcc:name>`;
  }

  private generateStatementsXML(data: DCCData): string {
    if (!data.statements || data.statements.length === 0) return '';

    return data.statements
      .map(
        (statement) => `
      <dcc:statement>
        ${
          statement.norm
            ? `<dcc:norm>${this.escapeXml(statement.norm)}</dcc:norm>`
            : ''
        }
        ${
          statement.reference
            ? `<dcc:reference>${this.escapeXml(
                statement.reference
              )}</dcc:reference>`
            : ''
        }
        <dcc:declaration>
          <dcc:content lang="en">${this.escapeXml(
            statement.declaration || ''
          )}</dcc:content>
        </dcc:declaration>
        ${
          typeof statement.valid !== 'undefined' && statement.valid !== null
            ? `<dcc:valid>${
                statement.valid === 1 ? 'true' : 'false'
              }</dcc:valid>`
            : ''
        }
        ${this.generateRespAuthorityXML(statement)}
      </dcc:statement>`
      )
      .join('');
  }

  private generateRespAuthorityXML(statement: any): string {
    if (
      !statement.respAuthority_name &&
      !statement.respAuthority_countryCode &&
      !statement.respAuthority_postCode
    ) {
      return '';
    }

    return `
        <dcc:respAuthority>
          ${
            statement.respAuthority_name
              ? `
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(
              statement.respAuthority_name
            )}</dcc:content>
          </dcc:name>`
              : ''
          }
          <dcc:location>
            ${
              statement.respAuthority_countryCode
                ? `
            <dcc:city>Ciudad de México</dcc:city>
            <dcc:countryCode>${this.escapeXml(
              statement.respAuthority_countryCode
            )}</dcc:countryCode>`
                : ''
            }
            ${
              statement.respAuthority_postCode
                ? `
            <dcc:postCode>${this.escapeXml(
              statement.respAuthority_postCode
            )}</dcc:postCode>`
                : ''
            }
          </dcc:location>
        </dcc:respAuthority>`;
  }

  private generateUsedMethodsXML(data: DCCData): string {
    if (!data.usedMethods || data.usedMethods.length === 0) return '';

    return `
      <dcc:usedMethods>
        ${data.usedMethods
          .map(
            (method) => `
        <dcc:usedMethod refType="${this.escapeXml(method.refType)}">
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(method.name)}</dcc:content>
          </dcc:name>
          <dcc:description>
            <dcc:content lang="en">${this.escapeXml(
              method.description
            )}</dcc:content>
          </dcc:description>
          ${
            method.norm
              ? `<dcc:norm>${this.escapeXml(method.norm)}</dcc:norm>`
              : ''
          }
          ${this.generateUsedMethodQuantitiesXML(method)}
        </dcc:usedMethod>`
          )
          .join('')}
      </dcc:usedMethods>`;
  }

  private generateUsedMethodQuantitiesXML(method: any): string {
    if (
      !method.usedMethodQuantities ||
      method.usedMethodQuantities.length === 0
    )
      return '';

    return `
          <dcc:usedMethodQuantities>
            ${method.usedMethodQuantities
              .filter((qty: any) => qty.name && qty.value)
              .map(
                (qty: any) => `
            <dcc:usedMethodQuantity>
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(qty.name)}</dcc:content>
              </dcc:name>
              <si:real>
                <si:value>${this.escapeXml(qty.value)}</si:value>
                <si:unit>${this.escapeXml(qty.unit || '')}</si:unit>
              </si:real>
            </dcc:usedMethodQuantity>`
              )
              .join('')}
          </dcc:usedMethodQuantities>`;
  }

  private generateMeasuringEquipmentsXML(data: DCCData): string {
    if (!data.measuringEquipments || data.measuringEquipments.length === 0)
      return '';

    return `
      <dcc:measuringEquipments>
        ${data.measuringEquipments
          .map(
            (equipment) => `
        <dcc:measuringEquipment refType="${this.escapeXml(equipment.refType)}">
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(
              equipment.name
            )}</dcc:content>
          </dcc:name>
          ${
            equipment.manufacturer
              ? `
          <dcc:manufacturer>
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(
                equipment.manufacturer
              )}</dcc:content>
            </dcc:name>
          </dcc:manufacturer>`
              : ''
          }
          ${
            equipment.model
              ? `<dcc:model>${this.escapeXml(equipment.model)}</dcc:model>`
              : ''
          }
          ${this.generateEquipmentIdentificationsXML(equipment.identifications)}
        </dcc:measuringEquipment>`
          )
          .join('')}
      </dcc:measuringEquipments>`;
  }

  private generateEquipmentIdentificationsXML(identifications: any[]): string {
    if (!identifications || identifications.length === 0) return '';

    return `
          <dcc:identifications>
            ${identifications
              .map(
                (identification) => `
            <dcc:identification>
              <dcc:issuer>${this.mapIssuerToLowerCase(
                identification.issuer
              )}</dcc:issuer>
              <dcc:value>${this.escapeXml(identification.value)}</dcc:value>
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(
                  identification.name
                )}</dcc:content>
              </dcc:name>
            </dcc:identification>`
              )
              .join('')}
          </dcc:identifications>`;
  }

  private generateInfluenceConditionsXML(data: DCCData): string {
    if (!data.influenceConditions || data.influenceConditions.length === 0)
      return '';

    return `
      <dcc:influenceConditions>
        ${data.influenceConditions
          .filter(
            (condition) =>
              condition.subBlock.value && condition.subBlock.value.trim() !== ''
          )
          .map(
            (condition) => `
        <dcc:influenceCondition refType="${this.escapeXml(condition.refType)}">
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(
              condition.name
            )}</dcc:content>
          </dcc:name>
          <dcc:data>
            <dcc:quantity>
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(
                  condition.subBlock.name
                )}</dcc:content>
              </dcc:name>
              <si:real>
                <si:value>${this.escapeXml(condition.subBlock.value)}</si:value>
                <si:unit>${this.escapeXml(condition.subBlock.unit)}</si:unit>
              </si:real>
            </dcc:quantity>
          </dcc:data>
        </dcc:influenceCondition>`
          )
          .join('')}
      </dcc:influenceConditions>`;
  }

  private generateResultsXML(data: DCCData): string {
    if (!data.results || data.results.length === 0) return '';

    return `
      <dcc:results>
        ${data.results
          .map(
            (result) => `
        <dcc:result${
          result.refType ? ` refType="${this.escapeXml(result.refType)}"` : ''
        }>
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(result.name)}</dcc:content>
          </dcc:name>
          <dcc:data>
            ${this.generateResultDataXML(result.data)}
          </dcc:data>
        </dcc:result>`
          )
          .join('')}
      </dcc:results>`;
  }

  private generateResultDataXML(resultData: any[]): string {
    if (!resultData || resultData.length === 0) return '';

    const hasListData =
      resultData.length > 1 ||
      resultData.some((data) => data.dataType === 'realListXMLList');

    if (hasListData) {
      return `
            <dcc:list>
              ${resultData
                .filter((data) => this.isValidQuantityData(data))
                .map(
                  (data) => `
              <dcc:quantity refType="${this.escapeXml(data.refType)}">
                <dcc:name>
                  <dcc:content lang="en">${this.escapeXml(
                    data.name
                  )}</dcc:content>
                </dcc:name>
                ${this.generateQuantityValueXML(data)}
              </dcc:quantity>`
                )
                .join('')}
            </dcc:list>`;
    } else {
      const data = resultData[0];
      if (!this.isValidQuantityData(data)) return '';

      return `
            <dcc:quantity refType="${this.escapeXml(data.refType)}">
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(
                  data.name
                )}</dcc:content>
              </dcc:name>
              ${this.generateQuantityValueXML(data)}
            </dcc:quantity>`;
    }
  }

  // =======================
  // Métodos de utilidad
  // =======================
  private getPersonDisplayName(person: any): string {
    return person.full_name || person.name || 'Sin nombre';
  }

  private formatDate(date: Date | string): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString().split('T')[0];
  }

  private escapeXml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private mapIssuerToLowerCase(issuer: string): string {
    const mapping: { [key: string]: string } = {
      Manufacturer: 'manufacturer',
      'Calibration Laboratory': 'calibrationLaboratory',
      Customer: 'customer',
      Owner: 'owner',
      Other: 'other',
    };
    return mapping[issuer] || issuer.toLowerCase();
  }

  private isValidQuantityData(data: any): boolean {
    if (data.dataType === 'realListXMLList') {
      return (
        data.valueXMLList &&
        data.valueXMLList.trim() !== '' &&
        data.unitXMLList &&
        data.unitXMLList.trim() !== ''
      );
    } else {
      return (
        data.value &&
        data.value.trim() !== '' &&
        data.unit &&
        data.unit.trim() !== ''
      );
    }
  }

  private generateQuantityValueXML(data: any): string {
    if (data.dataType === 'realListXMLList') {
      let xmlContent = `
                <si:realListXMLList>
                  <si:valueXMLList>${this.escapeXml(
                    data.valueXMLList
                  )}</si:valueXMLList>
                  <si:unitXMLList>${this.escapeXml(
                    data.unitXMLList
                  )}</si:unitXMLList>`;

      // Agregar incertidumbre de medición si existe
      if (
        data.measurementUncertainty?.expandedMU?.valueExpandedMUXMLList &&
        data.measurementUncertainty.expandedMU.valueExpandedMUXMLList.trim() !==
          ''
      ) {
        xmlContent += `
                  <si:measurementUncertaintyUnivariateXMLList>
                    <si:expandedMUXMLList>
                      <si:valueExpandedMUXMLList>${this.escapeXml(
                        data.measurementUncertainty.expandedMU
                          .valueExpandedMUXMLList
                      )}</si:valueExpandedMUXMLList>
                      <si:coverageFactorXMLList>${this.escapeXml(
                        data.measurementUncertainty.expandedMU
                          .coverageFactorXMLList
                      )}</si:coverageFactorXMLList>
                      <si:coverageProbabilityXMLList>${this.escapeXml(
                        data.measurementUncertainty.expandedMU
                          .coverageProbabilityXMLList
                      )}</si:coverageProbabilityXMLList>
                    </si:expandedMUXMLList>
                  </si:measurementUncertaintyUnivariateXMLList>`;
      }

      xmlContent += `
                </si:realListXMLList>`;

      return xmlContent;
    } else {
      // dataType === 'real' o valor simple
      return `
                <si:real>
                  <si:value>${this.escapeXml(data.value)}</si:value>
                  <si:unit>${this.escapeXml(data.unit)}</si:unit>
                </si:real>`;
    }
  }
}
