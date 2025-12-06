import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../../services/dcc-data.service';
import { Subscription, lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { Pt23XmlGeneratorService } from '../../../services/pt23-xml-generator.service';

interface NivelTensionData {
  id?: string; // ID local generado para el frontend
  id_bd?: number; // ID de la base de datos
  nivel: number | null;
  dut: (number | null)[];
  patron: (number | null)[];
  // Agregar campos de la BD
  promedio_dut?: number | null;
  promedio_patron?: number | null;
  desviacion_std_dut?: number | null;
  desviacion_std_patron?: number | null;
  num_mediciones?: number;
}

interface ScaleFactorData {
  prueba: number;
  tablas: NivelTensionData[];
}

interface LinearityTestData {
  prueba: number;
  tablas: NivelTensionData[];
}

interface StabilityTestData {
  prueba: number;
  tablas: NivelTensionData[];
}

@Component({
  selector: 'app-pt23-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pt23-results.component.html',
  styleUrls: ['./pt23-results.component.css'],
})
export class Pt23ResultsComponent implements OnInit, OnDestroy {
  // Evento para notificar al padre cuando se generan resultados
  @Output() resultsGenerated = new EventEmitter<void>();

  filas = Array(10).fill(0);

  // Estructuras para múltiples pruebas
  scaleFactorData: ScaleFactorData[] = [];
  linearityTestData: LinearityTestData[] = [];
  stabilityTestData: StabilityTestData[] = [];

  private subscription = new Subscription();
  private database: string = 'calibraciones';
  private dccId: string = '';

  isEditing: boolean = false;

  numeroScaleFactor: number = 1;
  numeroLinearityTest: number = 0;
  numeroStabilityTest: number = 0;
  opcionesScaleFactor: number[] = [0, 1, 2, 3, 4, 5];
  opcionesLinearityTest: number[] = [0, 1, 2, 3, 4, 5];
  opcionesStabilityTest: number[] = [0, 1, 2, 3, 4, 5];

  // Nuevos campos para SFx y SFref
  sfx: number | null = null;
  sfref: number | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // REFACTORIZACIÓN: ESTADOS INDEPENDIENTES
  // ═══════════════════════════════════════════════════════════════════════════

  // SECCIÓN 1: CONFIGURACIÓN (SFx, SFref, número de pruebas)
  isEditingConfig: boolean = false;

  // Variables temporales para backup durante edición
  sfxTemp: number | null = null;
  sfrefTemp: number | null = null;
  numeroScaleFactorTemp: number = 0;
  numeroLinearityTestTemp: number = 0;
  numeroStabilityTestTemp: number = 0;

  // SECCIÓN 2: NIVELES (Datos de mediciones)
  isEditingLevelsSection: boolean = false;

  // Backups para cancelar ediciones de niveles
  scaleFactorDataBackup: ScaleFactorData[] = [];
  linearityTestDataBackup: LinearityTestData[] = [];
  stabilityTestDataBackup: StabilityTestData[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // NUEVO: CHANGE DETECTION POR NIVEL
  // ═══════════════════════════════════════════════════════════════════════════

  // Almacenar cambios detectados: { tipoNivel, nivelId, indiceNivel, accion, datos }
  private changesDetected: Map<string, any> = new Map();

  /**
   * Crea un identificador único para un nivel
   * Formato: "tipoNivel_indice" ej: "lt_0", "sf_1", "st_2"
   */
  private generateLevelKey(
    tipoNivel: 'sf' | 'lt' | 'st',
    indice: number
  ): string {
    return `${tipoNivel}_${indice}`;
  }

  /**
   * Crea un backup de un nivel ANTES de editar
   * Esto permite detectar cambios cuando se guarda
   */
  private createLevelBackup(data: any[]): any[] {
    return JSON.parse(JSON.stringify(data)); // Deep copy
  }

  /**
   * Detecta qué ha cambiado entre el backup y el estado actual
   * Retorna array de cambios: { indice, accion: 'create'|'update'|'delete', nivel }
   */
  private detectLevelChanges(
    tipoNivel: 'sf' | 'lt' | 'st',
    currentData: any[],
    backupData: any[]
  ): any[] {
    const changes: any[] = [];

    // CASO 1: Niveles nuevos (en current pero no en backup)
    currentData.forEach((nivel: any, indice: number) => {
      const existeEnBackup = backupData.some(
        (b: any) =>
          b.id === nivel.id || (b.id_bd === nivel.id_bd && nivel.id_bd)
      );

      if (!existeEnBackup) {
        changes.push({
          indice,
          accion: 'create',
          tipoNivel,
          nivel,
          key: this.generateLevelKey(tipoNivel, indice),
        });
      }
    });

    // CASO 2: Niveles eliminados (en backup pero no en current)
    backupData.forEach((backupNivel: any, backupIndice: number) => {
      const existeEnCurrent = currentData.some(
        (c: any) =>
          c.id === backupNivel.id ||
          (c.id_bd === backupNivel.id_bd && backupNivel.id_bd)
      );

      if (!existeEnCurrent && backupNivel.id_bd) {
        // Solo marcar como eliminado si tiene ID en BD
        changes.push({
          indice: backupIndice,
          accion: 'delete',
          tipoNivel,
          nivel: backupNivel,
          key: this.generateLevelKey(tipoNivel, backupIndice),
        });
      }
    });

    // CASO 3: Niveles modificados (comparer profundamente)
    currentData.forEach((nivel: any, indice: number) => {
      const backupNivel = backupData.find(
        (b: any) =>
          b.id === nivel.id || (b.id_bd === nivel.id_bd && nivel.id_bd)
      );

      if (backupNivel && nivel.id_bd) {
        // Comparar todos los campos
        const hasChanges = this.hasNivelChanges(nivel, backupNivel);
        if (hasChanges) {
          changes.push({
            indice,
            accion: 'update',
            tipoNivel,
            nivel,
            backupNivel,
            key: this.generateLevelKey(tipoNivel, indice),
          });
        }
      }
    });

    return changes;
  }

  /**
   * Compara profundamente dos niveles para detectar cambios
   */
  private hasNivelChanges(nivel: any, backupNivel: any): boolean {
    // Comparar propiedades clave
    if (JSON.stringify(nivel) !== JSON.stringify(backupNivel)) {
      // Comparación más específica
      return (
        nivel.nivel !== backupNivel.nivel ||
        JSON.stringify(nivel.dut) !== JSON.stringify(backupNivel.dut) ||
        JSON.stringify(nivel.patron) !== JSON.stringify(backupNivel.patron) ||
        nivel.promedio_dut !== backupNivel.promedio_dut ||
        nivel.promedio_patron !== backupNivel.promedio_patron
      );
    }
    return false;
  }

  // NUEVO: Cache para valores calculados
  private calculatedErrorsCache: Map<string, string> = new Map();
  private calculatedSFCache: Map<string, string> = new Map();
  private autoGenerateScheduled: boolean = false; // NUEVO: Flag para evitar múltiples auto-generaciones

  constructor(
    private dccDataService: DccDataService,
    private pt23XmlGenerator: Pt23XmlGeneratorService
  ) {}

  ngOnInit() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        const newDccId = data.administrativeData.core.certificate_number;

        // OPTIMIZACIÓN: Solo recargar si el DCC ID cambió
        if (this.dccId !== newDccId) {
          this.dccId = newDccId;

          if (this.dccId) {
            // CORRECCIÓN: Cargar primero config y datos de BD ANTES de inicializar
            this.loadConfigAndData();
          } else {
            if (this.scaleFactorData.length === 0) {
              this.initializeScaleFactorData();
            }
            if (this.linearityTestData.length === 0) {
              this.initializeLinearityTestData();
            }
            if (this.stabilityTestData.length === 0) {
              this.initializeStabilityTestData();
            }
          }
        }
      })
    );
  }

  /**
   * Carga config y datos en el orden correcto:
   * 1. Config (para saber números de pruebas)
   * 2. Datos de BD (niveles/mediciones existentes)
   * 3. Solo entonces inicializar arrays vacíos si es necesario
   */
  private loadConfigAndData(): void {
    this.loadConfigFromDB().then(() => {
      // Cargar datos de BD primero
      Promise.all([
        this.loadScaleFactorFromDB(),
        this.loadLinearityTestFromDB(),
        this.loadStabilityTestFromDB(),
      ]).then(() => {
        // Solo inicializar si no hay datos en BD
        if (this.scaleFactorData.length === 0) {
          this.initializeScaleFactorData();
        }
        if (this.linearityTestData.length === 0) {
          this.initializeLinearityTestData();
        }
        if (this.stabilityTestData.length === 0) {
          this.initializeStabilityTestData();
        }
      });
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private createEmptyTable(): NivelTensionData {
    return {
      id: this.generateId(),
      nivel: null,
      dut: Array(10).fill(null),
      patron: Array(10).fill(null),
    };
  }

  private initializeScaleFactorData() {
    // Crear estructura de datos para cada Scale Factor
    this.scaleFactorData = [];

    // Solo inicializar si numeroScaleFactor > 0
    if (this.numeroScaleFactor > 0) {
      for (let i = 0; i < this.numeroScaleFactor; i++) {
        this.scaleFactorData.push({
          prueba: i + 1,
          tablas: [this.createEmptyTable()],
        });
      }
    }
  }

  private initializeLinearityTestData() {
    this.linearityTestData = [];
    if (this.numeroLinearityTest > 0) {
      for (let i = 0; i < this.numeroLinearityTest; i++) {
        this.linearityTestData.push({
          prueba: i + 1,
          tablas: [this.createEmptyTable()],
        });
      }
    }
  }

  private initializeStabilityTestData() {
    this.stabilityTestData = [];
    if (this.numeroStabilityTest > 0) {
      for (let i = 0; i < this.numeroStabilityTest; i++) {
        this.stabilityTestData.push({
          prueba: i + 1,
          tablas: [this.createEmptyTable()],
        });
      }
    }
  }

  agregarNivel(testType: 'sf' | 'lt' | 'st', testIndex: number) {
    if (testType === 'sf') {
      this.scaleFactorData[testIndex].tablas.push(this.createEmptyTable());
    } else if (testType === 'lt') {
      this.linearityTestData[testIndex].tablas.push(this.createEmptyTable());
    } else if (testType === 'st') {
      this.stabilityTestData[testIndex].tablas.push(this.createEmptyTable());
    }
  }

  quitarUltimoNivel(testType: 'sf' | 'lt' | 'st', testIndex: number) {
    const data =
      testType === 'sf'
        ? this.scaleFactorData[testIndex]
        : testType === 'lt'
        ? this.linearityTestData[testIndex]
        : this.stabilityTestData[testIndex];

    if (data.tablas.length <= 1) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'Debe haber al menos un nivel de tensión.',
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
      return;
    }

    const ultimoIndice = data.tablas.length - 1;
    const ultimoNivel = data.tablas[ultimoIndice];

    // Si el nivel tiene ID de BD, significa que existe en la base de datos
    if (ultimoNivel.id_bd) {
      Swal.fire({
        title: '¿Eliminar último nivel?',
        text: `Este nivel (${ultimoNivel.nivel}) tiene datos guardados en la base de datos. ¿Deseas eliminarlo?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          // Remover del array (se marcará como deleted=1 al guardar)
          data.tablas.splice(ultimoIndice, 1);
          Swal.fire({
            icon: 'success',
            title: 'Nivel eliminado',
            text: 'El nivel será eliminado al guardar los cambios.',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
          });
        }
      });
    } else {
      // Si no tiene ID de BD, simplemente lo quitamos del array
      data.tablas.splice(ultimoIndice, 1);
      Swal.fire({
        icon: 'success',
        title: 'Nivel removido',
        timer: 1500,
        showConfirmButton: false,
        position: 'top-end',
      });
    }
  }

  eliminarNivel(
    testType: 'sf' | 'lt' | 'st',
    testIndex: number,
    nivelIndex: number
  ) {
    const data =
      testType === 'sf'
        ? this.scaleFactorData[testIndex]
        : testType === 'lt'
        ? this.linearityTestData[testIndex]
        : this.stabilityTestData[testIndex];

    if (data.tablas.length <= 1) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'Debe haber al menos un nivel de tensión.',
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
      return;
    }

    Swal.fire({
      title: '¿Eliminar nivel?',
      text: 'Esta acción marcará el nivel como eliminado en la base de datos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        const nivelEliminado = data.tablas[nivelIndex];
        const idBd = nivelEliminado.id_bd;

        // Eliminar de la memoria local
        data.tablas.splice(nivelIndex, 1);

        // Si tiene ID de BD, marcar como eliminado en BD (soft delete)
        if (idBd) {
          const tables = this.getTableNames(testType);
          const logPrefix =
            testType === 'sf' ? '[SF]' : testType === 'lt' ? '[LT]' : '[ST]';

          // Soft delete del nivel
          const deleteNivelQuery = {
            action: 'update',
            bd: this.database,
            table: tables.nivel,
            opts: {
              attributes: { deleted: 1 },
              where: { id: idBd },
            },
          };

          // Soft delete de todas las mediciones asociadas
          const deleteMedicionesQuery = {
            action: 'update',
            bd: this.database,
            table: tables.medicion,
            opts: {
              attributes: { deleted: 1 },
              where: { id_nivel: idBd },
            },
          };

          Promise.all([
            this.dccDataService.post(deleteNivelQuery).toPromise(),
            this.dccDataService.post(deleteMedicionesQuery).toPromise(),
          ])
            .then(() => {})
            .catch((error) => {});
        }

        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'El nivel de tensión ha sido eliminado.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
      }
    });
  }

  /**
   * Limpia los caches cuando cambian los datos o se entra/sale de edición
   */
  private clearCalculationCaches(): void {
    this.calculatedErrorsCache.clear();
    this.calculatedSFCache.clear();
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    this.clearCalculationCaches(); // Limpiar caches al cambiar modo
  }

  onNumeroScaleFactorChange() {
    // Permitir 0 Scale Factors
    if (this.numeroScaleFactor === 0) {
      this.scaleFactorData = [];
      this.guardarScaleFactor();
      return;
    }

    // Ajustar el array de Scale Factor según el nuevo número
    if (this.scaleFactorData.length < this.numeroScaleFactor) {
      // Agregar más Scale Factors
      for (
        let i = this.scaleFactorData.length;
        i < this.numeroScaleFactor;
        i++
      ) {
        this.scaleFactorData.push({
          prueba: i + 1,
          tablas: [this.createEmptyTable()],
        });
      }
    } else if (this.scaleFactorData.length > this.numeroScaleFactor) {
      // Reducir Scale Factors - solo eliminar del array, NO cambiar los números de prueba
      this.scaleFactorData = this.scaleFactorData.slice(
        0,
        this.numeroScaleFactor
      );

      // IMPORTANTE: Los números de prueba se mantienen
      // Si tenías prueba 1 y 2, y reduces a 1, solo te quedas con prueba 1
      // NO renumeras la prueba 2 a ser prueba 1
    }
    // Guardar automáticamente los cambios al modificar el número de SF
    this.guardarScaleFactor();
  }

  onNumeroLinearityTestChange() {
    alert(
      '[DEBUG] onNumeroLinearityTestChange llamado! Valor: ' +
        this.numeroLinearityTest
    );
    if (this.numeroLinearityTest === 0) {
      this.linearityTestData = [];
      this.guardarLinearityTest();
      return;
    }

    if (this.linearityTestData.length < this.numeroLinearityTest) {
      for (
        let i = this.linearityTestData.length;
        i < this.numeroLinearityTest;
        i++
      ) {
        this.linearityTestData.push({
          prueba: i + 1,
          tablas: [this.createEmptyTable()],
        });
      }
    } else if (this.linearityTestData.length > this.numeroLinearityTest) {
      this.linearityTestData = this.linearityTestData.slice(
        0,
        this.numeroLinearityTest
      );
    }
    this.guardarLinearityTest();
  }

  onNumeroStabilityTestChange() {
    if (this.numeroStabilityTest === 0) {
      this.stabilityTestData = [];
      this.guardarStabilityTest();
      return;
    }

    if (this.stabilityTestData.length < this.numeroStabilityTest) {
      for (
        let i = this.stabilityTestData.length;
        i < this.numeroStabilityTest;
        i++
      ) {
        this.stabilityTestData.push({
          prueba: i + 1,
          tablas: [this.createEmptyTable()],
        });
      }
    } else if (this.stabilityTestData.length > this.numeroStabilityTest) {
      this.stabilityTestData = this.stabilityTestData.slice(
        0,
        this.numeroStabilityTest
      );
    }
    this.guardarStabilityTest();
  }

  private loadConfigFromDB(): Promise<void> {
    return new Promise((resolve) => {
      const checkQuery = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_config',
        opts: {
          where: { id_dcc: this.dccId },
        },
      };

      this.dccDataService.post(checkQuery).subscribe({
        next: (response: any) => {
          if (response?.result && response.result.length > 0) {
            const config = response.result[0];
            this.numeroScaleFactor = config.numero_scale_factor || 0;
            this.numeroLinearityTest = config.numero_linearity_test || 0;
            this.numeroStabilityTest = config.numero_stability_test || 0;
            this.sfx = config.sfx !== undefined ? config.sfx : null;
            this.sfref = config.sfref !== undefined ? config.sfref : null;
          } else {
            // Si no hay config en BD, inicializa todo en 0
            this.numeroScaleFactor = 0;
            this.numeroLinearityTest = 0;
            this.numeroStabilityTest = 0;
            this.sfx = null;
            this.sfref = null;
          }
          resolve();
        },
        error: (error) => {
          this.numeroScaleFactor = 0;
          this.numeroLinearityTest = 0;
          this.numeroStabilityTest = 0;
          this.sfx = null;
          this.sfref = null;
          this.scaleFactorData = [];
          this.linearityTestData = [];
          this.stabilityTestData = [];
          resolve(); // Resolver de todas formas
        },
      });
    });
  }

  private saveConfigToDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkQuery = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_config',
        opts: {
          where: { id_dcc: this.dccId },
        },
      };

      this.dccDataService.post(checkQuery).subscribe({
        next: (response: any) => {
          const existingConfig = response?.result?.[0];

          const attributes = {
            id_dcc: this.dccId,
            numero_scale_factor: this.numeroScaleFactor,
            numero_linearity_test: this.numeroLinearityTest,
            numero_stability_test: this.numeroStabilityTest,
            sfx: this.sfx,
            sfref: this.sfref,
          };

          let query;
          if (existingConfig) {
            query = {
              action: 'update',
              bd: this.database,
              table: 'dcc_pt23_config',
              opts: {
                attributes: {
                  numero_scale_factor: this.numeroScaleFactor,
                  numero_linearity_test: this.numeroLinearityTest,
                  numero_stability_test: this.numeroStabilityTest,
                  sfx: this.sfx,
                  sfref: this.sfref,
                },
                where: { id: existingConfig.id },
              },
            };
          } else {
            query = {
              action: 'create',
              bd: this.database,
              table: 'dcc_pt23_config',
              opts: { attributes },
            };
          }

          this.dccDataService.post(query).subscribe({
            next: (saveResponse) => {
              resolve();
            },
            error: (error) => {
              reject(error);
            },
          });
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  guardarScaleFactor() {
    if (!this.dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró el Certificate Number para guardar.',
      });
      return;
    }

    // Validar que SFx y SFref estén definidos
    if (this.sfx === null || this.sfref === null) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor ingrese los valores de SFx y SFref antes de guardar.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Validación ajustada: permitir guardar incluso si numeroScaleFactor es 0
    const hasData =
      this.numeroScaleFactor === 0 ||
      this.scaleFactorData.some((sf) =>
        sf.tablas.some(
          (tabla) =>
            tabla.nivel !== null ||
            tabla.dut.some((v) => v !== null) ||
            tabla.patron.some((v) => v !== null)
        )
      );

    if (!hasData && this.numeroScaleFactor > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos',
        text: 'Ingrese al menos un nivel de tensión con mediciones.',
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando configuración y datos',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    Promise.all([this.saveConfigToDB(), this.saveScaleFactorToDB()])
      .then(() => {
        Swal.close();
        this.isEditing = false;

        Swal.fire({
          icon: 'success',
          title: '¡Guardado!',
          text: 'Los datos se han guardado correctamente.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al guardar los datos.',
        });
      });
  }

  cancelarEdicion() {
    this.isEditing = false;
    this.loadScaleFactorFromDB();
    this.loadLinearityTestFromDB();
    this.loadStabilityTestFromDB();
    this.loadConfigFromDB();
  }

  // NUEVO: Guardar Todo (SF, LT, ST) para asegurar trazabilidad y ejecución
  async guardarTodo() {
    if (!this.dccId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró el Certificate Number para guardar.',
      });
      return;
    }
    if (this.sfx === null || this.sfref === null) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor ingrese los valores de SFx y SFref antes de guardar.',
      });
      return;
    }
    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando configuración y datos (SF, LT, ST)',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      await this.saveConfigToDB();
      const ops: Promise<void>[] = [];
      if (this.numeroScaleFactor > 0) {
        ops.push(this.saveScaleFactorToDB());
      }
      if (this.numeroLinearityTest > 0) {
        ops.push(this.saveLinearityTestToDB());
      }
      if (this.numeroStabilityTest > 0) {
        ops.push(this.saveStabilityTestToDB());
      }
      await Promise.all(ops);
      this.isEditing = false;
      Swal.close();
      Swal.fire({
        icon: 'success',
        title: '¡Guardado!',
        text: 'SF, LT y ST se han guardado correctamente.',
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
    } catch (error) {
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al guardar los datos.',
      });
    }
  }

  guardarLinearityTest() {
    if (!this.dccId) {
      return;
    }

    if (this.sfx === null || this.sfref === null) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor ingrese los valores de SFx y SFref antes de guardar.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando configuración y datos de Linearity Test',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    Promise.all([this.saveConfigToDB(), this.saveLinearityTestToDB()])
      .then(() => {
        this.isEditing = false;
        Swal.close();
        Swal.fire({
          icon: 'success',
          title: '¡Guardado!',
          text: 'Los datos se han guardado correctamente.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error al guardar',
          html: `<p>${
            error?.message || 'Error desconocido'
          }</p><small>Revisa la consola del navegador (F12) para más detalles</small>`,
        });
        // NO cambiar isEditing aquí para que el usuario pueda corregir y reintentar
      });
  }

  guardarStabilityTest() {
    if (!this.dccId) return;

    if (this.sfx === null || this.sfref === null) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor ingrese los valores de SFx y SFref antes de guardar.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando...',
      text: 'Actualizando configuración y datos',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // CORREGIDO: Permitir guardar incluso con tablas vacías (solo estructura)
    Promise.all([this.saveConfigToDB(), this.saveStabilityTestToDB()])
      .then(() => {
        this.isEditing = false;
        Swal.close();
        Swal.fire({
          icon: 'success',
          title: '¡Guardado!',
          text: 'Los datos se han guardado correctamente.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error al guardar',
          text: `Detalles: ${error?.message || 'Error desconocido'}`,
        });
      });
  }

  private saveScaleFactorToDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const promises: Promise<any>[] = [];

      if (this.scaleFactorData.length === 0) {
        // Si no hay SF en memoria, eliminar todos los niveles, mediciones y resultados de SF en la BD para este dccId
        const deleteNivelQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_pt23_scalefactor_nivel',
          opts: {
            attributes: { deleted: 1 },
            where: { id_dcc: this.dccId, deleted: 0 },
          },
        };
        const deleteMedicionQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_pt23_scalefactor_medicion',
          opts: {
            attributes: { deleted: 1 },
            where: { id_dcc: this.dccId, deleted: 0 },
          },
        };
        const deleteResultsQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_results',
          opts: {
            attributes: { deleted: 1 },
            where: {
              id_dcc: this.dccId,
              deleted: 0,
              ref_type: [
                'hv_scaleFactorTest',
                'hv_scaleFactorMean',
                'hv_linearity',
              ],
            },
          },
        };
        Promise.all([
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteNivelQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteMedicionQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteResultsQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
        ])
          .then(() => resolve())
          .catch((err) => reject(err));
        return;
      }

      // Procesar cada Scale Factor
      this.scaleFactorData.forEach((sf) => {
        sf.tablas.forEach((tabla) => {
          // Solo procesar niveles que tengan al menos un valor
          const hasData =
            tabla.nivel !== null ||
            tabla.dut.some((v) => v !== null) ||
            tabla.patron.some((v) => v !== null);

          if (!hasData) {
            return; // Skip este nivel
          }

          // Calcular promedios y estadísticas
          const estadisticas = this.calcularEstadisticas(
            tabla.dut,
            tabla.patron
          );

          // 1. Guardar/actualizar nivel y obtener el ID
          const nivelPromise = this.guardarNivel(
            sf.prueba,
            tabla.nivel || 0,
            estadisticas,
            tabla.id_bd
          ).then((nivelId) => {
            // Guardar el ID de BD en la tabla para futuras actualizaciones
            tabla.id_bd = nivelId;
            // 2. Guardar mediciones individuales
            return this.guardarMediciones(
              nivelId,
              tabla.dut,
              tabla.patron,
              sf.prueba,
              this.dccId
            );
          });

          promises.push(nivelPromise);
        });
      });

      // Eliminar niveles que ya no existen
      this.limpiarNivelesEliminados().then((deletePromise) => {
        if (deletePromise) {
          promises.push(deletePromise);
        }

        Promise.all(promises)
          .then(() => {
            resolve();
          })
          .catch((error) => {
            reject(error);
          });
      });
    });
  }

  private limpiarNivelesEliminados(): Promise<any> {
    return new Promise((resolve) => {
      // Obtener todos los IDs actuales de niveles
      const idsActuales = new Set<string>();
      this.scaleFactorData.forEach((sf) => {
        sf.tablas.forEach((tabla) => {
          if (tabla.id) {
            idsActuales.add(tabla.id);
          }
        });
      });

      // Si no hay IDs actuales, no hay nada que limpiar
      if (idsActuales.size === 0) {
        resolve({ success: true, deleted: 0 });
        return;
      }

      // Buscar niveles en BD que ya no están en memoria
      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_scalefactor_nivel',
        opts: {
          where: {
            id_dcc: this.dccId,
            deleted: 0,
          },
        },
      };

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          if (!response?.result || response.result.length === 0) {
            resolve({ success: true, deleted: 0 });
            return;
          }

          // Identificar niveles a eliminar
          const nivelesAEliminar = response.result.filter(
            (nivel: any) => !idsActuales.has(nivel.id)
          );

          if (nivelesAEliminar.length === 0) {
            resolve({ success: true, deleted: 0 });
            return;
          }

          // Marcar como eliminados (soft delete)
          const updatePromises = nivelesAEliminar.map((nivel: any) => {
            const updateQuery = {
              action: 'update',
              bd: this.database,
              table: 'dcc_pt23_scalefactor_nivel',
              opts: {
                attributes: { deleted: 1 },
                where: { id: nivel.id },
              },
            };

            return new Promise((res) => {
              this.dccDataService.post(updateQuery).subscribe({
                next: () => res(true),
                error: () => res(false),
              });
            });
          });

          Promise.all(updatePromises).then(() => {
            resolve({ success: true, deleted: nivelesAEliminar.length });
          });
        },
        error: (error) => {
          resolve({ success: false, error });
        },
      });
    });
  }

  private saveLinearityTestToDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const promises: Promise<any>[] = [];

      // Si no hay LT en memoria, eliminar todos los niveles, mediciones y resultados de LT en la BD para este dccId
      if (this.linearityTestData.length === 0) {
        const deleteNivelQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_pt23_linearity_nivel',
          opts: {
            attributes: { deleted: 1 },
            where: { id_dcc: this.dccId, deleted: 0 },
          },
        };
        const deleteMedicionQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_pt23_linearity_medicion',
          opts: {
            attributes: { deleted: 1 },
            where: { id_dcc: this.dccId, deleted: 0 },
          },
        };
        const deleteResultsQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_results',
          opts: {
            attributes: { deleted: 1 },
            where: {
              id_dcc: this.dccId,
              deleted: 0,
              ref_type: [
                'hv_linearityTest',
                'hv_linearityMean',
                'hv_linearityValue',
              ],
            },
          },
        };
        Promise.all([
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteNivelQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteMedicionQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteResultsQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
        ])
          .then(() => resolve())
          .catch((err) => reject(err));
        return;
      }

      this.linearityTestData.forEach((lt) => {
        lt.tablas.forEach((tabla) => {
          // CORREGIDO: Solo procesar niveles que tengan al menos un valor
          const hasData =
            tabla.nivel !== null ||
            tabla.dut.some((v) => v !== null) ||
            tabla.patron.some((v) => v !== null);

          if (!hasData) {
            return; // Skip este nivel
          }

          const estadisticas = this.calcularEstadisticas(
            tabla.dut,
            tabla.patron
          );
          const nivelPromise = this.guardarNivelLinearity(
            lt.prueba,
            tabla.nivel || 0,
            estadisticas,
            tabla.id_bd // Pasar el ID de BD si existe
          ).then((nivelId) => {
            // Guardar el ID de BD en la tabla para futuras actualizaciones
            tabla.id_bd = nivelId;
            return this.guardarMedicionesLinearity(
              nivelId,
              tabla.dut,
              tabla.patron,
              lt.prueba,
              this.dccId
            );
          });
          promises.push(nivelPromise);
        });
      });

      this.limpiarNivelesEliminadosLinearity().then((deletePromise) => {
        if (deletePromise) promises.push(deletePromise);
        Promise.all(promises)
          .then(() => {
            // Generar y guardar resultados en dcc_results
            const ltResults = this.pt23XmlGenerator.generateResultsForComponent(
              [],
              this.linearityTestData,
              [],
              this.sfx || 1,
              this.sfref || 1
            );

            // Filtrar solo los resultados de LT (hv_linearityTest, hv_linearityMean, hv_linearityValue)
            const ltOnlyResults = ltResults.filter(
              (r) =>
                r.refType === 'hv_linearityTest' ||
                r.refType === 'hv_linearityMean' ||
                r.refType === 'hv_linearityValue'
            );

            if (ltOnlyResults.length > 0) {
              this.saveResultsToDBGeneric(ltOnlyResults, 'lt', false)
                .then(() => {
                  resolve();
                })
                .catch((error) => {
                  resolve(); // No fallar el guardado completo por error en resultados
                });
            } else {
              resolve();
            }
          })
          .catch((error) => {
            reject(error);
          });
      });
    });
  }

  private saveStabilityTestToDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const promises: Promise<any>[] = [];

      // Si no hay ST en memoria, eliminar todos los niveles, mediciones y resultados de ST en la BD para este dccId
      if (this.stabilityTestData.length === 0) {
        const deleteNivelQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_pt23_stability_nivel',
          opts: {
            attributes: { deleted: 1 },
            where: { id_dcc: this.dccId, deleted: 0 },
          },
        };
        const deleteMedicionQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_pt23_stability_medicion',
          opts: {
            attributes: { deleted: 1 },
            where: { id_dcc: this.dccId, deleted: 0 },
          },
        };
        const deleteResultsQuery = {
          action: 'update',
          bd: this.database,
          table: 'dcc_results',
          opts: {
            attributes: { deleted: 1 },
            where: {
              id_dcc: this.dccId,
              deleted: 0,
              ref_type: [
                'hv_stabilityTest',
                'hv_stabilityMean',
                'hv_stabilityValue',
              ],
            },
          },
        };
        Promise.all([
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteNivelQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteMedicionQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
          new Promise((res, rej) =>
            this.dccDataService
              .post(deleteResultsQuery)
              .subscribe({ next: () => res(true), error: () => rej(false) })
          ),
        ])
          .then(() => resolve())
          .catch((err) => reject(err));
        return;
      }

      this.stabilityTestData.forEach((st) => {
        st.tablas.forEach((tabla) => {
          // Solo procesar niveles que tengan al menos un valor
          const hasData =
            tabla.nivel !== null ||
            tabla.dut.some((v) => v !== null) ||
            tabla.patron.some((v) => v !== null);

          if (!hasData) {
            return; // Skip este nivel
          }

          const estadisticas = this.calcularEstadisticas(
            tabla.dut,
            tabla.patron
          );
          const nivelPromise = this.guardarNivelStability(
            st.prueba,
            tabla.nivel || 0,
            estadisticas,
            tabla.id_bd
          ).then((nivelId) => {
            // Guardar el ID de BD en la tabla para futuras actualizaciones
            tabla.id_bd = nivelId;
            return this.guardarMedicionesStability(
              nivelId,
              tabla.dut,
              tabla.patron
            );
          });
          promises.push(nivelPromise);
        });
      });

      this.limpiarNivelesEliminadosStability().then((deletePromise) => {
        if (deletePromise) promises.push(deletePromise);
        Promise.all(promises)
          .then(() => {
            // Generar y guardar resultados en dcc_results
            const stResults = this.pt23XmlGenerator.generateResultsForComponent(
              [],
              [],
              this.stabilityTestData,
              this.sfx || 1,
              this.sfref || 1
            );

            // Filtrar solo los resultados de ST (hv_stabilityTest, hv_stabilityMean, hv_stabilityValue)
            const stOnlyResults = stResults.filter(
              (r) =>
                r.refType === 'hv_stabilityTest' ||
                r.refType === 'hv_stabilityMean' ||
                r.refType === 'hv_stabilityValue'
            );

            if (stOnlyResults.length > 0) {
              this.saveResultsToDBGeneric(stOnlyResults, 'st', false)
                .then(() => {
                  resolve();
                })
                .catch((error) => {
                  resolve(); // No fallar el guardado completo por error en resultados
                });
            } else {
              resolve();
            }
          })
          .catch((error) => {
            reject(error);
          });
      });
    });
  }

  private limpiarNivelesEliminadosLinearity(): Promise<any> {
    return new Promise((resolve) => {
      const idsActuales = new Set<string>();
      this.linearityTestData.forEach((lt) => {
        lt.tablas.forEach((tabla) => {
          if (tabla.id) idsActuales.add(tabla.id);
        });
      });

      if (idsActuales.size === 0) {
        resolve({ success: true, deleted: 0 });
        return;
      }

      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_linearity_nivel',
        opts: { where: { id_dcc: this.dccId, deleted: 0 } },
      };

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          if (!response?.result || response.result.length === 0) {
            resolve({ success: true, deleted: 0 });
            return;
          }

          const nivelesAEliminar = response.result.filter(
            (nivel: any) => !idsActuales.has(nivel.id)
          );
          if (nivelesAEliminar.length === 0) {
            resolve({ success: true, deleted: 0 });
            return;
          }

          const deleteQuery = {
            action: 'update',
            bd: this.database,
            table: 'dcc_pt23_linearity_nivel',
            opts: {
              attributes: { deleted: 1 },
              where: {
                id_dcc: this.dccId,
                deleted: 0,
                id: nivelesAEliminar.map((n: any) => n.id),
              },
            },
          };

          this.dccDataService.post(deleteQuery).subscribe({
            next: () =>
              resolve({ success: true, deleted: nivelesAEliminar.length }),
            error: () => resolve({ success: false }),
          });
        },
        error: () => resolve({ success: false }),
      });
    });
  }

  private limpiarNivelesEliminadosStability(): Promise<any> {
    return new Promise((resolve) => {
      const idsActuales = new Set<string>();
      this.stabilityTestData.forEach((st) => {
        st.tablas.forEach((tabla) => {
          if (tabla.id) idsActuales.add(tabla.id);
        });
      });

      if (idsActuales.size === 0) {
        resolve({ success: true, deleted: 0 });
        return;
      }

      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_stability_nivel',
        opts: { where: { id_dcc: this.dccId, deleted: 0 } },
      };

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          if (!response?.result || response.result.length === 0) {
            resolve({ success: true, deleted: 0 });
            return;
          }

          const nivelesAEliminar = response.result.filter(
            (nivel: any) => !idsActuales.has(nivel.id)
          );
          if (nivelesAEliminar.length === 0) {
            resolve({ success: true, deleted: 0 });
            return;
          }

          const deleteQuery = {
            action: 'update',
            bd: this.database,
            table: 'dcc_pt23_stability_nivel',
            opts: {
              attributes: { deleted: 1 },
              where: {
                id_dcc: this.dccId,
                deleted: 0,
                id: nivelesAEliminar.map((n: any) => n.id),
              },
            },
          };

          this.dccDataService.post(deleteQuery).subscribe({
            next: () =>
              resolve({ success: true, deleted: nivelesAEliminar.length }),
            error: () => resolve({ success: false }),
          });
        },
        error: () => resolve({ success: false }),
      });
    });
  }

  private calcularEstadisticas(
    dut: (number | null)[],
    patron: (number | null)[]
  ): {
    promedio_dut: number | null;
    promedio_patron: number | null;
    desviacion_std_dut: number | null;
    desviacion_std_patron: number | null;
    num_mediciones: number;
  } {
    const dutValidos = dut
      .map((v) => (v === null || v === undefined ? NaN : Number(v)))
      .filter((v) => !isNaN(v)) as number[];
    const patronValidos = patron
      .map((v) => (v === null || v === undefined ? NaN : Number(v)))
      .filter((v) => !isNaN(v)) as number[];

    const promedioDut =
      dutValidos.length > 0
        ? dutValidos.reduce((a, b) => a + b, 0) / dutValidos.length
        : null;

    const promedioPatron =
      patronValidos.length > 0
        ? patronValidos.reduce((a, b) => a + b, 0) / patronValidos.length
        : null;

    // Calcular desviación estándar solo si hay promedio válido y suficientes valores
    const desviacionDut =
      promedioDut === null || dutValidos.length < 2
        ? null
        : this.calcularDesviacion(dutValidos, promedioDut);
    const desviacionPatron =
      promedioPatron === null || patronValidos.length < 2
        ? null
        : this.calcularDesviacion(patronValidos, promedioPatron);

    return {
      promedio_dut: promedioDut,
      promedio_patron: promedioPatron,
      desviacion_std_dut: desviacionDut,
      desviacion_std_patron: desviacionPatron,
      num_mediciones: Math.max(dutValidos.length, patronValidos.length),
    };
  }

  private calcularDesviacion(
    valores: number[],
    promedio: number
  ): number | null {
    if (valores.length < 2) return null;

    const varianza =
      valores.reduce((sum, val) => {
        const diff = val - promedio;
        return sum + diff * diff;
      }, 0) / valores.length;

    return Math.sqrt(varianza);
  }

  private guardarNivel(
    prueba: number,
    nivelTension: number,
    estadisticas: any,
    idBd?: number
  ): Promise<number> {
    return this.guardarNivelGenerico(
      'sf',
      prueba,
      nivelTension,
      estadisticas,
      idBd
    );
  }

  private async guardarMediciones(
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[],
    prueba: number,
    id_dcc?: string
  ): Promise<void> {
    if (!idNivel || isNaN(idNivel)) {
      throw new Error(`Invalid nivel ID: ${idNivel}`);
    }

    let totalMediciones = 0;
    for (let i = 0; i < 10; i++) {
      if (dut[i] !== null || patron[i] !== null) {
        totalMediciones++;
      }
    }

    if (totalMediciones === 0) {
      return;
    }

    // Upsert directo (update si existe, insert si no)
    await this.insertarMediciones(idNivel, dut, patron);
  }

  private async insertarMediciones(
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[]
  ): Promise<void> {
    return this.insertarMedicionesGenerico('sf', idNivel, dut, patron);
  }

  private guardarNivelLinearity(
    prueba: number,
    nivelTension: number,
    estadisticas: any,
    idBd?: number
  ): Promise<number> {
    return this.guardarNivelGenerico(
      'lt',
      prueba,
      nivelTension,
      estadisticas,
      idBd
    );
  }

  private guardarNivelStability(
    prueba: number,
    nivelTension: number,
    estadisticas: any,
    idBd?: number
  ): Promise<number> {
    return this.guardarNivelGenerico(
      'st',
      prueba,
      nivelTension,
      estadisticas,
      idBd
    );
  }

  private async guardarMedicionesLinearity(
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[],
    prueba: number,
    id_dcc?: string
  ): Promise<void> {
    const medicionesConDatos = [];
    for (let i = 0; i < 10; i++) {
      if (dut[i] !== null || patron[i] !== null) {
        medicionesConDatos.push({
          numero: i + 1,
          dut: dut[i],
          patron: patron[i],
        });
      }
    }

    if (!idNivel || isNaN(idNivel)) {
      throw new Error(`Invalid nivel ID: ${idNivel}`);
    }

    const totalMediciones = medicionesConDatos.length;

    if (totalMediciones === 0) {
      return;
    }

    // Upsert directo (update si existe, insert si no)
    await this.insertarMedicionesLinearity(idNivel, dut, patron);
  }

  private async guardarMedicionesStability(
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[]
  ): Promise<void> {
    if (!idNivel || isNaN(idNivel))
      throw new Error(`Invalid nivel ID: ${idNivel}`);

    let totalMediciones = 0;
    for (let i = 0; i < 10; i++) {
      if (dut[i] !== null || patron[i] !== null) totalMediciones++;
    }
    if (totalMediciones === 0) return;

    await this.insertarMedicionesStability(idNivel, dut, patron);
  }

  private async insertarMedicionesLinearity(
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[]
  ): Promise<void> {
    return this.insertarMedicionesGenerico('lt', idNivel, dut, patron);
  }

  private async insertarMedicionesStability(
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[]
  ): Promise<void> {
    return this.insertarMedicionesGenerico('st', idNivel, dut, patron);
  }

  private loadScaleFactorFromDB(): Promise<void> {
    return new Promise((resolve) => {
      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_scalefactor_nivel',
        opts: {
          where: {
            id_dcc: this.dccId,
            deleted: 0,
          },
        },
      };

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          if (response?.result?.length > 0) {
            const niveles = response.result;
            const promises = niveles.map((nivel: any) =>
              this.cargarMedicionesNivel(nivel.id)
            );

            Promise.all(promises).then((mediciones) => {
              const groupedByPrueba: { [key: number]: any[] } = {};

              niveles.forEach((nivel: any, index: number) => {
                if (!groupedByPrueba[nivel.prueba]) {
                  groupedByPrueba[nivel.prueba] = [];
                }

                groupedByPrueba[nivel.prueba].push({
                  id: nivel.id,
                  id_bd: nivel.id, // Guardar el ID de BD
                  nivel: nivel.nivel_tension,
                  dut: mediciones[index].dut,
                  patron: mediciones[index].patron,
                  promedio_dut: nivel.promedio_dut,
                  promedio_patron: nivel.promedio_patron,
                  desviacion_std_dut: nivel.desviacion_std_dut,
                  desviacion_std_patron: nivel.desviacion_std_patron,
                  num_mediciones: nivel.num_mediciones,
                });
              });

              this.scaleFactorData = Object.keys(groupedByPrueba)
                .map(Number)
                .sort((a, b) => a - b)
                .map((prueba) => ({
                  prueba,
                  tablas: groupedByPrueba[prueba],
                }));

              // Limpiar caches después de cargar datos
              this.clearCalculationCaches();

              // NUEVO: Verificar si se deben auto-generar resultados
              this.checkAndAutoGenerateResults();

              this.numeroScaleFactor = this.scaleFactorData.length;
              resolve();
            });
          } else {
            resolve();
          }
        },
        error: () => {
          resolve();
        },
      });
    });
  }

  private cargarMedicionesNivel(idNivel: number): Promise<any> {
    return new Promise((resolve) => {
      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_scalefactor_medicion',
        opts: {
          where: {
            id_nivel: idNivel,
            deleted: 0,
          },
        },
      };

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          const dut = Array(10).fill(null);
          const patron = Array(10).fill(null);

          if (response?.result) {
            response.result.forEach((med: any) => {
              const idx = med.numero_medicion - 1;
              if (idx >= 0 && idx < 10) {
                dut[idx] = med.valor_dut;
                patron[idx] = med.valor_patron;
              }
            });
          }

          resolve({ dut, patron });
        },
        error: () => {
          resolve({
            dut: Array(10).fill(null),
            patron: Array(10).fill(null),
          });
        },
      });
    });
  }

  private loadLinearityTestFromDB(): Promise<void> {
    return new Promise((resolve) => {
      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_linearity_nivel',
        opts: { where: { id_dcc: this.dccId, deleted: 0 } },
      };

      this.dccDataService.post(query).subscribe({
        next: async (response: any) => {
          if (!response?.result || response.result.length === 0) {
            resolve();
            return;
          }

          const nivelesPorPrueba = new Map<number, any[]>();
          response.result.forEach((nivel: any) => {
            if (!nivelesPorPrueba.has(nivel.prueba)) {
              nivelesPorPrueba.set(nivel.prueba, []);
            }
            nivelesPorPrueba.get(nivel.prueba)!.push(nivel);
          });

          this.linearityTestData = [];
          for (const [prueba, niveles] of nivelesPorPrueba.entries()) {
            const tablas: NivelTensionData[] = [];
            for (const nivel of niveles) {
              const mediciones = await this.cargarMedicionesNivelLinearity(
                nivel.id
              );
              tablas.push({
                id: nivel.id,
                id_bd: nivel.id, // Guardar el ID de BD
                nivel: nivel.nivel_tension,
                dut: mediciones.dut,
                patron: mediciones.patron,
                promedio_dut: nivel.promedio_dut,
                promedio_patron: nivel.promedio_patron,
                desviacion_std_dut: nivel.desviacion_std_dut,
                desviacion_std_patron: nivel.desviacion_std_patron,
                num_mediciones: nivel.num_mediciones,
              });
            }
            this.linearityTestData.push({ prueba, tablas });
          }

          this.numeroLinearityTest = this.linearityTestData.length;
          resolve();
        },
        error: () => {
          resolve();
        },
      });
    });
  }

  private loadStabilityTestFromDB(): Promise<void> {
    return new Promise((resolve) => {
      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_stability_nivel',
        opts: { where: { id_dcc: this.dccId, deleted: 0 } },
      };

      this.dccDataService.post(query).subscribe({
        next: async (response: any) => {
          if (!response?.result || response.result.length === 0) {
            resolve();
            return;
          }

          const nivelesPorPrueba = new Map<number, any[]>();
          response.result.forEach((nivel: any) => {
            if (!nivelesPorPrueba.has(nivel.prueba)) {
              nivelesPorPrueba.set(nivel.prueba, []);
            }
            nivelesPorPrueba.get(nivel.prueba)!.push(nivel);
          });

          this.stabilityTestData = [];
          for (const [prueba, niveles] of nivelesPorPrueba.entries()) {
            const tablas: NivelTensionData[] = [];
            for (const nivel of niveles) {
              const mediciones = await this.cargarMedicionesNivelStability(
                nivel.id
              );
              tablas.push({
                id: nivel.id,
                id_bd: nivel.id, // Guardar el ID de BD
                nivel: nivel.nivel_tension,
                dut: mediciones.dut,
                patron: mediciones.patron,
                promedio_dut: nivel.promedio_dut,
                promedio_patron: nivel.promedio_patron,
                desviacion_std_dut: nivel.desviacion_std_dut,
                desviacion_std_patron: nivel.desviacion_std_patron,
                num_mediciones: nivel.num_mediciones,
              });
            }
            this.stabilityTestData.push({ prueba, tablas });
          }

          this.numeroStabilityTest = this.stabilityTestData.length;
          resolve();
        },
        error: () => {
          resolve();
        },
      });
    });
  }

  private cargarMedicionesNivelLinearity(idNivel: number): Promise<any> {
    return new Promise((resolve) => {
      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_linearity_medicion',
        opts: { where: { id_nivel: idNivel, deleted: 0 } },
      };

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          const dut = Array(10).fill(null);
          const patron = Array(10).fill(null);
          if (response?.result) {
            response.result.forEach((med: any) => {
              const idx = med.numero_medicion - 1;
              if (idx >= 0 && idx < 10) {
                dut[idx] = med.valor_dut;
                patron[idx] = med.valor_patron;
              }
            });
          }
          resolve({ dut, patron });
        },
        error: () =>
          resolve({ dut: Array(10).fill(null), patron: Array(10).fill(null) }),
      });
    });
  }

  private cargarMedicionesNivelStability(idNivel: number): Promise<any> {
    return new Promise((resolve) => {
      const query = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_stability_medicion',
        opts: { where: { id_nivel: idNivel, deleted: 0 } },
      };

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          const dut = Array(10).fill(null);
          const patron = Array(10).fill(null);
          if (response?.result) {
            response.result.forEach((med: any) => {
              const idx = med.numero_medicion - 1;
              if (idx >= 0 && idx < 10) {
                dut[idx] = med.valor_dut;
                patron[idx] = med.valor_patron;
              }
            });
          }
          resolve({ dut, patron });
        },
        error: () =>
          resolve({ dut: Array(10).fill(null), patron: Array(10).fill(null) }),
      });
    });
  }

  // Métodos auxiliares para serializar/deserializar arrays
  private parseArrayField(field: string): (number | null)[] {
    if (!field || field.trim() === '') {
      return Array(10).fill(null);
    }

    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) {
        // Asegurar que siempre haya 10 elementos
        const result = Array(10).fill(null);
        parsed.forEach((val, idx) => {
          if (idx < 10) {
            result[idx] = val === null || val === '' ? null : Number(val);
          }
        });
        return result;
      }
    } catch (e) {}

    return Array(10).fill(null);
  }

  private stringifyArrayField(arr: (number | null)[]): string {
    return JSON.stringify(arr);
  }

  private generateId(): string {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getAverage(arr: (number | null)[]): string {
    const nums = arr
      .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number) as number[];
    if (nums.length === 0) return '';
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return avg.toFixed(3);
  }

  async pegarValores(
    testType: 'sf' | 'lt' | 'st',
    testIndex: number,
    tablaIndex: number,
    tipo: 'dut' | 'patron'
  ) {
    try {
      // Leer del portapapeles
      const text = await navigator.clipboard.readText();

      if (!text || text.trim() === '') {
        Swal.fire({
          icon: 'warning',
          title: 'Portapapeles vacío',
          text: 'No hay datos en el portapapeles para pegar.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
        return;
      }

      // Dividir por líneas y limpiar
      const lineas = text
        .split(/[\n\r]+/)
        .map((linea) => linea.trim())
        .filter((linea) => linea !== '');

      // Convertir a números
      const valores: (number | null)[] = [];
      const errores: string[] = [];

      lineas.forEach((linea, index) => {
        const numero = parseFloat(linea.replace(',', '.'));
        if (isNaN(numero)) {
          errores.push(`Línea ${index + 1}: "${linea}" no es un número válido`);
        } else {
          valores.push(numero);
        }
      });

      if (errores.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Errores encontrados',
          html:
            '<p>Se encontraron ' +
            errores.length +
            ' error(es):</p>' +
            '<ul style="text-align: left; max-height: 200px; overflow-y: auto;">' +
            errores
              .slice(0, 5)
              .map((e) => '<li>' + e + '</li>')
              .join('') +
            (errores.length > 5
              ? '<li>... y ' + (errores.length - 5) + ' más</li>'
              : '') +
            '</ul>',
        });
        return;
      }

      if (valores.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Sin valores',
          text: 'No se encontraron valores numéricos válidos.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
        return;
      }

      if (valores.length > 10) {
        const result = await Swal.fire({
          icon: 'warning',
          title: 'Demasiados valores',
          text: `Se encontraron ${valores.length} valores pero solo hay 10 celdas. ¿Desea usar solo los primeros 10?`,
          showCancelButton: true,
          confirmButtonText: 'Sí, usar 10',
          cancelButtonText: 'Cancelar',
        });

        if (!result.isConfirmed) {
          return;
        }
      }

      // Aplicar valores según el tipo de prueba
      const data =
        testType === 'sf'
          ? this.scaleFactorData[testIndex]
          : testType === 'lt'
          ? this.linearityTestData[testIndex]
          : this.stabilityTestData[testIndex];
      const tabla = data.tablas[tablaIndex];
      const array = tipo === 'dut' ? tabla.dut : tabla.patron;

      for (let i = 0; i < Math.min(valores.length, 10); i++) {
        array[i] = valores[i];
      }

      Swal.fire({
        icon: 'success',
        title: '¡Valores pegados!',
        text: `Se pegaron ${Math.min(
          valores.length,
          10
        )} valores en ${tipo.toUpperCase()}.`,
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo acceder al portapapeles. Asegúrese de que el navegador tenga permisos.',
      });
    }
  }

  limpiarColumna(
    testType: 'sf' | 'lt' | 'st',
    testIndex: number,
    tablaIndex: number,
    tipo: 'dut' | 'patron'
  ) {
    Swal.fire({
      title: '¿Limpiar columna?',
      text: `Se borrarán todos los valores de ${tipo.toUpperCase()}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        const data =
          testType === 'sf'
            ? this.scaleFactorData[testIndex]
            : testType === 'lt'
            ? this.linearityTestData[testIndex]
            : this.stabilityTestData[testIndex];
        const tabla = data.tablas[tablaIndex];
        const array = tipo === 'dut' ? tabla.dut : tabla.patron;

        for (let i = 0; i < array.length; i++) {
          array[i] = null;
        }

        Swal.fire({
          icon: 'success',
          title: 'Limpiado',
          text: `Columna ${tipo.toUpperCase()} limpiada.`,
          timer: 1500,
          showConfirmButton: false,
          position: 'top-end',
        });
      }
    });
  }

  /**
   * NUEVO: Verifica si hay datos completos y auto-genera resultados
   */
  private checkAndAutoGenerateResults() {
    // OPTIMIZACIÓN: Evitar múltiples llamadas simultáneas
    if (this.autoGenerateScheduled) return;

    this.autoGenerateScheduled = true;

    setTimeout(() => {
      const hasConfig = this.sfx !== null && this.sfref !== null;
      const hasData =
        this.scaleFactorData.length > 0 && this.numeroScaleFactor > 0;
      const hasValidData = this.scaleFactorData.some((sf) =>
        sf.tablas.some(
          (tabla) =>
            tabla.nivel !== null &&
            tabla.dut.some((v) => v !== null) &&
            tabla.patron.some((v) => v !== null)
        )
      );

      if (hasConfig && hasData && hasValidData) {
        this.autoGenerateResults();
      }

      this.autoGenerateScheduled = false;
    }, 500);
  }

  /**
   * NUEVO: Auto-genera resultados sin mostrar alertas
   */
  private autoGenerateResults() {
    try {
      const generatedResults =
        this.pt23XmlGenerator.generateResultsForComponent(
          this.scaleFactorData,
          this.linearityTestData,
          this.stabilityTestData,
          this.sfx!,
          this.sfref!
        );
      this.dccDataService.updatePT23Results(generatedResults);

      // NO guardar en BD automáticamente - solo actualizar en memoria
    } catch (error) {
      // Silencioso en auto-generación
    }
  }

  /**
   * Genera resultados para todos los tipos de prueba (SF, LT, ST) y los guarda en dcc_results
   * Este método se llama desde el botón "Generar Resultados" sin necesidad de editar niveles
   * IMPORTANTE: Limpia resultados huérfanos (sin niveles correspondientes) antes de generar
   */
  async generarResultadosManuales() {
    // Validar parámetros
    if (this.sfx === null || this.sfref === null) {
      Swal.fire({
        icon: 'warning',
        title: 'Parámetros faltantes',
        text: 'Por favor configure SFx y SFref antes de generar resultados.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    try {
      // Mostrar loading
      Swal.fire({
        title: 'Generando resultados...',
        text: 'Limpiando resultados obsoletos y generando nuevos...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // PASO 1: Limpiar resultados huérfanos (marcar como deleted=1)
      await this.limpiarResultadosHuerfanos();

      // PASO 2: Generar resultados solo para los tipos que tienen datos
      const allResults = this.pt23XmlGenerator.generateResultsForComponent(
        this.scaleFactorData,
        this.linearityTestData,
        this.stabilityTestData,
        this.sfx,
        this.sfref
      );

      // Separar por tipo
      const sfResults = allResults.filter(
        (r) =>
          r.refType === 'hv_scaleFactorTest' ||
          r.refType === 'hv_scaleFactorMean' ||
          r.refType === 'hv_linearity'
      );
      const ltResults = allResults.filter(
        (r) =>
          r.refType === 'hv_linearityTest' ||
          r.refType === 'hv_linearityMean' ||
          r.refType === 'hv_linearityValue'
      );
      const stResults = allResults.filter(
        (r) =>
          r.refType === 'hv_stabilityTest' ||
          r.refType === 'hv_stabilityMean' ||
          r.refType === 'hv_stabilityValue'
      );

      // PASO 3: Guardar solo los resultados que tienen datos
      const promises: Promise<void>[] = [];
      let deletedCount = { sf: 0, lt: 0, st: 0 };

      if (sfResults.length > 0) {
        promises.push(this.saveResultsToDBGeneric(sfResults, 'sf', false));
      }
      if (ltResults.length > 0) {
        promises.push(this.saveResultsToDBGeneric(ltResults, 'lt', false));
      }
      if (stResults.length > 0) {
        promises.push(this.saveResultsToDBGeneric(stResults, 'st', false));
      }

      await Promise.all(promises);

      // Actualizar en el servicio DCC
      this.dccDataService.updatePT23Results(allResults);

      // Construir mensaje de resumen
      let resumenHtml =
        '<p>Se procesaron los resultados:</p><ul style="text-align: left; margin-left: 20px;">';

      if (this.numeroScaleFactor > 0 && sfResults.length > 0) {
        resumenHtml += `<li><strong>SF:</strong> ${sfResults.length} resultado(s) generados</li>`;
      } else if (this.numeroScaleFactor === 0) {
        resumenHtml += `<li><strong>SF:</strong> Sin pruebas configuradas (resultados anteriores eliminados)</li>`;
      }

      if (this.numeroLinearityTest > 0 && ltResults.length > 0) {
        resumenHtml += `<li><strong>LT:</strong> ${ltResults.length} resultado(s) generados</li>`;
      } else if (this.numeroLinearityTest === 0) {
        resumenHtml += `<li><strong>LT:</strong> Sin pruebas configuradas (resultados anteriores eliminados)</li>`;
      }

      if (this.numeroStabilityTest > 0 && stResults.length > 0) {
        resumenHtml += `<li><strong>ST:</strong> ${stResults.length} resultado(s) generados</li>`;
      } else if (this.numeroStabilityTest === 0) {
        resumenHtml += `<li><strong>ST:</strong> Sin pruebas configuradas (resultados anteriores eliminados)</li>`;
      }

      resumenHtml += '</ul>';

      // Emitir evento para que el padre actualice la tabla de resultados
      this.resultsGenerated.emit();

      Swal.fire({
        icon: 'success',
        title: '¡Resultados actualizados!',
        html: resumenHtml,
        confirmButtonText: 'Entendido',
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al generar los resultados.',
      });
    }
  }

  /**
   * Limpia resultados huérfanos en dcc_results
   * Marca como deleted=1 los resultados de tipos que ya no tienen niveles configurados
   */
  private async limpiarResultadosHuerfanos(): Promise<void> {
    if (!this.dccId) return;

    const deletePromises: Promise<any>[] = [];

    // Si no hay SF configurados, eliminar resultados de SF
    if (this.numeroScaleFactor === 0 || this.scaleFactorData.length === 0) {
      const deleteSFQuery = {
        action: 'update',
        bd: this.database,
        table: 'dcc_results',
        opts: {
          attributes: { deleted: 1 },
          where: {
            id_dcc: this.dccId,
            deleted: 0,
            ref_type: [
              'hv_scaleFactorTest',
              'hv_scaleFactorMean',
              'hv_linearity',
            ],
          },
        },
      };
      deletePromises.push(
        lastValueFrom(this.dccDataService.post(deleteSFQuery)).catch(() => {})
      );
    }

    // Si no hay LT configurados, eliminar resultados de LT
    if (this.numeroLinearityTest === 0 || this.linearityTestData.length === 0) {
      const deleteLTQuery = {
        action: 'update',
        bd: this.database,
        table: 'dcc_results',
        opts: {
          attributes: { deleted: 1 },
          where: {
            id_dcc: this.dccId,
            deleted: 0,
            ref_type: [
              'hv_linearityTest',
              'hv_linearityMean',
              'hv_linearityValue',
            ],
          },
        },
      };
      deletePromises.push(
        lastValueFrom(this.dccDataService.post(deleteLTQuery)).catch(() => {})
      );
    }

    // Si no hay ST configurados, eliminar resultados de ST
    if (this.numeroStabilityTest === 0 || this.stabilityTestData.length === 0) {
      const deleteSTQuery = {
        action: 'update',
        bd: this.database,
        table: 'dcc_results',
        opts: {
          attributes: { deleted: 1 },
          where: {
            id_dcc: this.dccId,
            deleted: 0,
            ref_type: [
              'hv_stabilityTest',
              'hv_stabilityMean',
              'hv_stabilityValue',
            ],
          },
        },
      };
      deletePromises.push(
        lastValueFrom(this.dccDataService.post(deleteSTQuery)).catch(() => {})
      );
    }

    // Ejecutar todas las eliminaciones en paralelo
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
  }

  /**
   * Generar resultados manualmente (con confirmación)
   */
  generarYActualizarResultados() {
    // Validar parámetros
    if (this.sfx === null || this.sfref === null) {
      Swal.fire({
        icon: 'warning',
        title: 'Parámetros faltantes',
        text: 'Por favor configure SFx y SFref antes de generar resultados.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    if (this.scaleFactorData.length === 0 || this.numeroScaleFactor === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos',
        text: 'No hay datos de Scale Factor para generar resultados.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // LOG IMPORTANTE: Ver qué datos estamos pasando

    this.scaleFactorData.forEach((sf) => {
      sf.tablas.forEach((tabla) => {});
    });

    try {
      // Generar resultados (SF + LT + ST)
      const generatedResults =
        this.pt23XmlGenerator.generateResultsForComponent(
          this.scaleFactorData,
          this.linearityTestData,
          this.stabilityTestData,
          this.sfx,
          this.sfref
        );

      // Actualizar los resultados en el servicio DCC
      this.dccDataService.updatePT23Results(generatedResults);

      // NUEVO: Guardar automáticamente en BD
      this.saveResultsToDB(generatedResults);

      // Emitir evento para que el padre actualice la tabla de resultados
      this.resultsGenerated.emit();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al generar los resultados.',
      });
    }
  }

  /**
   * MÉTODO GENÉRICO: Guardar resultados en BD con verificación de existencia
   * Usado por SF, LT y ST para guardar en dcc_results
   */
  private saveResultsToDBGeneric(
    results: any[],
    testType: 'sf' | 'lt' | 'st',
    showSuccessMessage: boolean = true
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const dccId = this.dccId;
      if (!dccId) {
        reject(new Error('No dccId available'));
        return;
      }

      const logPrefix =
        testType === 'sf' ? '[SF]' : testType === 'lt' ? '[LT]' : '[ST]';

      // Primero, obtener los resultados existentes
      const checkQuery = {
        action: 'get',
        bd: this.database,
        table: 'dcc_results',
        opts: {
          where: { id_dcc: dccId, deleted: 0 },
        },
      };

      this.dccDataService.post(checkQuery).subscribe({
        next: (response: any) => {
          const existingResults = response?.result || [];
          const promises: Promise<any>[] = [];

          results.forEach((result: any, index: number) => {
            let dataToSave;

            // Guardado especial para hv_scaleFactorTest (array de quantities)
            if (result.refType === 'hv_scaleFactorTest') {
              dataToSave = result.data.map((qty: any) => ({
                id: qty.id,
                name: qty.name,
                refType: qty.refType,
                dataType: qty.dataType,
                valueXMLList: qty.valueXMLList,
                unitXMLList: qty.unitXMLList,
                measurementUncertainty: qty.measurementUncertainty,
              }));
            }
            // Guardado especial para hv_scaleFactorMean, hv_linearity y otros arrays
            else if (
              result.refType === 'hv_scaleFactorMean' ||
              result.refType === 'hv_linearity' ||
              result.refType === 'hv_stability'
            ) {
              if (Array.isArray(result.data)) {
                dataToSave = result.data.map((qty: any) => ({
                  id: qty.id,
                  refType: qty.refType,
                  name: qty.name,
                  dataType: qty.dataType,
                  value: qty.value,
                  unit: qty.unit,
                }));
              } else {
                dataToSave = {
                  id: result.data.id,
                  refType: result.data.refType,
                  name: result.data.name,
                  dataType: result.data.dataType,
                  value: result.data.value,
                  unit: result.data.unit,
                };
              }
            }
            // Otros resultados
            else {
              dataToSave = result.data;
            }

            const attributes = {
              id_dcc: dccId,
              name: result.name,
              ref_type: result.refType,
              data: JSON.stringify(dataToSave),
              orden: index + 1,
            };

            // Buscar resultado existente por nombre Y ref_type
            const existingResult = existingResults.find(
              (r: any) =>
                r.name === result.name && r.ref_type === result.refType
            );

            if (existingResult) {
              const updateQuery = {
                action: 'update',
                bd: this.database,
                table: 'dcc_results',
                opts: {
                  attributes: {
                    name: attributes.name,
                    ref_type: attributes.ref_type,
                    data: attributes.data,
                    orden: attributes.orden,
                  },
                  where: { id: existingResult.id },
                },
              };
              promises.push(this.dccDataService.post(updateQuery).toPromise());
            } else {
              const createQuery = {
                action: 'create',
                bd: this.database,
                table: 'dcc_results',
                opts: { attributes },
              };
              promises.push(this.dccDataService.post(createQuery).toPromise());
            }
          });

          Promise.all(promises)
            .then(() => {
              if (showSuccessMessage) {
                Swal.fire({
                  icon: 'success',
                  title: '¡Resultados guardados!',
                  html:
                    '<p>Se han generado y guardado <strong>' +
                    results.length +
                    ' resultados</strong> en la base de datos.</p>' +
                    '<p>Los resultados están disponibles en el bloque de Results.</p>',
                  confirmButtonText: 'Entendido',
                });
              }
              resolve();
            })
            .catch((error) => {
              if (showSuccessMessage) {
                Swal.fire({
                  icon: 'error',
                  title: 'Error al guardar',
                  text: 'Los resultados se generaron pero hubo un error al guardarlos en la base de datos.',
                });
              }
              reject(error);
            });
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  /**
   * COMPATIBILIDAD: Wrapper para mantener compatibilidad con código existente
   */
  private saveResultsToDB(results: any[]) {
    return this.saveResultsToDBGeneric(results, 'sf', true);
  }

  /**
   * Calcula el error porcentual para un nivel
   * Fórmula: ((DUT - Patrón) / Patrón) * 100
   */
  getError(
    dutArray: (number | null)[],
    patronArray: (number | null)[]
  ): string {
    // OPTIMIZACIÓN: Cachear estos cálculos solo cuando los datos cambian
    const cacheKey = `error_${dutArray.join('_')}_${patronArray.join('_')}`;

    if (this.calculatedErrorsCache.has(cacheKey)) {
      return this.calculatedErrorsCache.get(cacheKey)!;
    }

    const promedioDUT = this.calcularPromedioLocal(dutArray);
    const promedioPatron = this.calcularPromedioLocal(patronArray);

    if (promedioPatron === 0 || promedioDUT === 0) return '';

    const error = ((promedioDUT - promedioPatron) / promedioPatron) * 100;
    const result = error.toFixed(2);

    this.calculatedErrorsCache.set(cacheKey, result);
    return result;
  }

  /**
   * Calcula el Scale Factor corregido para un nivel
   * Fórmula simplificada: SF = patron / (dut / SFx)
   * Retorna el promedio de todos los SF calculados
   */
  getObtainedScaleFactor(
    dutArray: (number | null)[],
    patronArray: (number | null)[]
  ): string {
    if (this.sfx === null || this.sfref === null) return '';

    const cacheKey = `sf_${dutArray.join('_')}_${patronArray.join('_')}_${
      this.sfx
    }`;

    if (this.calculatedSFCache.has(cacheKey)) {
      return this.calculatedSFCache.get(cacheKey)!;
    }

    const sfCalculados: number[] = [];

    // Iterar sobre cada medición (hasta 10)
    for (let i = 0; i < 10; i++) {
      const valorDUT = dutArray[i];
      const valorPatron = patronArray[i];

      // Solo calcular si ambos valores existen y son válidos
      if (
        valorDUT !== null &&
        valorDUT !== undefined &&
        !isNaN(Number(valorDUT)) &&
        valorPatron !== null &&
        valorPatron !== undefined &&
        !isNaN(Number(valorPatron)) &&
        Number(valorDUT) !== 0 &&
        this.sfx !== 0
      ) {
        // Fórmula simplificada: SF = patron / (dut / SFx)
        const sf = Number(valorPatron) / (Number(valorDUT) / this.sfx);
        sfCalculados.push(sf);
      }
    }

    // Si no hay mediciones válidas, retornar vacío
    if (sfCalculados.length === 0) return '';

    // Retornar el promedio de todos los SF calculados
    const sfPromedio =
      sfCalculados.reduce((a, b) => a + b, 0) / sfCalculados.length;
    const result = sfPromedio.toFixed(6);

    this.calculatedSFCache.set(cacheKey, result);
    return result;
  }

  /**
   * Método auxiliar para calcular promedio localmente
   */
  private calcularPromedioLocal(arr: (number | null)[]): number {
    const nums = arr
      .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number) as number[];
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  /**
   * Calcula el error porcentual para una medición individual
   * Fórmula: ((DUT - Patrón) / Patrón) * 100
   */
  getErrorForRow(dutValue: number | null, patronValue: number | null): string {
    // Crear clave única para el cache
    const cacheKey = `${dutValue}_${patronValue}`;

    // Verificar si ya está en cache
    if (this.calculatedErrorsCache.has(cacheKey)) {
      return this.calculatedErrorsCache.get(cacheKey)!;
    }

    if (
      dutValue === null ||
      patronValue === null ||
      patronValue === 0 ||
      dutValue === 0
    ) {
      return '';
    }

    const error = ((dutValue - patronValue) / patronValue) * 100;

    // Guardar en cache
    this.calculatedErrorsCache.set(cacheKey, error.toFixed(2));

    return error.toFixed(2);
  }

  /**
   * Calcula el Scale Factor corregido para una medición individual
   * Fórmula simplificada: SF = patron / (dut / SFx)
   */
  getSFCorrectedForRow(
    dutValue: number | null,
    patronValue: number | null
  ): string {
    // Crear clave única para el cache (solo sfx porque ya no usamos sfref)
    const cacheKey = `${dutValue}_${patronValue}_${this.sfx}`;

    // Verificar si ya está en cache
    if (this.calculatedSFCache.has(cacheKey)) {
      return this.calculatedSFCache.get(cacheKey)!;
    }

    // Validación 1: Verificar SFx
    if (this.sfx === null || this.sfx === 0) {
      return '';
    }

    // Validación 2: Verificar dutValue
    if (dutValue === null || dutValue === undefined || dutValue === 0) {
      return '';
    }

    // Validación 3: Verificar patronValue
    if (patronValue === null || patronValue === undefined) {
      return '';
    }

    // Convertir a números explícitamente
    const dut = Number(dutValue);
    const patron = Number(patronValue);
    const sfxNum = Number(this.sfx);

    // Verificar si la conversión fue exitosa
    if (isNaN(dut) || isNaN(patron) || isNaN(sfxNum)) {
      return '';
    }

    // Aplicar la fórmula simplificada: SF = patron / (dut / SFx)
    const sf = patron / (dut / sfxNum);

    const result = sf.toFixed(6);

    // Guardar en cache
    this.calculatedSFCache.set(cacheKey, result);

    return result;
  }

  /**
   * MÉTODOS GENÉRICOS PARA GUARDAR/CARGAR NIVELES Y MEDICIONES
   */
  private getTableNames(testType: 'sf' | 'lt' | 'st'): {
    nivel: string;
    medicion: string;
  } {
    const tables = {
      sf: {
        nivel: 'dcc_pt23_scalefactor_nivel',
        medicion: 'dcc_pt23_scalefactor_medicion',
      },
      lt: {
        nivel: 'dcc_pt23_linearity_nivel',
        medicion: 'dcc_pt23_linearity_medicion',
      },
      st: {
        nivel: 'dcc_pt23_stability_nivel',
        medicion: 'dcc_pt23_stability_medicion',
      },
    };
    return tables[testType];
  }

  private guardarNivelGenerico(
    testType: 'sf' | 'lt' | 'st',
    prueba: number,
    nivelTension: number,
    estadisticas: any,
    idBd?: number
  ): Promise<number> {
    const tables = this.getTableNames(testType);
    const logPrefix =
      testType === 'sf' ? '[SF]' : testType === 'lt' ? '[LT]' : '[ST]';

    return new Promise((resolve, reject) => {
      // MEJORA: Si tenemos id_bd, buscar directamente por ID para actualizar
      if (idBd) {
        const checkByIdQuery = {
          action: 'get',
          bd: this.database,
          table: tables.nivel,
          opts: {
            where: { id: idBd, deleted: 0 },
          },
        };

        this.dccDataService.post(checkByIdQuery).subscribe({
          next: (response: any) => {
            const existing = response?.result?.[0];
            if (existing) {
              const attributes = {
                nivel_tension: nivelTension,
                promedio_dut: estadisticas.promedio_dut,
                promedio_patron: estadisticas.promedio_patron,
                desviacion_std_dut: estadisticas.desviacion_std_dut,
                desviacion_std_patron: estadisticas.desviacion_std_patron,
                num_mediciones: estadisticas.num_mediciones,
              };

              const updateQuery = {
                action: 'update',
                bd: this.database,
                table: tables.nivel,
                opts: {
                  attributes,
                  where: { id: idBd },
                },
              };

              this.dccDataService.post(updateQuery).subscribe({
                next: (updateResponse) => {
                  resolve(idBd);
                },
                error: (err) => {
                  reject(err);
                },
              });
            } else {
              // Fallback: buscar por criterios
              this.buscarYGuardarPorCriterios(
                testType,
                tables,
                logPrefix,
                prueba,
                nivelTension,
                estadisticas,
                resolve,
                reject
              );
            }
          },
          error: (err) => {
            // Fallback: buscar por criterios
            this.buscarYGuardarPorCriterios(
              testType,
              tables,
              logPrefix,
              prueba,
              nivelTension,
              estadisticas,
              resolve,
              reject
            );
          },
        });
        return;
      }

      // Si no hay ID, buscar por criterios
      this.buscarYGuardarPorCriterios(
        testType,
        tables,
        logPrefix,
        prueba,
        nivelTension,
        estadisticas,
        resolve,
        reject
      );
    });
  }

  private buscarYGuardarPorCriterios(
    testType: 'sf' | 'lt' | 'st',
    tables: any,
    logPrefix: string,
    prueba: number,
    nivelTension: number | null | undefined,
    estadisticas: any,
    resolve: any,
    reject: any
  ) {
    // CRÍTICO: Siempre construir el WHERE CON nivel_tension (aunque sea null)
    // porque el constraint UNIQUE es: id_dcc + prueba + nivel_tension
    // IMPORTANTE: NO incluir filtro deleted para encontrar registros marcados como eliminados
    const where: any = {
      id_dcc: this.dccId,
      prueba: prueba,
      nivel_tension: nivelTension, // Incluir SIEMPRE, aunque sea null
      // NO incluir deleted: aquí buscamos TODO (activos y eliminados)
    };

    const checkQuery = {
      action: 'get',
      bd: this.database,
      table: tables.nivel,
      opts: {
        where: where,
        limit: 1, // Máximo 1 registro porque el constraint es UNIQUE
        // Sin filtro deleted - devolver todos los que cumplen la UNIQUE key
      },
    };

    this.dccDataService.post(checkQuery).subscribe({
      next: (response: any) => {
        const existing = response?.result?.[0];

        // Si no encontró con deleted=0, buscar explícitamente con deleted=1
        if (!existing) {
          const findDeletedQuery = {
            action: 'get',
            bd: this.database,
            table: tables.nivel,
            opts: {
              where: {
                id_dcc: this.dccId,
                prueba: prueba,
                nivel_tension: nivelTension,
                deleted: 1, // Buscar TODOS los eliminados
              },
              // Quitar limit: 1 para traer todos los duplicados
            },
          };

          this.dccDataService.post(findDeletedQuery).subscribe({
            next: (deletedResponse: any) => {
              const deletedRecords = deletedResponse?.result || [];
              if (deletedRecords.length > 0) {
                // Restaurar todos los duplicados
                const updatePromises = deletedRecords.map((rec: any) => {
                  const updateQuery = {
                    action: 'update',
                    bd: this.database,
                    table: tables.nivel,
                    opts: {
                      attributes: { deleted: 0 },
                      where: { id: rec.id },
                    },
                  };
                  return this.dccDataService.post(updateQuery).toPromise();
                });
                Promise.all(updatePromises)
                  .then(() => {
                    // Usar el primer registro restaurado para actualizar datos
                    this.procesarGuardoNivel(
                      testType,
                      tables,
                      logPrefix,
                      deletedRecords[0],
                      estadisticas,
                      resolve,
                      reject,
                      true
                    );
                  })
                  .catch((err) => {
                    reject(err);
                  });
              } else {
                // Proceder a crear
                this.procedeCreateNivel(
                  testType,
                  tables,
                  logPrefix,
                  prueba,
                  nivelTension,
                  estadisticas,
                  resolve,
                  reject
                );
              }
            },
            error: () => {
              // Si falla la búsqueda de eliminados, proceder a crear
              this.procedeCreateNivel(
                testType,
                tables,
                logPrefix,
                prueba,
                nivelTension,
                estadisticas,
                resolve,
                reject
              );
            },
          });
          return;
        }

        // Si SÍ encontró (activo o eliminado), proceder a guardar
        this.procesarGuardoNivel(
          testType,
          tables,
          logPrefix,
          existing,
          estadisticas,
          resolve,
          reject,
          false
        );
      },
      error: (err) => {
        reject(err);
      },
    });
  }

  /**
   * Procesa el guardado de un nivel encontrado (UPDATE)
   */
  private procesarGuardoNivel(
    testType: 'sf' | 'lt' | 'st',
    tables: any,
    logPrefix: string,
    existing: any,
    estadisticas: any,
    resolve: any,
    reject: any,
    wasDeleted: boolean
  ) {
    const attributes = {
      id_dcc: this.dccId,
      prueba: existing.prueba,
      nivel_tension: existing.nivel_tension,
      promedio_dut: estadisticas.promedio_dut,
      promedio_patron: estadisticas.promedio_patron,
      desviacion_std_dut: estadisticas.desviacion_std_dut,
      desviacion_std_patron: estadisticas.desviacion_std_patron,
      num_mediciones: estadisticas.num_mediciones,
      deleted: 0, // IMPORTANTE: Restaurar si estaba eliminado
    };

    const updateQuery = {
      action: 'update',
      bd: this.database,
      table: tables.nivel,
      opts: {
        attributes,
        where: { id: existing.id },
      },
    };

    this.dccDataService.post(updateQuery).subscribe({
      next: () => {
        resolve(existing.id);
      },
      error: (err) => {
        reject(err);
      },
    });
  }

  /**
   * Procede a crear un nuevo nivel
   */
  private procedeCreateNivel(
    testType: 'sf' | 'lt' | 'st',
    tables: any,
    logPrefix: string,
    prueba: number,
    nivelTension: number | null | undefined,
    estadisticas: any,
    resolve: any,
    reject: any
  ) {
    const attributes = {
      id_dcc: this.dccId,
      prueba: prueba,
      nivel_tension: nivelTension,
      promedio_dut: estadisticas.promedio_dut,
      promedio_patron: estadisticas.promedio_patron,
      desviacion_std_dut: estadisticas.desviacion_std_dut,
      desviacion_std_patron: estadisticas.desviacion_std_patron,
      num_mediciones: estadisticas.num_mediciones,
      deleted: 0,
    };

    const createQuery = {
      action: 'create',
      bd: this.database,
      table: tables.nivel,
      opts: { attributes },
    };

    this.dccDataService.post(createQuery).subscribe({
      next: (createResponse: any) => {
        // Si el backend retorna {result: false}, significa que falló la inserción
        // Probablemente sea por constraint UNIQUE (registro eliminado)
        if (createResponse?.result === false) {
          // Búsqueda EXPLÍCITA con deleted=1
          const findDeletedQuery = {
            action: 'get',
            bd: this.database,
            table: tables.nivel,
            opts: {
              where: {
                id_dcc: this.dccId,
                prueba: prueba,
                nivel_tension: nivelTension,
                deleted: 1, // EXPLÍCITAMENTE deleted=1
              },
              limit: 1,
            },
          };

          this.dccDataService.post(findDeletedQuery).subscribe({
            next: (findResponse: any) => {
              const deletedRecord = findResponse?.result?.[0];
              if (deletedRecord) {
                // Restaurar: UPDATE con deleted=0 y nuevos datos
                const restoreQuery = {
                  action: 'update',
                  bd: this.database,
                  table: tables.nivel,
                  opts: {
                    attributes: {
                      ...attributes,
                      deleted: 0,
                    },
                    where: { id: deletedRecord.id },
                  },
                };

                this.dccDataService.post(restoreQuery).subscribe({
                  next: () => {
                    resolve(deletedRecord.id);
                  },
                  error: (restoreErr) => {
                    reject(restoreErr);
                  },
                });
              } else {
                reject(
                  new Error(
                    'CREATE falló (result=false) pero no se encontró registro para restaurar'
                  )
                );
              }
            },
            error: (findErr) => {
              reject(findErr);
            },
          });
          return;
        }

        // Extraer ID de la respuesta
        const newId =
          createResponse?.id ||
          createResponse?.insertId ||
          createResponse?.result?.id ||
          createResponse?.result?.insertId ||
          (createResponse?.result?.length > 0
            ? createResponse.result[0]?.id
            : null);

        if (newId) {
          resolve(newId);
        } else {
          // Si no hay ID en respuesta, buscar el registro recién creado

          const findCreatedQuery = {
            action: 'get',
            bd: this.database,
            table: tables.nivel,
            opts: {
              where: {
                id_dcc: this.dccId,
                prueba: prueba,
                nivel_tension: nivelTension,
                deleted: 0,
              },
            },
          };

          this.dccDataService.post(findCreatedQuery).subscribe({
            next: (findResponse: any) => {
              const record = findResponse?.result?.[0] || findResponse?.[0];
              if (record?.id) {
                resolve(record.id);
              } else {
                reject(new Error('No se pudo obtener ID después de CREATE'));
              }
            },
            error: (findErr) => {
              reject(findErr);
            },
          });
        }
      },
      error: (err) => {
        // Si es error de constraint UNIQUE (1062)
        if (
          err?.error?.includes?.('1062') ||
          err?.message?.includes?.('Duplicate')
        ) {
          // Búsqueda EXPLÍCITA con deleted=1
          const findDeletedQuery = {
            action: 'get',
            bd: this.database,
            table: tables.nivel,
            opts: {
              where: {
                id_dcc: this.dccId,
                prueba: prueba,
                nivel_tension: nivelTension,
                deleted: 1, // EXPLÍCITAMENTE deleted=1
              },
              limit: 1,
            },
          };

          this.dccDataService.post(findDeletedQuery).subscribe({
            next: (findResponse: any) => {
              const deletedRecord = findResponse?.result?.[0];
              if (deletedRecord) {
                // Restaurar: UPDATE con deleted=0 y nuevos datos
                const restoreQuery = {
                  action: 'update',
                  bd: this.database,
                  table: tables.nivel,
                  opts: {
                    attributes: {
                      ...attributes,
                      deleted: 0,
                    },
                    where: { id: deletedRecord.id },
                  },
                };

                this.dccDataService.post(restoreQuery).subscribe({
                  next: () => {
                    resolve(deletedRecord.id);
                  },
                  error: (restoreErr) => {
                    reject(restoreErr);
                  },
                });
              } else {
                reject(
                  new Error(
                    'Error 1062 pero no se encontró registro para restaurar'
                  )
                );
              }
            },
            error: (findErr) => {
              reject(findErr);
            },
          });
        } else {
          reject(err);
        }
      },
    });
  }

  private async insertarMedicionesGenerico(
    testType: 'sf' | 'lt' | 'st',
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[]
  ): Promise<void> {
    const tables = this.getTableNames(testType);
    const logPrefix =
      testType === 'sf' ? '[SF]' : testType === 'lt' ? '[LT]' : '[ST]';

    // LOG CRÍTICO: Ver qué valores llegan a este método

    // Obtener TODAS las mediciones (incluidas las eliminadas) para este nivel
    const checkQuery = {
      action: 'get',
      bd: this.database,
      table: tables.medicion,
      opts: { where: { id_nivel: idNivel } },
    };

    let existingMediciones: any[] = [];
    try {
      const response: any = await lastValueFrom(
        this.dccDataService.post(checkQuery)
      );
      existingMediciones = response?.result || [];
    } catch (err) {
      // No se encontraron mediciones existentes
    }

    const promises: Promise<any>[] = [];
    const numerosMedicionesConDatos = new Set<number>();

    // Paso 1: Procesar mediciones CON datos (crear/actualizar/restaurar)
    for (let i = 0; i < 10; i++) {
      const dutValue = dut[i];
      const patronValue = patron[i];
      const hasValue = dutValue !== null || patronValue !== null;

      if (hasValue) {
        const numeroMedicion = i + 1;
        numerosMedicionesConDatos.add(numeroMedicion);

        // Buscar medición existente (activa O eliminada)
        // IMPORTANTE: Usar == en lugar de === porque numero_medicion puede venir como string de BD
        const existing = existingMediciones.find(
          (m: any) => Number(m.numero_medicion) === numeroMedicion
        );

        if (existing) {
          const wasDeleted = Number(existing.deleted) === 1;
          // Convertir a números para comparación y envío a BD
          const dutNumeric = dutValue !== null ? Number(dutValue) : null;
          const patronNumeric =
            patronValue !== null ? Number(patronValue) : null;

          const dutChanged =
            dutNumeric !== null && dutNumeric !== Number(existing.valor_dut);

          const patronChanged =
            patronNumeric !== null &&
            patronNumeric !== Number(existing.valor_patron);

          const hasRealChange = dutChanged || patronChanged || wasDeleted;

          if (hasRealChange) {
            // Convertir id a número por si viene como string de BD
            const medicionId = Number(existing.id);

            const updateQuery = {
              action: 'update',
              bd: this.database,
              table: tables.medicion,
              opts: {
                attributes: {
                  valor_dut: dutNumeric,
                  valor_patron: patronNumeric,
                  // NO incluir deleted aquí - la tabla puede no tener esa columna
                },
                where: { id: medicionId },
              },
            };

            // LOG completo para debug

            promises.push(
              lastValueFrom(this.dccDataService.post(updateQuery))
                .then((response) => {
                  return response;
                })
                .catch((error) => {
                  throw error;
                })
            );
          }
        } else {
          // Medición NO encontrada: CREAR NUEVA
          const createQuery = {
            action: 'create',
            bd: this.database,
            table: tables.medicion,
            opts: {
              attributes: {
                id_nivel: idNivel,
                numero_medicion: numeroMedicion,
                valor_dut: dutValue !== null ? Number(dutValue) : null,
                valor_patron: patronValue !== null ? Number(patronValue) : null,
              },
            },
          };
          promises.push(lastValueFrom(this.dccDataService.post(createQuery)));
        }
      }
    }

    // Paso 2: Marcar como eliminadas (soft delete) las mediciones que ya no tienen datos
    const medicionesAEliminar = existingMediciones.filter(
      (m: any) =>
        !numerosMedicionesConDatos.has(Number(m.numero_medicion)) &&
        Number(m.deleted) === 0
    );

    if (medicionesAEliminar.length > 0) {
      medicionesAEliminar.forEach((medicion: any) => {
        const deleteQuery = {
          action: 'update',
          bd: this.database,
          table: tables.medicion,
          opts: {
            attributes: { deleted: 1 },
            where: { id: medicion.id }, // Sin Number() - dejar como viene de BD
          },
        };
        promises.push(lastValueFrom(this.dccDataService.post(deleteQuery)));
      });
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NUEVAS FUNCIONES: EDICIÓN INDEPENDIENTE DE CONFIGURACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Activa el modo edición de configuración
   * Copia los valores actuales a variables temporales como backup
   */
  toggleEditConfig(): void {
    if (this.isEditingConfig) {
      // Si ya está en edición, cancelar
      this.cancelarConfig();
    } else {
      // Entrar en edición - hacer backup
      this.sfxTemp = this.sfx;
      this.sfrefTemp = this.sfref;
      this.numeroScaleFactorTemp = this.numeroScaleFactor;
      this.numeroLinearityTestTemp = this.numeroLinearityTest;
      this.numeroStabilityTestTemp = this.numeroStabilityTest;

      this.isEditingConfig = true;
    }
  }

  /**
   * Valida la configuración antes de guardar
   */
  private validarConfiguracion(): boolean {
    // SFx y SFref son requeridos
    if (
      this.sfxTemp === null ||
      this.sfxTemp === undefined ||
      this.sfxTemp === 0
    ) {
      Swal.fire({
        icon: 'warning',
        title: 'Valor requerido',
        text: 'SFx es un parámetro requerido y no puede ser 0 o vacío.',
      });
      return false;
    }

    if (
      this.sfrefTemp === null ||
      this.sfrefTemp === undefined ||
      this.sfrefTemp === 0
    ) {
      Swal.fire({
        icon: 'warning',
        title: 'Valor requerido',
        text: 'SFref es un parámetro requerido y no puede ser 0 o vacío.',
      });
      return false;
    }

    // Números de pruebas entre 0 y 5
    if (this.numeroScaleFactorTemp < 0 || this.numeroScaleFactorTemp > 5) {
      Swal.fire({
        icon: 'warning',
        title: 'Valor fuera de rango',
        text: 'Las pruebas de SF deben estar entre 0 y 5.',
      });
      return false;
    }

    if (this.numeroLinearityTestTemp < 0 || this.numeroLinearityTestTemp > 5) {
      Swal.fire({
        icon: 'warning',
        title: 'Valor fuera de rango',
        text: 'Las pruebas de LT deben estar entre 0 y 5.',
      });
      return false;
    }

    if (this.numeroStabilityTestTemp < 0 || this.numeroStabilityTestTemp > 5) {
      Swal.fire({
        icon: 'warning',
        title: 'Valor fuera de rango',
        text: 'Las pruebas de ST deben estar entre 0 y 5.',
      });
      return false;
    }

    return true;
  }

  /**
   * Guarda la configuración en BD
   * Crea/elimina pruebas vacías si el número cambió
   */
  guardarConfig(): void {
    if (!this.validarConfiguracion()) {
      return;
    }

    Swal.fire({
      title: 'Guardando configuración...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Detectar cambios en números de pruebas
    const sfChanged = this.numeroScaleFactorTemp !== this.numeroScaleFactor;
    const ltChanged = this.numeroLinearityTestTemp !== this.numeroLinearityTest;
    const stChanged = this.numeroStabilityTestTemp !== this.numeroStabilityTest;

    // Actualizar valores principales
    this.sfx = this.sfxTemp;
    this.sfref = this.sfrefTemp;
    this.numeroScaleFactor = this.numeroScaleFactorTemp;
    this.numeroLinearityTest = this.numeroLinearityTestTemp;
    this.numeroStabilityTest = this.numeroStabilityTestTemp;

    // Construir promesas para guardar config + crear/eliminar pruebas
    const promises: Promise<any>[] = [];

    // 1. Guardar configuración en BD
    promises.push(this.saveConfigToDB());

    // 2. Crear/eliminar pruebas de SF
    if (sfChanged) {
      promises.push(
        this.crearEliminarPruebasVacias(
          'sf',
          this.numeroScaleFactorTemp,
          this.numeroScaleFactor
        )
      );
    }

    // 3. Crear/eliminar pruebas de LT
    if (ltChanged) {
      promises.push(
        this.crearEliminarPruebasVacias(
          'lt',
          this.numeroLinearityTestTemp,
          this.numeroLinearityTest
        )
      );
    }

    // 4. Crear/eliminar pruebas de ST
    if (stChanged) {
      promises.push(
        this.crearEliminarPruebasVacias(
          'st',
          this.numeroStabilityTestTemp,
          this.numeroStabilityTest
        )
      );
    }

    // Ejecutar todo
    Promise.all(promises)
      .then(() => {
        // Recargar datos
        this.loadScaleFactorFromDB();
        this.loadLinearityTestFromDB();
        this.loadStabilityTestFromDB();

        this.isEditingConfig = false;

        Swal.close();
        Swal.fire({
          icon: 'success',
          title: '¡Configuración guardada!',
          text: 'Los parámetros se han actualizado correctamente.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          html: `<p>${
            error?.message || 'Error desconocido'
          }</p><small>Revisa la consola para más detalles</small>`,
        });
      });
  }

  /**
   * Crea o elimina pruebas vacías según sea necesario
   */
  private crearEliminarPruebasVacias(
    tipo: 'sf' | 'lt' | 'st',
    numNuevo: number,
    numAnterior: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const logPrefix =
        tipo === 'sf' ? '[SF]' : tipo === 'lt' ? '[LT]' : '[ST]';

      const tableNames = this.getTableNames(tipo);
      const diferencia = numNuevo - numAnterior;

      if (diferencia === 0) {
        resolve();
        return;
      }

      if (diferencia > 0) {
        // CREAR pruebas vacías
        const promises: Promise<any>[] = [];

        for (let i = numAnterior + 1; i <= numNuevo; i++) {
          const createQuery = {
            action: 'create',
            bd: this.database,
            table: tableNames.nivel,
            opts: {
              attributes: {
                id_dcc: this.dccId,
                prueba: i,
                nivel_tension: null,
                promedio_dut: null,
                promedio_patron: null,
                desviacion_std_dut: null,
                desviacion_std_patron: null,
                num_mediciones: 0,
              },
            },
          };

          promises.push(
            lastValueFrom(this.dccDataService.post(createQuery)).then(
              (resp) => {
                return resp;
              }
            )
          );
        }

        Promise.all(promises)
          .then(() => {
            resolve();
          })
          .catch(reject);
      } else {
        // ELIMINAR pruebas (soft delete)
        const promises: Promise<any>[] = [];

        for (let i = numNuevo + 1; i <= numAnterior; i++) {
          const deleteQuery = {
            action: 'update',
            bd: this.database,
            table: tableNames.nivel,
            opts: {
              attributes: { deleted: 1 },
              where: {
                id_dcc: this.dccId,
                prueba: i,
                deleted: 0,
              },
            },
          };

          promises.push(
            lastValueFrom(this.dccDataService.post(deleteQuery)).then(
              (resp) => {
                return resp;
              }
            )
          );
        }

        Promise.all(promises)
          .then(() => {
            resolve();
          })
          .catch(reject);
      }
    });
  }

  /**
   * Cancela edición de configuración y restaura valores anteriores
   */
  cancelarConfig(): void {
    this.isEditingConfig = false;

    // Los valores temporales se descartan automáticamente
    this.sfxTemp = null;
    this.sfrefTemp = null;
    this.numeroScaleFactorTemp = 0;
    this.numeroLinearityTestTemp = 0;
    this.numeroStabilityTestTemp = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NUEVAS FUNCIONES: EDICIÓN INDEPENDIENTE DE NIVELES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Activa el modo edición de niveles
   * Crea backups de los arrays de datos actuales
   */
  toggleEditLevels(): void {
    if (this.isEditingLevelsSection) {
      // Si ya está en edición, cancelar
      this.cancelarNiveles();
    } else {
      // Hacer backup profundo de los datos ANTES de permitir edición
      this.scaleFactorDataBackup = this.createLevelBackup(this.scaleFactorData);
      this.linearityTestDataBackup = this.createLevelBackup(
        this.linearityTestData
      );
      this.stabilityTestDataBackup = this.createLevelBackup(
        this.stabilityTestData
      );

      // Limpiar cambios previos
      this.changesDetected.clear();

      this.isEditingLevelsSection = true;
    }
  }

  /**
   * Valida que los niveles tengan datos válidos
   */
  private validarNiveles(): boolean {
    let tieneAlMenosUnDato = false;

    // Revisar SF
    for (const prueba of this.scaleFactorData) {
      for (const tabla of prueba.tablas) {
        if (
          tabla.dut.some((v) => v !== null && v !== undefined && v !== 0) ||
          tabla.patron.some((v) => v !== null && v !== undefined && v !== 0)
        ) {
          tieneAlMenosUnDato = true;
          break;
        }
      }
    }

    // Revisar LT
    for (const prueba of this.linearityTestData) {
      for (const tabla of prueba.tablas) {
        if (
          tabla.dut.some((v) => v !== null && v !== undefined && v !== 0) ||
          tabla.patron.some((v) => v !== null && v !== undefined && v !== 0)
        ) {
          tieneAlMenosUnDato = true;
          break;
        }
      }
    }

    // Revisar ST
    for (const prueba of this.stabilityTestData) {
      for (const tabla of prueba.tablas) {
        if (
          tabla.dut.some((v) => v !== null && v !== undefined && v !== 0) ||
          tabla.patron.some((v) => v !== null && v !== undefined && v !== 0)
        ) {
          tieneAlMenosUnDato = true;
          break;
        }
      }
    }

    if (!tieneAlMenosUnDato) {
      Swal.fire({
        icon: 'info',
        title: 'Sin datos',
        text: 'Por favor ingresa al menos una medición en cualquier nivel antes de guardar.',
      });
      return false;
    }

    return true;
  }

  /**
   * Guarda todos los niveles de SF, LT y ST
   */
  guardarNiveles(): void {
    if (!this.validarNiveles()) {
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NUEVO: DETECTAR CAMBIOS ANTES DE GUARDAR
    // ═══════════════════════════════════════════════════════════════════════════

    const changesSF = this.detectLevelChanges(
      'sf',
      this.scaleFactorData.flatMap((p) => p.tablas),
      this.scaleFactorDataBackup.flatMap((p) => p.tablas)
    );

    const changesLT = this.detectLevelChanges(
      'lt',
      this.linearityTestData.flatMap((p) => p.tablas),
      this.linearityTestDataBackup.flatMap((p) => p.tablas)
    );

    const changesST = this.detectLevelChanges(
      'st',
      this.stabilityTestData.flatMap((p) => p.tablas),
      this.stabilityTestDataBackup.flatMap((p) => p.tablas)
    );

    const totalChanges = changesSF.length + changesLT.length + changesST.length;

    if (totalChanges === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin cambios',
        text: 'No se detectaron cambios en los niveles.',
        timer: 2000,
        showConfirmButton: false,
        position: 'top-end',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando cambios...',
      text: `Procesando ${totalChanges} cambio(s)`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Guardar SOLO los cambios detectados
    Promise.all([
      this.saveChangedLevelsToDB('sf', changesSF),
      this.saveChangedLevelsToDB('lt', changesLT),
      this.saveChangedLevelsToDB('st', changesST),
    ])
      .then(() => {
        this.isEditingLevelsSection = false;

        // Recargar datos
        this.loadScaleFactorFromDB();
        this.loadLinearityTestFromDB();
        this.loadStabilityTestFromDB();

        Swal.close();
        Swal.fire({
          icon: 'success',
          title: '¡Cambios guardados!',
          text: `Se procesaron exitosamente ${totalChanges} cambio(s).`,
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
        });
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          html: `<p>${
            error?.message || 'Error desconocido'
          }</p><small>Revisa la consola para más detalles</small>`,
        });
      });
  }

  /**
   * Guarda SOLO los cambios detectados de un tipo específico
   */
  private async saveChangedLevelsToDB(
    tipo: 'sf' | 'lt' | 'st',
    changes: any[]
  ): Promise<void> {
    const logPrefix = tipo === 'sf' ? '[SF]' : tipo === 'lt' ? '[LT]' : '[ST]';

    if (changes.length === 0) {
      return;
    }

    // Mostrar resumen de cambios
    const creates = changes.filter((c) => c.accion === 'create').length;
    const updates = changes.filter((c) => c.accion === 'update').length;
    const deletes = changes.filter((c) => c.accion === 'delete').length;

    if (creates > 0)
      if (updates > 0)
        if (deletes > 0)
          // Procesar cada cambio
          for (const change of changes) {
            const nivel = change.nivel;
            const nivelDescripcion = `tension=${nivel.nivel} kV (id_bd=${
              nivel.id_bd || 'nuevo'
            })`;

            if (change.accion === 'delete') {
              // Marcar como eliminado (soft delete)
              await this.softDeleteNivel(tipo, nivel.id_bd);
            }
          }

    // Después de procesar cambios individuales, ejecutar el guardado estándar
    await this.saveLevelsToDB(tipo, this.getDataForType(tipo));
  }

  /**
   * Obtiene el array de datos para un tipo de prueba
   */
  private getDataForType(tipo: 'sf' | 'lt' | 'st'): any[] {
    switch (tipo) {
      case 'sf':
        return this.scaleFactorData;
      case 'lt':
        return this.linearityTestData;
      case 'st':
        return this.stabilityTestData;
    }
  }

  /**
   * Ejecuta soft delete en un nivel
   */
  private async softDeleteNivel(
    tipo: 'sf' | 'lt' | 'st',
    id_bd: number
  ): Promise<void> {
    const tableMap = {
      sf: 'dcc_pt23_scalefactor_nivel',
      lt: 'dcc_pt23_linearity_nivel',
      st: 'dcc_pt23_stability_nivel',
    };

    const deleteQuery = {
      action: 'update',
      bd: this.database,
      table: tableMap[tipo],
      opts: {
        attributes: { deleted: 1 },
        where: { id: Number(id_bd) },
      },
    };

    try {
      const result = await lastValueFrom(this.dccDataService.post(deleteQuery));
    } catch (err) {
      throw err;
    }
  }

  /**
   * Guarda todos los niveles de Scale Factor
   */
  private saveScaleFactorLevelsToDB(): Promise<void> {
    return this.saveLevelsToDB('sf', this.scaleFactorData);
  }

  /**
   * Guarda todos los niveles de Linearity Test
   */
  private saveLinearityTestLevelsToDB(): Promise<void> {
    return this.saveLevelsToDB('lt', this.linearityTestData);
  }

  /**
   * Guarda todos los niveles de Stability Test
   */
  private saveStabilityTestLevelsToDB(): Promise<void> {
    return this.saveLevelsToDB('st', this.stabilityTestData);
  }

  /**
   * Guarda todos los niveles de un tipo (genérico para SF, LT, ST)
   * Revisa nivel por nivel con validación completa antes de crear/actualizar
   */
  private async saveLevelsToDB(
    tipo: 'sf' | 'lt' | 'st',
    data: any[]
  ): Promise<void> {
    const logPrefix = tipo === 'sf' ? '[SF]' : tipo === 'lt' ? '[LT]' : '[ST]';
    const tipoNombre =
      tipo === 'sf'
        ? 'Scale Factor'
        : tipo === 'lt'
        ? 'Linearity'
        : 'Stability';

    // Calcular total de niveles
    const totalNiveles = data.reduce(
      (sum, prueba) => sum + prueba.tablas.length,
      0
    );
    let nivelActual = 0;

    const tables = this.getTableNames(tipo);

    for (const prueba of data) {
      for (const tabla of prueba.tablas) {
        try {
          nivelActual++;

          // Actualizar progreso en el diálogo
          Swal.update({
            html: `
              <div style="text-align: left; padding: 10px;">
                <p style="margin: 5px 0; font-weight: 600; color: #333;">
                  <span style="color: #2196f3;">${tipoNombre}</span> - 
                  Nivel ${nivelActual} de ${totalNiveles}
                </p>
                <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
                  📊 Prueba ${prueba.prueba} - ${tabla.nivel} kV
                </p>
                <p style="margin: 5px 0; color: #999; font-size: 0.85em;">
                  Guardando nivel...
                </p>
                <div style="margin-top: 15px;">
                  <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #2196f3, #1976d2); height: 100%; width: ${
                      (nivelActual / totalNiveles) * 100
                    }%; transition: width 0.3s ease;"></div>
                  </div>
                  <p style="margin: 8px 0 0 0; font-size: 0.8em; color: #999;">
                    ${Math.round(
                      (nivelActual / totalNiveles) * 100
                    )}% completado
                  </p>
                </div>
              </div>
            `,
          });

          // 1. Calcular estadísticas
          const stats = this.calcularEstadisticas(tabla.dut, tabla.patron);

          // 2. Determinar la acción a realizar
          let nivelId: number;

          if (tabla.id_bd) {
            // CASO 1: Tiene ID de BD → ACTUALIZAR
            nivelId = await this.guardarNivelGenerico(
              tipo,
              prueba.prueba,
              tabla.nivel,
              stats,
              tabla.id_bd
            );
          } else {
            // CASO 2: No tiene ID → Buscar si existe en BD

            const existingNivel = await this.buscarNivelExistente(
              tipo,
              prueba.prueba,
              tabla.nivel
            );

            if (existingNivel) {
              if (existingNivel.deleted === 1) {
                // CASO 2A: Existe pero está eliminado → RESTAURAR
                nivelId = await this.restaurarNivel(
                  tipo,
                  existingNivel.id,
                  stats
                );
              } else {
                // CASO 2B: Existe y está activo → ACTUALIZAR
                nivelId = await this.guardarNivelGenerico(
                  tipo,
                  prueba.prueba,
                  tabla.nivel,
                  stats,
                  existingNivel.id
                );
              }
            } else {
              // CASO 2C: No existe → CREAR
              nivelId = await this.guardarNivelGenerico(
                tipo,
                prueba.prueba,
                tabla.nivel,
                stats,
                undefined
              );
            }
          }

          // 3. Actualizar el ID en memoria
          tabla.id_bd = nivelId;

          // 4. Guardar mediciones con progreso
          Swal.update({
            html: `
              <div style="text-align: left; padding: 10px;">
                <p style="margin: 5px 0; font-weight: 600; color: #333;">
                  <span style="color: #2196f3;">${tipoNombre}</span> - 
                  Nivel ${nivelActual} de ${totalNiveles}
                </p>
                <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
                  📊 Prueba ${prueba.prueba} - ${
              tabla.nivel
            } kV (ID: ${nivelId})
                </p>
                <p style="margin: 5px 0; color: #4caf50; font-size: 0.85em;">
                  ✓ Nivel guardado - Guardando mediciones...
                </p>
                <div style="margin-top: 15px;">
                  <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #2196f3, #1976d2); height: 100%; width: ${
                      (nivelActual / totalNiveles) * 100
                    }%; transition: width 0.3s ease;"></div>
                  </div>
                  <p style="margin: 8px 0 0 0; font-size: 0.8em; color: #999;">
                    ${Math.round(
                      (nivelActual / totalNiveles) * 100
                    )}% completado
                  </p>
                </div>
              </div>
            `,
          });

          await this.guardarMedicionesNivel(
            tipo,
            nivelId,
            tabla.dut,
            tabla.patron
          );
        } catch (error) {
          throw error;
        }
      }
    }
  }

  /**
   * Busca un nivel existente en BD (incluyendo eliminados)
   */
  private async buscarNivelExistente(
    tipo: 'sf' | 'lt' | 'st',
    prueba: number,
    nivelTension: number
  ): Promise<any> {
    const tables = this.getTableNames(tipo);
    const logPrefix = tipo === 'sf' ? '[SF]' : tipo === 'lt' ? '[LT]' : '[ST]';

    const query = {
      action: 'get',
      bd: this.database,
      table: tables.nivel,
      opts: {
        where: {
          id_dcc: this.dccId,
          prueba: prueba,
          nivel_tension: nivelTension,
        },
      },
    };

    try {
      const response: any = await lastValueFrom(
        this.dccDataService.post(query)
      );
      const record = response?.result?.[0] || response?.[0];

      if (record) {
        return record;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Restaura un nivel eliminado (deleted=1 → deleted=0)
   */
  private async restaurarNivel(
    tipo: 'sf' | 'lt' | 'st',
    nivelId: number,
    stats: any
  ): Promise<number> {
    const tables = this.getTableNames(tipo);
    const logPrefix = tipo === 'sf' ? '[SF]' : tipo === 'lt' ? '[LT]' : '[ST]';

    const updateQuery = {
      action: 'update',
      bd: this.database,
      table: tables.nivel,
      opts: {
        attributes: {
          deleted: 0,
          promedio_dut: stats.promedio_dut,
          promedio_patron: stats.promedio_patron,
          desviacion_std_dut: stats.desviacion_std_dut,
          desviacion_std_patron: stats.desviacion_std_patron,
        },
        where: { id: nivelId },
      },
    };

    try {
      await lastValueFrom(this.dccDataService.post(updateQuery));
      return nivelId;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Guarda todas las mediciones de un nivel (wrapper genérico)
   */
  private guardarMedicionesNivel(
    tipo: 'sf' | 'lt' | 'st',
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[]
  ): Promise<void> {
    // Llamar al método correcto según el tipo de test
    if (tipo === 'sf') {
      return this.guardarMediciones(idNivel, dut, patron, 0, this.dccId);
    } else if (tipo === 'lt') {
      return this.guardarMedicionesLinearity(
        idNivel,
        dut,
        patron,
        0,
        this.dccId
      );
    } else {
      return this.guardarMedicionesStability(idNivel, dut, patron);
    }
  }

  /**
   * Cancela edición de niveles y restaura backup
   */
  cancelarNiveles(): void {
    this.scaleFactorData = this.scaleFactorDataBackup;
    this.linearityTestData = this.linearityTestDataBackup;
    this.stabilityTestData = this.stabilityTestDataBackup;

    this.isEditingLevelsSection = false;
  }
}
