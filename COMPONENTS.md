# Estructura de Componentes y Servicios

Este documento describe la organización de los componentes y servicios del proyecto, así como sus relaciones principales.

## Componentes

- **administrative-data**

  - Ubicación: `src/app/Components/administrative-data/`
  - Descripción: Gestiona y muestra datos administrativos.

- **dcc**

  - Ubicación: `src/app/Components/dcc/`
  - Descripción: Componente principal para la gestión DCC. Permite crear DCC, cargar DCC existentes de bd y cargar archivos XML relacionados.

- **home**

  - Ubicación: `src/app/Components/home/`
  - Descripción: Página de inicio del sistema.

- **items**

  - Ubicación: `src/app/Components/items/`
  - Descripción: Muestra y gestiona los ítems del sistema.

- **navbar**

  - Ubicación: `src/app/Components/navbar/`
  - Descripción: Barra de navegación principal.

- **preview**

  - Ubicación: `src/app/Components/preview/`
  - Descripción: Vista previa de datos o resultados.

- **results**

  - Ubicación: `src/app/Components/results/`
  - Descripción: Muestra resultados generales y específicos.
  - Subcomponentes:
    - **pt23-results**: Resultados PT23.
    - **pt24-results**: Resultados PT24.

- **statements**
  - Ubicación: `src/app/Components/statements/`
  - Descripción: Gestión y visualización de declaraciones.

## Servicios

- **administrative-data.service**

  - Ubicación: `src/app/services/administrative-data.service.ts`
  - Descripción: Lógica y acceso a datos administrativos.

- **customer.service**

  - Ubicación: `src/app/services/customer.service.ts`
  - Descripción: Gestión de clientes.

- **dcc-data.service**

  - Ubicación: `src/app/services/dcc-data.service.ts`
  - Descripción: Lógica de datos DCC.

- **laboratory.service**

  - Ubicación: `src/app/services/laboratory.service.ts`
  - Descripción: Gestión de laboratorios.

- **pt23-xml-generator.service**

  - Ubicación: `src/app/services/pt23-xml-generator.service.ts`
  - Descripción: Generación de XML para PT23.

- **responsible-persons.service**
  - Ubicación: `src/app/services/responsible-persons.service.ts`
  - Descripción: Gestión de personas responsables.

## Relación entre Componentes y Servicios

- Los componentes consumen servicios para obtener y manipular datos.
- Los subcomponentes de `results` se encargan de mostrar resultados específicos y pueden compartir servicios.
- El componente `navbar` permite la navegación entre los diferentes componentes principales.

## Notas

- Puedes agregar diagramas o ampliar las descripciones según evolucione el proyecto.
- Actualiza este documento cuando se agreguen nuevos componentes o servicios.
