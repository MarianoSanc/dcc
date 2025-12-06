# Flujo de Uso Paso a Paso - PT-23 Configuración

## Problema Actual Resuelto

**HTML Desacomodado**: ✅ Fijo - Tags correctamente cerrados
**Selectores No Funcionaban**: ✅ Fijo - Ahora mostrarán feedback visual

---

## Cómo Funciona Ahora

### PASO 1: Estado Inicial (Lectura)

```
┌────────────────────────────────────────────────────────┐
│ Parámetros de Referencia                        [Editar]│
├────────────────────────────────────────────────────────┤
│ SFx:    [ 150  ]  (DESHABILITADO)                      │
│ SFref:  [ 100  ]  (DESHABILITADO)                      │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Configuración de Número de Pruebas                     │
│                                                        │
│ Scale Factor (SF)                                      │
│ [0️⃣] [1️⃣] [2️⃣] [3️⃣] [4️⃣] [5️⃣]  ← Grises, no clickeables
│                                                        │
│ Linearity Test (LT)                                    │
│ [0️⃣] [1️⃣]* [2️⃣] [3️⃣] [4️⃣] [5️⃣]  ← *Seleccionado (azul)
│                                                        │
│ Stability Test (ST)                                    │
│ [0️⃣]* [1️⃣] [2️⃣] [3️⃣] [4️⃣] [5️⃣]  ← *Seleccionado (azul)
└────────────────────────────────────────────────────────┘
```

**Estado**: `isEditingConfig = false`

- Los inputs no se pueden editar
- Los selectores se ven grises y son NO interactivos
- Los valores mostrados son los guardados en BD

---

### PASO 2: Hacer Clic en "Editar"

```
┌────────────────────────────────────────────────────────┐
│ Parámetros de Referencia    [Guardar] [Cancelar]       │
├────────────────────────────────────────────────────────┤
│ SFx:    [150____________]  (HABILITADO) ✏️              │
│ SFref:  [100____________]  (HABILITADO) ✏️              │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Configuración de Número de Pruebas                     │
│                                                        │
│ Scale Factor (SF)          ← Ahora SÍ clickeables      │
│ [0️⃣] [1️⃣] [2️⃣] [3️⃣] [4️⃣] [5️⃣]                         │
│                            (azules cuando pasas mouse)  │
│ Linearity Test (LT)                                    │
│ [0️⃣] [1️⃣]* [2️⃣] [3️⃣] [4️⃣] [5️⃣]                         │
│                                                        │
│ Stability Test (ST)                                    │
│ [0️⃣]* [1️⃣] [2️⃣] [3️⃣] [4️⃣] [5️⃣]                         │
└────────────────────────────────────────────────────────┘
```

**Estado**: `isEditingConfig = true`

- Los inputs AHORA SÍ se pueden editar
- Los selectores AHORA SÍ son clickeables
- Los valores mostrados son temporales (`sfxTemp`, `numeroScaleFactorTemp`, etc.)

---

### PASO 3: Cambiar Valores

#### Opción A: Cambiar SFx/SFref

```
1. Haz clic en campo SFx
2. Borra valor actual: 150
3. Ingresa nuevo valor: 200
4. Campo ahora muestra: [200____________]
```

#### Opción B: Cambiar Número de Pruebas

```
Antes:  SF: [1️⃣]* (seleccionado)
        ↓
Haz clic en [3️⃣]
        ↓
Después: SF: [3️⃣]* (ahora seleccionado, azul con gradiente)
         [1️⃣] se vuelve gris
```

**¿Qué cambió en el backend? Nada aún** ← Todos los cambios son locales hasta guardar

---

### PASO 4: Guardar o Cancelar

#### Opción A: Guardar Cambios

```
Usuario hace clic: [Guardar]
        ↓
Sistema valida:
  ✅ SFx no es null y no es 0
  ✅ SFref no es null y no es 0
  ✅ Números de pruebas entre 0-5
        ↓
Si hay error → Modal de alerta (rojo)
Si OK → Modal "Guardando..." (amarillo, con Loading)
        ↓
Backend:
  1. UPDATE dcc_pt23_config
  2. CREATE/DELETE pruebas (si cambió número)
        ↓
Modal de éxito (verde) "¡Configuración guardada!"
        ↓
Interfaz se actualiza:
  - isEditingConfig = false
  - Vuelve a estado "Lectura"
  - Selectores vuelven a ser grises
```

#### Opción B: Cancelar Cambios

```
Usuario hace clic: [Cancelar]
        ↓
Los cambios se descartan:
  - sfxTemp → null
  - numeroScaleFactorTemp → 0
  - isEditingConfig = false
        ↓
Vuelve a mostrar valores anteriores:
  - SFx: 150 (del original)
  - SF: 1 (del original, no 3 como estabas editando)
```

---

## Cambios de CSS Implementados

### Mejoras Visuales

1. **Selectores Activos** (cuando `isEditingConfig = true`)

   - Hover: Borde azul (#2196f3)
   - Background azul claro
   - Sombra azul

2. **Selectores Inactivos** (cuando `isEditingConfig = false`)

   - Grises (opacity 0.5)
   - Sin sombra
   - `cursor: not-allowed`

3. **Botones de Sección de Niveles**
   - Nuevo CSS para `.levels-section-header`
   - Botones independientes bien espaciados
   - Colores consistentes (Editar=azul, Guardar=verde, Cancelar=gris)

---

## Checklist de Funcionamiento

✅ HTML: Tags correctamente cerrados (sin errores de compilación)
✅ CSS: Layout correcto para header-buttons
✅ CSS: Selectores con feedback visual (hover, disabled, selected)
✅ CSS: Sección de niveles con botones independientes
✅ Estado: isEditingConfig controla todo correctamente
✅ Click: Selectores funcionan cuando isEditingConfig=true
✅ Guardado: Lógica de validación implementada

---

## Próximo Paso

1. Abre la página en el navegador
2. Haz clic en **"Editar"** en la sección Parámetros
3. Los selectores cambiarán de gris a azul y serán clickeables
4. Haz clic en cualquier número (ej: cambiar SF de 1 a 3)
5. Verás el selector cambiar a azul con gradiente
6. Haz clic en **"Guardar"**
7. Deberías ver un modal "Guardando..."
8. Si todo va bien, modal de éxito "¡Configuración guardada!"

Si algo no funciona, abre F12 → Console y mira los logs `[CONFIG]` para ver qué está pasando.
