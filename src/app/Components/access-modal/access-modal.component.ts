import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

export interface MenuModule {
  id: string;
  label: string;
}

@Component({
  selector: 'app-access-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './access-modal.component.html',
  styleUrls: ['./access-modal.component.css'],
})
export class AccessModalComponent implements OnInit, OnChanges {
  @Input() isOpen: boolean = false;
  @Input() rawRoles: any[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  sortedRoles: any[] = [];

  // Los 6 módulos/botones del menú
  readonly modules: MenuModule[] = [
    { id: 'btn_create_dcc', label: 'Crear DCC' },
    { id: 'btn_create_ied', label: 'Crear IED' },
    { id: 'btn_load_dcc', label: 'Cargar DCC/DIE' },
    { id: 'btn_load_xml', label: 'Cargar XML' },
    { id: 'btn_history', label: 'Histórico de servicios' },
    { id: 'btn_access', label: 'Accesos' },
  ];

  // Matriz de permisos en memoria: permissionsMatrix[role_id][module_id] = boolean
  permissionsMatrix: Record<string, Record<string, boolean>> = {};

  // Mapa de permisos ya existentes en base de datos: key = `${role_id}_${module}`
  private existingPermissionsMap: Map<string, any> = new Map();

  loading: boolean = false;
  saving: boolean = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.authService.roles$.subscribe((roles: any[]) => {
      if (
        roles?.length &&
        (!this.sortedRoles?.length || !this.rawRoles?.length)
      ) {
        this.initRoles(roles);
      }
    });

    this.initRoles();

    if (!this.sortedRoles?.length) {
      this.authService.getRoles().subscribe({
        next: (res: any) => {
          const roles = res?.result || [];
          this.initRoles(roles);
        },
      });
    }

    if (this.isOpen) {
      this.loadCurrentPermissions();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rawRoles'] && this.rawRoles?.length) {
      this.initRoles();
    }
    if (changes['isOpen'] && this.isOpen) {
      this.initRoles();
      this.loadCurrentPermissions();
    }
  }

  /**
   * Ordena los roles alfanuméricamente según la propiedad pdp (o name)
   * del PDP-01 al PDP-XX.
   */
  private initRoles(incomingRoles?: any[]): void {
    const source =
      (incomingRoles?.length
        ? incomingRoles
        : this.rawRoles?.length
          ? this.rawRoles
          : this.authService.roles) || [];
    const rolesList = source.map((r: any) => ({
      ...r,
      pdp: r.pdp || r.name || '',
    }));

    this.sortedRoles = [...rolesList].sort((a, b) =>
      (a.pdp || '').localeCompare(b.pdp || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );

    // Inicializar matriz con false por defecto
    this.sortedRoles.forEach((role) => {
      if (!this.permissionsMatrix[role.id]) {
        this.permissionsMatrix[role.id] = {};
      }
      this.modules.forEach((mod) => {
        if (this.permissionsMatrix[role.id][mod.id] === undefined) {
          this.permissionsMatrix[role.id][mod.id] = false;
        }
      });
    });
  }

  /**
   * Carga los permisos actuales desde calibraciones.role_permissions
   */
  loadCurrentPermissions(): void {
    this.loading = true;
    const payload = {
      action: 'get',
      bd: 'calibraciones',
      table: 'role_permissions',
      opts: {
        where: {
          deleted: 0,
        },
      },
    };

    this.apiService.post(payload, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        const rows: any[] = Array.isArray(response?.result)
          ? response.result
          : [];
        this.existingPermissionsMap.clear();

        rows.forEach((row: any) => {
          const key = `${row.role_id}_${row.module}`;
          this.existingPermissionsMap.set(key, row);

          if (!this.permissionsMatrix[row.role_id]) {
            this.permissionsMatrix[row.role_id] = {};
          }
          this.permissionsMatrix[row.role_id][row.module] =
            Number(row.authorized) === 1 ||
            row.authorized === true ||
            row.authorized === '1';
        });

        this.loading = false;
      },
      error: (error: any) => {
        this.loading = false;
      },
    });
  }

  /**
   * Alterna el valor del permiso para una celda
   */
  togglePermission(roleId: string, moduleId: string): void {
    if (!this.permissionsMatrix[roleId]) {
      this.permissionsMatrix[roleId] = {};
    }
    this.permissionsMatrix[roleId][moduleId] =
      !this.permissionsMatrix[roleId][moduleId];
  }

  /**
   * Construye el payload idóneo para el Upsert (INSERT ON DUPLICATE KEY UPDATE)
   */
  buildUpsertPayload(): any {
    const records: Array<{
      role_id: string;
      module: string;
      authorized: number;
    }> = [];

    this.sortedRoles.forEach((role) => {
      this.modules.forEach((mod) => {
        records.push({
          role_id: role.id,
          module: mod.id,
          authorized: this.permissionsMatrix[role.id]?.[mod.id] ? 1 : 0,
        });
      });
    });

    return {
      action: 'upsert',
      bd: 'calibraciones',
      table: 'role_permissions',
      primaryKeys: ['role_id', 'module'],
      updateFields: ['authorized'],
      data: records,
    };
  }

  /**
   * Guarda los permisos. Si el endpoint no soporta 'upsert' directamente,
   * ejecuta la validación celda por celda (UPDATE si existe, INSERT si no).
   */
  async savePermissions(): Promise<void> {
    this.saving = true;
    const upsertPayload = this.buildUpsertPayload();

    // Intentar primero con el endpoint de upsert directo
    this.apiService.post(upsertPayload, UrlClass.URLNuevo).subscribe({
      next: (response: any) => {
        if (
          response &&
          response.result !== false &&
          !String(response).includes('Error')
        ) {
          this.onSaveSuccess();
        } else {
          // Fallback a operaciones atómicas get/create/update por celda
          this.executeCellByCellUpsert(upsertPayload.data);
        }
      },
      error: () => {
        // Fallback a operaciones atómicas
        this.executeCellByCellUpsert(upsertPayload.data);
      },
    });
  }

  /**
   * Lógica celda por celda:
   * Si la combinación (role_id + module) existe -> UPDATE authorized
   * Si no existe -> INSERT (action: 'create')
   */
  private async executeCellByCellUpsert(
    records: Array<{ role_id: string; module: string; authorized: number }>,
  ): Promise<void> {
    try {
      const requests = records.map((record) => {
        const key = `${record.role_id}_${record.module}`;
        const existing = this.existingPermissionsMap.get(key);

        if (existing) {
          // Ya existe: UPDATE únicamente authorized
          return {
            action: 'update',
            bd: 'calibraciones',
            table: 'role_permissions',
            opts: {
              where: {
                role_id: record.role_id,
                module: record.module,
              },
              attributes: {
                authorized: record.authorized,
              },
            },
          };
        } else {
          // No existe: INSERT
          return {
            action: 'create',
            bd: 'calibraciones',
            table: 'role_permissions',
            opts: {
              attributes: {
                role_id: record.role_id,
                module: record.module,
                authorized: record.authorized,
              },
            },
          };
        }
      });

      // Ejecutar secuencialmente o en paralelo
      await Promise.all(
        requests.map((req) =>
          this.apiService.post(req, UrlClass.URLNuevo).toPromise(),
        ),
      );

      this.onSaveSuccess();
    } catch (error) {
      console.error('❌ Error al guardar permisos por celda:', error);
      this.saving = false;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un problema al guardar los permisos.',
      });
    }
  }

  private onSaveSuccess(): void {
    this.saving = false;
    Swal.fire({
      icon: 'success',
      title: 'Permisos guardados',
      text: 'La matriz de accesos se actualizó correctamente.',
      timer: 1500,
      showConfirmButton: false,
    });
    this.saved.emit();
    this.onClose();
  }

  onClose(): void {
    this.close.emit();
  }
}
