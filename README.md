# EvolvrScreener

Extension de navegador para equipos de Recursos Humanos que permite evaluar candidatos de LinkedIn en segundos, clasificarlos por nivel de encaje y generar mensajes de contacto personalizados — todo desde el perfil de LinkedIn sin salir de la pagina.

---

## Tabla de Contenidos

1. [Que hace esta extension](#que-hace-esta-extension)
2. [Requisitos previos](#requisitos-previos)
3. [Instalacion en Chrome](#instalacion-en-chrome)
4. [Configuracion inicial](#configuracion-inicial)
5. [Uso diario paso a paso](#uso-diario-paso-a-paso)
6. [Sistema de clasificacion por niveles](#sistema-de-clasificacion-por-niveles)
7. [Idioma y traducciones](#idioma-y-traducciones)
8. [Generacion de mensajes](#generacion-de-mensajes)
9. [Exportar candidatos a CSV](#exportar-candidatos-a-csv)
10. [Estructura del proyecto](#estructura-del-proyecto)
11. [Desarrollo local](#desarrollo-local)
12. [Preguntas frecuentes](#preguntas-frecuentes)
13. [Instrucciones de prueba manual](#instrucciones-de-prueba-manual)

---

## Que hace esta extension

EvolvrScreener automatiza el flujo de trabajo de un reclutador:

1. **Abre un perfil de LinkedIn** — la extension extrae automaticamente las habilidades, experiencia, educacion y resumen del candidato.
2. **Evalua al candidato** — compara sus datos contra un formulario de requisicion guardado, usando coincidencia por palabras clave + inteligencia artificial (Claude AI) para resolver sinonimos y habilidades implicitas del rol.
3. **Clasifica por nivel de encaje** — asigna al candidato un nivel (Encaje alto, Buen encaje, Encaje parcial o Descartado) segun el porcentaje de coincidencia.
4. **Genera un mensaje personalizado** — crea automaticamente un mensaje de contacto adaptado al nivel del candidato.
5. **Exporta a CSV** — permite descargar un archivo con todos los candidatos evaluados, incluyendo puntajes, habilidades y preguntas de entrevista.

---

## Requisitos previos

| Requisito | Detalle |
|-----------|---------|
| **Navegador** | Google Chrome (version 113 o superior) |
| **Cuenta LinkedIn** | Sesion activa en LinkedIn |
| **API Key de Claude** | Viene preconfigurada en el build distribuido. Para desarrollo, se obtiene en [console.anthropic.com](https://console.anthropic.com/) |
| **Node.js** | Version 18+ (solo para desarrollo, no para uso) |

---

## Instalacion en Chrome

### Opcion A: Cargar desde carpeta de build (uso en produccion)

1. Abre Chrome y navega a `chrome://extensions/`
2. Activa el **Modo de desarrollador** (esquina superior derecha)
3. Haz clic en **"Cargar extension sin empaquetar"**
4. Selecciona la carpeta: `linkedin-hhrh-screener/.output/chrome-mv3/`
5. La extension **EvolvrScreener** aparecera en la barra de herramientas de Chrome

### Opcion B: Compilar desde el codigo fuente

```bash
cd linkedin-hhrh-screener
pnpm install
pnpm wxt build
```

Luego carga la carpeta `.output/chrome-mv3/` siguiendo los pasos de la Opcion A.

> Para incluir una API key preconfigurada en el build, agrega `VITE_ANTHROPIC_API_KEY=sk-ant-...` en el archivo `.env` (que esta en `.gitignore` y nunca se sube a GitHub) antes de compilar.

---

## Configuracion inicial

### 1. Crear un Formulario de Requisicion

1. Haz clic en el icono de la extension en la barra de Chrome
2. Haz clic en **"Ajustes"** (enlace en la esquina superior derecha del popup)
3. En la pagina de configuracion, busca la seccion **"Formulario de requisicion"**
4. Escribe un **titulo** para el puesto (ej: "Senior Backend Engineer")
5. Pega el **texto completo** de la descripcion del puesto, o importa desde un archivo (Excel, CSV, Word o PDF)
6. Haz clic en **"Anadir oferta"**
7. Una vez creada, agrega las **habilidades** relevantes:
   - Escribe el nombre de la habilidad (ej: "Python", "React", "SQL")
   - Selecciona su peso: **Obligatoria** o **Valorable**
   - Haz clic en **"Anadir"**
8. Repite para todas las habilidades del puesto

### 2. Seleccionar la busqueda activa

- En la seccion **"Nueva busqueda de Evolvers"**, marca el radio button junto a la oferta que deseas usar
- Puedes cambiar la oferta activa en cualquier momento

### 3. API Key (solo si el build no la incluye)

Si el build no tiene API key preconfigurada:

1. En la pagina de **Ajustes**, busca la seccion **"Clave API de Claude"**
2. Pega tu clave de Anthropic en el campo correspondiente
3. Haz clic en **"Guardar y verificar"** — debe aparecer una confirmacion en verde

---

## Uso diario paso a paso

### Evaluar un candidato

1. **Navega a un perfil de LinkedIn** (ej: `linkedin.com/in/nombre-candidato`)
2. Espera 1-2 segundos para que la extension extraiga los datos del perfil
3. Haz clic en el **icono de EvolvrScreener** en la barra de Chrome
4. Si ya evaluaste este perfil antes, el resultado se restaura automaticamente
5. Haz clic en **"Evaluar"** — el boton se desactivara mientras procesa
6. **Tiempo de espera: 10–20 segundos.** La extension hace coincidencia por keywords y luego consulta a Claude AI. No hagas clic de nuevo — el resultado aparece automaticamente.
7. Veras el resultado:
   - **Nivel de encaje** (Encaje alto / Buen encaje / Encaje parcial / Descartado) con color indicativo
   - **Porcentaje de coincidencia**
   - **Nivel de experiencia** (Junior / Mid / Senior / Staff)
   - **Habilidades que encajan** — skills que el candidato cumple
   - **Habilidades que faltan** — skills obligatorias no encontradas
   - **Analisis de Claude** — justificacion del nivel asignado
   - **Alertas de entrevista** — preguntas tecnicas especificas para verificar el perfil

### Cambiar idioma

- Haz clic en las banderas **🇨🇴 🇺🇸** en la esquina superior derecha del popup
- La bandera del idioma activo aparece resaltada con un borde naranja oscuro
- Al cambiar de idioma, el analisis y las alertas se traducen automaticamente (5–10 segundos)
- Si cierras y reabres el popup, el resultado guardado se muestra y puedes traducirlo sin volver a evaluar

### Generar y enviar un mensaje de contacto

1. Despues de evaluar (si el candidato NO es Descartado), aparece la seccion **"Mensaje de contacto"**
2. Haz clic en **"Redactar mensaje"** — **Tiempo de espera: 5–10 segundos.** No hagas clic varias veces.
   - **Encaje alto**: tono directo y entusiasta
   - **Buen encaje**: tono exploratorio
   - **Encaje parcial**: tono de oportunidad futura
3. **Edita el mensaje** en el area de texto si deseas ajustarlo
4. Usa los botones de accion:
   - **Copiar**: copia el mensaje al portapapeles
   - **Abrir en LinkedIn**: abre la ventana de mensajes de LinkedIn con el candidato preseleccionado
   - **Marcar como enviado**: guarda el texto del mensaje y la fecha de envio en el registro del candidato

### Exportar candidatos a CSV

1. En el popup, haz clic en **"Exportar CSV"**
2. Se descargara un archivo `hhrh-candidates-YYYY-MM-DD.csv` en espanol con todas las columnas de seguimiento

---

## Sistema de clasificacion por niveles

| Nivel | Rango | Significado | Accion recomendada |
|-------|-------|-------------|-------------------|
| **Encaje alto** | 75% o mas | Excelente coincidencia | Contactar inmediatamente, prioridad alta |
| **Buen encaje** | 63% - 74% | Buena coincidencia con alguna brecha menor | Contactar como segunda prioridad |
| **Encaje parcial** | 50% - 62% | Coincidencia parcial, vale la pena explorar | Contactar despues de 7 dias (dar prioridad a los anteriores) |
| **Descartado** | Menos de 50% | No cumple requisitos minimos | No continuar con este candidato |

### Como se calcula el puntaje

1. **Coincidencia por palabras clave**: compara las habilidades del candidato con las del puesto (incluyendo substrings bidireccionales, ej: "React" coincide con "React.js")
2. **Habilidades implicitas por rol**: Claude infiere habilidades estandar del rol aunque no esten listadas. Por ejemplo, un Data Scientist con anos de experiencia se asume que conoce numpy, pandas y scikit-learn. Git se asume para cualquier rol tecnico sin excepcion.
3. **Refinamiento con Claude AI**: para habilidades no coincidentes, Claude analiza sinonimos, herramientas relacionadas y experiencia laboral.
4. **Formula de dos cubos (80/20)**:
   - Habilidades **Obligatorias** → 80% del puntaje final
   - Habilidades **Valorables** → 20% del puntaje final
5. **Resultado**: los umbrales son los mismos para cualquier tamano de oferta (no hay penalizacion por ofertas con muchas habilidades).

---

## Idioma y traducciones

La extension soporta **espanol** e **ingles** de forma completa:

- El selector de idioma muestra las banderas 🇨🇴 (espanol) y 🇺🇸 (ingles) en el header del popup
- La bandera del idioma activo aparece resaltada con un borde naranja oscuro
- Cambiar de idioma traduce la interfaz, el analisis de Claude y las alertas de entrevista
- La evaluacion se genera en el idioma activo al momento de hacer clic en "Evaluar"
- Si cierras el popup y lo vuelves a abrir en el mismo perfil, el resultado se restaura y puedes traducirlo sin necesidad de re-evaluar

---

## Generacion de mensajes

EvolvrScreener genera mensajes personalizados usando Claude AI. El tono varia segun el nivel:

| Nivel | Tono del mensaje | Ejemplo de enfoque |
|-------|-----------------|-------------------|
| **Encaje alto** | Directo y entusiasta | "Tu experiencia en X es exactamente lo que buscamos..." |
| **Buen encaje** | Exploratorio | "Me gustaria conocer mas sobre tu experiencia en..." |
| **Encaje parcial** | Oportunidad futura | "Tenemos roles en desarrollo que podrian alinearse con tu perfil..." |

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
| Nivel | Nivel asignado (Encaje alto / Buen encaje / Encaje parcial / Descartado) |
| Puntuacion (%) | Porcentaje de coincidencia con la oferta |
| Habilidades coincidentes | Skills que el candidato cumple (separadas por `;`) |
| Habilidades faltantes | Skills obligatorias que no se encontraron (separadas por `;`) |
| Fecha de evaluacion | Fecha en formato YYYY-MM-DD |
| Contactar despues de | Fecha sugerida para Encaje parcial (evaluacion + 7 dias) |
| Mensaje enviado | Texto del mensaje marcado como enviado |
| Pregunta de verificacion N | Pregunta tecnica de entrevista para la alerta N |
| Respuesta esperada N | Que responderia un candidato cualificado a esa pregunta |

> Las columnas de preguntas y respuestas se generan dinamicamente: si el candidato tiene 3 alertas, apareceran 6 columnas adicionales.

---

## Estructura del proyecto

```
linkedin-hhrh-screener/
  entrypoints/
    background.ts          # Service worker: maneja API calls, scoring, mensajes
    content.ts             # Content script: extrae datos del perfil de LinkedIn
    popup/
      index.html           # UI del popup de la extension
      index.ts             # Logica del popup (evaluar, mensajes, CSV, traducciones)
      style.css            # Estilos del popup
    options/
      index.html           # Pagina de configuracion (Ajustes)
      index.ts             # Logica de configuracion
  src/
    i18n.ts                # Traducciones ES/EN de toda la interfaz
    parser/
      parser.ts            # Extraccion de datos del DOM de LinkedIn
      selectors.ts         # Selectores CSS centralizados
      types.ts             # Tipos de datos del candidato
    scorer/
      scorer.ts            # Motor de coincidencia por keywords
      tiers.ts             # Asignacion de niveles de encaje
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

La salida estara en `.output/chrome-mv3/`. Para incluir una API key preconfigurada, agrega `VITE_ANTHROPIC_API_KEY=sk-ant-...` en `.env` antes de compilar.

---

## Preguntas frecuentes

### La extension no detecta el perfil de LinkedIn

- Asegurate de estar en una URL con formato `linkedin.com/in/nombre`
- Espera a que la pagina cargue completamente (1-2 segundos)
- Si navegaste desde otro perfil, la extension re-extrae automaticamente

### El boton "Evaluar" muestra un error

| Error en pantalla | Solucion |
|-------------------|---------|
| "No hay datos del perfil" | Navega a un perfil de LinkedIn y espera a que cargue |
| "No hay clave API" | Ve a Ajustes y configura tu clave de Claude |
| "No hay ninguna oferta activa" | Ve a Ajustes y selecciona un formulario de requisicion |
| "La oferta activa no tiene habilidades" | Agrega habilidades a la oferta seleccionada |
| "El servicio en segundo plano no esta listo" | Recarga la extension desde `chrome://extensions/` |

### El puntaje parece bajo

- Verifica que las habilidades en la oferta coincidan con los terminos que usa LinkedIn (ej: "JS" vs "JavaScript")
- Las habilidades **Obligatorias** representan el 80% del puntaje — asegurate de marcarlas correctamente
- Claude infiere habilidades tipicas del rol (git para cualquier cargo tecnico, numpy para Data Scientists, etc.) aunque no esten listadas
- Si la oferta tiene muchas habilidades Valorables que el candidato no lista, el impacto es minimo gracias a la formula 80/20

### Donde se guardan los datos de los candidatos?

Todos los datos se almacenan localmente en `chrome.storage.local` (dentro de tu navegador). No se envian a ningun servidor excepto la API de Anthropic para el analisis. Los registros expiran automaticamente a los 90 dias.

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
3. Clic en **"Cargar extension sin empaquetar"** → selecciona la carpeta `.output/chrome-mv3/`
4. **Verifica**: la extension aparece como **"EvolvrScreener"** sin errores (sin boton rojo de "Errors")

### Paso 2: Configurar Ajustes

1. Clic en el icono de la extension → clic en **"Ajustes"**
2. **Clave API**: si no viene preconfigurada, pega tu clave → clic "Guardar y verificar" → debe mostrar confirmacion verde
3. **Crear oferta**: en "Formulario de requisicion", titulo = "Test Engineer", texto = cualquier descripcion → clic "Anadir oferta"
4. **Agregar habilidades**: agrega 3-4 habilidades (ej: "Python" obligatoria, "React" obligatoria, "Docker" valorable) → clic "Anadir" para cada una
5. **Seleccionar busqueda activa**: en "Nueva busqueda de Evolvers", marca el radio button de la oferta que creaste

### Paso 3: Evaluar un candidato

1. Navega a cualquier perfil publico de LinkedIn (ej: `linkedin.com/in/alguien`)
2. Espera 2 segundos
3. Clic en el icono de la extension → clic **"Evaluar"**
4. **Verificar**:
   - [ ] Se muestra un **nivel de encaje** (Encaje alto / Buen encaje / Encaje parcial / Descartado) con color
   - [ ] Se muestra el **porcentaje** de coincidencia
   - [ ] Se muestra el **nivel de experiencia** (Junior / Mid / Senior / Staff)
   - [ ] Se muestra lista de **habilidades que encajan**
   - [ ] Se muestra lista de **habilidades que faltan**
   - [ ] Se muestra el **analisis** de Claude
   - [ ] Se muestran las **alertas de entrevista** (preguntas tecnicas) si hay red flags
   - [ ] El candidato aparece en **"Candidatos recientes"** al fondo del popup

### Paso 4: Persistencia del resultado

1. Cierra el popup
2. Vuelve a abrirlo en el mismo perfil de LinkedIn
3. **Verificar**: el resultado del candidato se muestra automaticamente sin necesidad de evaluar de nuevo

### Paso 5: Cambio de idioma

1. Con un resultado visible, haz clic en la bandera 🇺🇸
2. **Verificar**:
   - [ ] La bandera de USA queda resaltada con borde naranja
   - [ ] La interfaz cambia a ingles
   - [ ] El analisis y las alertas se traducen (5–10 segundos)
3. Haz clic en la bandera 🇨🇴 para volver a espanol
4. **Verificar**: el resultado original en espanol se restaura sin nueva llamada a la API

### Paso 6: Generar mensaje de contacto

*(Solo si el candidato NO fue Descartado)*

1. Debe aparecer la seccion **"Mensaje de contacto"** debajo del resultado
2. Clic **"Redactar mensaje"** → esperar 5–10 segundos (no hacer clic de nuevo mientras espera)
3. **Verificar**:
   - [ ] Aparece un mensaje personalizado en el area de texto
   - [ ] El mensaje menciona el nombre del candidato
   - [ ] El tono corresponde al nivel (entusiasta para Encaje alto, exploratorio para Buen encaje, futuro para Encaje parcial)
4. **Editar**: modifica el texto (debe ser editable)
5. Clic **"Copiar"** → pegar en un editor de texto → confirmar que se copio correctamente
6. Clic **"Abrir en LinkedIn"** → debe abrir nueva pestana en LinkedIn messaging
7. Clic **"Marcar como enviado"** → debe mostrar confirmacion en verde

### Paso 7: Navegar a otro perfil (deteccion SPA)

1. Sin cerrar la pestana, navega a un **segundo perfil** de LinkedIn
2. Espera 2 segundos
3. Clic en el icono → **"Evaluar"** de nuevo
4. **Verificar**:
   - [ ] Los resultados son **diferentes** al candidato anterior
   - [ ] El nombre del nuevo candidato aparece correctamente
   - [ ] Ahora hay **2 candidatos** en "Candidatos recientes"

### Paso 8: Exportar CSV

1. En el popup, clic **"Exportar CSV"**
2. **Verificar**:
   - [ ] Se descarga un archivo `hhrh-candidates-YYYY-MM-DD.csv`
   - [ ] Abrirlo en Excel/Google Sheets — las columnas deben estar en espanol: Nombre, Telefono, Titulo, URL de LinkedIn, Nivel, Puntuacion (%), Habilidades coincidentes, Habilidades faltantes, Fecha de evaluacion, Contactar despues de, Mensaje enviado
   - [ ] Si el candidato tiene alertas, deben aparecer columnas adicionales: "Pregunta de verificacion 1", "Respuesta esperada 1", etc.
   - [ ] Los niveles aparecen como "Encaje alto", "Buen encaje", "Encaje parcial" o "Descartado"

### Paso 9: Verificar errores controlados

1. Ve a Ajustes → elimina la API key → guarda
2. Evalua un candidato → debe mostrar: **"No hay clave API de Anthropic — anadela en Ajustes"**
3. Re-agrega la key → desactiva la oferta activa
4. Evalua → debe mostrar: **"No hay ninguna oferta activa — selecciona una en Ajustes"**

> Si todos los pasos pasan correctamente, la extension esta validada y lista para uso.

---

*Desarrollado para equipos de RRHH — EvolvrScreener v2*
