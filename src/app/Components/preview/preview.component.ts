import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DccDataService, DCCData } from '../../services/dcc-data.service';
import {
  PdfGeneratorService,
  PdfTemplateData,
} from '../../services/pdf-generator.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.css'],
})
export class PreviewComponent implements OnInit, OnDestroy {
  xmlContent: string = '';
  dccData: DCCData | null = null;
  private subscription: Subscription = new Subscription();
  private database: string = 'calibraciones';
  private isGeneratingXML: boolean = false;

  // Variables para PDF
  isGeneratingPdf: boolean = false;

  constructor(
    private dccDataService: DccDataService,
    private pdfGeneratorService: PdfGeneratorService,
  ) {}

  ngOnInit() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        // Antes de generar el XML, fuerza recarga de resultados desde la BD
        this.dccData = data;
        this.reloadResultsFromDBAndGenerateXML();
      }),
    );
  }

  // Nuevo método para recargar resultados finales desde la BD antes de generar el XML
  private reloadResultsFromDBAndGenerateXML() {
    const certificateNumber =
      this.dccData?.administrativeData.core.certificate_number;
    if (!certificateNumber) {
      this.loadPT23DataAndGenerateXML();
      return;
    }
    // Primero recargar el nombre de measurementResult desde la BD
    const nameQuery = {
      action: 'get',
      bd: this.database,
      table: 'dcc_data',
      opts: {
        where: { id: certificateNumber },
        attributes: ['name_measurement'],
      },
    };
    this.dccDataService.post(nameQuery).subscribe({
      next: (nameResp: any) => {
        if (nameResp?.result?.[0]?.name_measurement && this.dccData) {
          if (!this.dccData.measurementResult) {
            this.dccData.measurementResult = { name: '', description: '' };
          }
          this.dccData.measurementResult.name =
            nameResp.result[0].name_measurement;
        }

        // Ahora recargar los resultados
        const query = {
          action: 'get',
          bd: this.database,
          table: 'dcc_results',
          opts: {
            where: { id_dcc: certificateNumber, deleted: 0 },
          },
        };
        this.dccDataService.post(query).subscribe({
          next: (response: any) => {
            if (
              response?.result &&
              response.result.length > 0 &&
              this.dccData
            ) {
              // Mapear los resultados finales y actualizar dccData
              this.dccData.results = response.result.map((dbResult: any) => {
                const dbData = dbResult.data ? JSON.parse(dbResult.data) : [];
                return {
                  id: dbResult.id,
                  name: dbResult.name,
                  refType: dbResult.ref_type,
                  data: dbData,
                };
              });
            }
            this.loadPT23DataAndGenerateXML();
          },
          error: () => {
            this.loadPT23DataAndGenerateXML();
          },
        });
      },
      error: () => {
        // Si falla la consulta del nombre, continuar con los resultados
        const query = {
          action: 'get',
          bd: this.database,
          table: 'dcc_results',
          opts: {
            where: { id_dcc: certificateNumber, deleted: 0 },
          },
        };
        this.dccDataService.post(query).subscribe({
          next: (response: any) => {
            if (
              response?.result &&
              response.result.length > 0 &&
              this.dccData
            ) {
              this.dccData.results = response.result.map((dbResult: any) => {
                const dbData = dbResult.data ? JSON.parse(dbResult.data) : [];
                return {
                  id: dbResult.id,
                  name: dbResult.name,
                  refType: dbResult.ref_type,
                  data: dbData,
                };
              });
            }
            this.loadPT23DataAndGenerateXML();
          },
          error: () => {
            this.loadPT23DataAndGenerateXML();
          },
        });
      },
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  downloadXML() {
    // Fuerza la regeneración del XML antes de descargar
    this.generateXMLContent();
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

  private async loadPT23DataAndGenerateXML() {
    // OPTIMIZACIÓN: Evitar regeneración si ya está en proceso
    if (this.isGeneratingXML) return;

    if (!this.dccData) return;

    this.isGeneratingXML = true;

    const certificateNumber =
      this.dccData.administrativeData.core.certificate_number;
    if (!certificateNumber) {
      this.generateXMLContent();
      this.isGeneratingXML = false;
      return;
    }

    this.generateXMLContent();
    this.isGeneratingXML = false;
  }

  private loadPT23Data(dccId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_scalefactor_nivel',
        opts: {
          where: {
            id_dcc: dccId,
            deleted: 0,
          },
          order_by: ['prueba', 'ASC', 'nivel_tension', 'ASC'],
        },
      };

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          if (response?.result?.length > 0) {
            const niveles = response.result;

            // Agrupar por prueba
            const groupedByPrueba: { [key: number]: any[] } = {};

            niveles.forEach((nivel: any) => {
              if (!groupedByPrueba[nivel.prueba]) {
                groupedByPrueba[nivel.prueba] = [];
              }

              groupedByPrueba[nivel.prueba].push({
                nivel: nivel.nivel_tension,
                promedio_dut: nivel.promedio_dut,
                promedio_patron: nivel.promedio_patron,
                desviacion_std_dut: nivel.desviacion_std_dut,
                desviacion_std_patron: nivel.desviacion_std_patron,
                num_mediciones: nivel.num_mediciones,
              });
            });

            const scaleFactorData = Object.keys(groupedByPrueba)
              .map(Number)
              .sort((a, b) => a - b)
              .map((prueba) => ({
                prueba,
                tablas: groupedByPrueba[prueba],
              }));

            resolve(scaleFactorData);
          } else {
            resolve([]);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  // =======================
  // Generador principal XML
  // =======================
  private generateXMLContent() {
    if (!this.dccData) return;
    const data = this.dccData;
    const pdfData = this.preparePdfData();

    this.xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet type="text/xsl" href="book.xsl"?>
<dcc:digitalCalibrationCertificate xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:dcc="https://ptb.de/dcc"
  xmlns:si="https://ptb.de/si"
  xsi:schemaLocation="https://ptb.de/dcc https://ptb.de/dcc/v3.3.0/dcc.xsd"
  schemaVersion="3.3.0">

  <!-- ========== Datos administrativos ========== -->
  <dcc:administrativeData>

    <!-- Datos del software -->
    <dcc:dccSoftware>
      <dcc:software>
        <dcc:name>
          <dcc:content>${this.escapeXml(
            data.administrativeData.software.name,
          )}</dcc:content>
        </dcc:name>
        <dcc:release>${this.escapeXml(
          data.administrativeData.software.version,
        )}</dcc:release>
        <dcc:type>${this.escapeXml(
          data.administrativeData.software.type,
        )}</dcc:type>
        ${
          data.administrativeData.software.description
            ? `<dcc:description>
          <dcc:content>${this.escapeXml(
            data.administrativeData.software.description,
          )}</dcc:content>
        </dcc:description>`
            : ''
        }
      </dcc:software>
    </dcc:dccSoftware>

    <!-- Datos centrales -->
    <dcc:coreData>
      <dcc:countryCodeISO3166_1>${this.escapeXml(
        data.administrativeData.core.country_code,
      )}</dcc:countryCodeISO3166_1>
      <dcc:usedLangCodeISO639_1>${this.escapeXml(
        data.administrativeData.core.language,
      )}</dcc:usedLangCodeISO639_1>
      <dcc:mandatoryLangCodeISO639_1>${this.escapeXml(
        data.administrativeData.core.language,
      )}</dcc:mandatoryLangCodeISO639_1>
      <dcc:uniqueIdentifier>${this.escapeXml(
        pdfData.certificate_number,
      )}</dcc:uniqueIdentifier>
      ${
        pdfData.beginPerformanceDate
          ? `<dcc:beginPerformanceDate>${this.escapeXml(
              pdfData.beginPerformanceDate,
            )}</dcc:beginPerformanceDate>`
          : ''
      }
      ${
        pdfData.endPerformanceDate
          ? `<dcc:endPerformanceDate>${this.escapeXml(
              pdfData.endPerformanceDate,
            )}</dcc:endPerformanceDate>`
          : `<dcc:endPerformanceDate>${this.escapeXml(
              pdfData.beginPerformanceDate,
            )}</dcc:endPerformanceDate>`
      }
      <dcc:performanceLocation>${this.escapeXml(
        pdfData.performanceLocation,
      )}</dcc:performanceLocation>
      ${
        pdfData.issue_date
          ? `<dcc:issueDate>${this.escapeXml(
              pdfData.issue_date,
            )}</dcc:issueDate>`
          : ''
      }
    </dcc:coreData>

    <!-- Equipos y objetos calibrados -->
    <dcc:items>
      ${this.generateItemsXML(data)}
    </dcc:items>

    <!-- Laboratorio de calibración -->
    <dcc:calibrationLaboratory>
      <dcc:contact>
        <dcc:name>
          <dcc:content lang="en">${this.escapeXml(
            data.administrativeData.laboratory.name,
          )}</dcc:content>
        </dcc:name>
        ${
          data.administrativeData.laboratory.phone
            ? `<dcc:phone>${this.escapeXml(
                data.administrativeData.laboratory.phone,
              )}</dcc:phone>`
            : ''
        }
        <dcc:location>
          <dcc:city>${this.escapeXml(
            data.administrativeData.laboratory.city,
          )}</dcc:city>
          <dcc:countryCode>${this.escapeXml(
            data.administrativeData.core.country_code,
          )}</dcc:countryCode>
          <dcc:postCode>${this.escapeXml(
            data.administrativeData.laboratory.postal_code,
          )}</dcc:postCode>
          <dcc:state>${this.escapeXml(
            data.administrativeData.laboratory.state,
          )}</dcc:state>
          <dcc:street>${this.escapeXml(
            data.administrativeData.laboratory.street,
          )}</dcc:street>
          <dcc:streetNo>${this.escapeXml(
            data.administrativeData.laboratory.street_number,
          )}</dcc:streetNo>
        </dcc:location>
      </dcc:contact>
    </dcc:calibrationLaboratory>

    <!-- Personas responsables -->
    <dcc:respPersons>
      ${data.administrativeData.responsiblePersons
        .filter((person) => person.role && person.role.trim() !== '')
        .map(
          (person) => `
      <dcc:respPerson>
        <dcc:person>
          <dcc:name>
            <dcc:content>${this.escapeXml(
              this.getPersonDisplayName(person),
            )}</dcc:content>
          </dcc:name>${
            person.email
              ? `
          <dcc:eMail>${this.escapeXml(person.email)}</dcc:eMail>`
              : ''
          }${
            person.phone
              ? `
          <dcc:phone>${this.escapeXml(person.phone)}</dcc:phone>`
              : ''
          }
        </dcc:person>
        <dcc:role>${this.escapeXml(person.role)}</dcc:role>
        ${person.mainSigner ? '<dcc:mainSigner>true</dcc:mainSigner>' : ''}
      </dcc:respPerson>`,
        )
        .join('')}
    </dcc:respPersons>

    <!-- Cliente -->
    <dcc:customer>
      <dcc:name>
        <dcc:content>${this.escapeXml(
          data.administrativeData.customer.name,
        )}</dcc:content>
      </dcc:name>
      <dcc:location>
        <dcc:street>${this.escapeXml(
          data.administrativeData.customer.street,
        )}</dcc:street>
        <dcc:streetNo>${this.escapeXml(
          data.administrativeData.customer.street_number,
        )}</dcc:streetNo>
        <dcc:city>${this.escapeXml(
          data.administrativeData.customer.city,
        )}</dcc:city>
        <dcc:state>${this.escapeXml(
          data.administrativeData.customer.state,
        )}</dcc:state>
        <dcc:countryCode>${this.escapeXml(
          data.administrativeData.core.country_code,
        )}</dcc:countryCode>
        <dcc:postCode>${this.escapeXml(
          data.administrativeData.customer.postal_code,
        )}</dcc:postCode>
      </dcc:location>
    </dcc:customer>

    <!-- Declaraciones -->
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
          </dcc:identification>`,
            )
            .join('')}
        </dcc:identifications>`;
  }

  private generateItemQuantitiesXML(
    objectIdentifications?: any[] | undefined,
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
          </dcc:itemQuantity>`,
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
                subItem.name,
              )}</dcc:content>
            </dcc:name>
            ${
              subItem.manufacturer
                ? `
            <dcc:manufacturer>
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(
                  subItem.manufacturer,
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
          </dcc:item>`,
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
                    id.name,
                  )}</dcc:content>
                </dcc:name>`
                    : ''
                }
              </dcc:identification>`,
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
                    qty.name,
                  )}</dcc:content>
                </dcc:name>
                <si:real>
                  <si:value>${this.escapeXml(qty.value)}</si:value>
                  <si:unit>${this.escapeXml(qty.unit)}</si:unit>
                </si:real>
              </dcc:itemQuantity>`,
                )
                .join('')}
            </dcc:itemQuantities>`;
  }

  private generateMeasurementResultNameXML(data: DCCData): string {
    // Priorizar el nombre editable measurementResult.name sobre item_name
    let name = '';
    const pdfData = this.preparePdfData();
    if (
      data.measurementResult?.name &&
      data.measurementResult.name.trim() !== ''
    ) {
      name = data.measurementResult.name;
    } else if (pdfData.item_name) {
      name = pdfData.item_name;
    } else {
      name = `Calibration ${
        pdfData.certificate_number ||
        data.administrativeData.core.certificate_number ||
        ''
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
                statement.reference,
              )}</dcc:reference>`
            : ''
        }
        <dcc:declaration>
          <dcc:content lang="en">${this.escapeXml(
            statement.declaration || '',
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
      </dcc:statement>`,
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
              statement.respAuthority_name,
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
              statement.respAuthority_countryCode,
            )}</dcc:countryCode>`
                : ''
            }
            ${
              statement.respAuthority_postCode
                ? `
            <dcc:postCode>${this.escapeXml(
              statement.respAuthority_postCode,
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
              method.description,
            )}</dcc:content>
          </dcc:description>
          ${
            method.norm
              ? `<dcc:norm>${this.escapeXml(method.norm)}</dcc:norm>`
              : ''
          }
          ${this.generateUsedMethodQuantitiesXML(method)}
        </dcc:usedMethod>`,
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
            </dcc:usedMethodQuantity>`,
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
              equipment.name,
            )}</dcc:content>
          </dcc:name>
          ${
            equipment.manufacturer
              ? `
          <dcc:manufacturer>
            <dcc:name>
              <dcc:content lang="en">${this.escapeXml(
                equipment.manufacturer,
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
        </dcc:measuringEquipment>`,
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
                identification.issuer,
              )}</dcc:issuer>
              <dcc:value>${this.escapeXml(identification.value)}</dcc:value>
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(
                  identification.name,
                )}</dcc:content>
              </dcc:name>
            </dcc:identification>`,
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
              condition.subBlock.value &&
              condition.subBlock.value.trim() !== '',
          )
          .map(
            (condition) => `
        <dcc:influenceCondition refType="${this.escapeXml(condition.refType)}">
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(
              condition.name,
            )}</dcc:content>
          </dcc:name>
          <dcc:data>
            <dcc:quantity>
              <dcc:name>
                <dcc:content lang="en">${this.escapeXml(
                  condition.subBlock.name,
                )}</dcc:content>
              </dcc:name>
              <si:real>
                <si:value>${this.escapeXml(condition.subBlock.value)}</si:value>
                <si:unit>${this.escapeXml(condition.subBlock.unit)}</si:unit>
              </si:real>
            </dcc:quantity>
          </dcc:data>
        </dcc:influenceCondition>`,
          )
          .join('')}
      </dcc:influenceConditions>`;
  }

  private generateResultsXML(data: DCCData): string {
    if (!data.results || data.results.length === 0) return '';

    // Adaptar los nombres y refType para coincidir con el XML de ejemplo
    // Forzar valueXMLList y unitXMLList para todos los resultados tipo lista
    const nameMap: { [key: string]: { refType: string; xmlName: string } } = {
      Range: { refType: 'hv_range', xmlName: 'Range' },
      'Voltage Measured': {
        refType: 'basic_measuredValue',
        xmlName: 'Voltage Measured',
      },
      'Ref. Voltage': {
        refType: 'basic_referenceValue',
        xmlName: 'Ref. Voltage',
      },
      'Voltage Error': {
        refType: 'basic_measurementError',
        xmlName: 'Voltage Error',
      },
      'Obtained Scale Factor': {
        refType: 'hv_scaleFactor',
        xmlName: 'Obtained Scale Factor',
      },
    };

    return `
      <dcc:results>
${data.results
  .map((result) => {
    if (Array.isArray(result.data)) {
      return `

        <dcc:result${
          result.refType ? ` refType="${this.escapeXml(result.refType)}"` : ''
        }>
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(result.name)}</dcc:content>
          </dcc:name>

          <dcc:data>
            <dcc:list>
${result.data
  .map((qty: any) => {
    const mapInfo = nameMap[qty.name] || {
      refType: '',
      xmlName: qty.name,
    };
    const forcedQty = {
      ...qty,
      dataType: 'realListXMLList',
      valueXMLList: qty.valueXMLList || qty.value || '',
      unitXMLList: qty.unitXMLList || qty.unit || '',
    };
    return `
                <dcc:quantity${
                  mapInfo.refType ? ` refType="${mapInfo.refType}"` : ''
                }>
                  <dcc:name>
                    <dcc:content lang="en">${this.escapeXml(
                      mapInfo.xmlName,
                    )}</dcc:content>
                  </dcc:name>
${this.generateQuantityValueXML(forcedQty)}
                </dcc:quantity>`;
  })
  .join('')}
            </dcc:list>
          </dcc:data>

        </dcc:result>
`;
    } else {
      return `

        <dcc:result${
          result.refType ? ` refType="${this.escapeXml(result.refType)}"` : ''
        }>
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(result.name)}</dcc:content>
          </dcc:name>

          <dcc:data>
${this.generateResultDataXML(result.data)}
          </dcc:data>

        </dcc:result>
`;
    }
  })
  .join('')}
      </dcc:results>
`;
  }

  // ...existing code...

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
      // Siempre mostrar valueXMLList y unitXMLList aunque estén vacíos
      let xmlContent = `
                    <si:realListXMLList>
                      <si:valueXMLList>${this.escapeXml(
                        data.valueXMLList || '',
                      )}</si:valueXMLList>
                      <si:unitXMLList>${this.escapeXml(
                        data.unitXMLList || '',
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
                              .valueExpandedMUXMLList || '',
                          )}</si:valueExpandedMUXMLList>
                          <si:coverageFactorXMLList>${this.escapeXml(
                            data.measurementUncertainty.expandedMU
                              .coverageFactorXMLList || '',
                          )}</si:coverageFactorXMLList>
                          <si:coverageProbabilityXMLList>${this.escapeXml(
                            data.measurementUncertainty.expandedMU
                              .coverageProbabilityXMLList || '',
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
                      <si:value>${this.escapeXml(data.value || '')}</si:value>
                      <si:unit>${this.escapeXml(data.unit || '')}</si:unit>
                    </si:real>`;
    }
  }

  private generateResultDataXML(data: any[]): string {
    if (!data || data.length === 0) return '';

    return data
      .filter((item) => this.isValidQuantityData(item))
      .map(
        (item) => `
        <dcc:quantity${
          item.refType ? ` refType="${this.escapeXml(item.refType)}"` : ''
        }>
          <dcc:name>
            <dcc:content lang="en">${this.escapeXml(item.name)}</dcc:content>
          </dcc:name>
          ${this.generateQuantityValueXML(item)}
        </dcc:quantity>`,
      )
      .join('');
  }

  // =======================
  // Métodos para generación de PDF
  // =======================

  /**
   * Genera el PDF usando la plantilla Word
   */
  generatePdf(): void {
    if (!this.dccData) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos',
        text: 'No hay datos del DCC para generar el PDF.',
      });
      return;
    }

    this.isGeneratingPdf = true;

    // Preparar los datos para la plantilla
    const pdfData = this.preparePdfData();

    console.log('[EXPORT] Payload final enviado a plantilla:', pdfData);
    console.log(
      '[EXPORT] Payload final enviado a plantilla (JSON):',
      JSON.stringify(pdfData, null, 2),
    );

    Swal.fire({
      title: 'Generando documento...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.pdfGeneratorService.generatePdf(pdfData).subscribe({
      next: (response: any) => {
        Swal.close();
        this.isGeneratingPdf = false;

        if (response.success) {
          // Mostrar opciones de descarga
          if (response.pdf_url) {
            Swal.fire({
              icon: 'success',
              title: 'Documento generado',
              html: `
                <p>El documento se ha generado correctamente.</p>
                <p><strong>Método:</strong> ${response.conversion_method}</p>
              `,
              showCancelButton: true,
              confirmButtonText: 'Descargar PDF',
              cancelButtonText: 'Descargar DOCX',
              showDenyButton: false,
            }).then((result) => {
              if (result.isConfirmed && response.pdf_url) {
                window.open(response.pdf_url, '_blank');
              } else if (
                result.dismiss === Swal.DismissReason.cancel &&
                response.docx_url
              ) {
                window.open(response.docx_url, '_blank');
              }
            });
          } else {
            // Solo DOCX disponible
            Swal.fire({
              icon: 'info',
              title: 'Documento generado (DOCX)',
              html: `
                <p>Se generó el documento Word.</p>
                <p><small>LibreOffice no está disponible para convertir a PDF.</small></p>
              `,
              confirmButtonText: 'Descargar DRAFT DOCX',
            }).then((result) => {
              if (result.isConfirmed && response.docx_url) {
                window.open(response.docx_url, '_blank');
              }
            });
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: response.error || 'No se pudo generar el documento.',
          });
        }
      },
      error: (error) => {
        Swal.close();
        this.isGeneratingPdf = false;
        console.error('Error generando PDF:', error);

        Swal.fire({
          icon: 'error',
          title: 'Error de conexión',
          text: 'No se pudo conectar con el servidor para generar el PDF. Verifica que el servicio esté disponible.',
        });
      },
    });
  }

  /**
   * Prepara los datos del DCC para enviar a la plantilla
   */
  private preparePdfData(): PdfTemplateData {
    const data = this.dccData!;

    // =====================
    // MAPEO DE RESULTADOS
    // =====================
    let results: any[] = [];
    if (Array.isArray(data.results) && data.results.length > 0) {
      // Buscar el resultado tipo tabla (array de quantities)
      const tableFields = {
        range: '',
        voltaje_m: '',
        ref_v: '',
        voltaje_e: '',
        sf_ob: '',
        expanded_u: '',
      };
      const tabla = data.results.find(
        (r: any) =>
          Array.isArray(r.data) && r.data.some((q: any) => q.name === 'Range'),
      );
      if (tabla && Array.isArray(tabla.data)) {
        tabla.data.forEach((qty: any) => {
          switch (qty.name) {
            case 'Range':
              tableFields.range = qty.valueXMLList || qty.value || '';
              break;
            case 'Voltage Measured':
              tableFields.voltaje_m = qty.valueXMLList || qty.value || '';
              break;
            case 'Ref. Voltage':
              tableFields.ref_v = qty.valueXMLList || qty.value || '';
              break;
            case 'Voltage Error':
              tableFields.voltaje_e = qty.valueXMLList || qty.value || '';
              if (
                qty.measurementUncertainty?.expandedMU?.valueExpandedMUXMLList
              ) {
                tableFields.expanded_u =
                  qty.measurementUncertainty.expandedMU.valueExpandedMUXMLList;
              }
              break;
            case 'Obtained Scale Factor':
              tableFields.sf_ob = qty.valueXMLList || qty.value || '';
              break;
          }
        });
        results.push(tableFields);
      }

      // Resultados individuales (nombres flexibles, asegurar que ambos estén presentes solo una vez)
      let meanValue: string | null = null;
      let linearityValue: string | null = null;
      let linearityTestResults: string | null = null;
      data.results.forEach((r: any, idx: number) => {
        console.log(
          `[PDF] [${idx}] Procesando resultado individual:`,
          r.name,
          r,
        );
        // Si data es array y es la tabla principal, omitir para individuales
        if (
          Array.isArray(r.data) &&
          r.data.length > 1 &&
          r.data.some((q: any) => q.name === 'Range')
        ) {
          console.log(
            `[PDF] [${idx}] data es array de tabla, se omite para individuales.`,
          );
          return;
        }
        // Si data es array de un solo elemento, procesar como individual
        let dataArray = Array.isArray(r.data) ? r.data : [r.data];
        // Mean Value of Scale Factor
        if (/Mean Value of Scale Factor Obtained/i.test(r.name)) {
          if (Array.isArray(r.data) && r.data[0]?.value) {
            meanValue = r.data[0].value;
            console.log(`[PDF] [${idx}] mean_sf_obtained (array):`, meanValue);
          } else if (r.data?.value) {
            meanValue = r.data.value;
            console.log(`[PDF] [${idx}] mean_sf_obtained (obj):`, meanValue);
          } else {
            console.log(`[PDF] [${idx}] mean_sf_obtained sin valor.`);
          }
        }
        // Linearity of Scale Factor
        if (/Linearity of Scale Factor/i.test(r.name)) {
          if (Array.isArray(r.data) && r.data[0]?.value) {
            linearityValue = r.data[0].value;
            console.log(
              `[PDF] [${idx}] linearity_sf_obtained (array):`,
              linearityValue,
            );
          } else if (r.data?.value) {
            linearityValue = r.data.value;
            console.log(
              `[PDF] [${idx}] linearity_sf_obtained (obj):`,
              linearityValue,
            );
          } else {
            console.log(`[PDF] [${idx}] linearity_sf_obtained sin valor.`);
          }
        }
        // Linearity Test Results
        if (/Linearity Test Results/i.test(r.name)) {
          if (Array.isArray(r.data) && r.data[0]?.value) {
            linearityTestResults = r.data[0].value;
            console.log(
              `[PDF] [${idx}] linearity_test_results (array):`,
              linearityTestResults,
            );
          } else if (r.data?.value) {
            linearityTestResults = r.data.value;
            console.log(
              `[PDF] [${idx}] linearity_test_results (obj):`,
              linearityTestResults,
            );
          } else {
            console.log(`[PDF] [${idx}] linearity_test_results sin valor.`);
          }
        }
      });
      if (meanValue !== null) {
        console.log('[PDF] Agregando mean_sf_obtained:', meanValue);
        results.push({ mean_sf_obtained: meanValue });
      }
      if (linearityValue !== null) {
        console.log('[PDF] Agregando linearity_sf_obtained:', linearityValue);
        results.push({ linearity_sf_obtained: linearityValue });
      }
      if (linearityTestResults !== null) {
        console.log(
          '[PDF] Agregando linearity_test_results:',
          linearityTestResults,
        );
        results.push({ linearity_test_results: linearityTestResults });
      }
    }

    // Validar measuringEquipments
    if (
      !Array.isArray(data.measuringEquipments) ||
      data.measuringEquipments.length === 0
    ) {
      console.log('[PDF] No hay measuringEquipments en dccData');
    } else {
      data.measuringEquipments.forEach((eq: any, idx: number) => {
        if (!eq.name || !eq.manufacturer || !eq.model) {
          console.log(`[PDF] MeasuringEquipment #${idx + 1} incompleto:`, eq);
        }
      });
    }

    // Measuring Equipments
    let measuringEquipments: any[] = [];
    if (
      Array.isArray(data.measuringEquipments) &&
      data.measuringEquipments.length > 0
    ) {
      measuringEquipments = data.measuringEquipments.map((eq: any) => {
        // Buscar los valores en identifications
        let assetId = '';
        let serialNumber = '';
        let interval = '';
        if (Array.isArray(eq.identifications)) {
          for (const ident of eq.identifications) {
            if (ident.name === 'Asset ID') assetId = ident.value || '';
            if (ident.name === 'Serial Number')
              serialNumber = ident.value || '';
            if (ident.name === 'Calibration Interval')
              interval = ident.value || '';
          }
        }
        return {
          id_patron: assetId,
          name_patron: eq.name || '',
          manufacturer_patron: eq.manufacturer || '',
          model_patron: eq.model || '',
          sn_patron: serialNumber,
          interval_patron: interval,
        };
      });
    }

    // Influence Conditions para PDF
    let influenceConditions: any[] = [];
    if (
      Array.isArray(data.influenceConditions) &&
      data.influenceConditions.length > 0
    ) {
      influenceConditions = data.influenceConditions.map((cond: any) => {
        const value = cond.subBlock?.value || '';
        // Si no tiene valor (especialmente para pressure), enviar "N/A"
        const displayValue = value.trim() === '' ? 'N/A' : value;

        return {
          refType: cond.refType || '',
          value: displayValue,
          name: cond.name || '',
          unit: cond.subBlock?.unit || '',
        };
      });
    }

    // Items - Nuevo sistema (itemsList del nuevo dcc_items)
    // Usar itemsList si existe, sino usar el sistema antiguo
    let itemsList: any[] = [];
    let itemDescription = data.itemDescription || ''; // Descripción del DCC

    if (
      data.itemsList &&
      Array.isArray(data.itemsList) &&
      data.itemsList.length > 0
    ) {
      // Nuevo sistema: usar itemsList directamente
      // Ordenar por campo 'item_order' antes de mapear
      const sortedItems = [...data.itemsList].sort(
        (a: any, b: any) => (a.item_order || 0) - (b.item_order || 0),
      );

      itemsList = sortedItems.map((item: any) => ({
        object: item.object || '',
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        serial_number: item.serial_number || '',
        costumer_asset: item.costumer_asset || '',
        comment: item.comment || '',
        description: itemDescription, // Usar descripción del DCC
      }));
    } else if (Array.isArray(data.items) && data.items.length > 0) {
      // Sistema antiguo: primer item + subitems
      itemsList = data.items.map((item: any) => ({
        object: item.name || '',
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        serial_number: item.serialNumber || '',
        costumer_asset: item.customerAssetId || '',
        comment: item.comment || '',
        description: itemDescription, // Usar descripción del DCC
      }));
    }

    // Subitems: todos menos el principal (primer item)
    let subitems: any[] = [];
    if (Array.isArray(data.items) && data.items.length > 1) {
      subitems = data.items.slice(1).map((item: any) => ({
        name: item.name || '',
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        serialNumber: item.serialNumber || '',
        customerAssetId: item.customerAssetId || '',
      }));
    }

    const admin = data.administrativeData;
    const customer = admin.customer;

    // PT
    const pt = admin.core?.pt_id || '';

    // Construir dirección completa del cliente
    const customerDirection = this.buildFullAddress(customer);

    // Preparar responsiblePersons para el backend
    let responsiblePersons: any[] = [];
    if (admin.responsiblePersons && Array.isArray(admin.responsiblePersons)) {
      responsiblePersons = admin.responsiblePersons.map((person: any) => ({
        full_name: person.full_name || person.name || '',
        role: person.role || '',
        email: person.email || '',
        phone: person.phone || '',
        mainSigner: !!person.mainSigner,
        doneBy: !!person.doneBy,
      }));
    }

    const approvedBy = this.getApprovedByForIe(responsiblePersons);
    const calibratedBy = this.getCalibratedByForIe(responsiblePersons);

    // Laboratory name and direction con salto de línea
    const labName = admin.laboratory?.name || '';
    const labDirection = this.buildFullAddress(admin.laboratory);
    const performanceLocation = `${labName}\n${labDirection}`;

    // Fecha de recepción - enviar N/A si está marcado o si la fecha es inválida
    const date_receipt =
      admin.core?.receipt_date_na || this.isDateNA(admin.core?.receipt_date)
        ? 'N/A'
        : admin.core?.receipt_date
          ? this.formatDateLongFormat(admin.core.receipt_date)
          : '';

    // PerformanceDate y rango
    const is_range_date = !!admin.core?.is_range_date;
    const beginPerformanceDate = this.formatDateLongFormat(
      admin.core?.performance_date,
    );
    const endPerformanceDate =
      is_range_date && admin.core?.end_performance_date
        ? this.formatDateLongFormat(admin.core?.end_performance_date)
        : '';

    // LOG FINAL DE DATOS PDF
    console.log('[PDF] Datos preparados para backend:', {
      pt,
      measuringEquipments,
      certificate_number: admin.core.certificate_number || '',
      itemsList: itemsList,
      itemDescription: itemDescription,
      measuringEquipmentsRaw: data.measuringEquipments,
    });

    // Determinar performance location type y dirección del proyecto
    const performanceLocationType =
      admin.core?.performance_localition || 'Laboratory';
    let projectLocation = '';

    // Si es 'Other', obtener la dirección del proyecto desde dccData
    if (performanceLocationType === 'Other') {
      // Obtener la dirección del proyecto (ya guardada en dccData o calcularla)
      projectLocation =
        (this.dccDataService.getCurrentData() as any).projectLocation || '';
    }

    // Next calibration - enviar N/A si está marcado o si la fecha es inválida
    const nextCalibration =
      admin.core?.next_calibration_na ||
      this.isDateNA(admin.core?.next_calibration)
        ? 'N/A'
        : admin.core?.next_calibration
          ? this.formatDateLongFormat(admin.core.next_calibration)
          : '';

    const technicalVerification = !!admin.core?.technical_verification;
    const exportCertificateNumber = this.getExportCertificateNumber(
      admin.core.certificate_number || '',
      technicalVerification,
    );
    const isIeDocument = (admin.core?.certificate_number || '').includes(
      ' IE ',
    );
    const ieNorma = isIeDocument
      ? this.getIeNorma(data.usedMethods || [])
      : undefined;
    const ieResults = data.ieResults || null;

    return {
      pt,
      measuringEquipments,
      influenceConditions, // <-- Agregar condiciones de influencia
      // Core Data
      certificate_number: exportCertificateNumber,
      issue_date: this.formatDateLongFormat(admin.core.issue_date),
      beginPerformanceDate,
      endPerformanceDate,
      performanceLocation,
      is_range_date,
      // Si hay patrones vencidos, forzar a usar plantilla NA (no acreditada)
      accredited: data.hasExpiredPatrones ? false : !!admin.core?.accredited,
      technical_verification: technicalVerification,
      next_calibration: nextCalibration,
      circuito: isIeDocument ? admin.core?.circuito || '' : undefined,

      // Performance Location
      performance_location_type: performanceLocationType,
      project_location: projectLocation,

      // Customer Data
      customer_name: customer.name || '',
      customer_direction: customerDirection,
      customer_email: customer.email || '',
      customer_phone: customer.phone || '',
      customer_rep: isIeDocument ? admin.core?.customer_rep || '' : undefined,
      customer_rep_tel: isIeDocument
        ? admin.core?.customer_rep_tel || ''
        : undefined,

      // IE-only template variables
      test_number: isIeDocument ? exportCertificateNumber : undefined,
      PerformanceDate: isIeDocument ? beginPerformanceDate : undefined,
      norma: ieNorma,
      approved_by: isIeDocument ? approvedBy?.full_name || '' : undefined,
      approved_by_role: isIeDocument ? approvedBy?.role || '' : undefined,
      approved_by_email: isIeDocument ? approvedBy?.email || '' : undefined,
      calibrated_by: isIeDocument ? calibratedBy?.full_name || '' : undefined,
      calibrated_by_role: isIeDocument ? calibratedBy?.role || '' : undefined,
      calibrated_by_email: isIeDocument ? calibratedBy?.email || '' : undefined,
      faseA: isIeDocument ? ieResults?.fase1 || '' : undefined,
      faseB: isIeDocument ? ieResults?.fase2 || '' : undefined,
      faseC: isIeDocument ? ieResults?.fase3 || '' : undefined,

      // Laboratory Data
      laboratory_name: labName,
      laboratory_direction: labDirection,
      laboratory_phone: admin.laboratory.phone || '',

      // Item Data (primer item)
      item_name: data.items?.[0]?.name || '',
      item_manufacturer: data.items?.[0]?.manufacturer || '',
      item_model: data.items?.[0]?.model || '',
      item_serial_number: data.items?.[0]?.serialNumber || '',
      item_customer_asset_id: data.items?.[0]?.customerAssetId || '',
      item_comment: data.items?.[0]?.comment || '',

      // PT Description and PT Method from usedMethods (hv_method)
      pt_description:
        this.getPtDescriptionFromUsedMethods(data.usedMethods, pt) || '',
      pt_method: this.getPtMethodFromUsedMethods(data.usedMethods, pt) || '',
      descripcion_servicio:
        this.getServiceNameFromUsedMethods(data.usedMethods) || '',
      objeto_test: isIeDocument
        ? admin.core?.test_object || ''
        : itemDescription || '',
      equipamiento: isIeDocument
        ? this.buildIeEquipamientoParagraph(data.ieEquipment)
        : this.buildEquipamientoParagraph(itemsList),

      // Tested Material (IE only)
      material_description: isIeDocument
        ? data.testedMaterial?.material_description || ''
        : undefined,
      cable_fabricante: isIeDocument
        ? data.testedMaterial?.cable_fabricante || ''
        : undefined,
      cable_modelo: isIeDocument
        ? data.testedMaterial?.cable_modelo || ''
        : undefined,
      cable_metrajeA: isIeDocument
        ? data.testedMaterial?.cable_metrajeA || ''
        : undefined,
      cable_metrajeB: isIeDocument
        ? data.testedMaterial?.cable_metrajeB || ''
        : undefined,
      cable_metrajeC: isIeDocument
        ? data.testedMaterial?.cable_metrajeC || ''
        : undefined,
      terminal1_fabricante: isIeDocument
        ? data.testedMaterial?.terminal1_fabricante || ''
        : undefined,
      terminal1_modelo: isIeDocument
        ? data.testedMaterial?.terminal1_modelo || ''
        : undefined,
      terminal1_snA: isIeDocument
        ? data.testedMaterial?.terminal1_snA || ''
        : undefined,
      terminal1_snB: isIeDocument
        ? data.testedMaterial?.terminal1_snB || ''
        : undefined,
      terminal1_snC: isIeDocument
        ? data.testedMaterial?.terminal1_snC || ''
        : undefined,
      terminal2_fabricante: isIeDocument
        ? data.testedMaterial?.terminal2_fabricante || ''
        : undefined,
      terminal2_modelo: isIeDocument
        ? data.testedMaterial?.terminal2_modelo || ''
        : undefined,
      terminal2_snA: isIeDocument
        ? data.testedMaterial?.terminal2_snA || ''
        : undefined,
      terminal2_snB: isIeDocument
        ? data.testedMaterial?.terminal2_snB || ''
        : undefined,
      terminal2_snC: isIeDocument
        ? data.testedMaterial?.terminal2_snC || ''
        : undefined,
      empalmes_fabricante: isIeDocument
        ? data.testedMaterial?.empalmes_fabricante || ''
        : undefined,
      empalmes_modelo: isIeDocument
        ? data.testedMaterial?.empalmes_modelo || ''
        : undefined,
      empalmes_metrajeA: isIeDocument
        ? data.testedMaterial?.empalmes_metrajeA || ''
        : undefined,
      empalmes_metrajeB: isIeDocument
        ? data.testedMaterial?.empalmes_metrajeB || ''
        : undefined,
      empalmes_metrajeC: isIeDocument
        ? data.testedMaterial?.empalmes_metrajeC || ''
        : undefined,

      // Metrological Traceability
      metrologicalTraceability: this.formatMetrologicalTraceabilityDates(
        data.metrologicalTraceability || [],
      ),

      // Responsible persons
      responsiblePersons,

      // Fecha de recepción
      date_receipt,

      // Template name
      template_name: isIeDocument
        ? 'ie_plantilla_general.docx'
        : technicalVerification
          ? 'dcc_technical_verification.docx'
          : 'dcc_plantilla_general.docx',

      // Items - Nuevo sistema (por fila en el Word)
      itemsList,

      // Subitems para el backend (legacy)
      subitems,

      // Results
      results,
    };
  }

  /**
   * Construye la dirección completa a partir de los campos individuales
   */
  private buildFullAddress(entity: any): string {
    const parts = [];

    if (entity.street) {
      let streetPart = entity.street;
      if (entity.street_number) {
        streetPart += ' ' + entity.street_number;
      }
      parts.push(streetPart);
    }

    if (entity.city) {
      parts.push(entity.city);
    }

    if (entity.state) {
      parts.push(entity.state);
    }

    if (entity.postal_code) {
      parts.push('C.P. ' + entity.postal_code);
    }

    if (entity.country) {
      parts.push(entity.country);
    }

    return parts.join(', ');
  }

  private getApprovedByForIe(responsiblePersons: any[]): any | null {
    return responsiblePersons.find((person) => person.mainSigner) || null;
  }

  private getCalibratedByForIe(responsiblePersons: any[]): any | null {
    return responsiblePersons.find((person) => person.doneBy) || null;
  }

  private getIeNorma(usedMethods: any[]): string {
    return (
      usedMethods.find((method) => method?.norm)?.norm ||
      usedMethods.find((method) => method?.reference)?.reference ||
      ''
    );
  }

  /**
   * Formatea la fecha para mostrar en el PDF
   */
  private formatDateForPdf(date: Date | string | undefined): string {
    if (!date) return '';

    // Si es string, asumir que ya está en formato DD/MM/YYYY o ISO
    if (typeof date === 'string') {
      // Si ya tiene el formato DD/MM/YYYY, retornarlo tal cual
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        return date;
      }

      // Si es ISO (YYYY-MM-DD), convertir a DD/MM/YYYY
      if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
        const parts = date.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      // Si es otro formato, intentar parsearlo
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return date; // Retornar como está si no se puede parsear

      // Para evitar problemas de zona horaria, usar UTC
      const day = dateObj.getUTCDate().toString().padStart(2, '0');
      const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }

    // Si es Date object, usar UTC para evitar problemas de zona horaria
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
  }

  /**
   * Formatea fecha al formato largo en inglés: "January 2, 2026"
   */
  private formatDateLongFormat(date: Date | string | undefined): string {
    if (!date) return '';

    let dateObj: Date;

    if (typeof date === 'string') {
      // Si es ISO (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
        dateObj = new Date(date + 'T00:00:00Z');
      } else {
        dateObj = new Date(date);
      }
    } else {
      dateObj = date;
    }

    if (isNaN(dateObj.getTime())) return '';

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const day = dateObj.getUTCDate();
    const month = monthNames[dateObj.getUTCMonth()];
    const year = dateObj.getUTCFullYear();

    return `${month} ${day}, ${year}`;
  }

  /**
   * Formatea las fechas de la tabla de Metrological Traceability a DD/MM/YYYY
   * Se usa específicamente para la tabla, manteniendo otras fechas en formato largo
   */
  private formatMetrologicalTraceabilityDates(traceability: any[]): any[] {
    return traceability.map((item) => ({
      ...item,
      tz_date: item.tz_date ? this.formatDateForPdf(item.tz_date) : '-',
    }));
  }

  /**
   * Obtiene PT Description desde usedMethods
   * Busca el método del tipo hv_method y retorna: description + norm
   */
  private getPtDescriptionFromUsedMethods(
    usedMethods: any[] | undefined,
    pt: string,
  ): string {
    if (!usedMethods || usedMethods.length === 0) {
      return '';
    }

    // Buscar el método que sea de tipo hv_method (el que viene de BD para el PT específico)
    const ptMethod = usedMethods.find(
      (method: any) => method.refType === 'hv_method',
    );

    if (!ptMethod) {
      return '';
    }

    // Construir: description, norm
    const description = ptMethod.description || '';
    const norm = ptMethod.norm ? `, ${ptMethod.norm}` : '';
    const result = `${description}${norm}`;

    return result;
  }

  /**
   * Obtiene PT Method desde usedMethods
   * Busca el método del tipo hv_method y retorna: pt + name
   */
  private getPtMethodFromUsedMethods(
    usedMethods: any[] | undefined,
    pt: string,
  ): string {
    if (!usedMethods || usedMethods.length === 0) {
      return '';
    }

    // Buscar el método que sea de tipo hv_method (el que viene de BD para el PT específico)
    const ptMethod = usedMethods.find(
      (method: any) => method.refType === 'hv_method',
    );

    if (!ptMethod) {
      return '';
    }

    // Construir: pt + name
    const name = ptMethod.name || '';
    const result = `${pt} ${name}`;

    return result;
  }

  /**
   * Obtiene el nombre del servicio desde usedMethods (dcc_usedmethod.name)
   */
  private getServiceNameFromUsedMethods(
    usedMethods: any[] | undefined,
  ): string {
    if (!usedMethods || usedMethods.length === 0) {
      return '';
    }

    const ptMethod = usedMethods.find(
      (method: any) => method.refType === 'hv_method',
    );

    return ptMethod?.name || '';
  }

  /**
   * Construye un parrafo en espanol para ${equipamiento} con uno o varios items.
   * Omite campos vacios y conserva comentarios tal como fueron capturados.
   */
  private buildEquipamientoParagraph(itemsList: any[] | undefined): string {
    if (!itemsList || itemsList.length === 0) {
      return '';
    }

    const fragments = itemsList
      .map((item: any) => {
        const parts: string[] = [];
        const objectName = String(item?.object || '').trim();
        const assetId = String(item?.costumer_asset || '').trim();
        const manufacturer = String(item?.manufacturer || '').trim();
        const model = String(item?.model || '').trim();
        const serialNumber = String(item?.serial_number || '').trim();
        const comment = String(item?.comment || '').trim();

        if (objectName) {
          parts.push(`${objectName}.`);
        }
        if (assetId) {
          parts.push(`No. de inventario / Identificacion: ${assetId}.`);
        }
        if (manufacturer) {
          parts.push(`Marca: ${manufacturer}.`);
        }
        if (model) {
          parts.push(`Modelo: ${model}.`);
        }
        if (serialNumber) {
          parts.push(`No. de serie: ${serialNumber}.`);
        }
        if (comment) {
          parts.push(this.ensureEndsWithPeriod(comment));
        }

        return parts.join(' ');
      })
      .filter((text: string) => text.trim() !== '');

    return fragments.join(' ');
  }

  private buildIeEquipamientoParagraph(ieEquipment: any): string {
    if (!ieEquipment) {
      return '';
    }

    const name = String(ieEquipment?.name || '').trim();
    const idEquipment = String(ieEquipment?.idequipment || '').trim();
    const maker = String(ieEquipment?.maker || '').trim();
    const model = String(ieEquipment?.model || '').trim();

    if (!name && !idEquipment && !maker && !model) {
      return '';
    }

    return `"${name}", N° de inventario / Identificación: "${idEquipment}". Marca: "${maker}", Modelo: "${model}".`;
  }

  private ensureEndsWithPeriod(text: string): string {
    return /[.!?]$/.test(text) ? text : `${text}.`;
  }

  /**
   * Verifica si una fecha debe considerarse como N/A
   * Retorna true si la fecha es null, undefined, inválida, o representa 00/00/0000
   */
  private isDateNA(date: any): boolean {
    if (!date) return true;

    // Si es un Date object, verificar si es válido
    if (date instanceof Date) {
      // Verificar si es una fecha inválida
      if (isNaN(date.getTime())) return true;

      // Verificar si es 00/00/0000 (año 0 o año 1900 con mes/día 0)
      const year = date.getFullYear();
      if (year === 0 || year === 1900) return true;
    }

    // Si es un string, verificar si representa 00/00/0000 o está vacío
    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (
        trimmed === '' ||
        trimmed === '0000-00-00' ||
        trimmed === '00/00/0000'
      )
        return true;

      // Intentar parsear y verificar
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) return true;

      const year = parsed.getFullYear();
      if (year === 0 || year === 1900) return true;
    }

    return false;
  }

  private getExportCertificateNumber(
    certificateNumber: string,
    technicalVerification: boolean,
  ): string {
    if (!certificateNumber) {
      return '';
    }

    if (!technicalVerification) {
      return certificateNumber;
    }

    return certificateNumber.replace(' DCC ', ' TV ');
  }
}
