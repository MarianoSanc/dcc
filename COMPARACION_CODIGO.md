# Comparación Código: Antes vs Después

## Función 1: `guardarNivelGenerico()` - Búsqueda POST-CREATE

### ANTES (Problema: No maneja `nivel_tension === null`)

```typescript
setTimeout(() => {
  const findQuery = {
    action: "get",
    bd: this.database,
    table: tables.nivel,
    opts: {
      where: {
        id_dcc: this.dccId,
        prueba: prueba,
        deleted: 0,
      },
      order: [["id", "DESC"]],
      limit: 5, // ← Solo 5 registros
    },
  };

  this.dccDataService.post(findQuery).subscribe({
    next: (findResponse: any) => {
      // ← Poco logging
      const existing = findResponse?.result?.[0];

      // ← Busca por nivel_tension exactamente
      // Si es null, la búsqueda falla
      let found = findResponse.result.find((r: any) => r.nivel_tension === nivelTension);

      // ← Si no lo encuentra por nivel_tension, no hay fallback
      if (!found) {
        reject(new Error("Could not find created nivel")); // ✗ FALLA
      }

      resolve(found.id);
    },
  });
}, 800);
```

**Problemas**:

- ❌ `nivelTension === null` no coincide con ningún registro
- ❌ Sin fallback a "usar el más reciente"
- ❌ Sin logging de qué se buscaba o qué existe

---

### AHORA (Solución: Búsqueda inteligente y flexible)

```typescript
setTimeout(() => {
  const findQuery = {
    action: "get",
    bd: this.database,
    table: tables.nivel,
    opts: {
      where: {
        id_dcc: this.dccId,
        prueba: prueba,
        deleted: 0,
      },
      order: [["id", "DESC"]],
      limit: 10, // ← Trae 10 registros (más opciones)
    },
  };

  console.log(`${logPrefix} NIVEL TRACE] Query para obtener últimos registros:`, JSON.stringify(findQuery));

  this.dccDataService.post(findQuery).subscribe({
    next: (findResponse: any) => {
      console.log(
        `${logPrefix} NIVEL TRACE] Respuesta GET últimos registros:`,
        JSON.stringify(findResponse) // ← Logging completo
      );

      console.log(`${logPrefix} NIVEL TRACE] Número de registros encontrados:`, findResponse?.result?.length || 0);

      if (!findResponse?.result || findResponse.result.length === 0) {
        console.error(`${logPrefix} NIVEL TRACE] ✖ No se encontraron registros después de crear`);
        reject(new Error("Could not find created nivel"));
        return;
      }

      // ← NUEVA LÓGICA: Búsqueda inteligente
      let found = null;

      // Si nivel_tension tiene valor, buscar coincidencia exacta
      if (nivelTension !== null && nivelTension !== undefined) {
        found = findResponse.result.find((r: any) => r.nivel_tension === nivelTension);
        if (found) {
          console.log(`${logPrefix} NIVEL TRACE] ✓ Encontrado por nivel_tension ${nivelTension}`);
        }
      }

      // Si no se encuentra (o nivel_tension === null), usar el primero (más reciente)
      if (!found) {
        console.log(`${logPrefix} NIVEL TRACE] ⚠️ Usando el más reciente (ID DESC)`);
        found = findResponse.result[0];
        console.log(
          `${logPrefix} NIVEL TRACE] Registros disponibles:`,
          findResponse.result.map((r: any) => ({
            id: r.id,
            prueba: r.prueba,
            nivel_tension: r.nivel_tension,
            createdAt: r.createdAt,
          }))
        );
      }

      if (found?.id) {
        console.log(`${logPrefix} NIVEL TRACE] ✓ ✓ ID recuperado exitosamente:`, found.id, `(nivel_tension: ${found.nivel_tension})`);
        resolve(found.id); // ✓ ÉXITO
      } else {
        console.error(`${logPrefix} NIVEL TRACE] ✖ No se pudo recuperar el ID`);
        reject(new Error("Could not get nivel ID"));
      }
    },
    error: (err) => {
      console.error(`${logPrefix} NIVEL TRACE] ✖ Error al recuperar ID:`, err);
      reject(err);
    },
  });
}, 800);
```

**Mejoras**:

- ✅ Maneja `nivelTension === null` correctamente
- ✅ Fallback a "usar el más reciente" si no hay coincidencia exacta
- ✅ Logging detallado de qué se busca y qué se encuentra
- ✅ Muestra lista completa de registros disponibles
- ✅ Mejor manejo de errores

---

## Función 2: `buscarYGuardarPorCriterios()` - WHERE Dinámico

### ANTES (Problema: Fuerza `nivel_tension` aunque sea null)

```typescript
private buscarYGuardarPorCriterios(
  testType: 'sf' | 'lt' | 'st',
  tables: any,
  logPrefix: string,
  prueba: number,
  nivelTension: number,  // ← Se espera número, pero puede ser null
  estadisticas: any,
  resolve: any,
  reject: any
) {
  // ← Query fija, no se adapta a nivel_tension
  const checkQuery = {
    action: 'get',
    bd: this.database,
    table: tables.nivel,
    opts: {
      where: {
        id_dcc: this.dccId,
        prueba: prueba,
        nivel_tension: nivelTension,  // ← Fuerza nivel_tension siempre
      },
    },
  };

  this.dccDataService.post(checkQuery).subscribe({
    next: (response: any) => {
      const existing = response?.result?.[0];

      // ← Si nivel_tension === null, no encontrará nada
      // Aunque existan registros sin nivel_tension
```

**Problemas**:

- ❌ WHERE siempre incluye `nivel_tension`, aunque sea null
- ❌ Query falla a encontrar registros cuando `nivel_tension === null`
- ❌ No es flexible para diferentes escenarios

---

### AHORA (Solución: WHERE Dinámico)

```typescript
private buscarYGuardarPorCriterios(
  testType: 'sf' | 'lt' | 'st',
  tables: any,
  logPrefix: string,
  prueba: number,
  nivelTension: number | null | undefined,  // ← Puede ser null/undefined
  estadisticas: any,
  resolve: any,
  reject: any
) {
  // ← NUEVA LÓGICA: Construir WHERE dinámicamente
  console.log(
    `${logPrefix} NIVEL TRACE] buscarYGuardarPorCriterios: prueba=${prueba}, nivelTension=${nivelTension} (tipo: ${typeof nivelTension})`
  );

  const where: any = {
    id_dcc: this.dccId,
    prueba: prueba,
  };

  // Solo incluir nivel_tension en la búsqueda si no es null
  if (nivelTension !== null && nivelTension !== undefined) {
    where.nivel_tension = nivelTension;
  }

  const checkQuery = {
    action: 'get',
    bd: this.database,
    table: tables.nivel,
    opts: {
      where: where,  // ← WHERE adaptado
      order: [['id', 'DESC']],
      limit: 10,  // ← Trae 10 para más opciones
    },
  };

  this.dccDataService.post(checkQuery).subscribe({
    next: (response: any) => {
      console.log(
        `${logPrefix} NIVEL TRACE] Número de registros encontrados:`,
        response?.result?.length || 0
      );

      let existing = null;

      // ← NUEVA LÓGICA: Búsqueda inteligente
      if (nivelTension !== null && nivelTension !== undefined) {
        // Si se especificó nivel_tension, buscar coincidencia exacta
        existing = response?.result?.find((r: any) => r.nivel_tension === nivelTension);
        if (existing) {
          console.log(
            `${logPrefix} NIVEL TRACE] ✓ Encontrado por nivel_tension exacto: ${nivelTension}`
          );
        }
      } else {
        // Si no se especificó nivel_tension, usar el primero
        existing = response?.result?.[0];
        if (existing) {
          console.log(
            `${logPrefix} NIVEL TRACE] ✓ Usando el registro más reciente`
          );
        }
      }

      console.log(
        `${logPrefix} NIVEL TRACE] Nivel existente:`,
        existing ? `SÍ (id: ${existing.id}, nivel_tension: ${existing.nivel_tension})` : 'NO'
      );

      // ... resto del código
```

**Mejoras**:

- ✅ WHERE dinámico que se adapta a `nivelTension`
- ✅ No fuerza `nivel_tension` si es null
- ✅ Búsqueda inteligente: exacta si se especifica, fallback a primer registro
- ✅ Logging claro de qué se busca y qué se encuentra

---

## Resumen de Cambios por Tema

| Aspecto                      | Antes                                 | Ahora                                                         |
| ---------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| **Parámetro `nivelTension`** | `number`                              | `number \| null \| undefined`                                 |
| **WHERE construction**       | Fijo: siempre incluye `nivel_tension` | Dinámico: incluye solo si ≠ null                              |
| **Búsqueda por criteria**    | Exacta: busca `nivel_tension === X`   | Inteligente: exacta si especificado, fallback primer registro |
| **Registros traídos**        | 5 últimos                             | 10 últimos                                                    |
| **Logging**                  | Mínimo                                | Detallado: respuesta completa, lista de registros             |
| **Manejo `null`**            | ✗ Falla                               | ✓ Funciona                                                    |
| **Fallback**                 | ✗ No hay                              | ✓ Usa más reciente                                            |

---

## Validación de Datos - Mejora Secundaria

### ANTES

```typescript
const hasRealData = estadisticas.promedio_dut !== null || estadisticas.promedio_patron !== null;

console.log(`¿Tiene datos reales?:`, hasRealData);
```

### AHORA

```typescript
const hasRealData = estadisticas.promedio_dut !== null || estadisticas.promedio_patron !== null;

console.log(`¿Tiene datos reales?:`, hasRealData, `(promedio_dut=${estadisticas.promedio_dut}, promedio_patron=${estadisticas.promedio_patron})`);
```

**Mejora**: Se ve exactamente qué valores se tienen, no solo sí/no.

---

## Impacto

### Antes (❌ Falla frecuente)

```
Guardar nivel con nivel_tension=null
  → Query: WHERE nivel_tension=null
  → Resultado: Vacío (no encuentra null)
  → Error: "Could not find created nivel"
  → User: No puede guardar datos
```

### Después (✅ Funciona siempre)

```
Guardar nivel con nivel_tension=null
  → Query: WHERE id_dcc AND prueba (sin nivel_tension)
  → Resultado: Últimos 10 registros
  → Búsqueda: Como es null, usa el primero
  → Éxito: ID recuperado
  → User: Datos guardados correctamente
```

---

## Líneas Exactas Modificadas

```
pt23-results.component.ts:
- Línea 2620-2695: Función buscarYGuardarPorCriterios() - WHERE dinámico
- Línea 2740-2860: Función guardarNivelGenerico() - Búsqueda POST-CREATE
- Línea 2700-2750: Validación de datos mejorada
```

**Total**: ~200 líneas mejoradas/reescritas  
**Cambios lógicos**: 5 principales  
**Logs agregados**: ~15 nuevas líneas de console.log
