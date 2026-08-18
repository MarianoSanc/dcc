import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { DccDataService } from '../../services/dcc-data.service';

@Component({
  selector: 'app-tested-material',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tested-material.component.html',
  styleUrl: './tested-material.component.css',
})
export class TestedMaterialComponent implements OnInit, OnDestroy {
  private subscription: Subscription = new Subscription();

  coreData: any = {};
  database: string = 'calibraciones';

  testedMaterial: any = {};
  testedMaterialBackup: any = {};
  isEditingTestedMaterial: boolean = false;
  isLoadingTestedMaterial: boolean = false;

  constructor(private dccDataService: DccDataService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        const certificateNumber =
          data.administrativeData?.core?.certificate_number || '';
        const ptId = data.administrativeData?.core?.pt_id || '';
        const previousCertificate = this.coreData?.certificate_number;

        this.coreData = {
          ...this.coreData,
          certificate_number: certificateNumber,
          pt_id: ptId,
        };

        if (certificateNumber && certificateNumber !== previousCertificate) {
          if (this.isIeCertificate(certificateNumber)) {
            this.loadTestedMaterialFromDB(certificateNumber);
          } else {
            this.testedMaterial = this.getEmptyTestedMaterial('cable');
          }
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  isGisMaterial(): boolean {
    return this.getCurrentMaterialType() === 'gis';
  }

  getDisplayMaterialType(): string {
    const type = this.getCurrentMaterialType();
    return type === 'gis' ? 'GIS' : 'Cable';
  }

  private isIeCertificate(certificateNumber?: string | null): boolean {
    return /\bIE\b/i.test(certificateNumber || '');
  }

  private normalizePtNumber(ptId?: string | null): number | null {
    const match = String(ptId || '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .match(/PT-?(\d{1,2})/);

    if (!match) {
      return null;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private inferMaterialTypeFromPt(ptId?: string | null): 'cable' | 'gis' {
    const ptNumber = this.normalizePtNumber(ptId);
    return ptNumber !== null && [2, 4, 8].includes(ptNumber) ? 'gis' : 'cable';
  }

  private async loadProjectTypeFromDB(
    certificateNumber: string,
  ): Promise<'cable' | 'gis' | null> {
    return new Promise<'cable' | 'gis' | null>((resolve) => {
      const projectKey =
        this.extractProjectKeyFromCertificate(certificateNumber);
      if (!projectKey) {
        resolve(null);
        return;
      }

      const prefix = projectKey.slice(0, 2).toUpperCase();
      const isPh = prefix === 'PH';
      const table = isPh ? 'opportunity' : 'opportunity_calpro';
      const getProjectType = {
        action: 'get',
        bd: 'hvtest2',
        table,
        opts: {
          where: { id: projectKey },
          attributes: isPh ? ['dut'] : ['tipo'],
        },
      };

      this.dccDataService.post(getProjectType).subscribe({
        next: (response: any) => {
          const record = response?.result?.[0];
          if (!record) {
            resolve(null);
            return;
          }

          const typeValue = isPh ? record.dut : record.tipo;
          if (!typeValue) {
            resolve(null);
            return;
          }

          const typeStr = typeValue.toString().toLowerCase().trim();
          // Si contiene GIS, es GIS
          if (typeStr.includes('gis')) {
            resolve('gis');
          } else {
            resolve('cable');
          }
        },
        error: () => resolve(null),
      });
    });
  }

  private extractProjectKeyFromCertificate(cert: string): string {
    const text = (cert || '').toString().trim().toUpperCase();
    const match = text.match(/^([A-Z]{2}\d{4})/);
    return match ? match[1] : '';
  }

  private getCurrentMaterialType(): 'cable' | 'gis' {
    // Si el material_type está explícitamente establecido, usarlo
    if (this.testedMaterial?.material_type) {
      return this.testedMaterial.material_type === 'gis' ? 'gis' : 'cable';
    }
    // Si hay datos GIS específicos, es GIS
    if (this.testedMaterial?.gis_fabricante || this.testedMaterial?.gis_tipo) {
      return 'gis';
    }
    // Si hay datos Cable específicos, es Cable
    if (
      this.testedMaterial?.cable_fabricante ||
      this.testedMaterial?.terminal1_fabricante
    ) {
      return 'cable';
    }
    // Finalmente, inferir según PT
    return this.inferMaterialTypeFromPt(this.coreData?.pt_id);
  }

  private getEmptyTestedMaterial(materialType: 'cable' | 'gis'): any {
    return {
      id: null,
      material_type: materialType,
      material_description: '',
      cable_fabricante: '',
      cable_modelo: '',
      cable_metrajeA: '',
      cable_metrajeB: '',
      cable_metrajeC: '',
      terminal1_fabricante: '',
      terminal1_modelo: '',
      terminal1_snA: '',
      terminal1_snB: '',
      terminal1_snC: '',
      terminal2_fabricante: '',
      terminal2_modelo: '',
      terminal2_snA: '',
      terminal2_snB: '',
      terminal2_snC: '',
      empalmes_fabricante: '',
      empalmes_modelo: '',
      empalmes_metrajeA: '',
      empalmes_metrajeB: '',
      empalmes_metrajeC: '',
      gis_fabricante: '',
      gis_tipo: '',
      gis_fecha: '',
      gis_lote: '',
      gis_tension_un: '',
      gis_tension_ur: '',
      gis_norma: '',
    };
  }

  private mapCableRow(row: any): any {
    return {
      ...this.getEmptyTestedMaterial('cable'),
      id: row.id,
      material_type: 'cable',
      material_description: row.material_description || '',
      cable_fabricante: row.cable_fabricante || '',
      cable_modelo: row.cable_modelo || '',
      cable_metrajeA: row.cable_metrajeA || '',
      cable_metrajeB: row.cable_metrajeB || '',
      cable_metrajeC: row.cable_metrajeC || '',
      terminal1_fabricante: row.terminal1_fabricante || '',
      terminal1_modelo: row.terminal1_modelo || '',
      terminal1_snA: row.terminal1_snA || '',
      terminal1_snB: row.terminal1_snB || '',
      terminal1_snC: row.terminal1_snC || '',
      terminal2_fabricante: row.terminal2_fabricante || '',
      terminal2_modelo: row.terminal2_modelo || '',
      terminal2_snA: row.terminal2_snA || '',
      terminal2_snB: row.terminal2_snB || '',
      terminal2_snC: row.terminal2_snC || '',
      empalmes_fabricante: row.empalmes_fabricante || '',
      empalmes_modelo: row.empalmes_modelo || '',
      empalmes_metrajeA: row.empalmes_metrajeA || '',
      empalmes_metrajeB: row.empalmes_metrajeB || '',
      empalmes_metrajeC: row.empalmes_metrajeC || '',
    };
  }

  private mapGisRow(row: any): any {
    return {
      ...this.getEmptyTestedMaterial('gis'),
      id: row.id,
      material_type: 'gis',
      gis_fabricante: row.fabricante || '',
      gis_tipo: row.tipo || '',
      gis_fecha: row.fecha_fabricante || '',
      gis_lote: row.lote || '',
      gis_tension_un: row.tension_un || '',
      gis_tension_ur: row.tension_ur || '',
      gis_norma: row.norma || '',
    };
  }

  private loadTestedMaterialFromDB(dccId: string): void {
    // Indicate loading state
    this.isLoadingTestedMaterial = true;

    // Primero intentar cargar el tipo de proyecto desde hvtest2
    this.loadProjectTypeFromDB(dccId).then((projectType) => {
      const preferredType =
        projectType || this.inferMaterialTypeFromPt(this.coreData?.pt_id);

      const gisQuery = {
        action: 'get',
        bd: this.database,
        table: 'ie_tested_material_gis',
        opts: {
          where: { id_ie: dccId, deleted: 0 },
        },
      };

      this.dccDataService.post(gisQuery).subscribe({
        next: (gisResponse: any) => {
          const gisRow = gisResponse?.result?.[0];
          if (gisRow) {
            this.testedMaterial = this.mapGisRow(gisRow);
            this.dccDataService.updateTestedMaterial(this.testedMaterial);
            this.isLoadingTestedMaterial = false;
            return;
          }

          const cableQuery = {
            action: 'get',
            bd: this.database,
            table: 'ie_tested_material',
            opts: {
              where: { id_ie: dccId, deleted: 0 },
            },
          };

          this.dccDataService.post(cableQuery).subscribe({
            next: (cableResponse: any) => {
              const cableRow = cableResponse?.result?.[0];
              this.testedMaterial = cableRow
                ? this.mapCableRow(cableRow)
                : this.getEmptyTestedMaterial(preferredType);
              this.dccDataService.updateTestedMaterial(this.testedMaterial);
              this.isLoadingTestedMaterial = false;
            },
            error: () => {
              this.testedMaterial = this.getEmptyTestedMaterial(preferredType);
              this.dccDataService.updateTestedMaterial(this.testedMaterial);
              this.isLoadingTestedMaterial = false;
            },
          });
        },
        error: () => {
          this.testedMaterial = this.getEmptyTestedMaterial(preferredType);
          this.dccDataService.updateTestedMaterial(this.testedMaterial);
          this.isLoadingTestedMaterial = false;
        },
      });
    });
  }

  toggleEditTestedMaterial(): void {
    if (this.isEditingTestedMaterial) {
      this.testedMaterial = JSON.parse(
        JSON.stringify(this.testedMaterialBackup),
      );
      this.isEditingTestedMaterial = false;
    } else {
      this.testedMaterialBackup = JSON.parse(
        JSON.stringify(this.testedMaterial),
      );
      this.isEditingTestedMaterial = true;
    }
  }

  saveTestedMaterial(): void {
    const dccId = this.coreData?.certificate_number;
    if (!dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay un certificado cargado.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Guardando material de prueba',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const materialType = this.getCurrentMaterialType();
    const table =
      materialType === 'gis' ? 'ie_tested_material_gis' : 'ie_tested_material';
    const attributes =
      materialType === 'gis'
        ? (() => {
            const attrs: any = {
              id_ie: dccId,
              fabricante: this.testedMaterial.gis_fabricante || '',
              tipo: this.testedMaterial.gis_tipo || '',
              lote: this.testedMaterial.gis_lote || '',
              tension_un: this.testedMaterial.gis_tension_un || '',
              tension_ur: this.testedMaterial.gis_tension_ur || '',
              norma: this.testedMaterial.gis_norma || '',
            };
            // Only include fecha_fabricante when provided (avoid inserting empty string)
            if (this.testedMaterial.gis_fecha) {
              attrs.fecha_fabricante = this.testedMaterial.gis_fecha;
            }
            return attrs;
          })()
        : {
            id_ie: dccId,
            material_description:
              this.testedMaterial.material_description || '',
            cable_fabricante: this.testedMaterial.cable_fabricante || '',
            cable_modelo: this.testedMaterial.cable_modelo || '',
            cable_metrajeA: this.testedMaterial.cable_metrajeA || '',
            cable_metrajeB: this.testedMaterial.cable_metrajeB || '',
            cable_metrajeC: this.testedMaterial.cable_metrajeC || '',
            terminal1_fabricante:
              this.testedMaterial.terminal1_fabricante || '',
            terminal1_modelo: this.testedMaterial.terminal1_modelo || '',
            terminal1_snA: this.testedMaterial.terminal1_snA || '',
            terminal1_snB: this.testedMaterial.terminal1_snB || '',
            terminal1_snC: this.testedMaterial.terminal1_snC || '',
            terminal2_fabricante:
              this.testedMaterial.terminal2_fabricante || '',
            terminal2_modelo: this.testedMaterial.terminal2_modelo || '',
            terminal2_snA: this.testedMaterial.terminal2_snA || '',
            terminal2_snB: this.testedMaterial.terminal2_snB || '',
            terminal2_snC: this.testedMaterial.terminal2_snC || '',
            empalmes_fabricante: this.testedMaterial.empalmes_fabricante || '',
            empalmes_modelo: this.testedMaterial.empalmes_modelo || '',
            empalmes_metrajeA: this.testedMaterial.empalmes_metrajeA || '',
            empalmes_metrajeB: this.testedMaterial.empalmes_metrajeB || '',
            empalmes_metrajeC: this.testedMaterial.empalmes_metrajeC || '',
          };

    const existingId = this.testedMaterial.id;

    if (existingId) {
      const updateQuery = {
        action: 'update',
        bd: this.database,
        table,
        opts: { attributes, where: { id: existingId } },
      };
      this.dccDataService.post(updateQuery).subscribe({
        next: () => this.onTestedMaterialSaved(materialType, existingId),
        error: () => this.onTestedMaterialSaveError(),
      });
    } else {
      const createQuery = {
        action: 'create',
        bd: this.database,
        table,
        opts: { attributes },
      };
      this.dccDataService.post(createQuery).subscribe({
        next: (response: any) => {
          const insertedId =
            response?.result?.insertId || response?.insertId || null;
          this.onTestedMaterialSaved(materialType, insertedId);
        },
        error: () => this.onTestedMaterialSaveError(),
      });
    }
  }

  private onTestedMaterialSaved(
    materialType: 'cable' | 'gis',
    id: number | null,
  ): void {
    Swal.close();
    this.isEditingTestedMaterial = false;
    this.testedMaterial.id = id;
    this.testedMaterial.material_type = materialType;
    this.dccDataService.updateTestedMaterial(this.testedMaterial);
    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'El material de prueba se ha guardado correctamente.',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
    });
  }

  private onTestedMaterialSaveError(): void {
    Swal.close();
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo guardar el material de prueba.',
    });
  }
}
