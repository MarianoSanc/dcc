import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../../services/dcc-data.service';
import { Subscription, lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { Pt23XmlGeneratorService } from '../../../services/pt23-xml-generator.service';

interface NivelTensionData {
  id?: string;
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

@Component({
  selector: 'app-pt23-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pt23-results.component.html',
  styleUrls: ['./pt23-results.component.css'],
})
export class Pt23ResultsComponent implements OnInit, OnDestroy {
  filas = Array(10).fill(0);

  // Cambiar estructura para múltiples Scale Factors
  scaleFactorData: ScaleFactorData[] = [];

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
            this.loadConfigFromDB();
            this.loadScaleFactorFromDB();
          } else {
            if (this.scaleFactorData.length === 0) {
              this.initializeScaleFactorData();
            }
          }
        }
      })
    );
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

  agregarNivel(sfIndex: number) {
    this.scaleFactorData[sfIndex].tablas.push(this.createEmptyTable());
  }

  eliminarNivel(sfIndex: number, nivelIndex: number) {
    const sf = this.scaleFactorData[sfIndex];

    if (sf.tablas.length <= 1) {
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
      text: 'Se eliminará este nivel de tensión y sus mediciones.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        sf.tablas.splice(nivelIndex, 1);

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

  onNumeroLinearityTestChange() {}

  onNumeroStabilityTestChange() {}

  private loadConfigFromDB() {
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
          this.numeroScaleFactor = config.numero_scale_factor || 1;
          this.numeroLinearityTest = config.numero_linearity_test || 0;
          this.numeroStabilityTest = config.numero_stability_test || 0;
          this.sfx = config.sfx || null;
          this.sfref = config.sfref || null;

          // Limpiar caches cuando cambian SFx o SFref
          this.clearCalculationCaches();

          // NUEVO: Verificar si se deben auto-generar resultados
          this.checkAndAutoGenerateResults();
        } else {
          this.numeroScaleFactor = 1;
          this.numeroLinearityTest = 0;
          this.numeroStabilityTest = 0;
          this.sfx = null;
          this.sfref = null;
        }
      },
      error: (error) => {
        this.numeroScaleFactor = 1;
        this.numeroLinearityTest = 0;
        this.numeroStabilityTest = 0;
        this.sfx = null;
        this.sfref = null;
      },
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
            // UPDATE
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
            // CREATE
            query = {
              action: 'create',
              bd: this.database,
              table: 'dcc_pt23_config',
              opts: { attributes },
            };
          }

          this.dccDataService.post(query).subscribe({
            next: () => {
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
    this.loadConfigFromDB();
  }

  private saveScaleFactorToDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const promises: Promise<any>[] = [];

      // Procesar cada Scale Factor
      this.scaleFactorData.forEach((sf) => {
        sf.tablas.forEach((tabla) => {
          // Calcular promedios y estadísticas
          const estadisticas = this.calcularEstadisticas(
            tabla.dut,
            tabla.patron
          );

          // 1. Guardar/actualizar nivel y obtener el ID
          const nivelPromise = this.guardarNivel(
            sf.prueba,
            tabla.nivel || 0,
            estadisticas
          ).then((nivelId) => {
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
    estadisticas: any
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const checkQuery = {
        action: 'get',
        bd: this.database,
        table: 'dcc_pt23_scalefactor_nivel',
        opts: {
          where: {
            id_dcc: this.dccId,
            prueba: prueba,
            nivel_tension: nivelTension,
          },
        },
      };

      this.dccDataService.post(checkQuery).subscribe({
        next: (response: any) => {
          const existing = response?.result?.[0];

          const attributes = {
            id_dcc: this.dccId,
            prueba: prueba,
            nivel_tension: nivelTension,
            promedio_dut: estadisticas.promedio_dut,
            promedio_patron: estadisticas.promedio_patron,
            desviacion_std_dut: estadisticas.desviacion_std_dut,
            desviacion_std_patron: estadisticas.desviacion_std_patron,
            num_mediciones: estadisticas.num_mediciones,
          };

          if (existing) {
            const updateQuery = {
              action: 'update',
              bd: this.database,
              table: 'dcc_pt23_scalefactor_nivel',
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
          } else {
            const createQuery = {
              action: 'create',
              bd: this.database,
              table: 'dcc_pt23_scalefactor_nivel',
              opts: { attributes },
            };

            this.dccDataService.post(createQuery).subscribe({
              next: () => {
                setTimeout(() => {
                  const findQuery = {
                    action: 'get',
                    bd: this.database,
                    table: 'dcc_pt23_scalefactor_nivel',
                    opts: {
                      where: {
                        id_dcc: this.dccId,
                        prueba: prueba,
                        nivel_tension: nivelTension,
                      },
                    },
                  };

                  this.dccDataService.post(findQuery).subscribe({
                    next: (findResponse: any) => {
                      const found = findResponse?.result?.[0];
                      if (found?.id) {
                        resolve(found.id);
                      } else {
                        reject(new Error('Could not get nivel ID'));
                      }
                    },
                    error: (err) => {
                      reject(err);
                    },
                  });
                }, 500);
              },
              error: (err) => {
                reject(err);
              },
            });
          }
        },
        error: (err) => {
          reject(err);
        },
      });
    });
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

    // Soft delete solo para mediciones del nivel y prueba actual
    const updateQuery = {
      action: 'update',
      bd: this.database,
      table: 'dcc_pt23_scalefactor_medicion',
      opts: {
        attributes: { deleted: 1 },
        where: { id_nivel: idNivel, prueba: prueba },
      },
    };

    // Try to soft delete existing measurements solo de este nivel y prueba
    try {
      await lastValueFrom(this.dccDataService.post(updateQuery));
    } catch (err) {}

    // Insert new measurements con id_dcc, prueba y deleted: 0
    await this.insertarMediciones(idNivel, dut, patron);
  }

  private insertarMediciones(
    idNivel: number,
    dut: (number | null)[],
    patron: (number | null)[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 10; i++) {
        if (dut[i] !== null || patron[i] !== null) {
          const createQuery = {
            action: 'create',
            bd: this.database,
            table: 'dcc_pt23_scalefactor_medicion',
            opts: {
              attributes: {
                id_nivel: idNivel,
                numero_medicion: i + 1,
                valor_dut: dut[i],
                valor_patron: patron[i],
              },
            },
          };

          promises.push(
            this.dccDataService
              .post(createQuery)
              .toPromise()
              .then(() => {})
              .catch((error) => {
                throw error;
              })
          );
        }
      }

      if (promises.length === 0) {
        resolve();
        return;
      }

      Promise.all(promises)
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private loadScaleFactorFromDB() {
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
          console.log('Niveles crudos de la BD:', niveles);
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

            console.log('Niveles agrupados por prueba:', groupedByPrueba);

            this.scaleFactorData = Object.keys(groupedByPrueba)
              .map(Number)
              .sort((a, b) => a - b)
              .map((prueba) => ({
                prueba,
                tablas: groupedByPrueba[prueba],
              }));

            console.log('scaleFactorData final:', this.scaleFactorData);

            // Limpiar caches después de cargar datos
            this.clearCalculationCaches();

            // NUEVO: Verificar si se deben auto-generar resultados
            this.checkAndAutoGenerateResults();
          });
        } else {
          this.initializeScaleFactorData();
        }
      },
      error: () => {
        this.initializeScaleFactorData();
      },
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
      console.log(
        'Query para cargar mediciones del nivel',
        idNivel,
        ':',
        query
      );

      this.dccDataService.post(query).subscribe({
        next: (response: any) => {
          console.log('Mediciones crudas para nivel', idNivel, ':', response);
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
    sfIndex: number,
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

      // Aplicar valores
      const tabla = this.scaleFactorData[sfIndex].tablas[tablaIndex];
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

  limpiarColumna(sfIndex: number, tablaIndex: number, tipo: 'dut' | 'patron') {
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
        const tabla = this.scaleFactorData[sfIndex].tablas[tablaIndex];
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
          this.sfx!,
          this.sfref!
        );
      console.log('AUTO-GENERATED PT-23 Results:', generatedResults);
      console.log('Number of results generated:', generatedResults.length);
      this.dccDataService.updatePT23Results(generatedResults);

      // NO guardar en BD automáticamente - solo actualizar en memoria
    } catch (error) {
      console.error('Error auto-generating results:', error);
      // Silencioso en auto-generación
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
      // Generar resultados
      const generatedResults =
        this.pt23XmlGenerator.generateResultsForComponent(
          this.scaleFactorData,
          this.sfx,
          this.sfref
        );

      console.log('MANUAL PT-23 Results Generated:', generatedResults);
      console.log('Number of results generated:', generatedResults.length);
      console.log('Scale Factor Data used:', this.scaleFactorData);

      // Actualizar los resultados en el servicio DCC
      this.dccDataService.updatePT23Results(generatedResults);

      // NUEVO: Guardar automáticamente en BD
      this.saveResultsToDB(generatedResults);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al generar los resultados.',
      });
    }
  }

  /**
   * NUEVO: Guardar resultados en BD con verificación de existencia
   */
  private saveResultsToDB(results: any[]) {
    const dccId = this.dccId;
    if (!dccId) {
      console.error('No dccId available for saving results');
      return;
    }

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

        console.log('💾 Saving', results.length, 'results to DB');

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
          // Guardado especial para hv_scaleFactorMean y hv_linearity
          else if (
            result.refType === 'hv_scaleFactorMean' ||
            result.refType === 'hv_linearity'
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
            (r: any) => r.name === result.name && r.ref_type === result.refType
          );

          if (existingResult) {
            console.log(`  🔄 Updating: ${result.name}`);
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
            console.log(`  ➕ Creating: ${result.name}`);
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
            console.log('✅ All PT-23 results saved to DB successfully');
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
          })
          .catch((error) => {
            console.error('❌ Error saving results to DB:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error al guardar',
              text: 'Los resultados se generaron pero hubo un error al guardarlos en la base de datos.',
            });
          });
      },
      error: (error) => {
        console.error('❌ Error checking existing results:', error);
      },
    });
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
}
