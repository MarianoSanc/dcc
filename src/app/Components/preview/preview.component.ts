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
  objectIdentifications: any[] = [];
  itemIdentifications: any[] = [];
  private subscription: Subscription = new Subscription();

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    // Nos suscribimos al servicio que contiene los datos del DCC
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        this.dccData = data;
        this.generateXMLContent();

        // Las identificaciones ahora están en objectIdentifications o en items
        this.objectIdentifications = data.objectIdentifications || [];
        this.itemIdentifications = data.items || [];
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
        ${this.generateCoreIdentificationsXML(data)}
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
      ${this.generateItemsXML(data)}
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
      <dcc:statement>
        ${
          statement.convention
            ? `<dcc:convention>${this.escapeXml(
                statement.convention
              )}</dcc:convention>`
            : ''
        }
        ${
          typeof statement.traceable === 'boolean'
            ? `<dcc:traceable>${
                statement.traceable ? 'true' : 'false'
              }</dcc:traceable>`
            : ''
        }
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
        ${
          typeof statement.valid !== 'undefined' && statement.valid !== null
            ? `<dcc:valid>${
                statement.valid === 1 ? 'true' : 'false'
              }</dcc:valid>`
            : ''
        }
        ${
          statement.respAuthority_name ||
          statement.respAuthority_countryCode ||
          statement.respAuthority_postCode
            ? `<dcc:respAuthority>
                ${
                  statement.respAuthority_name
                    ? `<dcc:name><dcc:content lang="en">${this.escapeXml(
                        statement.respAuthority_name
                      )}</dcc:content></dcc:name>`
                    : ''
                }
                <dcc:location>
                  ${
                    statement.respAuthority_countryCode
                      ? `<dcc:countryCode>${this.escapeXml(
                          statement.respAuthority_countryCode
                        )}</dcc:countryCode>`
                      : ''
                  }
                  ${
                    statement.respAuthority_postCode
                      ? `<dcc:postCode>${this.escapeXml(
                          statement.respAuthority_postCode
                        )}</dcc:postCode>`
                      : ''
                  }
                </dcc:location>
              </dcc:respAuthority>`
            : ''
        }
        <dcc:declaration>
          <dcc:content lang="en">${this.escapeXml(
            statement.declaration || ''
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

  // =======================
  // Generador de equipos de medición XML
  // =======================
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
          <dcc:content lang="en">${this.escapeXml(equipment.name)}</dcc:content>
        </dcc:name>
        ${
          equipment.manufacturer
            ? `
        <dcc:manufacturer>
          <dcc:name>
            <dcc:content>${this.escapeXml(equipment.manufacturer)}</dcc:content>
          </dcc:name>
        </dcc:manufacturer>`
            : ''
        }
        ${
          equipment.model
            ? `<dcc:model>${this.escapeXml(equipment.model)}</dcc:model>`
            : ''
        }
        ${
          equipment.identifications && equipment.identifications.length > 0
            ? `
        <dcc:identifications>
          ${equipment.identifications
            .map(
              (identification) => `
          <dcc:identification>
            <dcc:issuer>${this.escapeXml(identification.issuer)}</dcc:issuer>
            <dcc:value>${this.escapeXml(identification.value)}</dcc:value>
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(
                identification.name
              )}</dcc:content>
            </dcc:name>
          </dcc:identification>`
            )
            .join('')}
        </dcc:identifications>`
            : ''
        }
      </dcc:measuringEquipment>`
        )
        .join('')}
    </dcc:measuringEquipments>`;
  }

  // =======================
  // Generador de condiciones de influencia XML
  // =======================
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
          <dcc:content lang="en">${this.escapeXml(condition.name)}</dcc:content>
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
                <si:value>${this.escapeXml(condition.subBlock.value)}</si:value>
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

  // =======================
  // Generador de resultados XML
  // =======================
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
          ${this.generateResultDataXML(result.data)}
        </dcc:data>
      </dcc:result>`
        )
        .join('')}
    </dcc:results>`;
  }

  // =======================
  // Generador de datos de resultado XML
  // =======================
  private generateResultDataXML(resultData: any[]): string {
    if (!resultData || resultData.length === 0) {
      return '';
    }

    // Verificar si hay datos de lista (múltiples cantidades)
    const hasListData =
      resultData.length > 1 ||
      resultData.some((data) => data.dataType === 'realListXMLList');

    if (hasListData) {
      return `
        <dcc:list>
          ${resultData
            .map(
              (data) => `
          <dcc:quantity refType="${this.escapeXml(data.refType)}">
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(data.name)}</dcc:content>
            </dcc:name>
            ${this.generateQuantityValueXML(data)}
          </dcc:quantity>`
            )
            .join('')}
        </dcc:list>`;
    } else {
      // Datos simples (una sola cantidad)
      const data = resultData[0];
      return `
        <dcc:quantity refType="${this.escapeXml(data.refType)}">
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(data.name)}</dcc:content>
          </dcc:name>
          ${this.generateQuantityValueXML(data)}
        </dcc:quantity>`;
    }
  }

  // =======================
  // Generador de valores de cantidad XML
  // =======================
  private generateQuantityValueXML(data: any): string {
    if (data.dataType === 'realListXMLList') {
      return `
            <si:hybrid>
              <si:realListXMLList>
                <si:valueXMLList>${this.escapeXml(
                  data.valueXMLList
                )}</si:valueXMLList>
                <si:unitXMLList>${this.escapeXml(
                  data.unitXMLList
                )}</si:unitXMLList>
              </si:realListXMLList>
            </si:hybrid>`;
    } else {
      // dataType === 'real' o valor simple
      return `
            <si:hybrid>
              <si:real>
                <si:value>${this.escapeXml(data.value)}</si:value>
                <si:unit>${this.escapeXml(data.unit)}</si:unit>
              </si:real>
            </si:hybrid>`;
    }
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
    // No generamos nada aquí ya que los object identifications ahora son itemQuantities
    return '';
  }

  private generateCoreIdentificationsXML(data: DCCData): string {
    // Crear identificaciones básicas del objeto usando datos del primer item si existe
    const firstItem =
      data.items && data.items.length > 0 ? data.items[0] : null;
    const coreIdentifications = [];

    if (firstItem) {
      // Objeto
      coreIdentifications.push({
        issuer: 'calibrationLaboratory',
        value: firstItem.name || 'HVAC MEASURING SYSTEM',
        name: 'Object',
      });

      // Manufacturer
      if (firstItem.manufacturer) {
        coreIdentifications.push({
          issuer: 'manufacturer',
          value: firstItem.manufacturer,
          name: 'Manufacturer / Brand',
        });
      }

      // Model
      if (firstItem.model) {
        coreIdentifications.push({
          issuer: 'manufacturer',
          value: firstItem.model,
          name: 'Type / Model',
        });
      }

      // Serial number
      if (firstItem.serialNumber) {
        coreIdentifications.push({
          issuer: 'manufacturer',
          value: firstItem.serialNumber,
          name: 'Serial number',
        });
      }

      // Customer asset ID
      if (firstItem.customerAssetId) {
        coreIdentifications.push({
          issuer: 'calibrationLaboratory',
          value: firstItem.customerAssetId,
          name: "Customer's asset ID",
        });
      }
    } else {
      // Fallback si no hay items
      coreIdentifications.push({
        issuer: 'calibrationLaboratory',
        value: 'HVAC MEASURING SYSTEM',
        name: 'Object',
      });
    }

    return this.generateIdentificationsXML(coreIdentifications);
  }

  private generateItemsXML(data: any): string {
    if (!data.items || data.items.length === 0) {
      return '';
    }

    const mainItem = data.items[0];

    let itemsXML = `
      <dcc:item>
        <dcc:name>
          <dcc:content lang="en">${this.escapeXml(mainItem.name)}</dcc:content>
        </dcc:name>`;

    // Manufacturer del item principal
    if (mainItem.manufacturer) {
      itemsXML += `
        <dcc:manufacturer>
          <dcc:name>
            <dcc:content>${this.escapeXml(mainItem.manufacturer)}</dcc:content>
          </dcc:name>
        </dcc:manufacturer>`;
    }

    // Model del item principal
    if (mainItem.model) {
      itemsXML += `
        <dcc:model>${this.escapeXml(mainItem.model)}</dcc:model>`;
    }

    // Identifications del item principal - incluir campos específicos solamente
    let allIdentifications = [];

    // Agregar Serial Number si existe
    if (mainItem.serialNumber) {
      allIdentifications.push({
        issuer: 'manufacturer',
        value: mainItem.serialNumber,
        name: 'Serial number',
      });
    }

    // Agregar Customer Asset ID si existe
    if (mainItem.customerAssetId) {
      allIdentifications.push({
        issuer: 'customer',
        value: mainItem.customerAssetId,
        name: "Customer's asset ID",
      });
    }

    if (allIdentifications.length > 0) {
      itemsXML += `
        <dcc:identifications>`;
      allIdentifications.forEach((identification: any) => {
        itemsXML += `
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
          </dcc:identification>`;
      });
      itemsXML += `
        </dcc:identifications>`;
    }

    // Item Quantities del item principal - generar desde object groups
    const validItemQuantities: string[] = [];

    if (data.objectIdentifications && data.objectIdentifications.length > 0) {
      data.objectIdentifications.forEach((group: any) => {
        // Solo agregar itemQuantity para measurement range si tiene valor válido
        if (
          group.assignedMeasurementRange &&
          group.assignedMeasurementRange.value &&
          group.assignedMeasurementRange.value.trim() !== ''
        ) {
          validItemQuantities.push(`
          <dcc:itemQuantity refType="voltage_measurement_range">
            <dcc:name>
              <dcc:content lang="en">Assigned measurement range(s)</dcc:content>
            </dcc:name>
            <si:real>
              ${
                group.assignedMeasurementRange.label &&
                group.assignedMeasurementRange.label.trim() !== ''
                  ? `<si:label>${this.escapeXml(
                      group.assignedMeasurementRange.label
                    )}</si:label>`
                  : ''
              }
              <si:value>${this.escapeXml(
                group.assignedMeasurementRange.value
              )}</si:value>
              <si:unit>${this.escapeXml(
                group.assignedMeasurementRange.unit || '\\volt'
              )}</si:unit>
            </si:real>
          </dcc:itemQuantity>`);
        }

        // Solo agregar itemQuantity para scale factor si tiene valor válido
        if (
          group.assignedScaleFactor &&
          group.assignedScaleFactor.value &&
          group.assignedScaleFactor.value.trim() !== ''
        ) {
          validItemQuantities.push(`
          <dcc:itemQuantity refType="scale_factor">
            <dcc:name>
              <dcc:content lang="en">Assigned scale factor(s)</dcc:content>
            </dcc:name>
            <si:real>
              ${
                group.assignedScaleFactor.label &&
                group.assignedScaleFactor.label.trim() !== ''
                  ? `<si:label>${this.escapeXml(
                      group.assignedScaleFactor.label
                    )}</si:label>`
                  : ''
              }
              <si:value>${this.escapeXml(
                group.assignedScaleFactor.value
              )}</si:value>
              <si:unit>${this.escapeXml(
                group.assignedScaleFactor.unit || '\\one'
              )}</si:unit>
            </si:real>
          </dcc:itemQuantity>`);
        }
      });
    }

    // Solo agregar el bloque itemQuantities si hay cantidades válidas
    if (validItemQuantities.length > 0) {
      itemsXML += `
        <dcc:itemQuantities>`;
      itemsXML += validItemQuantities.join('');
      itemsXML += `
        </dcc:itemQuantities>`;
    }

    // SubItems (sin cambios)
    if (mainItem.subItems && mainItem.subItems.length > 0) {
      itemsXML += `
        <dcc:subItems>`;

      mainItem.subItems.forEach((subItem: any) => {
        itemsXML += `
          <dcc:item>
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(
                subItem.name
              )}</dcc:content>
            </dcc:name>`;

        // Manufacturer del subitem
        if (subItem.manufacturer) {
          itemsXML += `
            <dcc:manufacturer>
              <dcc:name>
                <dcc:content>${this.escapeXml(
                  subItem.manufacturer
                )}</dcc:content>
              </dcc:name>
            </dcc:manufacturer>`;
        }

        // Model del subitem
        if (subItem.model) {
          itemsXML += `
            <dcc:model>${this.escapeXml(subItem.model)}</dcc:model>`;
        }

        // Identifications del subitem - solo si hay identificaciones válidas
        if (subItem.identifications && subItem.identifications.length > 0) {
          const validIdentifications = subItem.identifications.filter(
            (id: any) => id.value && id.value.trim() !== ''
          );

          if (validIdentifications.length > 0) {
            itemsXML += `
            <dcc:identifications>`;
            validIdentifications.forEach((identification: any) => {
              itemsXML += `
              <dcc:identification>
                <dcc:issuer>${this.mapIssuerToLowerCase(
                  identification.issuer
                )}</dcc:issuer>
                <dcc:value>${this.escapeXml(identification.value)}</dcc:value>
                ${
                  identification.name && identification.name.trim() !== ''
                    ? `<dcc:name>
                  <dcc:content lang="en">${this.escapeXml(
                    identification.name
                  )}</dcc:content>
                </dcc:name>`
                    : ''
                }
              </dcc:identification>`;
            });
            itemsXML += `
            </dcc:identifications>`;
          }
        }

        // Item Quantities del subitem - solo si hay cantidades válidas
        if (subItem.itemQuantities && subItem.itemQuantities.length > 0) {
          const validQuantities = subItem.itemQuantities.filter(
            (q: any) => q.value && q.value.trim() !== ''
          );

          if (validQuantities.length > 0) {
            itemsXML += `
            <dcc:itemQuantities>`;
            validQuantities.forEach((quantity: any) => {
              itemsXML += `
              <dcc:itemQuantity${
                quantity.refType
                  ? ` refType="${this.escapeXml(quantity.refType)}"`
                  : ''
              }>
                ${
                  quantity.name && quantity.name.trim() !== ''
                    ? `<dcc:name>
                  <dcc:content lang="en">${this.escapeXml(
                    quantity.name
                  )}</dcc:content>
                </dcc:name>`
                    : ''
                }
                <si:real>
                  <si:value>${this.escapeXml(quantity.value)}</si:value>
                  <si:unit>${this.escapeXml(quantity.unit || '')}</si:unit>
                </si:real>
              </dcc:itemQuantity>`;
            });
            itemsXML += `
            </dcc:itemQuantities>`;
          }
        }

        itemsXML += `
          </dcc:item>`;
      });

      itemsXML += `
        </dcc:subItems>`;
    }

    itemsXML += `
      </dcc:item>`;

    return itemsXML;
  }

  // =======================
  // Generador de métodos usados XML
  // =======================
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
      Owner: 'other',
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

  // Método helper para obtener el nombre de una persona responsable
  private getPersonDisplayName(person: any): string {
    // Si tiene full_name directamente (desde la BD), usarlo
    if (person.full_name) {
      return person.full_name;
    }

    // Fallback para compatibilidad con formato anterior
    if (typeof person.name === 'string' && person.name) {
      return person.name;
    }

    return 'No asignado';
  }
}
