import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService, DCCData } from '../../services/dcc-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.css',
})
export class PreviewComponent implements OnInit, OnDestroy {
  dccData: DCCData | null = null;
  viewMode: 'xml' | 'pdf' = 'xml';
  xmlContent: string = '';
  private subscription: Subscription = new Subscription();

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    // Nos suscribimos al servicio que contiene los datos del DCC
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

  setViewMode(mode: 'xml' | 'pdf') {
    this.viewMode = mode;
  }

  downloadFile() {
    if (this.viewMode === 'xml') {
      this.downloadXML();
    } else {
      this.downloadPDF();
    }
  }

  private downloadXML() {
    // Genera un archivo XML y fuerza la descarga
    const blob = new Blob([this.xmlContent], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DCC_${
      this.dccData?.administrativeData.core.certificate_number || 'certificate'
    }.xml`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private downloadPDF() {
    // Pendiente de implementar la generación de PDF
    console.log('PDF download functionality to be implemented');
    alert('PDF download functionality will be implemented in the future');
  }

  // =======================
  // Generador principal XML
  // =======================
  private generateXMLContent() {
    if (!this.dccData) return;
    const data = this.dccData;

    this.xmlContent = `<?xml version="1.0" encoding="utf-8"?>
    <!-- <?xml-stylesheet type="text/xsl" href="book.xsl"?> -->

<dcc:digitalCalibrationCertificate
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:dcc="https://ptb.de/dcc"
  xmlns:si="https://ptb.de/si"
  xsi:schemaLocation="https://ptb.de/dcc https://ptb.de/dcc/v3.3.0/dcc.xsd"
  schemaVersion="3.3.0">

  <!-- ========== Datos administrativos ========== -->
  <dcc:administrativeData>

    <!-- 1️ Datos del software -->
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
      </dcc:software>
    </dcc:dccSoftware>

    <!-- 2️ Datos centrales -->
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

      <dcc:identifications>
        ${this.generateIdentificationsXML(
          data.administrativeData.identifications
        )}
      </dcc:identifications>

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
      }
    </dcc:coreData>

    <!-- 3️ Equipos y objetos calibrados -->
    <dcc:items>
      ${this.generateObjectItemXML(data)}
      ${this.generateItemsXML(data.items)}
    </dcc:items>

    <!-- 4️ Laboratorio de calibración -->
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

    <!-- 5️ Personas responsables -->
    <dcc:respPersons>
      ${data.administrativeData.responsiblePersons
        .map(
          (person) => `
      <dcc:respPerson refType="basic_technician">
        <dcc:person>
          <dcc:name>
            <dcc:content>${this.escapeXml(person.name)}</dcc:content>
          </dcc:name>
        </dcc:person>
        <dcc:role>${this.escapeXml(person.role)}</dcc:role>
      </dcc:respPerson>`
        )
        .join('')}
    </dcc:respPersons>

    <!-- 6️ Cliente -->
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

    <!-- 7️ Declaraciones -->
    <dcc:statements>
      ${
        data.statements
          ?.map(
            (statement) => `
      <dcc:statement refType="${this.escapeXml(statement.refType)}">
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
            statement.content
          )}</dcc:content>
        </dcc:declaration>
      </dcc:statement>`
          )
          .join('') || ''
      }
    </dcc:statements>

  </dcc:administrativeData>

  <!-- ========== Resultados de medición ========== -->
  <dcc:measurementResults>
    ${this.generateUsedMethodsXML(data)}
    ${this.generateMeasurementResultXML(data)}
  </dcc:measurementResults>

</dcc:digitalCalibrationCertificate>`;
  }

  // Genera el bloque de issuer usando los datos del laboratorio
  private generateIssuerXML(data: DCCData): string {
    const lab = data.administrativeData.laboratory;
    return `
    <dcc:issuer>
      <dcc:name>
        <dcc:content lang="en">${this.escapeXml(lab.name)}</dcc:content>
      </dcc:name>
      <dcc:location>
        <dcc:street>${this.escapeXml(lab.street)}</dcc:street>
        <dcc:streetNo>${this.escapeXml(lab.street_number)}</dcc:streetNo>
        <dcc:city>${this.escapeXml(lab.city)}</dcc:city>
        <dcc:state>${this.escapeXml(lab.state)}</dcc:state>
        <dcc:countryCode>${this.escapeXml(
          data.administrativeData.core.country_code
        )}</dcc:countryCode>
        <dcc:postCode>${this.escapeXml(lab.postal_code)}</dcc:postCode>
      </dcc:location>
    </dcc:issuer>`;
  }

  private generateMeasurementResultXML(data: DCCData): string {
    if (!data.measurementResult) {
      return '';
    }

    return `
    <dcc:measurementResult>
      <dcc:name>
        <dcc:content lang="en">${this.escapeXml(
          data.measurementResult.name
        )}</dcc:content>
      </dcc:name>
      <dcc:description>
        <dcc:content lang="en">${this.escapeXml(
          data.measurementResult.description
        )}</dcc:content>
      </dcc:description>
      ${this.generateMeasuringEquipmentsXML(data)}
      ${this.generateInfluenceConditionsXML(data)}
      ${this.generateResultsXML(data)}
    </dcc:measurementResult>`;
  }

  // Helper methods for XML generation
  private escapeXml(str: string | undefined): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatDate(dateValue: any): string {
    if (!dateValue) return new Date().toISOString().split('T')[0];

    // Si ya es string en formato YYYY-MM-DD, devolverlo directamente
    if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }

    let date: Date;

    // Si es string, convertir a Date cuidadosamente
    if (typeof dateValue === 'string') {
      date = new Date(dateValue + 'T12:00:00'); // Agregar tiempo para evitar zona horaria
    }
    // Si ya es Date object
    else if (dateValue instanceof Date) {
      date = dateValue;
    }
    // Si no es válido, usar fecha actual
    else {
      date = new Date();
    }

    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) {
      date = new Date(); // Fallback a fecha actual
    }

    // Formatear usando métodos locales en lugar de toISOString para evitar problemas de zona horaria
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private generateIdentificationsXML(identifications: any[]): string {
    return identifications
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
      .join('');
  }

  private generateObjectItemXML(data: DCCData): string {
    const objectItem = data.administrativeData.identifications.find(
      (item) => item.name === 'Object'
    );
    const objectIdentifications = data.objectIdentifications || [];

    return `
      <dcc:name>
        <dcc:content lang="en">${this.escapeXml(
          objectItem?.value || ''
        )}</dcc:content>
      </dcc:name>
      <dcc:identifications>
        ${objectIdentifications
          .map(
            (id) => `
        <dcc:identification>
          <dcc:issuer>${this.mapIssuerToLowerCase(id.issuer)}</dcc:issuer>
          <dcc:value>${this.escapeXml(id.value)}</dcc:value>
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(id.name)}</dcc:content>
          </dcc:name>
        </dcc:identification>`
          )
          .join('')}
      </dcc:identifications>`;
  }

  private generateItemsXML(items: any[]): string {
    return items
      .map(
        (item) => `
      <dcc:item refType="${this.generateRefType(item.name)}">
        <dcc:name>
          <dcc:content lang="en">${this.escapeXml(item.name)}</dcc:content>
        </dcc:name>
        ${
          item.manufacturer
            ? `
        <dcc:manufacturer>
          <dcc:name>
            <dcc:content>${this.escapeXml(item.manufacturer)}</dcc:content>
          </dcc:name>
        </dcc:manufacturer>`
            : ''
        }
        ${
          item.model
            ? `<dcc:model>${this.escapeXml(item.model)}</dcc:model>`
            : ''
        }
        <dcc:identifications>
          ${
            item.identifications
              ?.map(
                (id: any) => `
          <dcc:identification>
            <dcc:issuer>${this.mapIssuerToLowerCase(id.issuer)}</dcc:issuer>
            <dcc:value>${this.escapeXml(id.value)}</dcc:value>
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(id.name)}</dcc:content>
            </dcc:name>
          </dcc:identification>`
              )
              .join('') || ''
          }
        </dcc:identifications>
      </dcc:item>`
      )
      .join('');
  }

  private generateMeasuringEquipmentsXML(data: DCCData): string {
    if (!data.measuringEquipments || data.measuringEquipments.length === 0) {
      return '';
    }

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
          <dcc:identifications>
            ${
              equipment.identifications
                ?.map(
                  (id: any) => `
            <dcc:identification>
              <dcc:issuer>${this.escapeXml(id.issuer)}</dcc:issuer>
              <dcc:value>${this.escapeXml(id.value)}</dcc:value>
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(id.name)}</dcc:content>
              </dcc:name>
            </dcc:identification>`
                )
                .join('') || ''
            }
          </dcc:identifications>
        </dcc:measuringEquipment>`
          )
          .join('')}
      </dcc:measuringEquipments>`;
  }

  private generateInfluenceConditionsXML(data: DCCData): string {
    if (!data.influenceConditions || data.influenceConditions.length === 0) {
      return '';
    }

    return `
      <dcc:influenceConditions>
        ${data.influenceConditions
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
              <si:hybrid>
                <si:real>
                  <si:value>${this.escapeXml(
                    condition.subBlock.value
                  )}</si:value>
                  <si:unit>${this.escapeXml(condition.subBlock.unit)}</si:unit>
                </si:real>
              </si:hybrid>
            </dcc:quantity>
          </dcc:data>
        </dcc:influenceCondition>`
          )
          .join('')}
      </dcc:influenceConditions>`;
  }

  private generateResultsXML(data: DCCData): string {
    if (!data.results || data.results.length === 0) {
      return '';
    }

    return `
      <dcc:results>
        ${data.results
          .map(
            (result) => `
        <dcc:result refType="${this.escapeXml(result.refType)}">
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(result.name)}</dcc:content>
          </dcc:name>
          <dcc:data>
            <dcc:list>
              ${result.data
                .map(
                  (dataItem) => `
              <dcc:quantity refType="${this.escapeXml(dataItem.refType)}">
                <dcc:name>
                  <dcc:content lang="en">${this.escapeXml(
                    dataItem.name
                  )}</dcc:content>
                </dcc:name>
                <si:hybrid>
                  ${
                    dataItem.dataType === 'realListXMLList'
                      ? `
                  <si:realListXMLList>
                    <si:valueXMLList>${this.escapeXml(
                      dataItem.valueXMLList
                    )}</si:valueXMLList>
                    <si:unitXMLList>${this.escapeXml(
                      dataItem.unitXMLList
                    )}</si:unitXMLList>
                  </si:realListXMLList>
                  `
                      : `
                  <si:real>
                    <si:value>${this.escapeXml(dataItem.value)}</si:value>
                    <si:unit>${this.escapeXml(dataItem.unit)}</si:unit>
                  </si:real>
                  `
                  }
                </si:hybrid>
              </dcc:quantity>`
                )
                .join('')}
            </dcc:list>
          </dcc:data>
        </dcc:result>`
          )
          .join('')}
      </dcc:results>`;
  }

  private generateUsedMethodsXML(data: DCCData): string {
    if (!data.usedMethods || data.usedMethods.length === 0) {
      return '';
    }

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
        ${
          method.reference
            ? `<dcc:reference>${this.escapeXml(
                method.reference
              )}</dcc:reference>`
            : ''
        }
      </dcc:usedMethod>`
        )
        .join('')}
    </dcc:usedMethods>`;
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

  private generateRefType(itemName: string): string {
    // Generate refType based on item name - you can customize this logic
    const name = itemName.toLowerCase();
    if (name.includes('divider')) return 'hv_divider';
    if (name.includes('cable')) return 'measurement_cable';
    if (name.includes('kilovoltmeter') || name.includes('voltmeter'))
      return 'kilovoltmeter';
    if (name.includes('measurement')) return 'measurement_equipment';
    return 'basic_item';
  }
}
