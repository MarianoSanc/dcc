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

  constructor(private dccDataService: DccDataService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        const certificateNumber =
          data.administrativeData?.core?.certificate_number || '';
        const previousCertificate = this.coreData?.certificate_number;

        this.coreData = {
          ...this.coreData,
          certificate_number: certificateNumber,
        };

        if (certificateNumber && certificateNumber !== previousCertificate) {
          if (this.isIeCertificate(certificateNumber)) {
            this.loadTestedMaterialFromDB(certificateNumber);
          } else {
            this.testedMaterial = this.getEmptyTestedMaterial();
          }
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private isIeCertificate(certificateNumber?: string | null): boolean {
    return /\bIE\b/i.test(certificateNumber || '');
  }

  private getEmptyTestedMaterial(): any {
    return {
      id: null,
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
    };
  }

  private loadTestedMaterialFromDB(dccId: string): void {
    const query = {
      action: 'get',
      bd: this.database,
      table: 'ie_tested_material',
      opts: {
        where: { id_ie: dccId, deleted: 0 },
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        const row = response?.result?.[0];
        if (row) {
          this.testedMaterial = {
            id: row.id,
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
        } else {
          this.testedMaterial = this.getEmptyTestedMaterial();
        }
        this.dccDataService.updateTestedMaterial(this.testedMaterial);
      },
      error: () => {
        this.testedMaterial = this.getEmptyTestedMaterial();
        this.dccDataService.updateTestedMaterial(this.testedMaterial);
      },
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

    const attributes = {
      id_ie: dccId,
      material_description: this.testedMaterial.material_description || '',
      cable_fabricante: this.testedMaterial.cable_fabricante || '',
      cable_modelo: this.testedMaterial.cable_modelo || '',
      cable_metrajeA: this.testedMaterial.cable_metrajeA || '',
      cable_metrajeB: this.testedMaterial.cable_metrajeB || '',
      cable_metrajeC: this.testedMaterial.cable_metrajeC || '',
      terminal1_fabricante: this.testedMaterial.terminal1_fabricante || '',
      terminal1_modelo: this.testedMaterial.terminal1_modelo || '',
      terminal1_snA: this.testedMaterial.terminal1_snA || '',
      terminal1_snB: this.testedMaterial.terminal1_snB || '',
      terminal1_snC: this.testedMaterial.terminal1_snC || '',
      terminal2_fabricante: this.testedMaterial.terminal2_fabricante || '',
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
        table: 'ie_tested_material',
        opts: { attributes, where: { id: existingId } },
      };
      this.dccDataService.post(updateQuery).subscribe({
        next: () => this.onTestedMaterialSaved(),
        error: () => this.onTestedMaterialSaveError(),
      });
    } else {
      const createQuery = {
        action: 'create',
        bd: this.database,
        table: 'ie_tested_material',
        opts: { attributes },
      };
      this.dccDataService.post(createQuery).subscribe({
        next: (response: any) => {
          const insertedId =
            response?.result?.insertId || response?.insertId || null;
          if (insertedId) {
            this.testedMaterial.id = insertedId;
          }
          this.onTestedMaterialSaved();
        },
        error: () => this.onTestedMaterialSaveError(),
      });
    }
  }

  private onTestedMaterialSaved(): void {
    Swal.close();
    this.isEditingTestedMaterial = false;
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
