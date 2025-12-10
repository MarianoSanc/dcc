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
    private pdfGeneratorService: PdfGeneratorService
  ) {}

  ngOnInit() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        // Antes de generar el XML, fuerza recarga de resultados desde la BD
        this.dccData = data;
        this.reloadResultsFromDBAndGenerateXML();
      })
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
        if (response?.result && response.result.length > 0 && this.dccData) {
          console.log('Resultados recargados desde BD:', response.result);
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

    <!-- Datos centrales -->
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

    <!-- Equipos y objetos calibrados -->
    <dcc:items>
      ${this.generateItemsXML(data)}
    </dcc:items>

    <!-- Laboratorio de calibración -->
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
              this.getPersonDisplayName(person)
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
      </dcc:respPerson>`
        )
        .join('')}
    </dcc:respPersons>

    <!-- Cliente -->
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
                      mapInfo.xmlName
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
                        data.valueXMLList || ''
                      )}</si:valueXMLList>
                      <si:unitXMLList>${this.escapeXml(
                        data.unitXMLList || ''
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
                              .valueExpandedMUXMLList || ''
                          )}</si:valueExpandedMUXMLList>
                          <si:coverageFactorXMLList>${this.escapeXml(
                            data.measurementUncertainty.expandedMU
                              .coverageFactorXMLList || ''
                          )}</si:coverageFactorXMLList>
                          <si:coverageProbabilityXMLList>${this.escapeXml(
                            data.measurementUncertainty.expandedMU
                              .coverageProbabilityXMLList || ''
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
        </dcc:quantity>`
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

    // Log detallado de lo que se envía al backend
    console.log('[PDF][ENVIADO AL BACKEND]', JSON.stringify(pdfData, null, 2));

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
              confirmButtonText: 'Descargar DOCX',
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
          Array.isArray(r.data) && r.data.some((q: any) => q.name === 'Range')
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
          r
        );
        // Si data es array y es la tabla principal, omitir para individuales
        if (
          Array.isArray(r.data) &&
          r.data.length > 1 &&
          r.data.some((q: any) => q.name === 'Range')
        ) {
          console.log(
            `[PDF] [${idx}] data es array de tabla, se omite para individuales.`
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
              linearityValue
            );
          } else if (r.data?.value) {
            linearityValue = r.data.value;
            console.log(
              `[PDF] [${idx}] linearity_sf_obtained (obj):`,
              linearityValue
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
              linearityTestResults
            );
          } else if (r.data?.value) {
            linearityTestResults = r.data.value;
            console.log(
              `[PDF] [${idx}] linearity_test_results (obj):`,
              linearityTestResults
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
          linearityTestResults
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
      influenceConditions = data.influenceConditions.map((cond: any) => ({
        refType: cond.refType || '',
        value: cond.subBlock?.value || '',
        name: cond.name || '',
        unit: cond.subBlock?.unit || '',
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
        mainSigner: !!person.mainSigner,
      }));
    }

    // Laboratory name and direction con salto de línea
    const labName = admin.laboratory?.name || '';
    const labDirection = this.buildFullAddress(admin.laboratory);
    const performanceLocation = `${labName}\n${labDirection}`;

    // Fecha de recepción
    const date_receipt = admin.core?.receipt_date
      ? this.formatDateForPdf(admin.core.receipt_date)
      : '';

    // PerformanceDate y rango
    const is_range_date = !!admin.core?.is_range_date;
    const beginPerformanceDate = this.formatDateForPdf(
      admin.core?.performance_date
    );
    const endPerformanceDate =
      is_range_date && admin.core?.end_performance_date
        ? this.formatDateForPdf(admin.core?.end_performance_date)
        : '';

    // LOG FINAL DE DATOS PDF
    console.log('[PDF] Datos preparados para backend:', {
      pt,
      measuringEquipments,
      certificate_number: admin.core.certificate_number || '',
      item_manufacturer: data.items?.[0]?.manufacturer || '',
      item_name: data.items?.[0]?.name || '',
      measuringEquipmentsRaw: data.measuringEquipments,
      subitems,
    });

    return {
      pt,
      measuringEquipments,
      influenceConditions, // <-- Agregar condiciones de influencia
      // Core Data
      certificate_number: admin.core.certificate_number || '',
      issue_date: this.formatDateForPdf(admin.core.issue_date),
      beginPerformanceDate,
      endPerformanceDate,
      performanceLocation,
      is_range_date,

      // Customer Data
      customer_name: customer.name || '',
      customer_direction: customerDirection,
      customer_email: customer.email || '',
      customer_phone: customer.phone || '',

      // Laboratory Data
      laboratory_name: labName,
      laboratory_direction: labDirection,
      laboratory_phone: admin.laboratory.phone || '',

      // Item Data (primer item)
      item_name: data.items?.[0]?.name || '',
      item_manufacturer: data.items?.[0]?.manufacturer || '',
      item_model: data.items?.[0]?.model || '',
      item_serial_number: data.items?.[0]?.serialNumber || '',

      // Responsible persons
      responsiblePersons,

      // Fecha de recepción
      date_receipt,

      // Template name
      template_name: 'dcc_plantilla_general.docx',

      // Subitems para el backend
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

  /**
   * Formatea la fecha para mostrar en el PDF
   */
  private formatDateForPdf(date: Date | string | undefined): string {
    if (!date) return '';

    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Formato: DD/MM/YYYY o el que prefieras
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();

    return `${day}/${month}/${year}`;
  }
}
