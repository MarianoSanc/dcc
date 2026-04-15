import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { DccDataService } from '../../services/dcc-data.service';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';

@Component({
  selector: 'app-ie-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ie-results.component.html',
  styleUrl: './ie-results.component.css',
})
export class IeResultsComponent implements OnInit, OnDestroy {
  private subscription: Subscription = new Subscription();
  private readonly pt05FallbackEquipments = [
    {
      idequipment: '802-0020',
      name: 'Sistema de medicion, monitorizacion y diagnostico de descargas parciales',
      model: 'MS PLUS',
      maker: 'BLUE BOX',
      pt: '["5"]',
      status: 'Available',
    },
  ];

  coreData: any = {};
  database: string = 'calibraciones';
  usedMethods: any[] = [];
  readonly phaseResultOptions = ['Conforme', 'No conforme'];

  // Resultados
  ieResults = this.getEmptyIeResults();
  ieResultsBackup = this.getEmptyIeResults();
  isEditingResultados: boolean = false;

  // Equipamiento
  availableEquipments: any[] = [];
  selectedEquipmentId: string = '';
  selectedEquipment: any = null;
  isLoadingEquipments: boolean = false;
  savedEquipmentRecordId: number | null = null;
  savedEquipment: any = null;
  savedEquipmentId: string = '';
  selectedEquipmentIdBackup: string = '';
  isEditingEquipamiento: boolean = false;

  constructor(
    private dccDataService: DccDataService,
    private apiService: ApiService,
  ) {}

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
          this.loadUsedMethodsFromDB();
          this.loadEquipamientoFromDB(ptId, certificateNumber);
          this.loadIeResultsFromDB(certificateNumber);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadUsedMethodsFromDB(): void {
    const ptId = this.coreData?.pt_id;

    this.dccDataService
      .getAllUsedMethodsFromDatabase(this.database, ptId)
      .subscribe({
        next: (methods) => {
          this.usedMethods = (methods || [])
            .filter((method) => method.refType !== 'basic_uncertainty')
            .map((method) => {
              const mapped = { ...method };

              if (
                ptId &&
                mapped.refType === 'hv_method' &&
                mapped.description
              ) {
                mapped.description = mapped.description.replace(
                  /PT-\d{2}/g,
                  ptId,
                );
              }

              if (
                mapped.norm &&
                mapped.usedMethodQuantities &&
                mapped.usedMethodQuantities.length > 0
              ) {
                const quantityName = mapped.usedMethodQuantities[0].name;
                mapped.norm = mapped.norm + ': ' + quantityName;
              }

              return mapped;
            });

          this.dccDataService.updateUsedMethods(this.usedMethods);
        },
        error: () => {
          this.usedMethods = [];
          this.dccDataService.updateUsedMethods(this.usedMethods);
        },
      });
  }

  private getEmptyIeResults() {
    return {
      id: null,
      fase1: '',
      fase2: '',
      fase3: '',
    };
  }

  private loadIeResultsFromDB(ieId: string): void {
    if (!ieId) {
      this.ieResults = this.getEmptyIeResults();
      this.dccDataService.updateIeResults(null);
      return;
    }

    const query = {
      action: 'get',
      bd: this.database,
      table: 'ie_results',
      opts: {
        where: { id_ie: ieId, deleted: 0 },
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        const row = response?.result?.[0];
        this.ieResults = row
          ? {
              id: row.id || null,
              fase1: row.fase1 || '',
              fase2: row.fase2 || '',
              fase3: row.fase3 || '',
            }
          : this.getEmptyIeResults();
        this.dccDataService.updateIeResults(this.ieResults);
      },
      error: () => {
        this.ieResults = this.getEmptyIeResults();
        this.dccDataService.updateIeResults(this.ieResults);
      },
    });
  }

  private loadEquipamientoFromDB(ptId: string, ieId: string): void {
    if (!ptId) {
      this.availableEquipments = [];
      this.savedEquipment = null;
      this.savedEquipmentId = '';
      this.savedEquipmentRecordId = null;
      this.dccDataService.updateIeEquipment(null);
      return;
    }

    // pt_id is like "PT-12" or "PT-05"; extract numeric part and normalize to integer string
    // so "05" and "5" both resolve to "5" for comparison against the BD JSON array
    const rawPt = ptId.replace(/^PT-/i, '').trim();
    const ptNumber = String(parseInt(rawPt, 10));

    this.isLoadingEquipments = true;
    this.availableEquipments = [];
    this.selectedEquipmentId = '';
    this.selectedEquipment = null;
    this.savedEquipment = null;
    this.savedEquipmentId = '';
    this.savedEquipmentRecordId = null;
    this.dccDataService.updateIeEquipment(null);

    const query = {
      action: 'get',
      bd: 'hvtest2',
      table: 'equipment_catalog',
      opts: {
        attributes: ['idequipment', 'name', 'model', 'maker', 'pt', 'status'],
      },
    };

    this.apiService.post(query, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        const allEquipments: any[] = response?.result || [];
        const filteredEquipments = allEquipments.filter((eq) => {
          try {
            const ptArray: string[] = JSON.parse(eq.pt || '[]');
            const status = String(eq.status || '').trim();
            const hasValidStatus =
              status === 'Assigned' || status === 'Available';
            // Normalize each stored value to integer string before comparing
            return (
              hasValidStatus &&
              ptArray.some((v) => String(parseInt(v, 10)) === ptNumber)
            );
          } catch {
            return false;
          }
        });
        this.availableEquipments = this.mergeFallbackEquipments(
          filteredEquipments,
          ptNumber,
        );
        console.log(
          `[Equipamiento] PT="${ptNumber}" → ${this.availableEquipments.length} equipo(s) encontrado(s):`,
          this.availableEquipments.map((eq) => ({
            id: eq.idequipment,
            name: eq.name,
            model: eq.model,
            pt: eq.pt,
            status: eq.status,
          })),
        );
        this.loadSavedEquipamiento(ieId);
        this.isLoadingEquipments = false;
      },
      error: () => {
        this.availableEquipments = this.mergeFallbackEquipments([], ptNumber);
        this.loadSavedEquipamiento(ieId);
        this.isLoadingEquipments = false;
      },
    });
  }

  private mergeFallbackEquipments(equipments: any[], ptNumber: string): any[] {
    const fallbackEquipments =
      ptNumber === '5' ? this.pt05FallbackEquipments : [];

    if (fallbackEquipments.length === 0) {
      return equipments;
    }

    const mergedEquipments = [...equipments];

    fallbackEquipments.forEach((fallbackEquipment) => {
      const exists = mergedEquipments.some(
        (equipment) =>
          String(equipment.idequipment) ===
          String(fallbackEquipment.idequipment),
      );

      if (!exists) {
        mergedEquipments.push(fallbackEquipment);
      }
    });

    return mergedEquipments;
  }

  private loadSavedEquipamiento(ieId: string): void {
    const query = {
      action: 'get',
      bd: this.database,
      table: 'ie_equipamiento',
      opts: {
        where: { id_ie: ieId, deleted: 0 },
      },
    };

    this.dccDataService.post(query).subscribe({
      next: (response: any) => {
        const rows = response?.result || [];
        const row =
          rows.length > 0
            ? rows.reduce((latest: any, current: any) => {
                const latestId = Number(latest?.id || 0);
                const currentId = Number(current?.id || 0);
                return currentId > latestId ? current : latest;
              }, rows[0])
            : null;

        if (!row) {
          this.savedEquipmentRecordId = null;
          this.savedEquipmentId = '';
          this.savedEquipment = null;
          this.dccDataService.updateIeEquipment(null);
          return;
        }

        this.savedEquipmentRecordId = row.id || null;
        this.savedEquipmentId = String(row.id_equipment || '');
        this.savedEquipment =
          this.availableEquipments.find(
            (eq) => String(eq.idequipment) === this.savedEquipmentId,
          ) || null;

        if (!this.savedEquipment && this.savedEquipmentId) {
          this.loadEquipmentById(this.savedEquipmentId);
        } else {
          this.dccDataService.updateIeEquipment(this.savedEquipment);
        }
      },
      error: () => {
        this.savedEquipmentRecordId = null;
        this.savedEquipmentId = '';
        this.savedEquipment = null;
        this.dccDataService.updateIeEquipment(null);
      },
    });
  }

  private loadEquipmentById(equipmentId: string): void {
    const query = {
      action: 'get',
      bd: 'hvtest2',
      table: 'equipment_catalog',
      opts: {
        where: { idequipment: equipmentId },
        attributes: ['idequipment', 'name', 'model', 'maker', 'pt', 'status'],
      },
    };

    this.apiService.post(query, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        const row = response?.result?.[0];
        this.savedEquipment = row || null;
        this.dccDataService.updateIeEquipment(this.savedEquipment);
      },
      error: () => {
        this.savedEquipment = null;
        this.dccDataService.updateIeEquipment(null);
      },
    });
  }

  toggleEditResultados(): void {
    if (this.isEditingResultados) {
      this.ieResults = JSON.parse(JSON.stringify(this.ieResultsBackup));
      this.isEditingResultados = false;
      return;
    }

    this.ieResultsBackup = JSON.parse(JSON.stringify(this.ieResults));
    this.isEditingResultados = true;
  }

  saveResultados(): void {
    const ieId = this.coreData?.certificate_number;
    if (!ieId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay un informe IE/IED cargado.',
      });
      return;
    }

    if (!this.ieResults.fase1 || !this.ieResults.fase2) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos incompletos',
        text: 'Las fases A y B deben tener un valor.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Guardando resultados del informe IE/IED',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const attributes = {
      id_ie: ieId,
      fase1: this.ieResults.fase1 || '',
      fase2: this.ieResults.fase2 || '',
      fase3: this.ieResults.fase3 || '',
    };

    if (this.ieResults.id) {
      const updateQuery = {
        action: 'update',
        bd: this.database,
        table: 'ie_results',
        opts: {
          attributes,
          where: { id: this.ieResults.id },
        },
      };

      this.dccDataService.post(updateQuery).subscribe({
        next: () => this.onResultadosSaved(),
        error: () => this.onResultadosSaveError(),
      });
      return;
    }

    const createQuery = {
      action: 'create',
      bd: this.database,
      table: 'ie_results',
      opts: {
        attributes,
      },
    };

    this.dccDataService.post(createQuery).subscribe({
      next: (response: any) => {
        const insertedId =
          response?.result?.insertId || response?.insertId || null;
        if (insertedId) {
          this.ieResults.id = insertedId;
        }
        this.onResultadosSaved();
      },
      error: () => this.onResultadosSaveError(),
    });
  }

  private onResultadosSaved(): void {
    Swal.close();
    this.isEditingResultados = false;
    this.dccDataService.updateIeResults(this.ieResults);
    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'Los resultados se han guardado correctamente.',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
    });
  }

  private onResultadosSaveError(): void {
    Swal.close();
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudieron guardar los resultados.',
    });
  }

  onEquipmentChange(): void {
    this.selectedEquipment =
      this.availableEquipments.find(
        (eq) => String(eq.idequipment) === String(this.selectedEquipmentId),
      ) || null;
  }

  toggleEditEquipamiento(): void {
    if (this.isEditingEquipamiento) {
      this.selectedEquipmentId = this.selectedEquipmentIdBackup;
      this.onEquipmentChange();
      this.isEditingEquipamiento = false;
      return;
    }

    this.selectedEquipmentId = this.savedEquipmentId;
    this.selectedEquipmentIdBackup = this.savedEquipmentId;
    this.onEquipmentChange();
    this.isEditingEquipamiento = true;
  }

  saveEquipamiento(): void {
    const ieId = this.coreData?.certificate_number;
    if (!ieId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay un informe IE/IED cargado.',
      });
      return;
    }

    if (!this.selectedEquipmentId) {
      Swal.fire({
        icon: 'warning',
        title: 'Seleccion requerida',
        text: 'Debe seleccionar un equipo para guardar.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Guardando equipamiento del informe IE/IED',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const attributes = {
      id_ie: ieId,
      id_equipment: this.selectedEquipmentId,
    };

    const resolveQuery = {
      action: 'get',
      bd: this.database,
      table: 'ie_equipamiento',
      opts: {
        where: { id_ie: ieId },
      },
    };

    this.dccDataService.post(resolveQuery).subscribe({
      next: (response: any) => {
        const rows = response?.result || [];

        if (rows.length > 0) {
          this.updateEquipamientoByIeId(ieId, attributes);
          return;
        }

        this.createEquipamientoRecord(attributes);
      },
      error: () => this.createEquipamientoRecord(attributes),
    });
  }

  private updateEquipamientoByIeId(ieId: string, attributes: any): void {
    const updateQuery = {
      action: 'update',
      bd: this.database,
      table: 'ie_equipamiento',
      opts: {
        attributes,
        where: { id_ie: ieId },
      },
    };

    this.dccDataService.post(updateQuery).subscribe({
      next: () => this.onEquipamientoSaved(),
      error: () => this.onEquipamientoSaveError(),
    });
  }

  private createEquipamientoRecord(attributes: any): void {
    const createQuery = {
      action: 'create',
      bd: this.database,
      table: 'ie_equipamiento',
      opts: {
        attributes,
      },
    };

    this.dccDataService.post(createQuery).subscribe({
      next: (response: any) => {
        const insertedId = response?.result?.insertId || response?.insertId;
        this.savedEquipmentRecordId = insertedId || this.savedEquipmentRecordId;
        this.onEquipamientoSaved();
      },
      error: () => this.onEquipamientoSaveError(),
    });
  }

  private onEquipamientoSaved(): void {
    Swal.close();
    this.savedEquipmentId = this.selectedEquipmentId;
    this.savedEquipment = this.selectedEquipment;
    this.dccDataService.updateIeEquipment(this.savedEquipment);
    this.isEditingEquipamiento = false;

    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'El equipamiento se ha guardado correctamente.',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
    });
  }

  private onEquipamientoSaveError(): void {
    Swal.close();
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo guardar el equipamiento.',
    });
  }
}
