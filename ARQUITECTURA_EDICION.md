# Arquitectura de Edición PT-23 - Refactorización

## Flujo General del Componente

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENTE PT-23 RESULTS                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ ESTADO GENERAL   │
                    │ isEditingConfig: │ ← Control maestro
                    │ isEditingLevels: │
                    └──────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌─────────────────────────┐            ┌──────────────────────────┐
│  SECCIÓN 1: CONFIG      │            │  SECCIÓN 2: NIVELES      │
│                         │            │                          │
│ • Referencia Params     │            │ • SF Tabla Niveles       │
│   - SFx (requerido)     │            │ • LT Tabla Niveles       │
│   - SFref (requerido)   │            │ • ST Tabla Niveles       │
│                         │            │                          │
│ • Número de Pruebas     │            │ CADA TABLA CONTIENE:     │
│   - SF (0-5)            │            │ • Nivel Tensión          │
│   - LT (0-5)            │            │ • Mediciones (n filas)   │
│   - ST (0-5)            │            │ • Estadísticas           │
│                         │            │                          │
│ [Editar]                │            │ [Editar] [Guardar] [Cancelar]
│ [Guardar] [Cancelar]    │            │                          │
└─────────────────────────┘            └──────────────────────────┘
        │                                      │
        ▼                                      ▼
    ON SAVE:                              ON SAVE:
    1. Validar SFx, SFref                  1. Validar niveles con datos
    2. Crear/eliminar pruebas              2. Guardar niveles
    3. Guardar en dcc_pt23_config          3. Guardar mediciones
    4. Recargar interface                  4. Recalcular estadísticas
```

---

## Sección 1: Configuración General

### Estado

```typescript
isEditingConfig: boolean = false;
sfxValue: number | null = null;
sfrefValue: number | null = null;
numeroScaleFactor: number = 0;
numeroLinearityTest: number = 0;
numeroStabilityTest: number = 0;
```

### Validaciones

- ✅ SFx es requerido (no null, no 0)
- ✅ SFref es requerido (no null, no 0)
- ✅ Números de pruebas entre 0 y 5

### Botones

- **[Editar]**: Activa modo edición, copia valores actuales a variables temporales
- **[Guardar]**:
  1. Valida SFx y SFref
  2. Llama `saveConfigToDB()`
  3. Si número de pruebas cambió → crear/eliminar pruebas vacías en BD
  4. Desactiva modo edición, recarga datos
- **[Cancelar]**: Descarta cambios, restaura valores anteriores

### Acciones en BD

- **dcc_pt23_config**: CREATE/UPDATE con (SFx, SFref, numero_sf, numero_lt, numero_st)
- **dcc*pt23*\*\_nivel**: CREATE registros vacíos si aumenta número de pruebas
- **dcc*pt23*\*\_nivel**: Soft DELETE (deleted=1) si disminuye número de pruebas

### Ejemplo

```
Usuario cambia:
- SFx: 120 → 150
- SFref: 100 → 100
- SF Pruebas: 1 → 3 (crea 2 pruebas vacías)
- LT Pruebas: 2 → 1 (soft delete 1 prueba vacía)

Resultado:
- dcc_pt23_config UPDATE
- dcc_pt23_scalefactor_nivel: CREATE 2 nuevos (prueba=2, prueba=3)
- dcc_pt23_linearity_nivel: DELETE 1 (prueba=2, deleted=1)
```

---

## Sección 2: Datos de Niveles (INDEPENDIENTE)

### Estado por Prueba

```typescript
// Para cada tipo (SF, LT, ST)
scaleFactorData: Array<{
  prueba: number;
  tablas: Array<{
    id_bd: number; // ID en BD
    id: string; // ID local (UUID)
    nivel: number; // nivel_tension
    isEditing: boolean; // Modo edición de esta tabla

    // Mediciones
    dut: number[]; // valores DUT
    patron: number[]; // valores patrón
    num_mediciones: number; // cantidad

    // Estadísticas (calculadas)
    promedio_dut: number;
    promedio_patron: number;
    desviacion_std_dut: number;
    desviacion_std_patron: number;
  }>;
}>;

isEditingLevelsSection: boolean = false; // Control INDEPENDIENTE
```

### Validaciones (Por Tabla)

- ✅ Al menos una medición debe tener valores (DUT o patrón)
- ✅ Número de niveles coincide con configuración
- ✅ No hay duplicados de nivel_tension dentro de la misma prueba

### Botones (INDEPENDIENTES)

- **[Editar]** (Sección de Niveles):

  - Habilita todas las tablas
  - Copia datos actuales (backup local)
  - Activa modo edición: `isEditingLevelsSection = true`

- **[Guardar Todo]** (Sección de Niveles):

  1. Valida cada tabla (al menos 1 valor)
  2. Calcula estadísticas
  3. Para CADA tabla de nivel:
     - Si `id_bd` existe → UPDATE
     - Si no existe → CREATE (guardar id_bd)
  4. Para CADA medición:
     - Si existe → UPDATE
     - Si no existe → CREATE
  5. Recalcula estadísticas globales
  6. Desactiva modo edición

- **[Cancelar]** (Sección de Niveles):
  - Restaura datos del backup local
  - Desactiva modo edición

### Acciones en BD (Por Tabla de Nivel)

```typescript
// CREAR Nivel (si es nuevo)
INSERT INTO dcc_pt23_scalefactor_nivel (
  id_dcc, prueba, nivel_tension,
  promedio_dut, promedio_patron,
  desviacion_std_dut, desviacion_std_patron,
  num_mediciones
)

// ACTUALIZAR Nivel (si ya existe)
UPDATE dcc_pt23_scalefactor_nivel
SET nivel_tension = ?, promedio_dut = ?, ...
WHERE id = ? AND id_dcc = ?

// CREAR Mediciones
INSERT INTO dcc_pt23_scalefactor_medicion (
  id_nivel, numero_medicion, valor_dut, valor_patron
)

// ACTUALIZAR Mediciones
UPDATE dcc_pt23_scalefactor_medicion
SET valor_dut = ?, valor_patron = ?
WHERE id = ? AND id_nivel = ?
```

---

## Interacción Entre Secciones

### Caso 1: Aumentar Número de Pruebas

```
SECCIÓN 1:
1. Usuario cambia SF Pruebas de 1 → 2
2. Guarda configuración
3. Se crean 2 "pruebas" vacías en BD (prueba=1, prueba=2)

SECCIÓN 2:
4. Se cargan automáticamente 2 filas en la tabla
5. Usuario puede ingresar datos en la prueba 2
6. Guarda datos de nivel → CREATE/UPDATE mediciones
```

### Caso 2: Disminuir Número de Pruebas

```
SECCIÓN 1:
1. Usuario cambia SF Pruebas de 2 → 1
2. Guarda configuración
3. Soft DELETE prueba 2 en BD (deleted=1)

SECCIÓN 2:
4. Se recarga, ya solo aparece 1 fila
5. Datos de prueba 2 no se pierden (deleted=1 en BD)
```

### Caso 3: Editar Nivel Tensión

```
SECCIÓN 2:
1. Usuario edita nivel_tension de 100 → 150
2. Tabla se mantiene en modo edición
3. Usuario guarda

GUARDADO:
1. Busca registro por id_bd (NO por criterios)
2. UPDATE nivel_tension = 150
3. Se permiten cambios sin crear duplicados
```

---

## Separación de Responsabilidades

### Funciones a REFACTORIZAR

#### Configuración

```typescript
// SECCIÓN 1
toggleEditConfig(): void
guardarConfig(): Promise
cancelarConfig(): void
validarConfiguracion(): boolean

// Métodos de soporte
crearPruebasVacias(tipo: 'sf'|'lt'|'st', cantidad: number): Promise
eliminarPruebasVacias(tipo: 'sf'|'lt'|'st', cantidad: number): Promise
```

#### Niveles

```typescript
// SECCIÓN 2
toggleEditLevels(): void
guardarNiveles(): Promise // NUEVO: Guardar TODOS los niveles a la vez
cancelarNiveles(): void
validarNiveles(): boolean

// Métodos de soporte (existentes, con pequeñas modificaciones)
guardarNivelGenerico(tipo, prueba, nivelTension, stats, idBd): Promise
guardarMedicionesNivel(idNivel, mediciones): Promise
calcularEstadisticas(valores_dut[], valores_patron[]): object
```

---

## Cambios en HTML

### Sección 1: Configuración

```html
<!-- Modo lectura -->
<div *ngIf="!isEditingConfig">
  <p>SFx: {{ sfx }}</p>
  <p>SFref: {{ sfref }}</p>
  <button (click)="toggleEditConfig()">Editar</button>
</div>

<!-- Modo edición -->
<div *ngIf="isEditingConfig">
  <input [(ngModel)]="sfxTemp" placeholder="SFx" />
  <input [(ngModel)]="sfrefTemp" placeholder="SFref" />
  <input [(ngModel)]="numeroScaleFactorTemp" type="number" min="0" max="5" />
  <input [(ngModel)]="numeroLinearityTestTemp" type="number" min="0" max="5" />
  <input [(ngModel)]="numeroStabilityTestTemp" type="number" min="0" max="5" />

  <button (click)="guardarConfig()">Guardar</button>
  <button (click)="cancelarConfig()">Cancelar</button>
</div>
```

### Sección 2: Niveles

```html
<!-- BOTONES INDEPENDIENTES -->
<div class="niveles-section">
  <div class="buttons-header">
    <!-- Modo lectura -->
    <button *ngIf="!isEditingLevelsSection" (click)="toggleEditLevels()">Editar Niveles</button>

    <!-- Modo edición -->
    <div *ngIf="isEditingLevelsSection">
      <button (click)="guardarNiveles()">Guardar Todo</button>
      <button (click)="cancelarNiveles()">Cancelar</button>
    </div>
  </div>

  <!-- TABLAS (cada una con sus propias filas) -->
  <div *ngFor="let item of scaleFactorData">
    <h4>Prueba SF #{{ item.prueba }}</h4>
    <table>
      <tbody>
        <tr *ngFor="let tabla of item.tablas; let i = index">
          <td>
            <input [(ngModel)]="tabla.nivel" [disabled]="!isEditingLevelsSection" placeholder="Nivel Tensión" />
          </td>
          <!-- Filas de mediciones -->
          <ng-container *ngFor="let j of [0,1,2,3,4]">
            <td>
              <input [(ngModel)]="tabla.dut[j]" [disabled]="!isEditingLevelsSection" placeholder="DUT" />
            </td>
            <td>
              <input [(ngModel)]="tabla.patron[j]" [disabled]="!isEditingLevelsSection" placeholder="Patrón" />
            </td>
          </ng-container>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## Flujo de Guardado Completo

### Guardado de Configuración

```
guardarConfig()
├─ Validar SFx, SFref
├─ saveConfigToDB()
│  └─ INSERT/UPDATE dcc_pt23_config
├─ SI número SF cambió
│  ├─ crearPruebasVacias() o eliminarPruebasVacias()
│  └─ INSERT/UPDATE dcc_pt23_scalefactor_nivel (vacíos)
├─ SI número LT cambió
│  ├─ crearPruebasVacias() o eliminarPruebasVacias()
│  └─ INSERT/UPDATE dcc_pt23_linearity_nivel (vacíos)
├─ SI número ST cambió
│  ├─ crearPruebasVacias() o eliminarPruebasVacias()
│  └─ INSERT/UPDATE dcc_pt23_stability_nivel (vacíos)
├─ Recargar loadScaleFactorFromDB(), etc.
└─ isEditingConfig = false
```

### Guardado de Niveles (NUEVO)

```
guardarNiveles()
├─ Validar cada tabla (al menos 1 valor)
├─ Para CADA tabla en scaleFactorData:
│  ├─ Calcular estadísticas
│  ├─ guardarNivelGenerico(tabla.id_bd) → UPDATE o CREATE
│  ├─ guardarMedicionesNivel(nivelId, tabla.dut, tabla.patron)
│  └─ Guardar id_bd devuelto
├─ Lo mismo para linearityTestData
├─ Lo mismo para stabilityTestData
└─ isEditingLevelsSection = false
```

---

## Estructura de Datos Propuesta

```typescript
interface NivelTensionData {
  id_bd?: number; // ID de BD (para UPDATE)
  id: string; // ID local único
  nivel: number; // nivel_tension

  // Mediciones crudas
  dut: number[];
  patron: number[];
  num_mediciones: number;

  // Estadísticas calculadas
  promedio_dut: number | null;
  promedio_patron: number | null;
  desviacion_std_dut: number | null;
  desviacion_std_patron: number | null;
}

interface PruebaData {
  prueba: number;
  tablas: NivelTensionData[];
}
```

---

## Ventajas de Esta Arquitectura

1. ✅ **Separación clara**: Config y Niveles son independientes
2. ✅ **Mejor UX**: No obligas al usuario a guardar todo junto
3. ✅ **Control granular**: Cada sección tiene su propio estado
4. ✅ **Reuso de código**: Métodos genéricos para SF, LT, ST
5. ✅ **Manejo de errores**: Errores en una sección no afectan la otra
6. ✅ **Validaciones específicas**: Cada sección valida lo suyo
7. ✅ **Fácil de debuggear**: Logs claros por sección

---

## Próximos Pasos

1. Refactorizar estado del componente (separar config y niveles)
2. Crear funciones independientes para cada sección
3. Actualizar HTML con botones independientes
4. Implementar validaciones granulares
5. Agregar logs detallados por sección
6. Probar guardado de config sin afectar niveles
7. Probar guardado de niveles sin afectar config
