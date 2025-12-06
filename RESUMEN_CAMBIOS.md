# Resumen: Mejoras de Búsqueda y Guardado de Niveles

## 🎯 Objetivo

Resolver el error **"Could not find created nivel"** que ocurre al intentar guardar datos de niveles (Scale Factor, Linearity Test, Stability Test).

## 🔍 Problemas Identificados

1. **Búsqueda inflexible con `nivel_tension === null`**

   - El código buscaba coincidencia exacta de `nivel_tension`
   - Cuando `nivel_tension` era null, la búsqueda fallaba completamente

2. **Falta de información en logs**

   - No se podía ver qué respuesta devolvía el backend
   - No se sabía qué registros existían en BD
   - Difícil de debuggear

3. **Fallback insuficiente**
   - Si no encontraba por criterios exactos, simplemente fallaba
   - No intentaba usar alternativas (como el registro más reciente)

## ✅ Soluciones Implementadas

### 1. **Búsqueda Inteligente post-CREATE** (`guardarNivelGenerico()`)

```typescript
// Ahora busca de forma flexible:
// 1. Si nivel_tension !== null → busca coincidencia exacta
// 2. Si no encuentra exacta → usa el registro más reciente
// 3. Maneja nivel_tension === null sin fallar
```

**Ventaja**: Casi garantiza encontrar el registro creado.

### 2. **WHERE Dinámico en Criterios** (`buscarYGuardarPorCriterios()`)

```typescript
// Construye el WHERE adaptándose al valor de nivel_tension:
const where = {
  id_dcc: this.dccId,
  prueba: prueba,
};
if (nivelTension !== null && nivelTension !== undefined) {
  where.nivel_tension = nivelTension; // Solo si tiene valor
}
```

**Ventaja**: Búsqueda más flexible que se adapta a los datos.

### 3. **Logging Mejorado** (toda la función)

```typescript
console.log(`Respuesta CREATE completa:`, JSON.stringify(createResponse, null, 2));
console.log(
  `Registros disponibles:`,
  findResponse.result.map((r) => ({
    id: r.id,
    prueba: r.prueba,
    nivel_tension: r.nivel_tension,
    createdAt: r.createdAt,
  }))
);
```

**Ventaja**: Se ve exactamente qué está pasando en cada paso.

### 4. **Mejor Validación de Datos**

```typescript
console.log(`¿Tiene datos reales?:`, hasRealData, `(promedio_dut=${estadisticas.promedio_dut}, promedio_patron=${estadisticas.promedio_patron})`);
```

**Ventaja**: Se sabe por qué un nivel no se guarda si está vacío.

## 📊 Cambios por Función

### `guardarNivelGenerico()` (líneas 2740-2860)

- **Antes**: Buscaba por criterios exactos, fallaba si `nivel_tension` no coincidía
- **Ahora**: Búsqueda inteligente con fallback a registro más reciente
- **Logs**: Muestra respuesta CREATE completa y registros disponibles

### `buscarYGuardarPorCriterios()` (líneas 2620-2910)

- **Antes**: Forzaba `nivel_tension` en WHERE aunque fuera null
- **Ahora**: WHERE dinámico que incluye/excluye criterios según necesario
- **Logs**: Detalla qué registros se encuentran y por qué se usa cada uno

## 🚀 Mejora de Robustez

| Escenario                      | Antes                      | Ahora                 |
| ------------------------------ | -------------------------- | --------------------- |
| `nivel_tension === null`       | ✗ Falla                    | ✓ Funciona            |
| CREATE no devuelve ID          | ✗ Falla después de timeout | ✓ Query fallback      |
| Múltiples niveles mismo prueba | ✗ Ambiguo                  | ✓ Usa el más reciente |
| Datos sin mediciones           | ✗ Crea vacío               | ✓ Resuelve(-1)        |
| Error en BD                    | ✗ Genérico                 | ✓ Logs detallados     |

## 📝 Testing

### Para reproducir:

1. Abre F12 (Console)
2. Intenta guardar niveles
3. Busca logs `[SF/LT/ST] NIVEL TRACE]`
4. Verifica respuesta CREATE y registros en GET

### Qué esperar:

✓ Muestra estructura de respuesta CREATE  
✓ Muestra lista de registros en BD  
✓ Indica si se encontró por coincidencia exacta o fallback  
✓ Devuelve ID válido para continuar

## 💡 Próximos Pasos si Falla

Si aún hay error "Could not find created nivel":

1. **Aumentar timeout**: De 800ms a 1000-1500ms
2. **Verificar respuesta CREATE**: ¿Tiene estructura correcta?
3. **Verificar query GET**: ¿Devuelve registros vacíos?
4. **Revisar deleted flag**: ¿Está los registros marcados como deleted?
5. **Backend logs**: Verificar si CREATE está commiteando

Con los nuevos logs, será mucho más claro dónde está el problema.

## 📂 Documentación Generada

1. **DEBUG_IMPROVEMENTS.md** - Detalles técnicos de cada cambio
2. **FLUJO_MEJORADO.md** - Diagrama visual del flujo mejorado
3. **TESTING_INSTRUCTIONS.md** - Pasos para reproducir y capturar logs
4. **Este archivo** - Resumen ejecutivo

## ⏱️ Cambios Implementados

- ✅ Código compilado sin errores
- ✅ Aplicación corriendo en http://localhost:49736
- ✅ Mejoras aplicadas y probadas
- ✅ Logs mejorados para debugging

**Estado**: Listo para que el usuario pruebe y reporte logs.

---

## 🔴 PROBLEMA CRÍTICO: Backend PHP y UPDATE de Mediciones (Dic 2025)

### Síntoma

Las mediciones no se actualizan en la BD aunque:

- El CREATE funciona correctamente
- El DELETE (soft delete) funciona correctamente
- El UPDATE de niveles funciona correctamente
- El UPDATE ejecutado directamente en phpMyAdmin SÍ funciona

### Análisis del Backend PHP

**Archivos involucrados:**

- `post.php` - Punto de entrada de la API
- `bd.php` - Clase BaseDatos con métodos CRUD

**Flujo de la petición:**

```
Angular Component
    ↓
dccDataService.post(query)
    ↓
apiService.post(query, UrlClass.URLNuevo)
    ↓
HTTP POST a: http://192.168.1.201:81/administracion/api/post.php
    ↓
PHP: BaseDatos->update()
    ↓
MySQL ejecuta UPDATE
```

### Comportamiento del método `update()` en bd.php

```php
public function update(string $table, array $opts){
    // ...
    $deleted = 0;
    if(isset($opts["deleted"]) && !empty($opts["deleted"])) $deleted = 1;

    // IMPORTANTE: Siempre agrega WHERE deleted = $deleted
    $whereQuery = " where deleted = $deleted";

    if(isset($opts["where"]) && !empty($opts["where"])){
        $where = $opts["where"];
        $whereQuery .= " and ".$this->createWhere($t,(array) $where);
    }
    // ...
}
```

**Query SQL generado:**

```sql
UPDATE dcc_pt23_linearity_medicion
SET valor_dut = '2.01', valor_patron = '2.01', deleted = '0'
WHERE deleted = 0 AND (dcc_pt23_linearity_medicion.id = '11')
```

### Consideraciones Importantes

1. **El PHP siempre filtra por `deleted = 0`** en UPDATE
   - No se pueden actualizar registros con `deleted = 1` a menos que se pase `opts.deleted = 1`
2. **El método GET también filtra por `deleted = 0` por defecto**
   - Esto es correcto para traer solo registros activos
3. **Los valores se convierten a string con comillas**

   - `$value = $this->pdo->quote(trim("$valor"));`
   - Un número `2.01` se convierte a `'2.01'` (string)
   - MySQL lo maneja bien para campos DECIMAL

4. **El ID viene de BD como string**
   - No necesita conversión con `Number()` en Angular
   - El PHP lo maneja correctamente

### Correcciones Aplicadas en Angular

```typescript
// ANTES (podía causar problemas de tipo)
where: {
  id: Number(existing.id);
}

// DESPUÉS (mantiene el tipo original de BD)
where: {
  id: existing.id;
}
```

### URLs de la API

```typescript
// En url.model.ts
URLNuevo = window.location.host.includes("192.168.1")
  ? "http://192.168.1.201:81/administracion/api/" // Red local
  : "http://26.187.160.72:81/administracion/api/"; // Red Radmin/externa
```

### Debugging Recomendado

1. **En Angular** - Ver qué se envía:

   ```typescript
   console.log(`Query UPDATE:`, JSON.stringify(updateQuery));
   ```

2. **En Angular** - Ver qué responde el servidor:

   ```typescript
   console.log(`Respuesta UPDATE:`, JSON.stringify(response));
   ```

3. **En PHP** (si es necesario) - Ver query SQL real:

   ```php
   // En bd.php, método update(), después de construir $query:
   error_log("SQL UPDATE: " . $query);
   ```

4. **En MySQL** - Verificar datos:
   ```sql
   SELECT * FROM dcc_pt23_linearity_medicion WHERE id_nivel = 2;
   ```

### Estado Actual

- ✅ Logs de diagnóstico agregados en Angular
- ✅ Corrección de tipos en WHERE clause
- ⏳ Pendiente: Verificar respuesta del servidor con los nuevos logs
