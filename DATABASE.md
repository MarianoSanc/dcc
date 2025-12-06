# Estructura de Base de Datos

Este documento describe las tablas de la base de datos utilizadas en el proyecto DCC, sus campos y relaciones.

---

## Tablas PT-23

### 1. `dcc_pt23_config`

**Descripción**: Almacena la configuración general de PT-23 para cada DCC.

**Campos**:

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT): Identificador único del registro de configuración
- `id_dcc` (INT, NOT NULL): ID del DCC asociado (foreign key)
- `numero_scale_factor` (INT): Cantidad de pruebas de Scale Factor configuradas
- `numero_linearity_test` (INT): Cantidad de pruebas de Linearity Test configuradas
- `numero_stability_test` (INT): Cantidad de pruebas de Stability Test configuradas
- `sfx` (DECIMAL): Valor de SFx (Scale Factor x)
- `sfref` (DECIMAL): Valor de SFref (Scale Factor referencia)
- `deleted` (TINYINT, DEFAULT 0): Marca de borrado lógico (0 = activo, 1 = eliminado)

**Relaciones**:

- Uno a uno con el DCC principal (tabla `dcc`)
- Uno a muchos con `dcc_pt23_scalefactor_nivel`, `dcc_pt23_linearity_nivel`, `dcc_pt23_stability_nivel`

**Uso**:

- Se crea/actualiza cuando el usuario guarda los valores de SFx, SFref y las cantidades de pruebas
- Se consulta al cargar un DCC existente para mostrar la configuración

---

### 2. `dcc_pt23_scalefactor_nivel`

**Descripción**: Almacena los niveles de tensión y estadísticas para cada prueba de Scale Factor.

**Campos**:

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT): Identificador único del nivel
- `id_dcc` (INT, NOT NULL): ID del DCC asociado
- `prueba` (INT, NOT NULL): Número de la prueba de Scale Factor (1, 2, 3, etc.)
- `nivel_tension` (DECIMAL, NOT NULL): Valor del nivel de tensión (ej: 100, 200, 300)
- `promedio_dut` (DECIMAL): Promedio de las mediciones del DUT (Device Under Test)
- `promedio_patron` (DECIMAL): Promedio de las mediciones del patrón
- `desviacion_std_dut` (DECIMAL): Desviación estándar del DUT
- `desviacion_std_patron` (DECIMAL): Desviación estándar del patrón
- `num_mediciones` (INT): Cantidad de mediciones realizadas
- `deleted` (TINYINT, DEFAULT 0): Marca de borrado lógico

**Relaciones**:

- Muchos a uno con `dcc_pt23_config` (via `id_dcc`)
- Uno a muchos con `dcc_pt23_scalefactor_medicion`

**Claves únicas**:

- Combinación (`id_dcc`, `prueba`, `nivel_tension`) debe ser única por registro activo

**Uso**:

- Se crea un registro por cada nivel de tensión en cada prueba de SF
- Al editar el `nivel_tension`, se busca por `id` (no por criterios) para evitar duplicados
- Se calcula automáticamente a partir de las mediciones ingresadas

---

### 3. `dcc_pt23_scalefactor_medicion`

**Descripción**: Almacena cada medición individual de DUT y patrón para un nivel de Scale Factor.

**Campos**:

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT): Identificador único de la medición
- `id_nivel` (INT, NOT NULL): ID del nivel al que pertenece (foreign key a `dcc_pt23_scalefactor_nivel`)
- `numero_medicion` (INT, NOT NULL): Número secuencial de la medición (1, 2, 3, ...)
- `valor_dut` (DECIMAL): Valor medido del DUT
- `valor_patron` (DECIMAL): Valor medido del patrón
- `deleted` (TINYINT, DEFAULT 0): Marca de borrado lógico

**Relaciones**:

- Muchos a uno con `dcc_pt23_scalefactor_nivel` (via `id_nivel`)

**Claves únicas**:

- Combinación (`id_nivel`, `numero_medicion`) debe ser única

**Uso**:

- Se crean/actualizan cuando el usuario ingresa valores en las columnas DUT/Patrón
- Se consultan para calcular estadísticas (promedio, desviación estándar)
- Se eliminan (soft delete) cuando se reduce el número de niveles o se borra un nivel

---

### 4. `dcc_pt23_linearity_nivel`

**Descripción**: Almacena los niveles de tensión y estadísticas para cada prueba de Linearity Test.

**Campos**: (idénticos a `dcc_pt23_scalefactor_nivel`)

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `id_dcc` (INT, NOT NULL)
- `prueba` (INT, NOT NULL): Número de la prueba de Linearity Test
- `nivel_tension` (DECIMAL, NOT NULL)
- `promedio_dut` (DECIMAL)
- `promedio_patron` (DECIMAL)
- `desviacion_std_dut` (DECIMAL)
- `desviacion_std_patron` (DECIMAL)
- `num_mediciones` (INT)
- `deleted` (TINYINT, DEFAULT 0)

**Relaciones**:

- Muchos a uno con `dcc_pt23_config` (via `id_dcc`)
- Uno a muchos con `dcc_pt23_linearity_medicion`

**Uso**: Similar a Scale Factor, pero para pruebas de linealidad

---

### 5. `dcc_pt23_linearity_medicion`

**Descripción**: Almacena cada medición individual para un nivel de Linearity Test.

**Campos**: (idénticos a `dcc_pt23_scalefactor_medicion`)

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `id_nivel` (INT, NOT NULL): Foreign key a `dcc_pt23_linearity_nivel`
- `numero_medicion` (INT, NOT NULL)
- `valor_dut` (DECIMAL)
- `valor_patron` (DECIMAL)
- `deleted` (TINYINT, DEFAULT 0)

**Relaciones**:

- Muchos a uno con `dcc_pt23_linearity_nivel` (via `id_nivel`)

**Uso**: Almacena las mediciones individuales de Linearity Test

---

### 6. `dcc_pt23_stability_nivel`

**Descripción**: Almacena los niveles de tensión y estadísticas para cada prueba de Stability Test.

**Campos**: (idénticos a `dcc_pt23_scalefactor_nivel`)

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `id_dcc` (INT, NOT NULL)
- `prueba` (INT, NOT NULL): Número de la prueba de Stability Test
- `nivel_tension` (DECIMAL, NOT NULL)
- `promedio_dut` (DECIMAL)
- `promedio_patron` (DECIMAL)
- `desviacion_std_dut` (DECIMAL)
- `desviacion_std_patron` (DECIMAL)
- `num_mediciones` (INT)
- `deleted` (TINYINT, DEFAULT 0)

**Relaciones**:

- Muchos a uno con `dcc_pt23_config` (via `id_dcc`)
- Uno a muchos con `dcc_pt23_stability_medicion`

**Uso**: Similar a Scale Factor y Linearity, pero para pruebas de estabilidad

---

### 7. `dcc_pt23_stability_medicion`

**Descripción**: Almacena cada medición individual para un nivel de Stability Test.

**Campos**: (idénticos a `dcc_pt23_scalefactor_medicion`)

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `id_nivel` (INT, NOT NULL): Foreign key a `dcc_pt23_stability_nivel`
- `numero_medicion` (INT, NOT NULL)
- `valor_dut` (DECIMAL)
- `valor_patron` (DECIMAL)
- `deleted` (TINYINT, DEFAULT 0)

**Relaciones**:

- Muchos a uno con `dcc_pt23_stability_nivel` (via `id_nivel`)

**Uso**: Almacena las mediciones individuales de Stability Test

---

### 8. `dcc_results`

**Descripción**: Almacena los resultados calculados para mostrar en el bloque de Results del DCC.

**Campos**:

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT): Identificador único del resultado
- `id_dcc` (INT, NOT NULL): ID del DCC asociado
- `name` (VARCHAR): Nombre descriptivo del resultado (ej: "SF_1_Nivel_100", "Linearity_slope")
- `ref_type` (VARCHAR): Tipo de referencia o categoría del resultado (ej: "sf", "lt", "st")
- `data` (TEXT/JSON): Datos del resultado en formato JSON o texto
- `orden` (INT): Orden de visualización en el bloque de resultados
- `deleted` (TINYINT, DEFAULT 0): Marca de borrado lógico

**Relaciones**:

- Muchos a uno con el DCC principal

**Uso**:

- Se crean/actualizan cuando el usuario hace clic en "Generar Resultados"
- Se consultan para mostrar en el componente de resultados
- Se eliminan (soft delete) cuando se regeneran los resultados

---

## Flujo de Datos PT-23

### 1. Creación/Edición de Configuración

```
Usuario ingresa SFx, SFref, número de pruebas
  ↓
saveConfigToDB()
  ↓
dcc_pt23_config (create/update)
```

### 2. Ingreso de Mediciones

```
Usuario ingresa valores en tabla DUT/Patrón
  ↓
guardarScaleFactor/LinearityTest/StabilityTest()
  ↓
guardarNivelGenerico() - Busca/crea nivel
  ↓
dcc_pt23_[tipo]_nivel (create/update)
  ↓
guardarMedicionesNivel()
  ↓
dcc_pt23_[tipo]_medicion (create/update por cada medición)
```

### 3. Búsqueda y Actualización de Niveles

**IMPORTANTE**: Cuando se edita un nivel existente:

1. **Con `id_bd` (caso ideal)**:

   - Se busca el registro por `id = id_bd`
   - Se actualiza directamente SIN importar si cambió `nivel_tension`
   - Esto permite cambiar el valor del nivel sin crear duplicados

2. **Sin `id_bd` (fallback)**:
   - Se busca por criterios: `(id_dcc, prueba, nivel_tension)`
   - Si existe: UPDATE
   - Si no existe: CREATE
   - ⚠️ **PROBLEMA**: Si se cambió `nivel_tension`, no encontrará el registro y creará duplicado

### 4. Carga de Datos Existentes

```
loadScaleFactorFromDB/LinearityTestFromDB/StabilityTestFromDB()
  ↓
Consulta dcc_pt23_[tipo]_nivel WHERE id_dcc AND deleted=0
  ↓
Por cada nivel:
  ↓
  cargarMedicionesNivel(id_nivel)
    ↓
    Consulta dcc_pt23_[tipo]_medicion WHERE id_nivel AND deleted=0
  ↓
Popula arrays de datos en el componente
```

---

## Problema Actual Detectado

### Error: "Could not get nivel ID"

**Causa**: Después de crear un nivel nuevo (`action: 'create'`), el backend NO devuelve el `id` del registro creado en la respuesta.

**Solución temporal actual**:

- Esperamos 800ms con `setTimeout`
- Hacemos una consulta `GET` por criterios `(id_dcc, prueba, nivel_tension)`
- Si encontramos el registro, obtenemos su `id`

**Problema con esta solución**:

- Si el usuario cambió `nivel_tension`, la búsqueda fallará
- El `id_bd` no se actualiza correctamente

**Soluciones recomendadas**:

1. **Backend debe devolver el ID** (MEJOR opción):

   ```json
   {
     "action": "create",
     "result": {
       "id": 123, // ← ID del registro creado
       "insertId": 123 // ← Alternativa común en MySQL
     }
   }
   ```

2. **Frontend espera múltiples formatos**:

   - Buscar en: `response.id`, `response.insertId`, `response.result.id`, `response.result.insertId`

3. **Búsqueda por último registro**:
   - Después de CREATE, buscar: `WHERE id_dcc AND prueba ORDER BY id DESC LIMIT 1`
   - Más confiable que buscar por `nivel_tension`

---

## Notas Importantes

- **Soft Delete**: Todas las tablas usan `deleted = 0/1` en lugar de DELETE físico
- **id_bd vs id**: El componente usa `id` local (string UUID) y `id_bd` (número de BD) para tracking dual
- **Transacciones**: No hay transacciones explícitas; se usan Promises para coordinar múltiples operaciones
- **Validaciones**: El frontend valida que no se creen niveles sin datos reales (al menos un promedio debe existir)

---

## Convenciones de Nombres

- `dcc_pt23_[tipo]_nivel`: Tablas de niveles de tensión
- `dcc_pt23_[tipo]_medicion`: Tablas de mediciones individuales
- `[tipo]`: `scalefactor`, `linearity`, `stability`
- Prefijo `id_`: Indica foreign key o referencia a otra tabla
- Sufijo `_dut`: Valor del dispositivo bajo prueba
- Sufijo `_patron`: Valor del patrón/referencia

---

**Última actualización**: Diciembre 4, 2025
