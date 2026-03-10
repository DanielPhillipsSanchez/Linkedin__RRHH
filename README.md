# LinkedIn HHRR Candidate Screener

Extension de navegador para equipos de Recursos Humanos que permite evaluar candidatos de LinkedIn en segundos, clasificarlos en niveles de contratacion y generar mensajes de contacto personalizados — todo desde el perfil de LinkedIn sin salir de la pagina.

---

## Tabla de Contenidos

1. [Que hace esta extension](#que-hace-esta-extension)
2. [Requisitos previos](#requisitos-previos)
3. [Instalacion en Chrome](#instalacion-en-chrome)
4. [Configuracion inicial](#configuracion-inicial)
5. [Uso diario paso a paso](#uso-diario-paso-a-paso)
6. [Sistema de clasificacion por niveles](#sistema-de-clasificacion-por-niveles)
7. [Generacion de mensajes](#generacion-de-mensajes)
8. [Exportar candidatos a CSV](#exportar-candidatos-a-csv)
9. [Estructura del proyecto](#estructura-del-proyecto)
10. [Desarrollo local](#desarrollo-local)
11. [Preguntas frecuentes](#preguntas-frecuentes)

---

## Que hace esta extension

La extension automatiza el flujo de trabajo de un reclutador:

1. **Abre un perfil de LinkedIn** — la extension extrae automaticamente las habilidades, experiencia, educacion y resumen del candidato.
2. **Evalua al candidato** — compara sus datos contra una descripcion de puesto (JD) guardada, usando coincidencia por palabras clave + inteligencia artificial (Claude AI) para resolver sinonimos y habilidades implicitas.
3. **Clasifica en niveles** — asigna al candidato un nivel (Layer 1, 2, 3 o Rechazado) segun el porcentaje de coincidencia.
4. **Genera un mensaje personalizado** — crea automaticamente un mensaje de contacto adaptado al nivel del candidato.
5. **Exporta a CSV** — permite descargar un archivo con todos los candidatos evaluados, incluyendo puntajes, habilidades y mensajes enviados.

---

## Requisitos previos

| Requisito | Detalle |
|-----------|---------|
| **Navegador** | Google Chrome (version 113 o superior) |
| **Cuenta LinkedIn** | Sesion activa en LinkedIn |
| **API Key de Claude** | Clave de API de Anthropic (Claude). Se obtiene en [console.anthropic.com](https://console.anthropic.com/) |
| **Node.js** | Version 18+ (solo para desarrollo, no para uso) |

---

## Instalacion en Chrome

### Opcion A: Cargar desde carpeta de build

1. Abre Chrome y navega a `chrome://extensions/`
2. Activa el **Modo de desarrollador** (esquina superior derecha)
3. Haz clic en **"Cargar extension sin empaquetar"** (Load unpacked)
4. Selecciona la carpeta: `linkedin-hhrh-screener/output/chrome-mv3/`
5. La extension aparecera en la barra de herramientas de Chrome

### Opcion B: Compilar desde el codigo fuente

```bash
cd linkedin-hhrh-screener
pnpm install
pnpm wxt build
```

Luego carga la carpeta `.output/chrome-mv3/` siguiendo los pasos de la Opcion A.

---

## Configuracion inicial

Antes de evaluar candidatos, debes configurar dos cosas: tu clave de API y al menos una descripcion de puesto.

### 1. Configurar la API Key de Claude

1. Haz clic en el icono de la extension en la barra de Chrome
2. Haz clic en **"Settings"** (enlace en la esquina superior derecha del popup)
3. En la pagina de opciones, pega tu clave de API de Claude en el campo **API Key**
4. Haz clic en **"Save & Validate"**
5. Debe aparecer un mensaje de confirmacion en verde si la clave es valida

> **Seguridad:** La clave se almacena exclusivamente en el contexto del service worker. Nunca se expone al contenido de la pagina web ni se transmite a ningun servidor excepto la API de Anthropic.

### 2. Crear una Descripcion de Puesto (JD)

1. En la misma pagina de opciones, busca la seccion de **Job Descriptions**
2. Escribe un **titulo** para el puesto (ej: "Senior Backend Engineer")
3. Pega el **texto completo** de la descripcion del puesto
4. Haz clic en **"Add JD"**
5. Una vez creada, agrega las **habilidades** relevantes:
   - Escribe el nombre de la habilidad (ej: "Python", "React", "SQL")
   - Selecciona su peso: **Mandatory** (obligatoria) o **Nice-to-have** (deseable)
   - Haz clic en **"Add Skill"**
6. Repite para todas las habilidades del puesto

### 3. Seleccionar la JD activa

- Marca el **radio button** junto a la JD que deseas usar para las evaluaciones actuales
- Puedes cambiar la JD activa en cualquier momento

---

## Uso diario paso a paso

### Evaluar un candidato

1. **Navega a un perfil de LinkedIn** (ej: `linkedin.com/in/nombre-candidato`)
2. Espera 1-2 segundos para que la extension extraiga los datos del perfil
3. Haz clic en el **icono de la extension** en la barra de Chrome
4. Haz clic en el boton **"Evaluate"**
5. Espera unos segundos (la extension primero hace coincidencia por keywords, luego consulta a Claude AI para resolver sinonimos)
6. Veras el resultado:
   - **Nivel** (Layer 1, Layer 2, Layer 3 o Rejected) con color indicativo
   - **Porcentaje de coincidencia**
   - **Habilidades coincidentes** — lista de skills que el candidato cumple
   - **Habilidades faltantes** — skills obligatorias que no se encontraron
   - **Justificacion de Claude** — explicacion breve de por que recibio ese nivel

### Generar y enviar un mensaje de contacto

1. Despues de evaluar (si el candidato NO es Rechazado), aparece la seccion **"Outreach Message"**
2. Haz clic en **"Generate Message"** — Claude genera un mensaje personalizado segun el nivel:
   - **Layer 1**: tono directo y entusiasta
   - **Layer 2**: tono exploratorio
   - **Layer 3**: tono de oportunidad futura
3. **Edita el mensaje** en el area de texto si deseas ajustarlo
4. Usa los botones de accion:
   - **Copy**: copia el mensaje al portapapeles
   - **Open LinkedIn Message**: abre la ventana de mensajes de LinkedIn con el candidato preseleccionado
   - **Mark as Sent**: guarda el texto del mensaje y la fecha de envio en el registro del candidato

### Exportar candidatos a CSV

1. En el popup de la extension, haz clic en **"Export CSV"**
2. Se descargara un archivo `hhrh-candidates-YYYY-MM-DD.csv` con las columnas:
   - Nombre del candidato
   - Titulo/Headline
   - URL de LinkedIn
   - Nivel (Layer 1/2/3/Rejected)
   - Porcentaje de coincidencia
   - Habilidades coincidentes (separadas por punto y coma)
   - Habilidades faltantes (separadas por punto y coma)
   - Fecha de evaluacion
   - Fecha de contacto (solo para Layer 3, 7 dias despues de la evaluacion)
   - Texto del mensaje de contacto enviado

---

## Sistema de clasificacion por niveles

| Nivel | Rango | Significado | Accion recomendada |
|-------|-------|-------------|-------------------|
| **Layer 1** | 80% o mas | Excelente coincidencia | Contactar inmediatamente, prioridad alta |
| **Layer 2** | 71% - 79% | Buena coincidencia | Contactar como segunda prioridad |
| **Layer 3** | 60% - 70% | Coincidencia parcial | Contactar despues de 7 dias (dar prioridad a L1/L2) |
| **Rejected** | Menos de 60% | No cumple requisitos minimos | No continuar con este candidato |

### Como se calcula el puntaje

1. **Coincidencia por palabras clave**: compara las habilidades del candidato con las del puesto (incluyendo substrings bidireccionales, ej: "React" coincide con "React.js")
2. **Refinamiento con Claude AI**: para habilidades no coincidentes, Claude analiza el perfil completo para detectar sinonimos y experiencia implicita (ej: "Machine Learning" puede coincidir con experiencia en "Data Science")
3. **Ponderacion**: las habilidades **Mandatory** tienen el doble de peso que las **Nice-to-have**
4. **Calculo final**: `puntaje = (puntos obtenidos / puntos posibles) * 100`

---

## Generacion de mensajes

La extension genera mensajes personalizados usando Claude AI. Cada nivel tiene un tono diferente:

| Nivel | Tono del mensaje | Ejemplo de enfoque |
|-------|-----------------|-------------------|
| **Layer 1** | Directo y entusiasta | "Tu experiencia en X es exactamente lo que buscamos..." |
| **Layer 2** | Exploratorio | "Me gustaria conocer mas sobre tu experiencia en..." |
| **Layer 3** | Oportunidad futura | "Tenemos roles en desarrollo que podrian alinearse con tu perfil..." |

Los mensajes:
- Usan el nombre del candidato
- Hacen referencia a experiencia especifica de su perfil
- Tienen menos de 300 palabras
- Son completamente editables antes de enviar
- Nunca se envian automaticamente — el reclutador siempre revisa y decide

---

## Exportar candidatos a CSV

El archivo CSV incluye toda la informacion necesaria para reportes y seguimiento:

| Columna | Descripcion |
|---------|-------------|
| Name | Nombre completo del candidato |
| Title | Headline de LinkedIn |
| LinkedIn URL | Enlace directo al perfil |
| Tier | Nivel asignado (Layer 1, Layer 2, Layer 3, Rejected) |
| Match Score (%) | Porcentaje de coincidencia |
| Matched Skills | Habilidades que coinciden (separadas por `;`) |
| Missing Skills | Habilidades obligatorias faltantes (separadas por `;`) |
| Evaluation Date | Fecha de evaluacion (YYYY-MM-DD) |
| Contact After | Fecha sugerida de contacto para Layer 3 (evaluacion + 7 dias) |
| Outreach Message Sent | Texto del mensaje marcado como enviado |

---

## Estructura del proyecto

```
linkedin-hhrh-screener/
  entrypoints/
    background.ts          # Service worker: maneja API calls, scoring, mensajes
    content.ts             # Content script: extrae datos del perfil de LinkedIn
    popup/
      index.html           # UI del popup de la extension
      index.ts             # Logica del popup (evaluar, mensajes, CSV)
      style.css            # Estilos del popup
    options/
      index.html           # Pagina de configuracion (API key, JDs)
      index.ts             # Logica de configuracion
  src/
    parser/
      parser.ts            # Extraccion de datos del DOM de LinkedIn
      selectors.ts         # Selectores CSS centralizados
      types.ts             # Tipos de datos del candidato
    scorer/
      scorer.ts            # Motor de coincidencia por keywords
      tiers.ts             # Asignacion de niveles (L1/L2/L3/Rejected)
      claude.ts            # Refinamiento con Claude AI
      messenger.ts         # Generacion de mensajes de contacto
    shared/
      messages.ts          # Tipos de mensajes entre componentes
      csv.ts               # Generacion y descarga de CSV
    storage/
      schema.ts            # Esquema de almacenamiento local
      storage.ts           # Operaciones CRUD sobre browser.storage.local
  tests/                   # Tests unitarios (Vitest)
```

---

## Desarrollo local

### Instalar dependencias

```bash
cd linkedin-hhrh-screener
pnpm install
```

### Ejecutar en modo desarrollo (hot reload)

```bash
pnpm wxt dev
```

Esto abre Chrome con la extension cargada automaticamente. Los cambios en el codigo se reflejan al instante.

### Ejecutar tests

```bash
pnpm vitest run
```

### Compilar para produccion

```bash
pnpm wxt build
```

La salida estara en `.output/chrome-mv3/`.

---

## Preguntas frecuentes

### La extension no detecta el perfil de LinkedIn

- Asegurate de estar en una URL con formato `linkedin.com/in/nombre`
- Espera a que la pagina cargue completamente (1-2 segundos)
- Si navegaste desde otro perfil (SPA), la extension deberia re-extraer automaticamente

### El boton "Evaluate" muestra un error

| Error | Solucion |
|-------|---------|
| "No profile data" | Navega a un perfil de LinkedIn y espera a que cargue |
| "No API key" | Ve a Settings y configura tu clave de Claude |
| "No active JD" | Ve a Settings y selecciona una descripcion de puesto |
| "Active JD has no skills" | Agrega habilidades a la JD seleccionada |
| "Background service worker not ready" | Recarga la extension desde `chrome://extensions/` |

### El puntaje parece bajo

- Verifica que las habilidades en la JD coincidan con los terminos que usa LinkedIn (ej: "JS" vs "JavaScript")
- Recuerda que habilidades **Mandatory** pesan el doble
- Claude AI resuelve sinonimos, pero no inventa habilidades que no estan en el perfil

### Donde se guardan los datos de los candidatos?

Todos los datos se almacenan localmente en `chrome.storage.local` (dentro de tu navegador). No se envian a ningun servidor. Los registros expiran automaticamente a los 90 dias (GDPR).

### Puedo usar la extension en Safari?

La extension esta disenada para funcionar en Safari via Safari Web Extension (Xcode). Esta funcionalidad sera habilitada en una fase futura (Phase 6).

---

## Privacidad y seguridad

- **Sin backend**: todos los datos se almacenan localmente en tu navegador
- **API Key segura**: la clave de Claude solo se usa desde el service worker, nunca se expone al contenido de la pagina
- **Sin scraping masivo**: la extension lee un perfil a la vez, solo cuando el reclutador navega a el
- **Expiracion automatica**: los registros de candidatos expiran a los 90 dias
- **Revision obligatoria**: ningun mensaje se envia sin la revision y aprobacion explicita del reclutador

---

*Desarrollado para equipos de RRHH — LinkedIn HHRR Candidate Screener v1*
