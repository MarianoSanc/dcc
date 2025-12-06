# Mejoras de Debug - Búsqueda de Niveles Después de CREATE

## Problema Original

"Error: Could not find created nivel" cuando se intenta guardar niveles. Después de hacer CREATE, la búsqueda del registro no encuentra el nuevo nivel.

## Root Causes Identificadas

1. **`nivel_tension` puede ser `null`**: Cuando está creando nuevos niveles sin especificar tensión, el search fallaba porque buscaba coincidencia exacta en `null`.

2. **Búsqueda muy restrictiva**: Solo buscaba por `(id_dcc, prueba, nivel_tension)` exactamente, fallando si algo no coincidía perfectamente.

3. **Falta de información en logs**: No se sabía qué estaba devolviendo el backend ni qué registros existían en la BD.

## Soluciones Implementadas

### 1. En `guardarNivelGenerico()` - Después del CREATE (líneas 2810-2860)

```typescript
// Traer los últimos 10 registros para esta prueba (no solo 5)
const findQuery = {
  action: 'get',
  bd: this.database,
  table: tables.nivel,
  opts: {
    where: {
      id_dcc: this.dccId,
      prueba: prueba,
      deleted: 0,
    },
    order: [['id', 'DESC']],
    limit: 10, // Aumentado de 5 a 10
  },
};

// Buscar por nivel_tension SOLO si no es null
if (nivelTension !== null && nivelTension !== undefined) {
  found = findResponse.result.find((r: any) => r.nivel_tension === nivelTension);
}

// Si no se encuentra por nivel_tension exacto, usar el más reciente
if (!found) {
  found = findResponse.result[0]; // Tomar el primero (más nuevo)
  console.log(`Registros disponibles:`, findResponse.result.map(...));
}
```

**Beneficios**:

- Maneja `nivel_tension === null` sin fallar
- Fallback a "usar el registro más reciente" si no hay coincidencia exacta
- Mejor logging de qué registros hay disponibles

### 2. En `buscarYGuardarPorCriterios()` - Búsqueda por criterios (líneas 2620-2695)

```typescript
// Construir WHERE dinámicamente
const where: any = {
  id_dcc: this.dccId,
  prueba: prueba,
};

// SOLO incluir nivel_tension si no es null
if (nivelTension !== null && nivelTension !== undefined) {
  where.nivel_tension = nivelTension;
}

// Luego:
// Si buscamos por nivel_tension específico, buscar coincidencia exacta
if (nivelTension !== null && nivelTension !== undefined) {
  existing = response?.result?.find((r: any) => r.nivel_tension === nivelTension);
} else {
  // Si no hay nivel_tension, usar el primero
  existing = response?.result?.[0];
}
```

**Beneficios**:

- No fuerza `nivel_tension` en el WHERE si es null
- Busca inteligentemente: exacta si la especifica, fallback al más reciente si no
- Mejor manejo de casos donde no hay tensión específica

### 3. Mejora de Logging

Agregadas líneas de debug:

```typescript
console.log(`Respuesta GET últimos registros:`, JSON.stringify(findResponse));
console.log(`Número de registros encontrados:`, response?.result?.length || 0);
console.log(
  `Registros disponibles:`,
  findResponse.result.map((r: any) => ({
    id: r.id,
    prueba: r.prueba,
    nivel_tension: r.nivel_tension,
    createdAt: r.createdAt,
  }))
);
```

**Beneficio**: Ahora se puede ver exactamente qué se devuelve del BD.

### 4. Mejorado la validación de datos reales

```typescript
console.log(`¿Tiene datos reales?:`, hasRealData, `(promedio_dut=${estadisticas.promedio_dut}, promedio_patron=${estadisticas.promedio_patron})`);
```

## Flujo Mejorado

### Cuando se crea un nuevo nivel:

1. **CREATE query**: Envía el nivel con todos sus datos
2. **Respuesta CREATE**: Intenta obtener ID directamente
3. **Si no hay ID** (espera 800ms):
   - Query: `{id_dcc, prueba, deleted: 0}` ordenado por ID DESC
   - Resultado: trae últimos 10 registros
   - **Búsqueda inteligente**:
     - Si `nivel_tension !== null`: busca coincidencia exacta
     - Si no encuentra exacta O `nivel_tension === null`: usa el primero (más reciente)
   - Log detallado de qué registros existen

### Cuando se actualiza un nivel existente:

1. **Búsqueda por criterios**:
   - Si `nivel_tension` es null: busca solo por `(id_dcc, prueba)`
   - Si `nivel_tension` no es null: busca por `(id_dcc, prueba, nivel_tension)`
   - Trae últimos 10 registros, ordenados por ID DESC
2. **Encontrado**: Usa el registro coincidente
3. **No encontrado**: Crea uno nuevo

## Próximos Pasos de Debug

Si aún falla, el console mostrará:

1. **CREATE response completo** (`JSON.stringify`): Verás exactamente qué devuelve el backend
2. **GET response completo**: Verás qué registros existen en BD después del CREATE
3. **Lista de registros disponibles**: Verás id, prueba, nivel_tension de cada uno

Con esto se puede determinar:

- ¿El backend devuelve ID en CREATE?
- ¿Se está creando el registro realmente en BD?
- ¿El timeout de 800ms es suficiente?
- ¿Hay otros registros que interfieren?

## Cambios en Archivos

- **pt23-results.component.ts**:
  - `guardarNivelGenerico()`: Mejorada búsqueda después del CREATE
  - `buscarYGuardarPorCriterios()`: Mejorada para manejar `nivel_tension` null
  - Logs mejorados en ambas funciones

## Testing

Para probar:

1. Abre F12 (Console)
2. Intenta guardar un nivel (especialmente sin nivel_tension específico)
3. Busca logs que digan:
   - `[SF/LT/ST] NIVEL TRACE] Respuesta CREATE`
   - `[SF/LT/ST] NIVEL TRACE] Respuesta GET últimos registros`
   - `[SF/LT/ST] NIVEL TRACE] Registros disponibles`
4. Verifica si hay IDs en los registros devueltos
