# ONNY COACH

Aplicación web deportiva para demostración académica, creada con HTML, CSS y JavaScript modular. No requiere dependencias ni servicios externos: los datos y los cálculos se procesan en el navegador. Los gráficos se dibujan con Canvas nativo, así que la aplicación también funciona sin Chart.js.

## Estructura

```text
index.html
css/
  style.css
js/
  app.js
  data.js
  storage.js
  utils.js
README.md
```

## Ejecutar en Visual Studio Code

1. Abre la carpeta del proyecto en Visual Studio Code.
2. Instala la extensión **Live Server** (Ritwick Dey), si aún no la tienes.
3. En `index.html`, selecciona **Open with Live Server**. La aplicación usa módulos ES; no abras el archivo mediante `file://`.
4. Crea un perfil local o continúa como visitante. Desde **Configuración** puedes cargar datos de ejemplo, exportar o importar una copia JSON y borrar los datos.

También se puede servir la carpeta con cualquier servidor estático local que respete rutas y módulos ES, por ejemplo `python -m http.server 8000`; después visita `http://localhost:8000`.

## Qué incluye

- Panel de inicio, objetivos semanales, actividad reciente y estados vacíos.
- Cuestionario inicial en tres pasos: datos personales, uno o varios deportes, deporte prioritario, experiencia, objetivo, disponibilidad, lugar y equipamiento. Edad, peso y estatura son opcionales; no se solicita talla de ropa.
- Perfil editable y generador local de rutinas que usa una guía de preparación complementaria para el deporte prioritario, nivel, objetivo, tiempo y equipamiento.
- Biblioteca de ejercicios con músculos, propósito, relación orientativa con el deporte, instrucciones paso a paso, adaptaciones, series, repeticiones y descanso.
- Sesión interactiva con cronómetro, pausa, temporizador de descanso, siguiente ejercicio y registro al finalizar.
- Vista semanal, historial, seguimiento de peso y gráficos Canvas.
- Calculadora orientativa de IMC y estimación calórica con limitaciones visibles.
- Asistente de recomendaciones basado en reglas locales; no es una IA externa.
- Exportación e importación JSON con validación y confirmación; borrado local y ejemplos sintéticos identificados como DEMO.
- Diseño adaptable, navegación por teclado básica y respeto a `prefers-reduced-motion`.

## Datos, autenticación y limitaciones

La aplicación guarda el perfil, las rutinas y el historial en `localStorage` del navegador. La contraseña del formulario **no se guarda**. Esta autenticación solo simula el flujo y valida los campos: no verifica identidades, no protege datos y no es segura para producción. No uses datos sensibles. Al borrar datos se limpia el almacenamiento local de esta aplicación.

Los ejemplos son sintéticos y se identifican como **DEMO**. Las imágenes de ejercicios no se descargan; se usan composiciones gráficas locales para evitar dependencias y peticiones a servicios externos. La estimación de calorías es muy general y el IMC no mide composición corporal; ninguno es consejo médico.

El cuestionario puede registrar varios deportes y un deporte prioritario para orientar el generador. Sus rutinas son propuestas genéricas de acondicionamiento complementario: no enseñan técnica deportiva, no programan cargas de entrenamiento del equipo y no diagnostican ni adaptan automáticamente condiciones médicas. Revisa las explicaciones, omite movimientos no adecuados y consulta a un entrenador o profesional de salud si lo necesitas.

La tipografía se carga desde Google Fonts cuando hay conexión; si no, se usa una tipografía sans-serif del sistema. No hace falta Chart.js: la visualización local está dibujada en Canvas.

## Pruebas manuales sugeridas

1. Crear cuenta con correo válido y contraseña de al menos 8 caracteres; probar errores de campos incompletos.
2. Completar los tres pasos de ingreso y comprobar que el panel y la rutina inicial se adapten al deporte prioritario.
3. Seleccionar varios deportes, cambiar el deporte prioritario y confirmar que el enfoque y ejercicios cambien.
4. Editar en “Mi perfil” el deporte prioritario, objetivo, experiencia, duración de práctica, tiempo disponible y equipamiento; guardar y comprobar que la siguiente sesión use la nueva configuración. Después, generar rutinas con otros niveles, objetivos y equipo; revisar explicaciones, iniciar y eliminar.
5. Filtrar y buscar ejercicios; iniciar una sesión, revisar su propósito deportivo, pausar, descansar, avanzar y finalizar.
6. Añadir y borrar registros de peso; comprobar los gráficos con al menos dos registros.
7. Cargar datos DEMO y confirmar que se identifican como sintéticos.
8. Exportar JSON, borrar los datos, importar esa copia y comprobar que perfil, deportes e historial se restauran.
9. Revisar navegación, cuestionario y formularios en una ventana estrecha y con movimiento reducido activado.
