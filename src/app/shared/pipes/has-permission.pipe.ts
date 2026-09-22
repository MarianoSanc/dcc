import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'hasPermission',
  standalone: true,
  pure: false,
})
export class HasPermissionPipe implements PipeTransform {
  /**
   * Evalúa si un botón/módulo del menú debe mostrarse según los roles del usuario.
   * Regla estricta:
   * - Retorna true si al menos un rol del usuario tiene authorized === 1 en permissions.
   * - Retorna false si authorized === 0, si no existe el registro, o si no hay roles/permisos.
   */
  transform(
    moduleId: string,
    userRoleIds: string[] | null | undefined,
    permissions: Array<{ role_id: string; module: string; authorized: number | boolean | string }> | null | undefined,
  ): boolean {
    if (!moduleId || !userRoleIds?.length || !permissions?.length) {
      return false;
    }

    return userRoleIds.some((roleId) =>
      permissions.some(
        (p) =>
          p.role_id === roleId &&
          p.module === moduleId &&
          (Number(p.authorized) === 1 || p.authorized === true || p.authorized === '1'),
      ),
    );
  }
}
