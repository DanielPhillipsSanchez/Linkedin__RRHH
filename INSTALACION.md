# Guia de Instalacion — LinkedIn HHRH Screener

Esta guia te explica, paso a paso, como instalar la extension en tu computadora. No necesitas saber nada de tecnologia para seguirla.

---

## Antes de empezar

Necesitas tener instalado el navegador **Google Chrome**. Si no lo tienes, descargalo desde [google.com/chrome](https://www.google.com/chrome/) e instalalo como cualquier otro programa.

---

## Paso 1 — Descarga los archivos de la extension desde GitHub

No necesitas tener cuenta en GitHub para descargar la extension. Sigue estos pasos:

1. Abre Google Chrome (o cualquier navegador) y ve a la pagina del proyecto en GitHub. El enlace te lo compartira tu equipo.

2. Una vez en la pagina, busca el boton verde que dice **"Code"** — esta en la parte superior derecha de la pantalla.

3. Al hacer clic en ese boton, se despliega un menu. Haz clic en **"Download ZIP"** (al fondo del menu).

   ![Boton Code → Download ZIP]

4. Se descargara un archivo llamado algo como **`Linkedin__RRHH-main.zip`** en tu carpeta de Descargas.

5. Ahora descomprime ese archivo:
   - **En Windows**: haz clic derecho sobre el archivo `.zip` → selecciona **"Extraer todo"** → haz clic en **"Extraer"**.
   - **En Mac**: haz doble clic sobre el archivo `.zip` y se descomprimira automaticamente.

6. Se creara una carpeta. Abrela y entra a la carpeta **`linkedin-hhrh-screener`**.

7. Dentro encontraras una carpeta llamada **`.output`** — pero puede que no la veas porque su nombre empieza con un punto, lo que la hace invisible por defecto. Para mostrarla:

   - **En Windows**: dentro del Explorador de archivos, haz clic en la pestana **"Ver"** (en la barra superior) y activa la casilla **"Elementos ocultos"**. La carpeta `.output` aparecera.
   - **En Mac**: dentro de la carpeta `linkedin-hhrh-screener`, presiona al mismo tiempo las teclas **Cmd + Shift + Punto ( . )**. Las carpetas ocultas apareceran en color gris. Vuelve a presionar la misma combinacion para ocultarlas de nuevo.

8. Abre la carpeta **`.output`** → luego abre **`chrome-mv3`**. Esa es la carpeta que necesitas. La ruta completa es:

   ```
   Linkedin__RRHH-main → linkedin-hhrh-screener → .output → chrome-mv3
   ```

9. Guarda esta ubicacion en mente (o mueve la carpeta `chrome-mv3` a tu Escritorio o Documentos para encontrarla facilmente).

> Importante: no muevas ni elimines la carpeta `chrome-mv3` despues de instalar la extension. Chrome la necesita en ese lugar para funcionar.

---

## Paso 2 — Abre la pantalla de extensiones en Chrome

1. Abre **Google Chrome**.
2. En la barra de direcciones (donde normalmente escribes una pagina web), escribe exactamente esto y presiona **Enter**:

```
chrome://extensions/
```

3. Se abrira una pantalla con el titulo "Extensiones".

---

## Paso 3 — Activa el "Modo de desarrollador"

En la esquina superior derecha de esa pantalla veras un interruptor que dice **"Modo de desarrollador"**.

- Si el interruptor esta apagado (gris), haz clic en el para encenderlo (se pondra azul).
- Si ya esta azul, no necesitas hacer nada.

---

## Paso 4 — Carga la extension

1. Haz clic en el boton **"Cargar extension sin empaquetar"** que aparecera en la parte superior izquierda.
2. Se abrira una ventana para seleccionar una carpeta.
3. Busca y selecciona la carpeta **`chrome-mv3`** que guardaste en el Paso 1.
4. Haz clic en **"Seleccionar carpeta"**.

Si todo salio bien, la extension aparecera en la lista con el nombre **"LinkedIn HHRH Screener"** y sin ningun mensaje de error en rojo.

---

## Paso 5 — Fija la extension en la barra de Chrome

Para tener la extension siempre a mano:

1. Busca el icono de un **rompecabezas** en la esquina superior derecha de Chrome (junto a la barra de direcciones).
2. Haz clic en el.
3. Busca **"LinkedIn HHRH Screener"** en la lista.
4. Haz clic en el icono del **pin** que aparece a la derecha del nombre.

Ahora el icono de la extension quedara visible en tu barra de Chrome para usarlo en cualquier momento.

---

## Paso 6 — Agrega tu clave de acceso (API Key)

> Este paso solo se hace **una vez**. Despues de guardarlo, la extension lo recordara siempre.

La extension usa inteligencia artificial (Claude AI) para evaluar candidatos. Para que funcione, necesitas agregarle una clave de acceso. Tu administrador o encargado de equipo te la proporcionara.

Sigue estos pasos:

1. Haz clic en el icono de la extension en la barra de Chrome (el que fijaste en el Paso 5).
2. Se abrira una ventana pequena. En la esquina superior derecha de esa ventana, haz clic en el enlace que dice **"Settings"**.
3. Se abrira una pagina nueva de configuracion.
4. Busca el campo que dice **"API Key"** — es una caja de texto en blanco.
5. Pega la clave que te dieron en ese campo. La clave tiene un formato similar a este: `sk-ant-api03-XXXXX...`
6. Haz clic en el boton **"Save & Validate"**.
7. Si la clave es correcta, aparecera un mensaje en verde que dice que esta activa. Si aparece un mensaje en rojo, verifica que la clave este completa y sin espacios al inicio o al final.

> No compartas tu clave con nadie ni la escribas en correos o chats. Es personal y confidencial.

---

## Paso 7 — Crea tu primera Descripcion de Puesto

Antes de evaluar candidatos, debes indicarle a la extension para que puesto esta buscando.

1. En la misma pagina de configuracion, busca la seccion **"Job Descriptions"**.
2. Escribe el nombre del puesto en el campo de titulo (por ejemplo: "Analista de Datos").
3. Pega el texto completo de la oferta de trabajo en el campo de descripcion.
4. Haz clic en **"Add JD"**.
5. A continuacion, agrega las habilidades que buscas en el candidato:
   - Escribe el nombre de cada habilidad (por ejemplo: "Excel", "Python", "Comunicacion").
   - Indica si es **obligatoria** (Mandatory) o **deseable** (Nice-to-have).
   - Haz clic en **"Add Skill"** para cada una.
6. Cuando termines, marca el circulo (radio button) junto al nombre del puesto para activarlo.

---

## Listo! Asi se usa la extension cada dia

1. Abre LinkedIn en Chrome y navega al perfil de un candidato.
2. Haz clic en el icono de la extension.
3. Haz clic en **"Evaluate"** y espera unos segundos.
4. La extension te mostrara el nivel del candidato (Layer 1, 2, 3 o Rechazado) y un resumen de sus habilidades.
5. Cuando termines tu jornada, puedes exportar todos los candidatos del dia a un archivo Excel haciendo clic en **"Export CSV"**.
6. Si quieres empezar de cero al dia siguiente, haz clic en **"Clear Candidates"** para limpiar la lista.

---

## Preguntas frecuentes

**No veo el icono de la extension en Chrome**
Sigue el Paso 5 para fijarlo en la barra.

**Aparece un error rojo que dice "No API key"**
Ve a Settings y verifica que la clave de acceso este guardada correctamente.

**La extension no detecta el perfil del candidato**
Asegurate de estar en una URL de LinkedIn que tenga el formato `linkedin.com/in/nombre-del-candidato` y espera 2 segundos despues de que cargue la pagina.

**Movi o elimine la carpeta `chrome-mv3` por error**
Tendras que repetir los pasos 1 a 4 con una nueva copia de la carpeta.

---

*Para cualquier problema tecnico, contacta al equipo de soporte de tu organizacion.*
