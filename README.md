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
12. [Instrucciones de prueba manual](#instrucciones-de-prueba-manual)

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
4. Haz clic en el boton **"Evaluate"** — el boton se desactivara mientras procesa
5. **Tiempo de espera: 10–20 segundos.** La extension primero hace coincidencia por keywords y luego consulta a Claude AI para resolver sinonimos e inferir habilidades implicitas. No hagas clic de nuevo mientras esperas — el resultado aparecera automaticamente.
6. Veras el resultado:
   - **Nivel** (Layer 1, Layer 2, Layer 3 o Rejected) con color indicativo
   - **Porcentaje de coincidencia**
   - **Habilidades coincidentes** — lista de skills que el candidato cumple
   - **Habilidades faltantes** — skills obligatorias que no se encontraron
   - **Justificacion de Claude** — explicacion breve de por que recibio ese nivel

### Generar y enviar un mensaje de contacto

1. Despues de evaluar (si el candidato NO es Rechazado), aparece la seccion **"Outreach Message"**
2. Haz clic en **"Generate Message"** — **Tiempo de espera: 5–10 segundos.** No hagas clic varias veces; el mensaje aparecera en el area de texto cuando este listo. Claude genera un mensaje personalizado segun el nivel:
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
2. Se descargara un archivo `hhrh-candidates-YYYY-MM-DD.csv` en **espanol** con las columnas:
   - Nombre, Telefono, Titulo, URL de LinkedIn
   - Nivel (Nivel 1/2/3/Descartado) y Puntuacion (%)
   - Habilidades coincidentes y faltantes (separadas por punto y coma)
   - Fecha de evaluacion y fecha de contacto (solo para Nivel 3)
   - Mensaje enviado
   - **Preguntas de verificacion + Respuesta esperada** para cada red flag del candidato (columnas pares: Pregunta 1, Respuesta esperada 1, Pregunta 2, etc.)

---

## Sistema de clasificacion por niveles

| Nivel | Rango | Significado | Accion recomendada |
|-------|-------|-------------|-------------------|
| **Nivel 1 — Encaje alto** | 75% o mas | Excelente coincidencia | Contactar inmediatamente, prioridad alta |
| **Nivel 2 — Buen encaje** | 63% - 74% | Buena coincidencia con alguna brecha menor | Contactar como segunda prioridad |
| **Nivel 3 — Encaje parcial** | 50% - 62% | Coincidencia parcial, vale la pena explorar | Contactar despues de 7 dias (dar prioridad a N1/N2) |
| **Descartado** | Menos de 50% | No cumple requisitos minimos | No continuar con este candidato |

### Como se calcula el puntaje

1. **Coincidencia por palabras clave**: compara las habilidades del candidato con las del puesto (incluyendo substrings bidireccionales, ej: "React" coincide con "React.js")
2. **Habilidades implicitas por rol**: Claude infiere habilidades estandar del rol aunque no esten listadas en el perfil. Por ejemplo, si el candidato trabaja como Data Scientist se asume que conoce numpy, pandas y scikit-learn aunque no aparezcan en su perfil de LinkedIn.
3. **Refinamiento con Claude AI**: para habilidades no coincidentes, Claude analiza sinonimos, herramientas relacionadas y experiencia laboral.
4. **Formula de dos cubos (80/20)**:
   - Habilidades **Mandatory** → 80% del puntaje final
   - Habilidades **Nice-to-have** → 20% del puntaje final
   - Esto garantiza que un candidato que cumple todas las obligatorias siempre obtiene al menos 80%, independientemente de cuantas habilidades deseables tenga la oferta.
5. **Resultado**: los umbrales son los mismos para cualquier tamano de JD (no hay penalizacion por ofertas con muchas habilidades).

---

## Generacion de mensajes

La extension genera mensajes personalizados usando Claude AI. Cada nivel tiene un tono diferente:

| Nivel | Tono del mensaje | Ejemplo de enfoque |
|-------|-----------------|-------------------|
| **Nivel 1** | Directo y entusiasta | "Tu experiencia en X es exactamente lo que buscamos..." |
| **Nivel 2** | Exploratorio | "Me gustaria conocer mas sobre tu experiencia en..." |
| **Nivel 3** | Oportunidad futura | "Tenemos roles en desarrollo que podrian alinearse con tu perfil..." |

Los mensajes:
- Usan el nombre del candidato
- Hacen referencia a experiencia especifica de su perfil
- Tienen menos de 300 palabras
- Son completamente editables antes de enviar
- Nunca se envian automaticamente — el reclutador siempre revisa y decide

---

## Exportar candidatos a CSV

El archivo CSV esta completamente en espanol e incluye toda la informacion necesaria para reportes y seguimiento:

| Columna | Descripcion |
|---------|-------------|
| Nombre | Nombre completo del candidato |
| Telefono | Numero de telefono (si fue ingresado manualmente) |
| Titulo | Headline de LinkedIn |
| URL de LinkedIn | Enlace directo al perfil |
| Nivel | Nivel asignado (Nivel 1 / 2 / 3 / Descartado) |
| Puntuacion (%) | Porcentaje de coincidencia con la oferta |
| Habilidades coincidentes | Skills que el candidato cumple (separadas por `;`) |
| Habilidades faltantes | Skills obligatorias que no se encontraron (separadas por `;`) |
| Fecha de evaluacion | Fecha en formato YYYY-MM-DD |
| Contactar despues de | Fecha sugerida para Nivel 3 (evaluacion + 7 dias) |
| Mensaje enviado | Texto del mensaje marcado como enviado |
| Pregunta de verificacion N | Pregunta tecnica de entrevista para la alerta N |
| Respuesta esperada N | Que responderia un candidato cualificado a esa pregunta |

> Las columnas de preguntas y respuestas se generan dinamicamente: si el candidato tiene 3 red flags, apareceran 6 columnas adicionales (Pregunta 1, Respuesta 1, Pregunta 2, Respuesta 2, Pregunta 3, Respuesta 3).

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
- Las habilidades **Mandatory** representan el 80% del puntaje — asegurate de marcarlas correctamente
- Claude infiere habilidades tipicas del rol (ej: numpy para un Data Scientist) aunque no esten listadas, pero si el perfil no da ninguna pista del dominio tecnico, no las asume
- Si la oferta tiene muchas habilidades Nice-to-have que el candidato no lista, el impacto es minimo gracias a la formula 80/20

### Donde se guardan los datos de los candidatos?

Todos los datos se almacenan localmente en `chrome.storage.local` (dentro de tu navegador). No se envian a ningun servidor. Los registros expiran automaticamente a los 90 dias (GDPR).

### Puedo usar la extension en Safari?

Actualmente la extension esta disenada y validada para **Google Chrome**. La compatibilidad con Safari no esta en el alcance actual.

---

## Privacidad y seguridad

- **Sin backend**: todos los datos se almacenan localmente en tu navegador
- **API Key segura**: la clave de Claude solo se usa desde el service worker, nunca se expone al contenido de la pagina
- **Sin scraping masivo**: la extension lee un perfil a la vez, solo cuando el reclutador navega a el
- **Expiracion automatica**: los registros de candidatos expiran a los 90 dias
- **Revision obligatoria**: ningun mensaje se envia sin la revision y aprobacion explicita del reclutador

---

## Instrucciones de prueba manual

Sigue estos pasos en orden para verificar que la extension funciona correctamente de extremo a extremo.

### Paso 1: Compilar y cargar la extension

```bash
cd ~/Documents/Linkedin__RRHH/linkedin-hhrh-screener
pnpm wxt build
```

1. Abre `chrome://extensions/`
2. Activa **Modo de desarrollador** (toggle arriba a la derecha)
3. Clic en **"Load unpacked"** → selecciona la carpeta `.output/chrome-mv3/`
4. **Verifica**: la extension aparece sin errores (sin boton rojo de "Errors")

### Paso 2: Configurar Settings

1. Clic en el icono de la extension → clic en **"Settings"**
2. **API Key**: pega tu clave de Claude → clic "Save & Validate" → debe mostrar checkmark verde
3. **Crear JD**: titulo = "Test Engineer", texto = cualquier descripcion
4. **Agregar skills**: agrega 3-4 habilidades (ej: "Python" mandatory, "React" mandatory, "Docker" nice-to-have)
5. **Seleccionar JD activa**: marca el radio button de la JD que creaste

### Paso 3: Evaluar un candidato

1. Navega a cualquier perfil publico de LinkedIn (ej: `linkedin.com/in/alguien`)
2. Espera 2 segundos
3. Clic en el icono de la extension → clic **"Evaluate"**
4. **Verificar**:
   - [ ] Se muestra un **nivel** (Nivel 1/2/3 o Descartado) con color
   - [ ] Se muestra el **porcentaje** de coincidencia
   - [ ] Se muestra lista de **habilidades coincidentes**
   - [ ] Se muestra lista de **habilidades faltantes**
   - [ ] Se muestra la **justificacion** de Claude (texto en italica)
   - [ ] Se muestran las **alertas de entrevista** (preguntas tecnicas) si hay red flags
   - [ ] El candidato aparece en **"Candidatos recientes"** al fondo del popup

### Paso 4: Generar mensaje de contacto

*(Solo si el candidato NO fue Rejected)*

1. Debe aparecer la seccion **"Outreach Message"** debajo del resultado
2. Clic **"Generate Message"** → esperar 5–10 segundos (no hacer clic de nuevo mientras espera)
3. **Verificar**:
   - [ ] Aparece un mensaje personalizado en el textarea
   - [ ] El mensaje menciona el nombre del candidato
   - [ ] El tono corresponde al nivel (entusiasta para L1, exploratorio para L2, futuro para L3)
4. **Editar**: modifica el texto en el textarea (debe ser editable)
5. Clic **"Copy"** → pegar en un editor de texto → confirmar que se copio correctamente
6. Clic **"Open LinkedIn Message"** → debe abrir nueva pestaña en LinkedIn messaging
7. Clic **"Mark as Sent"** → debe mostrar "Message marked as sent" en verde

### Paso 5: Navegar a otro perfil (deteccion SPA)

1. Sin cerrar la pestaña, navega a un **segundo perfil** de LinkedIn desde la barra de busqueda o un enlace
2. Espera 2 segundos
3. Clic en el icono → **"Evaluate"** de nuevo
4. **Verificar**:
   - [ ] Los resultados son **diferentes** al candidato anterior
   - [ ] El nombre del nuevo candidato aparece correctamente
   - [ ] Ahora hay **2 candidatos** en "Recent Candidates"

### Paso 6: Exportar CSV

1. En el popup, clic **"Export CSV"**
2. **Verificar**:
   - [ ] Se descarga un archivo `hhrh-candidates-YYYY-MM-DD.csv`
   - [ ] Abrirlo en Excel/Google Sheets — las columnas deben estar en **espanol**: Nombre, Telefono, Titulo, URL de LinkedIn, Nivel, Puntuacion (%), Habilidades coincidentes, Habilidades faltantes, Fecha de evaluacion, Contactar despues de, Mensaje enviado
   - [ ] Si el candidato tiene red flags, deben aparecer columnas adicionales: "Pregunta de verificacion 1", "Respuesta esperada 1", etc.
   - [ ] Los datos corresponden a los candidatos evaluados
   - [ ] Si evaluaste un candidato Nivel 3, la columna "Contactar despues de" tiene fecha
   - [ ] Si marcaste un mensaje como enviado, el texto aparece en la columna correspondiente

### Paso 7: Verificar errores controlados

1. Ve a Settings → borra la API key → guarda
2. Evalua un candidato → debe mostrar: **"No API key — please add your Claude API key in Options"**
3. Re-agrega la key → borra la JD activa
4. Evalua → debe mostrar: **"No active JD"**

> Si todos los pasos pasan correctamente, la extension esta validada y lista para uso.

---

*Desarrollado para equipos de RRHH — LinkedIn HHRR Candidate Screener v1*

