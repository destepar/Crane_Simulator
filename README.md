# Crane Simulator — Gemelo Digital 3D (Liebherr LTM 1110)

Simulador interactivo en tiempo real y gemelo digital de la grúa móvil **Liebherr LTM 1110**, desarrollado con tecnologías web estándar (**HTML5**, **CSS3**, **JavaScript ES6**) y renderizado 3D mediante **Three.js**.

---

## 🏗️ Características Principales

* **Modelo 3D y Cinemática Realista:**
  * Carga optimizada del modelo glTF (`LTM 1110 LIEBHERR.gltf` + `.bin`).
  * Cinemática de pluma telescópica multietapa (despliegue coordinado de tramos 2 a 6 y tramo flecha con punto de anclaje de punta).
  * Cilindro hidráulico interactivo con orientación dinámica (*lookAt*) entre cuerpo y vástago.
  * Rodadura de ejes/ruedas según el avance del vehículo.
* **Sistema de Conducción y Colisiones:**
  * Control del camión en modo oruga/vehículo con detección de colisiones de chasis frente a edificios y contenedores.
* **Telemetría y Sistema LMI (Load Moment Indicator):**
  * Cálculo en tiempo real del Momento de Vuelco:
    $$M = \text{Masa (t)} \times \text{Radio (m)}$$
  * Cálculo de potencia motriz estimada en HP en base a la velocidad de izado.
  * Gráfico 2D dinámico (Canvas) que traza la curva de capacidad nominal y la posición de trabajo actual.
  * Alertas automáticas de seguridad: *Sistema Nominal*, *Advertencia Límite LMI* y *Peligro de Vuelco Estructural*.
* **Simulación de Cable y Cabrestante:**
  * Elevación y descenso manual del gancho/carga con límites dinámicos respecto a la cota del terreno o techo de edificios.

---

## 🕹️ Controles del Simulador

### 🚚 Conducción del Camión
| Tecla | Acción |
| :--- | :--- |
| `↑` (Flecha Arriba) | Avanzar vehículo |
| `↓` (Flecha Abajo) | Retroceder vehículo |
| `←` (Flecha Izquierda) | Girar dirección a la izquierda |
| `→` (Flecha Derecha) | Girar dirección a la derecha |

### 🏗️ Operación de la Grúa
| Tecla / Control | Acción |
| :--- | :--- |
| `Q` / `A` | Rotar cabina / superestructura (Izquierda / Derecha) |
| `W` / `S` | Extender / Retraer pluma telescópica |
| `E` / `D` | Elevar / Descender ángulo de la pluma |
| `Z` / `X` | Subir / Bajar cable del cabrestante |

### 🎛️ Panel de Mandos Lateral (Sliders UI)
* **Masa Carga (t):** Ajusta el peso del bloque suspendido (0.5 t – 60 t).
* **Velocidad Izado (m/s):** Modifica la rapidez del cabrestante e influye en la potencia requerida (HP).
* **Rotación, Extensión y Ángulo:** Sliders sincronizados bidireccionalmente con los controles del teclado.

### 🎥 Cámara 3D (OrbitControls)
* **Clic Izquierdo + Arrastrar:** Rotar vista orbital alrededor del objetivo.
* **Clic Derecho + Arrastrar:** Desplazar la cámara (*pan*).
* **Rueda del Ratón:** Zoom in / Zoom out.

---

## 🚀 Cómo Ejecutar en Local

Debido a que el navegador restringe la carga de modelos 3D locales (`.gltf` / `.bin`) vía el protocolo `file://` por políticas de seguridad (CORS), se recomienda servir el proyecto mediante un servidor web local sencillo:

### Opción 1: Con Python (Recomendado)
Abre una terminal en la raíz del proyecto y ejecuta:
```bash
python -m http.server 8000
```
Luego abre tu navegador en: [http://localhost:8000](http://localhost:8000)

### Opción 2: VS Code / Live Server
Si utilizas Visual Studio Code, haz clic derecho sobre `index.html` y selecciona **"Open with Live Server"**.

---

## 📁 Estructura del Proyecto

```text
Crane_Simulator/
├── Assets3D/                       # Modelo 3D glTF optimizado
│   ├── LTM 1110 LIEBHERR.gltf      # Estructura de nodos, materiales y jerarquía
│   └── LTM 1110 LIEBHERR.bin       # Datos binarios de mallas geométricas
├── CAD/                            # Archivos fuente originales de diseño (ignorados en git)
├── .gitignore                      # Reglas de exclusión de Git
├── GruaTEst.html                   # Visor de prueba para inspección de piezas glTF
├── index.html                      # Aplicación principal del simulador
└── README.md                       # Documentación del proyecto
```
