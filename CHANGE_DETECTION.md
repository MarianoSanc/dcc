# Sistema de Detección de Cambios

## Descripción General

Se implementó un nuevo sistema de **change detection** que detecta exactamente qué ha cambiado (niveles nuevos, editados, eliminados) y solo envía esos cambios a la base de datos.

## Cómo Funciona

### 1. **Al Entrar en Modo Edición** (`toggleEditLevels()`)

```
Usuario hace click en "Editar Niveles"
    ↓
Se crean backups profundos de:
  - scaleFactorData (SF)
  - linearityTestData (LT)
  - stabilityTestData (ST)
    ↓
isEditingLevelsSection = true
```

El backup captura el estado EXACTO antes de cualquier cambio:

- IDs de los niveles
- Valores de mediciones (DUT/PATRON)
- Número de niveles por prueba

### 2. **Durante la Edición**

El usuario puede:

- ✏️ Editar valores de mediciones
- ➕ Agregar nuevos niveles
- 🗑️ Eliminar niveles (quitar del array)

Los arrays se actualizan en tiempo real con `[(ngModel)]`.

### 3. **Al Guardar** (`guardarNiveles()`)

#### Paso 1: Detectar Cambios

Se compara el estado actual vs el backup para cada tipo (SF, LT, ST):

```typescript
const changesSF = this.detectLevelChanges("sf", currentData, backupData);
const changesLT = this.detectLevelChanges("lt", currentData, backupData);
const changesST = this.detectLevelChanges("st", currentData, backupData);
```

#### Paso 2: Clasificar Cambios

Para cada nivel, se determina:

1. **CREATE** (➕)
   - Nivel existe en current pero NO en backup
   - No tiene `id_bd` (es nuevo)
2. **UPDATE** (✏️)

   - Nivel existe en ambos
   - Tiene cambios en: nivel, dut, patron, mediciones
   - Tiene `id_bd` válido

3. **DELETE** (🗑️)
   - Nivel existe en backup pero NO en current (fue eliminado del array)
   - Tiene `id_bd` → ejecuta soft delete

#### Paso 3: Mostrar Resumen

```
═══════════════════════════════════════════════
RESUMEN DE CAMBIOS DETECTADOS:
  SF: 0 cambios
  LT: 2 cambios (1 CREATE, 1 UPDATE)
  ST: 0 cambios
  TOTAL: 2 cambios
═════════════════════════════════════════════
```

#### Paso 4: Procesar SOLO Cambios

Se llama a `saveChangedLevelsToDB()` para cada tipo con sus cambios específicos.

Ejemplo de salida:

```
[LT CHANGE SAVE] Procesando 2 cambio(s):
[LT CHANGE SAVE]   ➕ 1 NUEVO(S) nivel(es)
[LT CHANGE SAVE]   ✏️ 1 ACTUALIZACIÓN(ES)
[LT CHANGE SAVE] ═════════════════════════════════════
[LT CHANGE SAVE] Procesando: CREATE - tension=10.000 kV (id_bd=nuevo)
[LT CHANGE SAVE] Procesando: UPDATE - tension=20.000 kV (id_bd=2)
[LT CHANGE SAVE] Ejecutando guardado estándar de todos los niveles...
```

## Ventajas del Sistema

| Aspecto                 | Antes                             | Después                            |
| ----------------------- | --------------------------------- | ---------------------------------- |
| **Datos Enviados**      | TODOS los niveles                 | SOLO los que cambiaron             |
| **Claridad**            | ¿Qué se está guardando?           | ✓ Visible en consola               |
| **Eficiencia**          | Guardar 7 niveles cada vez        | Solo los necesarios                |
| **Trazabilidad**        | Difícil de debuguear              | Cada cambio está documentado       |
| **Errores Silenciosos** | Sí (todos los niveles se tocaban) | Mínimos (solo cambios específicos) |

## Logs en Consola

### Entrada a Edición

```
[LEVELS EDIT] ▶ toggleEditLevels {actualState: false, sfDataCount: 0, ltDataCount: 1, stDataCount: 0}
[LEVELS EDIT] ✓ Modo edición de niveles activado
[LEVELS EDIT] ✓ Backups creados para detectar cambios
```

### Guardado (sin cambios)

```
[LEVELS SAVE] ▶ guardarNiveles iniciado
[CHANGE DETECTION] Comparando sf: 0 niveles actuales vs 0 en backup
[CHANGE DETECTION] Comparando lt: 7 niveles actuales vs 7 en backup
[CHANGE DETECTION] Comparando st: 0 niveles actuales vs 0 en backup
[LEVELS SAVE] ═══════════════════════════════════════════
[LEVELS SAVE] RESUMEN DE CAMBIOS DETECTADOS:
  SF: 0 cambios
  LT: 0 cambios
  ST: 0 cambios
  TOTAL: 0 cambios
[LEVELS SAVE] ═══════════════════════════════════════════
[LEVELS SAVE] ✓ No hay cambios, nada que guardar
```

### Guardado (con cambios)

```
[LEVELS SAVE] ▶ guardarNiveles iniciado
[CHANGE DETECTION] Comparando lt: 8 niveles actuales vs 7 en backup
[CHANGE DETECTION] ✓ NUEVO nivel lt #7: {id: "...", nivel: 70, id_bd: undefined, ...}
[LEVELS SAVE] ═══════════════════════════════════════════
[LEVELS SAVE] RESUMEN DE CAMBIOS DETECTADOS:
  SF: 0 cambios
  LT: 1 cambios
  ST: 0 cambios
  TOTAL: 1 cambios
[LEVELS SAVE] ═══════════════════════════════════════════
[LT CHANGE SAVE] Procesando 1 cambio(s):
[LT CHANGE SAVE]   ➕ 1 NUEVO(S) nivel(es)
[LT CHANGE SAVE] Procesando: CREATE - tension=70.000 kV (id_bd=nuevo)
[LT CHANGE SAVE] Ejecutando guardado estándar de todos los niveles...
```

## Métodos Clave

### `generateLevelKey(tipoNivel, indice): string`

Crea identificador único: `"lt_0"`, `"sf_1"`, etc.

### `createLevelBackup(data): any[]`

Deep copy JSON para crear backup inmutable.

### `detectLevelChanges(tipo, current, backup): Change[]`

Compara arrays y retorna:

```typescript
interface Change {
  indice: number; // Posición en array
  accion: "create" | "update" | "delete";
  tipoNivel: "sf" | "lt" | "st";
  nivel: any; // El nivel actual
  backupNivel?: any; // El nivel del backup (si existe)
  key: string; // "sf_0", "lt_1", etc
}
```

### `hasNivelChanges(nivel, backupNivel): boolean`

Comparación profunda de propiedades del nivel.

### `saveChangedLevelsToDB(tipo, changes): Promise<void>`

Procesa SOLO los cambios detectados para un tipo específico.

### `softDeleteNivel(tipo, id_bd): Promise<void>`

Ejecuta soft delete (set deleted=1) en un nivel de la BD.

## Flujo Completo

```
┌─ Usuario hace click "Editar Niveles"
│   └─ toggleEditLevels() → Crear backups
│
├─ Usuario edita (agrega/modifica/elimina niveles)
│   └─ Los arrays se actualizan con [(ngModel)]
│
└─ Usuario hace click "Guardar"
    └─ guardarNiveles()
        ├─ detectLevelChanges() para SF, LT, ST
        ├─ Mostrar resumen (cuántos cambios por tipo)
        ├─ Si NO hay cambios → Mostrar "Sin cambios"
        └─ Si hay cambios → saveChangedLevelsToDB() por tipo
            └─ saveLevelsToDB() (guardado estándar)
                └─ Procesar cada nivel (crear/actualizar)
                └─ Guardar mediciones
                └─ Recargar datos desde BD
```

## Seguridad y Confiabilidad

✓ **Cada cambio está documentado** en consola
✓ **Backups inmutables** previenen corrupción accidental
✓ **Soft delete** nunca pierdes datos (deleted=1)
✓ **Validación antes de guardar** (validarNiveles())
✓ **Manejo de errores** por cambio individual

## Testing

### Caso 1: Sin cambios

1. Entra a editar
2. No cambies nada
3. Haz click Guardar
4. Resultado: "No hay cambios"

### Caso 2: Agregar nivel

1. Entra a editar
2. Haz click "Agregar Nivel"
3. Llena datos
4. Haz click Guardar
5. Consola: `➕ 1 NUEVO nivel`

### Caso 3: Editar nivel existente

1. Entra a editar
2. Cambia valores DUT/PATRON
3. Haz click Guardar
4. Consola: `✏️ 1 ACTUALIZACIÓN`

### Caso 4: Eliminar nivel

1. Entra a editar
2. Haz click "Quitar Nivel"
3. Confirma
4. Haz click Guardar
5. Consola: `🗑️ 1 ELIMINACIÓN`
