# Guia de Instalacion — EvolvrScreener

Esta guia te explica, paso a paso, como instalar la extension en tu computadora. No necesitas saber nada de tecnologia para seguirla.

---

## Antes de empezar

Necesitas tener instalado el navegador **Google Chrome**. Si no lo tienes, descargalo desde [google.com/chrome](https://www.google.com/chrome/) e instalalo como cualquier otro programa.

---

## Paso 1 — Recibe y descomprime el archivo de la extension

El equipo de soporte te compartira un archivo `.zip` (por USB, carpeta compartida o correo). Descomprimelo en un lugar fijo de tu computadora, por ejemplo en **Documentos**. **No muevas ni elimines la carpeta despues de instalar.**

**En Windows:**
1. Clic derecho sobre el archivo `.zip` → **"Extraer todo"** → **"Extraer"**
2. Se creara una carpeta con el contenido

**En Mac:**
1. Doble clic sobre el archivo `.zip`
2. Se creara automaticamente una carpeta con el contenido

---

## Paso 2 — Muestra las carpetas ocultas para encontrar `.output`

Dentro de la carpeta que descomprimiste hay una subcarpeta llamada **`.output`** (con un punto al inicio). Las carpetas que empiezan con punto estan **ocultas por defecto** en Windows y Mac. Sigue estos pasos para verla:

**En Windows:**
1. Abre la carpeta descomprimida en el Explorador de archivos
2. Haz clic en la pestana **"Ver"** en la barra superior
3. Marca la casilla **"Elementos ocultos"**
4. Ahora veras la carpeta **`.output`**

**En Mac:**
1. Abre la carpeta descomprimida en el Finder
2. Presiona al mismo tiempo **Cmd + Shift + Punto ( . )**
3. Ahora veras la carpeta **`.output`**

> Puedes repetir el atajo para volver a ocultar las carpetas ocultas despues de instalar.

---

## Paso 3 — Abre la pantalla de extensiones en Chrome

1. Abre **Google Chrome**.
2. En la barra de direcciones, escribe exactamente esto y presiona **Enter**:

```
chrome://extensions/
```

3. Se abrira una pantalla con el titulo "Extensiones".

---

## Paso 4 — Activa el "Modo de desarrollador"

En la esquina superior derecha de esa pantalla veras un interruptor que dice **"Modo de desarrollador"**.

- Si el interruptor esta apagado (gris), haz clic en el para encenderlo (se pondra azul).
- Si ya esta azul, no necesitas hacer nada.

---

## Paso 5 — Carga la extension en Chrome

1. Haz clic en el boton **"Cargar extension sin empaquetar"** que aparece en la parte superior izquierda.
2. Se abrira una ventana del explorador de archivos para seleccionar una carpeta.
3. Navega hasta la carpeta que descomprimiste y entra en ella.
4. Abre la carpeta **`.output`** (recuerda que debes tener activada la vista de elementos ocultos del Paso 2).
5. Entra en la carpeta **`chrome-mv3`** que esta dentro de `.output`.
6. Con **`chrome-mv3`** seleccionada, haz clic en **"Seleccionar carpeta"** (Windows) o **"Abrir"** (Mac).

> La ruta correcta es: `[carpeta descomprimida]` → `.output` → **`chrome-mv3`** ← esta es la que debes seleccionar.

Si todo salio bien, la extension aparecera en la lista con el nombre **"EvolvrScreener"** y sin ningun mensaje de error en rojo.

---

## Paso 6 — Fija la extension en la barra de Chrome

Para tener la extension siempre a mano:

1. Busca el icono de un **rompecabezas** en la esquina superior derecha de Chrome (junto a la barra de direcciones).
2. Haz clic en el.
3. Busca **"EvolvrScreener"** en la lista.
4. Haz clic en el icono del **pin** que aparece a la derecha del nombre.

Ahora el icono de la extension quedara visible en tu barra de Chrome para usarlo en cualquier momento.

> La extension viene con la clave de acceso ya configurada. No necesitas hacer ningun paso adicional de configuracion antes de usarla.

---

## Paso 7 — Crea tu primera Busqueda de Evolvers

Antes de evaluar candidatos, debes indicarle a la extension para que puesto esta buscando.

1. Haz clic en el icono de la extension en la barra de Chrome.
2. En la esquina superior derecha del popup, haz clic en el enlace **"Ajustes"**.
3. Se abrira la pagina de configuracion.
4. Busca la seccion **"Formulario de requisicion"**.
5. Escribe el nombre del puesto en el campo **"Titulo"** (por ejemplo: "Analista de Datos").
6. Pega el texto completo de la oferta de trabajo en el campo de descripcion.
7. Haz clic en **"Anadir oferta"**.
8. A continuacion, agrega las habilidades que buscas en el candidato:
   - Escribe el nombre de cada habilidad (por ejemplo: "Excel", "Python", "SQL").
   - Indica si es **Obligatoria** o **Valorable**.
   - Haz clic en **"Anadir"** para cada una.
9. Sube a la seccion **"Nueva busqueda de Evolvers"** y marca el circulo (radio button) junto al nombre del puesto para activarlo.

> Tambien puedes importar la oferta directamente desde un archivo **Excel, CSV, Word o PDF** en vez de pegarla manualmente.

---

## Listo! Asi se usa la extension cada dia

1. Abre LinkedIn en Chrome y navega al perfil de un candidato.
2. Haz clic en el icono de la extension (el logo de Evolvr en la barra de Chrome).
3. Haz clic en **"Evaluar"** — el boton se desactivara mientras procesa.
   > **Tiempo de espera**: la evaluacion tarda entre **10 y 20 segundos**. Primero analiza las habilidades por palabras clave y luego consulta a la inteligencia artificial (Claude AI). **No hagas clic de nuevo** mientras esperas — el boton volvera a activarse solo cuando el resultado este listo.
4. La extension te mostrara el nivel del candidato y un resumen de sus habilidades:
   - **Encaje alto** — excelente coincidencia, contactar de inmediato
   - **Buen encaje** — buena coincidencia, contactar como segunda prioridad
   - **Encaje parcial** — vale la pena explorar, contactar despues de 7 dias
   - **Descartado** — no cumple los requisitos minimos
5. Si cierras el popup y lo vuelves a abrir en el mismo perfil, el resultado anterior se recupera automaticamente.
6. Para cambiar el idioma de la interfaz y del analisis, haz clic en las banderas 🇨🇴 🇺🇸 en la esquina superior derecha del popup. La bandera del idioma activo aparece resaltada en naranja.
   > **Tiempo de espera**: la traduccion puede tardar entre **15 y 20 segundos**. **No hagas clic en las banderas varias veces** mientras esperas — el resultado aparecera solo.
7. Si el candidato no fue descartado, puedes hacer clic en **"Redactar mensaje"** para generar un mensaje de contacto personalizado.
   > **Tiempo de espera**: el mensaje tarda entre **5 y 10 segundos** en generarse. No hagas clic varias veces — espera a que aparezca el texto en la pantalla.
8. Cuando termines tu jornada, exporta todos los candidatos del dia a un archivo Excel haciendo clic en **"Exportar CSV"**.
9. Si quieres empezar de cero al dia siguiente, haz clic en **"Borrar candidatos"** para limpiar la lista.

---

## Preguntas frecuentes

**No veo el icono de la extension en Chrome**
Sigue el Paso 6 para fijarlo en la barra.

**La extension no detecta el perfil del candidato**
Asegurate de estar en una URL de LinkedIn que tenga el formato `linkedin.com/in/nombre-del-candidato` y espera 2 segundos despues de que cargue la pagina.

**El puntaje del candidato parece bajo aunque tiene buena experiencia**
Verifica que las habilidades marcadas como **Obligatoria** sean las realmente criticas del cargo. La extension da el 80% del puntaje a esas habilidades. Las habilidades implicitas del rol (por ejemplo: numpy para un Data Scientist) se reconocen automaticamente aunque no esten listadas en el perfil de LinkedIn.

**El resultado desaparecio al cerrar y reabrir el popup**
Si navegaste a un perfil diferente, el resultado cambia al nuevo perfil. Si sigues en el mismo perfil, el resultado se debe restaurar automaticamente. Si no aparece, vuelve a hacer clic en "Evaluar".

**Movi o elimine la carpeta `chrome-mv3` por error**
Pide al equipo de soporte que te vuelva a compartir el archivo y repite desde el Paso 1.

---

*Para cualquier problema tecnico, contacta al equipo de soporte de tu organizacion.*
