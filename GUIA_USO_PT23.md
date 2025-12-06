# Guía de Uso - Nueva Interfaz PT-23 Results

**Versión Refactorizada**: Diciembre 5, 2025

---

## Descripción General

El componente PT-23 Results ahora tiene una interfaz mejorada con **dos secciones independientes** de edición:

1. **Sección 1: Parámetros de Referencia** (SFx, SFref, número de pruebas)
2. **Sección 2: Datos de Niveles** (Mediciones de DUT y Patrón)

Esto permite editar configuración sin afectar datos, y viceversa.

---

## Sección 1: Parámetros de Referencia

### ¿Qué es?

- **SFx**: Valor de Scale Factor X (requerido)
- **SFref**: Valor de Scale Factor de Referencia (requerido)
- Estos son parámetros globales que aplican a todos los datos

### ¿Cómo editar?

#### Paso 1: Hacer clic en "Editar"

```
┌─────────────────────────────────────────┐
│ Parámetros de Referencia                │
│                                         │
│ SFx:    [____________________]  [Editar]│
│ SFref:  [____________________]          │
└─────────────────────────────────────────┘
```

#### Paso 2: Los campos se habilitan

```
┌─────────────────────────────────────────────────────┐
│ Parámetros de Referencia                            │
│                                                     │
│ SFx:    [150        ] (campos ahora habilitados)    │
│ SFref:  [100        ]                               │
│                                                     │
│        [Guardar] [Cancelar]                         │
└─────────────────────────────────────────────────────┘
```

#### Paso 3: Cambiar valores

- Modifica SFx y/o SFref
- Selecciona nuevos números de pruebas (0-5)
- Puedes cambiar un parámetro o todos

#### Paso 4: Guardar o Cancelar

- **Guardar**: Valida y guarda en BD
- **Cancelar**: Descarta cambios y restaura valores anteriores

### Validaciones

⚠️ **SFx es requerido**: No puede ser 0 o vacío  
⚠️ **SFref es requerido**: No puede ser 0 o vacío  
⚠️ **Número de pruebas**: Deben estar entre 0 y 5

### Comportamiento Especial

- Si cambias **Número de Pruebas**:
  - ✅ Si aumenta: Se crean pruebas vacías en BD
  - ✅ Si disminuye: Se eliminan pruebas (soft delete, recuperables)
  - ✅ Las mediciones existentes se conservan

---

## Sección 2: Configuración de Número de Pruebas

### ¿Qué es?

- Selecciona cuántas pruebas quieres de cada tipo:
  - **SF** (Scale Factor): 0-5 pruebas
  - **LT** (Linearity Test): 0-5 pruebas
  - **ST** (Stability Test): 0-5 pruebas

### ¿Cómo editar?

- Estos selectores se activan cuando haces clic en "Editar" (Sección 1)
- Selecciona el número deseado (0-5)
- Guarda la configuración

### Ejemplo

```
Antes:  SF: 1 | LT: 0 | ST: 0
        ↓
Editar y cambiar a:  SF: 2 | LT: 1 | ST: 0
        ↓
Guardar
        ↓
Resultado:
  - 2 pruebas de SF disponibles
  - 1 prueba de LT disponible
  - ST desactivado (eliminado)
```

---

## Sección 3: Datos de Niveles y Mediciones

### ¿Qué es?

- Las tablas donde ingresas mediciones de DUT y Patrón
- Para cada prueba (SF, LT, ST)
- Con cálculos automáticos (error %, SF corrected)

### ¿Cómo editar?

#### Paso 1: Hacer clic en "Editar Niveles"

```
┌───────────────────────────────────────────┐
│ Datos de Niveles y Mediciones             │
│                                           │
│                  [Editar Niveles]         │
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │ Scale Factor 1                      │   │
│ │ Nivel 1 [100] kV                    │   │
│ │ DUT (kV)  Patrón (kV)  Error  SF... │   │
│ │ [_____]   [______]     ---   ---    │   │
│ └─────────────────────────────────────┘   │
└───────────────────────────────────────────┘
```

#### Paso 2: Los campos se habilitan

```
┌───────────────────────────────────────────┐
│ Datos de Niveles y Mediciones             │
│                                           │
│   [Guardar Todo] [Cancelar]               │
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │ Scale Factor 1                      │   │
│ │ Nivel 1 [100] kV                    │   │
│ │ DUT (kV)  Patrón (kV)               │   │
│ │ [_____] ✏️  [______] ✏️              │   │
│ └─────────────────────────────────────┘   │
└───────────────────────────────────────────┘
```

#### Paso 3: Ingresa mediciones

- Haz clic en cualquier celda de DUT o Patrón
- Ingresa valores numéricos
- Presiona Tab o Enter para pasar a la siguiente celda
- Puedes pegar valores desde Excel/Calc

#### Paso 4: Los cálculos se actualizan automáticamente

- **Error (%)**: Se calcula automáticamente
- **SF Corrected**: Se calcula automáticamente
- **Estadísticas**: Se muestran en la cabecera

#### Paso 5: Guardar o Cancelar

- **Guardar Todo**:
  1. Valida que haya al menos una medición
  2. Calcula estadísticas (promedio, desviación)
  3. Guarda en BD (crea o actualiza)
  4. Recarga datos
- **Cancelar**: Descarta cambios y restaura datos anteriores

### Funcionalidades Especiales

#### Agregar Nivel

- Haz clic en "+ Agregar Nivel" (solo disponible si estás en edición)
- Se crea un nuevo nivel vacío en la prueba

#### Eliminar Nivel

- Haz clic en el icono de papelera (solo si hay múltiples niveles)
- El nivel se marca para eliminación

#### Pegar Valores

- Copia valores desde Excel/Calc
- Haz clic en el botón "Pegar" en la columna DUT o Patrón
- Los valores se pegan automáticamente

#### Limpiar Columna

- Haz clic en el botón "Limpiar" en la columna
- Todos los valores de esa columna se borran

### Validaciones

⚠️ **Al menos una medición**: Debe haber al menos un valor (DUT o Patrón)  
⚠️ **Formato numérico**: Los valores deben ser números  
⚠️ **Número de niveles**: Debe coincidir con la configuración

---

## Casos de Uso Comunes

### Caso 1: Cambiar SFx y SFref

```
1. Haz clic en "Editar" (Parámetros)
2. Cambia SFx de 120 → 150
3. Mantén SFref = 100
4. Haz clic en "Guardar"
5. Listo - Los parámetros se actualizan
6. Los datos de niveles no se afectan
```

### Caso 2: Agregar más pruebas

```
1. Haz clic en "Editar" (Parámetros)
2. Cambia "SF Pruebas" de 1 → 3
3. Cambia "LT Pruebas" de 0 → 1
4. Haz clic en "Guardar"
5. Las nuevas pruebas aparecen en la Sección 3
6. Puedes ingresar datos en las nuevas pruebas
```

### Caso 3: Ingresar y guardar mediciones

```
1. Haz clic en "Editar Niveles" (Datos)
2. Ingresa valores en las celdas de DUT y Patrón
3. Los cálculos se muestran automáticamente
4. Haz clic en "Guardar Todo"
5. Modal de "Guardando..." aparece
6. Datos se guardan en BD
7. La página se recarga con los nuevos datos
```

### Caso 4: Cambiar nivel_tension sin perder datos

```
Antes:  Nivel 1 = 100 kV (con 5 mediciones guardadas)
        ↓
1. Haz clic en "Editar Niveles"
2. Cambia "Nivel 1" de 100 → 200 kV
3. Las mediciones permanecen iguales
4. Haz clic en "Guardar Todo"
5. Resultado: Nivel 1 ahora = 200 kV (SIN perder mediciones)
```

---

## Flujo Recomendado

### Primera Vez (Configuración Completa)

```
1. Editar Parámetros
   └─ SFx, SFref
   └─ Número de pruebas (SF, LT, ST)
   └─ Guardar

2. Editar Niveles
   └─ Ingresar mediciones
   └─ Guardar

3. Regenerar Resultados
   └─ Clic en "Regenerar Resultados"
```

### Actualizaciones Posteriores

```
Opción A: Solo cambiar mediciones
└─ Editar Niveles → Guardar

Opción B: Solo cambiar parámetros
└─ Editar Parámetros → Guardar

Opción C: Cambiar ambas (usar DESPUÉS)
└─ Editar Parámetros → Guardar
└─ Editar Niveles → Guardar
```

---

## Mensajes de Error Común

| Error                                       | Causa             | Solución                                  |
| ------------------------------------------- | ----------------- | ----------------------------------------- |
| "Se requieren ambos valores (SFx y SFref)"  | Faltan parámetros | Ingresa ambos valores                     |
| "Las pruebas de SF deben estar entre 0 y 5" | Número inválido   | Selecciona número 0-5                     |
| "Por favor ingresa al menos una medición"   | No hay datos      | Ingresa al menos un valor en DUT o Patrón |
| "Error al guardar" + detalles en consola    | Error de BD       | Abre F12 y revisa console para detalles   |

---

## Atajos y Tips

💡 **Pegar datos rápido**: Copia columna de Excel → Botón "Pegar" → Automático  
💡 **Limpiar rápido**: Botón "Limpiar columna" borra todo en esa columna  
💡 **Cancelar cambios**: Botón "Cancelar" restaura todo a como estaba  
💡 **Ver detalles**: F12 → Console para ver logs detallados del proceso  
💡 **Regenerar**: Botón "Regenerar Resultados" después de cualquier cambio importante

---

## Soporte

Si algo no funciona:

1. Abre la consola (F12)
2. Intenta la operación de nuevo
3. Copia los logs de la consola
4. Contacta con soporte con los logs
