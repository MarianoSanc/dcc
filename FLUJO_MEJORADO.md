# Flujo Mejorado: Buscar y Guardar Niveles

## Escenario 1: Crear Nuevo Nivel (Sin ID previo)

```
┌─────────────────────────────────────────────────────────────┐
│ guardarNivelGenerico()                                      │
│ - Input: prueba, nivel_tension (puede ser null)             │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
            ┌───────────────────────────────┐
            │ ¿Ya existe ID en BD (id_bd)? │
            └───────────────┬───────────────┘
                   NO       │       SÍ
           ┌────────────────┴──────────────┐
           ▼                                ▼
    ┌─────────────┐              ┌───────────────────────┐
    │ Ir a       │              │ Buscar por ID primero │
    │ buscar por │              │ (UPDATE si existe)     │
    │ criterios  │              └───────────────────────┘
    └─────────────┘
           │
           ▼
    ┌─────────────────────────────────────┐
    │ buscarYGuardarPorCriterios()        │
    │                                     │
    │ WHERE {                             │
    │   id_dcc,                           │
    │   prueba,                           │
    │   nivel_tension (si !== null)       │
    │ }                                   │
    │                                     │
    │ ORDER BY id DESC LIMIT 10           │
    └──────────┬──────────────────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │ ¿Se encontró existente?      │
    └────────────┬────────────────┘
         SÍ      │      NO
    ┌────────────┴─────────────┐
    ▼                           ▼
  UPDATE                    ┌──────────────────────┐
  (existente)               │ ¿Tiene datos reales? │
                            │ (algún promedio≠null)│
                            └────┬─────────────────┘
                          SÍ     │     NO
                        ┌─────────┴─────────┐
                        ▼                   ▼
                      CREATE          RESOLVE(-1)
                        │             (no crear)
                        ▼
            ┌──────────────────────────┐
            │ Esperar 800ms            │
            │ (DB commit)              │
            └───────────┬──────────────┘
                        ▼
            ┌──────────────────────────────┐
            │ Query: Últimos 10 registros  │
            │                              │
            │ WHERE {                      │
            │   id_dcc,                    │
            │   prueba,                    │
            │   deleted: 0                 │
            │ }                            │
            │ ORDER BY id DESC LIMIT 10    │
            └───────────┬──────────────────┘
                        ▼
            ┌──────────────────────────────┐
            │ Buscar registro              │
            │                              │
            │ SI nivel_tension !== null:   │
            │   Buscar coincidencia EXACTA │
            │                              │
            │ SI no encontrado O           │
            │    nivel_tension === null:   │
            │   Usar el primero (+ reciente)
            └───────────┬──────────────────┘
                        ▼
            ┌──────────────────────────────┐
            │ ¿Se encontró registro?       │
            │ ¿Con ID válido?              │
            └────────┬─────────────────────┘
                  SÍ│      NO
          ┌─────────┴──────────────┐
          ▼                         ▼
      RESOLVE(id)            REJECT(error)
      ✓ Éxito               ✖ Error
```

## Escenario 2: Actualizar Nivel Existente (Con ID previo)

```
┌─────────────────────────────────────────────────────────────┐
│ guardarNivelGenerico()                                      │
│ - Input: idBd (existente), prueba, nivel_tension            │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
            ┌───────────────────────────────┐
            │ ¿Ya existe ID en BD (id_bd)? │
            └───────────────┬───────────────┘
                    SÍ      │
                            ▼
            ┌───────────────────────────────────┐
            │ Buscar por ID primero             │
            │ WHERE { id: idBd }                │
            └─────────────┬─────────────────────┘
                          │
                    ┌─────┴──────────┐
                    ▼                ▼
              ┌──────────┐    ┌──────────────────┐
              │Encontrado│    │ No encontrado    │
              │ (UPDATE) │    │ (fallback a      │
              └──────────┘    │  criterios)      │
                              └──────────────────┘
```

## Mejoras Clave

### 1. **Manejo de `nivel_tension === null`**

- **Antes**: Fallaba buscando `nivel_tension === null` exactamente
- **Ahora**: Si es null, busca sin ese criterio y usa el registro más reciente

### 2. **Búsqueda Inteligente post-CREATE**

- **Antes**: Buscaba por criterios exactos, tomaba el primero sin verificar
- **Ahora**:
  - Trae últimos 10 registros
  - Si `nivel_tension` especificado, busca coincidencia exacta
  - Si no encuentra exacta, usa el más reciente
  - Log detallado de qué registros existen

### 3. **Mejor Fallback**

- **Antes**: Si no encontraba por nivel_tension, simplemente fallaba
- **Ahora**: Usa el registro más reciente de la BD (que es muy probable que sea el que acababa de crear)

### 4. **Logging Detallado**

- **Antes**: Solo decía "No encontrado"
- **Ahora**: Muestra:
  - Respuesta CREATE completa (estructura JSON)
  - Número de registros encontrados
  - Lista de registros disponibles (id, prueba, nivel_tension, createdAt)
  - Criterios exactos usados en búsqueda

## Ventajas para Debug

Con los logs mejorados, se puede ver:

```
[SF/LT/ST] NIVEL TRACE] ✓ Nivel creado, respuesta COMPLETA: {...}
[SF/LT/ST] NIVEL TRACE] Respuesta GET últimos registros: {...}
[SF/LT/ST] NIVEL TRACE] Número de registros encontrados: 5
[SF/LT/ST] NIVEL TRACE] Registros disponibles:
  - id: 123, prueba: 1, nivel_tension: 50, createdAt: "2024-01-15..."
  - id: 122, prueba: 1, nivel_tension: 40, createdAt: "2024-01-15..."
[SF/LT/ST] NIVEL TRACE] ✓ ✓ ID recuperado exitosamente: 123
```

Esto permite determinar:

- ¿El backend está devolviendo registros?
- ¿Se creó el registro correctamente?
- ¿El timeout de 800ms es suficiente?
- ¿Hay conflictos de datos?
