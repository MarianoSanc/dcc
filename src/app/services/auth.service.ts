import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { ApiService } from '../api/api.service';
import { UrlClass } from '../shared/models/url.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly USER_ID_STORAGE_KEY = 'espo-user-lastUserId';

  // Variable roles donde se guardan los roles que empiezan con 'PDP-'
  roles: any[] = [];

  // Registros completos de hvtest2.role_user para el usuario
  userRoles: any[] = [];

  // Lista de role_id del usuario obtenidos de hvtest2.role_user
  userRoleIds: string[] = [];

  // Roles PDP relacionados directamente con el usuario
  userPdpRoles: any[] = [];

  // Permisos cargados desde calibraciones.role_permissions
  activePermissions: any[] = [];

  private rolesSubject = new BehaviorSubject<any[]>([]);
  public roles$ = this.rolesSubject.asObservable();

  private userRoleIdsSubject = new BehaviorSubject<string[]>([]);
  public userRoleIds$ = this.userRoleIdsSubject.asObservable();

  private userPdpRolesSubject = new BehaviorSubject<any[]>([]);
  public userPdpRoles$ = this.userPdpRolesSubject.asObservable();

  private activePermissionsSubject = new BehaviorSubject<any[]>([]);
  public activePermissions$ = this.activePermissionsSubject.asObservable();

  private isLoadingPermissions: boolean = false;
  private permissionsLoaded: boolean = false;

  constructor(private apiService: ApiService) {}

  /**
   * Obtiene el ID del usuario actual desde localStorage usando la clave 'espo-user-lastUserId'.
   * Imprime el valor obtenido en la consola.
   * Si no se encuentra en localStorage, usa el parámetro 'id' de la URL como fallback (útil para pruebas/desarrollo).
   *
   * @returns ID del usuario o cadena vacía si no existe.
   */
  getUserId(): string {
    let userId = '';

    try {
      const storedId = localStorage.getItem(this.USER_ID_STORAGE_KEY);
      if (storedId) {
        userId = storedId.trim();
        // Eliminar comillas si fue guardado con formato JSON
        if (
          (userId.startsWith('"') && userId.endsWith('"')) ||
          (userId.startsWith("'") && userId.endsWith("'"))
        ) {
          userId = userId.slice(1, -1).trim();
        }
      }
    } catch (error) {
      console.error('❌ [AuthService] Error al acceder a localStorage:', error);
    }

    // Fallback a parámetro 'id' de la URL si no existe en localStorage
    if (!userId) {
      const urlParams = new URLSearchParams(window.location.search);
      userId = urlParams.get('id') || '';
    }

    // Fallback de prueba para entorno localhost si no hay storage ni query param
    if (
      !userId &&
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    ) {
      userId = '63c704bfb9c9d8482';
      console.log(
        '👤 [Auth] Modo localhost detectado sin ID; usando usuario de prueba:',
        userId,
      );
    }

    console.log('👤 [Auth] espo-user-lastUserId:', userId);
    return userId;
  }

  /**
   * Consulta en hvtest2.role todos los roles cuyo name comience con 'PDP-' y deleted = 0
   */
  getRoles(): Observable<any> {
    const payload = {
      action: 'get',
      bd: 'hvtest2',
      table: 'role',
      opts: {
        where: {
          deleted: 0,
          like: {
            name: 'PDP-%',
          },
        },
      },
    };

    return this.apiService.post(payload, UrlClass.URLNuevo);
  }

  /**
   * Consulta en hvtest2.role_user todos los registros del usuario (user_id = espo-user-lastUserId y deleted = 0)
   */
  getUserRoleUser(userId: string): Observable<any> {
    const payload = {
      action: 'get',
      bd: 'hvtest2',
      table: 'role_user',
      opts: {
        where: {
          user_id: userId,
          deleted: 0,
        },
      },
    };

    return this.apiService.post(payload, UrlClass.URLNuevo);
  }

  /**
   * Consulta los permisos en calibraciones.role_permissions
   */
  getRolePermissions(): Observable<any> {
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

    return this.apiService.post(payload, UrlClass.URLNuevo);
  }

  /**
   * Evalúa si un módulo/botón debe mostrarse según la regla estricta:
   * - Si la combinación rol-módulo tiene authorized = 1 -> true.
   * - Si tiene 0 o el registro NO existe -> false.
   */
  canShow(moduleId: string): boolean {
    if (
      !moduleId ||
      !this.userRoleIds?.length ||
      !this.activePermissions?.length
    ) {
      return false;
    }

    return this.userRoleIds.some((roleId) =>
      this.activePermissions.some(
        (p) =>
          p.role_id === roleId &&
          p.module === moduleId &&
          (Number(p.authorized) === 1 ||
            p.authorized === true ||
            p.authorized === '1'),
      ),
    );
  }

  /**
   * Nivel de autenticación:
   * 1. Trae los roles de hvtest2.role con name 'PDP-%', los guarda en la variable 'roles' y los imprime en consola.
   * 2. Trae de hvtest2.role_user los role_id del usuario (user_id = espo-user-lastUserId, deleted = 0) y los muestra en consola.
   * 3. Relaciona los roles PDP con los role_id del usuario y los muestra en consola.
   * 4. Carga los permisos activos de calibraciones.role_permissions para validación de vistas.
   */
  loadUserPermissions(force: boolean = false): void {
    if ((this.isLoadingPermissions || this.permissionsLoaded) && !force) {
      return;
    }

    this.isLoadingPermissions = true;
    const userId = this.getUserId();

    // 1. Cargar roles PDP
    this.getRoles().subscribe({
      next: (response: any) => {
        this.roles = response?.result || [];
        this.rolesSubject.next(this.roles);

        // 2. Cargar permisos de calibraciones.role_permissions
        this.getRolePermissions().subscribe({
          next: (permResponse: any) => {
            this.activePermissions = Array.isArray(permResponse?.result)
              ? permResponse.result
              : [];
            this.activePermissionsSubject.next(this.activePermissions);
          },
          error: (err: any) => {
            console.warn(
              '⚠️ No se pudieron obtener permisos de role_permissions:',
              err,
            );
          },
        });

        if (!userId) {
          console.warn(
            '⚠️ [AuthService] No se encontró user_id (espo-user-lastUserId) para consultar hvtest2.role_user.',
          );
          this.isLoadingPermissions = false;
          this.permissionsLoaded = true;
          return;
        }

        // 3. Cargar roles del usuario en hvtest2.role_user
        this.getUserRoleUser(userId).subscribe({
          next: (userRoleResponse: any) => {
            const rawResult = userRoleResponse?.result || [];
            this.userRoles = rawResult;
            this.userRoleIds = rawResult.map((item: any) => item.role_id);
            this.userRoleIdsSubject.next(this.userRoleIds);

            console.log(
              '🔑 hvtest2.role_user (role_id del usuario):',
              this.userRoleIds,
            );
            console.log(
              '📋 hvtest2.role_user (registros completos):',
              this.userRoles,
            );

            // Relación: roles de PDP asignados al usuario
            this.userPdpRoles = this.roles.filter((r: any) =>
              this.userRoleIds.includes(r.id),
            );
            this.userPdpRolesSubject.next(this.userPdpRoles);
            console.log(
              '🔗 Roles PDP relacionados al usuario:',
              this.userPdpRoles,
            );

            this.isLoadingPermissions = false;
            this.permissionsLoaded = true;
          },
          error: (error: any) => {
            console.error('❌ Error al consultar hvtest2.role_user:', error);
            this.isLoadingPermissions = false;
          },
        });
      },
      error: (error: any) => {
        console.error('❌ Error al consultar hvtest2.role:', error);
        this.isLoadingPermissions = false;
      },
    });
  }
}
