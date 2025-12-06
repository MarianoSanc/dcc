# Instrucciones de Testing - Debug de Guardado de Niveles

## Pasos para Reproducir y Capturar Logs

### 1. Abrir la Consola del Navegador

```
Presiona F12 en el navegador
→ Ve a la pestaña "Console"
```

### 2. Limpiar Logs Anteriores

```
Escribe: clear()
Presiona Enter
```

### 3. Navegar a PT-23

- En la aplicación, ve a la sección de PT-23 Results
- Selecciona una prueba existente

### 4. Intentar Guardar Niveles

#### Opción A: Guardar Niveles Recién Creados

1. Haz clic en "Editar Niveles"
2. Añade valores en las columnas de mediciones (DUT y Patrón)
3. Completa al menos una fila con números (ej: DUT=10.5, Patrón=10.3)
4. Haz clic en "Guardar Todo"

#### Opción B: Editar Niveles Existentes

1. Haz clic en "Editar Niveles"
2. Cambia valores en mediciones existentes
3. Haz clic en "Guardar Todo"

### 5. Capturar los Logs

En la consola, busca líneas que contengan:

```
[SF/LT/ST] NIVEL TRACE]
```

**Copiar TODO desde:**

```
[SF/LT/ST] NIVEL TRACE] ▶ Iniciando...
```

**Hasta:**

```
[SF/LT/ST] NIVEL TRACE] ✓ ✓ ID recuperado exitosamente:
```

O si hay error:

```
[SF/LT/ST] NIVEL TRACE] ✖ Error...
```

### 6. Importante: Buscar Específicamente

Las líneas más importantes son:

#### Respuesta CREATE:

```
[SF/LT/ST] NIVEL TRACE] ✓ Nivel creado, respuesta COMPLETA:
```

↓ Aquí verás la estructura JSON que devuelve el backend

#### Respuesta GET (búsqueda del registro creado):

```
[SF/LT/ST] NIVEL TRACE] Respuesta GET últimos registros:
```

↓ Aquí verás qué registros existen en BD

#### Registros Disponibles:

```
[SF/LT/ST] NIVEL TRACE] Registros disponibles:
```

↓ Lista de id, prueba, nivel_tension, createdAt

### 7. Copiar y Pegar

Si falla con error "Could not find created nivel":

```
1. Haz clic derecho en la consola
2. Selecciona "Save as..." o toma un screenshot
3. O: Selecciona manualmente desde [SF/LT/ST] NIVEL TRACE] hasta el final del error
4. Copia (Ctrl+C) y pega en el chat
```

## Qué Incluir en el Reporte

Cuando reportes, incluye:

1. **El error exacto que ves**

   ```
   Error: Could not find created nivel
   O
   Error: Could not get nivel ID
   O Otro
   ```

2. **La estructura CREATE response**

   ```json
   {
     "result": {...},
     "insertId": X,
     "id": X,
     O similar
   }
   ```

3. **La estructura GET response**

   ```json
   {
     "result": [
       { "id": 123, "prueba": 1, "nivel_tension": 50, ... },
       { "id": 122, "prueba": 1, "nivel_tension": 40, ... }
     ]
   }
   ```

4. **Si los registros tienen ID o no**
   - ¿El registro creado tiene `id`?
   - ¿Está vacío o es null?

## Ejemplo de Logs Exitosos

```
[SF] NIVEL TRACE] ✓ Nivel creado, respuesta COMPLETA:
{
  "result": [
    {
      "id": 145,
      "prueba": 1,
      "nivel_tension": 50,
      "deleted": 0
    }
  ]
}

[SF] NIVEL TRACE] Respuesta GET últimos registros:
{
  "result": [
    {
      "id": 145,
      "prueba": 1,
      "nivel_tension": 50,
      "createdAt": "2024-01-15T10:30:45.000Z"
    }
  ]
}

[SF] NIVEL TRACE] ✓ ✓ ID recuperado exitosamente: 145 (nivel_tension: 50)
```

## Ejemplo de Logs Fallidos (Lo que Buscamos Arreglar)

```
[SF] NIVEL TRACE] ✓ Nivel creado, respuesta COMPLETA:
{
  "result": null  ← Aquí está el problema
}

O:

[SF] NIVEL TRACE] Respuesta GET últimos registros:
{
  "result": []  ← Lista vacía, no se creó
}

O:

[SF] NIVEL TRACE] Registros disponibles: []
[SF] NIVEL TRACE] ✖ No se encontraron registros después de crear
```

## Esperado Después de Estos Cambios

La búsqueda debería ser más robusta:

1. ✅ Si hay registros después del CREATE, encontrará el más reciente
2. ✅ Aunque `nivel_tension` sea null, no fallará en la búsqueda
3. ✅ Mostrará claramente qué registros existen en BD
4. ✅ Indicará si el problema es:
   - Backend no devolviendo registros
   - Timeout demasiado corto
   - ID no en respuesta
   - Otros problemas

## Próximos Pasos

Una vez que captures estos logs:

1. Si ves registros en GET pero error de ID:
   → Ajustaremos cómo extraemos el ID de la respuesta

2. Si GET devuelve lista vacía:
   → Aumentaremos timeout o investigaremos por qué no se crea

3. Si CREATE no devuelve ID:
   → Mejoraremos fallback a query manual

4. Si funciona correctamente:
   → ¡Problema resuelto!
