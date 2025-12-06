# Resumen de Refactorización PT-23 Results Component

**Fecha**: Diciembre 5, 2025
**Cambios**: Separación de edición en dos secciones independientes

---

## Cambios Realizados

### 1. **Nuevo Estado del Componente** (`pt23-results.component.ts`)

Se agregaron nuevas variables para separar completamente la edición de configuración de la edición de niveles:

#### Sección 1: Configuración (SFx, SFref, número de pruebas)

```typescript
isEditingConfig: boolean = false;

// Variables temporales para backup durante edición
sfxTemp: number | null = null;
sfrefTemp: number | null = null;
numeroScaleFactorTemp: number = 0;
numeroLinearityTestTemp: number = 0;
numeroStabilityTestTemp: number = 0;
```

#### Sección 2: Niveles (Datos de mediciones)

```typescript
isEditingLevelsSection: boolean = false;

// Backups para cancelar ediciones de niveles
scaleFactorDataBackup: ScaleFactorData[] = [];
linearityTestDataBackup: LinearityTestData[] = [];
stabilityTestDataBackup: StabilityTestData[] = [];
```

---

### 2. **Nuevas Funciones de Configuración**

#### `toggleEditConfig()`

- Activa/desactiva modo edición de configuración
- Realiza backup de valores actuales a variables temporales
- Permite editar SFx, SFref, y número de pruebas

#### `guardarConfig()`

- Valida SFx y SFref (ambos requeridos, no pueden ser 0)
- Valida número de pruebas (0-5)
- Guarda en `dcc_pt23_config`
- Crea/elimina pruebas vacías si el número cambió
- Recarga datos después de guardar
- Muestra modal de progreso y confirmación

#### `validarConfiguracion()`

- Valida que SFx y SFref tengan valores válidos
- Valida que los números de pruebas estén en rango 0-5
- Muestra alertas específicas en caso de error

#### `cancelarConfig()`

- Descarta cambios en configuración
- Restaura valores anteriores
- Limpia variables temporales

#### `crearEliminarPruebasVacias(tipo, numNuevo, numAnterior)`

- Crea registros vacíos en BD si aumenta número de pruebas
- Soft-delete de pruebas si disminuye número
- Maneja SF, LT y ST

---

### 3. **Nuevas Funciones de Niveles**

#### `toggleEditLevels()`

- Activa/desactiva modo edición de niveles
- Hace backup profundo (JSON stringify) de todos los arrays de datos
- Permite editar todas las mediciones y niveles

#### `guardarNiveles()`

- Valida que haya al menos una medición con datos
- Calcula estadísticas para cada nivel
- Para CADA tabla de nivel:
  - Si tiene `id_bd`: UPDATE
  - Si no tiene: CREATE
- Guarda todas las mediciones asociadas
- Recarga datos después de guardar
- Muestra modales de progreso y confirmación

#### `validarNiveles()`

- Revisa que exista al menos una medición con valores válidos
- Recorre SF, LT y ST
- Muestra alerta si no hay datos

#### `cancelarNiveles()`

- Restaura valores desde backup
- Descarta todos los cambios realizados

#### `saveLevelsToDB(tipo, data)` (genérico)

- Guarda todos los niveles de un tipo (SF, LT, ST)
- Llama a `guardarNivelGenerico` para cada nivel
- Llama a `guardarMedicionesNivel` para cada set de mediciones

---

### 4. **Actualización del HTML** (`pt23-results.component.html`)

#### Sección 1: Parámetros de Referencia (Independiente)

```html
<!-- Botones de Configuración Independientes -->
<button *ngIf="!isEditingConfig" (click)="toggleEditConfig()">Editar</button>
<ng-container *ngIf="isEditingConfig">
  <button (click)="guardarConfig()">Guardar</button>
  <button (click)="cancelarConfig()">Cancelar</button>
</ng-container>

<!-- Inputs usan variables temporales cuando en modo edición -->
<input [ngModel]="isEditingConfig ? sfxTemp : sfx" (ngModelChange)="isEditingConfig && (sfxTemp = $event)" [disabled]="!isEditingConfig" />
```

#### Sección 2: Configuración de Número de Pruebas (Independiente)

- Los selectores de opciones usan `numeroScaleFactorTemp/LT/ST` cuando `isEditingConfig`
- Los selectores usan los valores principales cuando no está en edición

#### Sección 3: Datos de Niveles (Independiente)

```html
<!-- Botones de Niveles Independientes -->
<button *ngIf="!isEditingLevelsSection" (click)="toggleEditLevels()">Editar Niveles</button>
<ng-container *ngIf="isEditingLevelsSection">
  <button (click)="guardarNiveles()">Guardar Todo</button>
  <button (click)="cancelarNiveles()">Cancelar</button>
</ng-container>

<!-- Reemplazo de isEditing por isEditingLevelsSection en todas las tablas -->
[disabled]="!isEditingLevelsSection" *ngIf="isEditingLevelsSection"
```

---

## Flujo de Uso

### Escenario 1: Editar Solo Configuración

```
1. Usuario hace clic en "Editar" (sección Parámetros)
2. isEditingConfig = true, sfxTemp/sfrefTemp se cargan
3. Usuario edita SFx, SFref, número de pruebas
4. Guarda configuración
5. isEditingLevelsSection permanece false (no afectada)
```

### Escenario 2: Editar Solo Niveles

```
1. Usuario hace clic en "Editar Niveles" (sección Datos)
2. isEditingLevelsSection = true, backups se crean
3. Usuario edita mediciones y niveles
4. Guarda niveles
5. isEditingConfig permanece false (no afectada)
```

### Escenario 3: Editar Ambas (Secuencial)

```
1. Usuario edita y guarda configuración
2. Luego edita y guarda niveles
3. Cada operación es independiente
4. Los cambios se aplican sin conflictos
```

---

## Ventajas de Esta Arquitectura

✅ **Separación de Responsabilidades**: Config y Niveles son completamente independientes  
✅ **Mejor UX**: Usuario no está obligado a guardar todo junto  
✅ **Control Granular**: Cada sección valida y guarda solo lo suyo  
✅ **Fácil Recuperación**: Botón "Cancelar" restaura valores originales  
✅ **Manejo de Errores**: Error en una sección no afecta la otra  
✅ **Escalabilidad**: Fácil agregar más secciones independientes después

---

## Archivos Modificados

1. **pt23-results.component.ts**

   - Agregado nuevo estado (`isEditingConfig`, `isEditingLevelsSection`, variables temporales)
   - Agregadas 8 nuevas funciones de configuración e niveles
   - Mantiene compatibilidad con funciones existentes

2. **pt23-results.component.html**

   - Actualizada sección de parámetros con botones independientes
   - Actualizada sección de configuración de pruebas
   - Agregada sección de botones de niveles
   - Reemplazo de `isEditing` por `isEditingLevelsSection` en tablas
   - Sin errores de compilación

3. **DATABASE.md** (creado)

   - Documentación completa de tablas PT-23

4. **ARQUITECTURA_EDICION.md** (creado)
   - Documentación de la arquitectura de edición

---

## Próximos Pasos Opcionales

1. Mejorar CSS de botones y secciones
2. Agregar animaciones de transición
3. Implementar validaciones en tiempo real
4. Agregar tooltips más descriptivos
5. Crear tests unitarios para funciones de validación

---

## Notas Importantes

- **Variables Temporales**: Se usan para hacer backup sin modificar los datos principales hasta que se guarde
- **Backups Profundos**: Los arrays de niveles se copian con `JSON.stringify/parse` para evitar referencias
- **Flujo de Guardado**: Cada sección ejecuta su propio `Promise.all` para operaciones paralelas
- **Modales de Progreso**: Se muestran con `Swal.fire` para feedback visual
- **Recargas Automáticas**: Después de guardar, se recarga desde BD para sincronizar
