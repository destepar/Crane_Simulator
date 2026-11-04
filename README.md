# Crane Simulator — Gemelo Digital 3D (Liebherr LTM 1110)

Simulador interactivo en tiempo real y gemelo digital de la grúa móvil **Liebherr LTM 1110**, desarrollado con tecnologías web estándar (**HTML5**, **CSS3**, **JavaScript ES6**) y renderizado 3D mediante **Three.js**.

---

## 🏗️ Características Principales

* **Física y Cinemática Vehicular Realista (Modelo Ackermann + Inercia):**
  * Conducción tipo camión real de gran tonelaje: el vehículo **no gira en parado sobre su propio eje**.
  * Aceleración progresiva, desaceleración por inercia/rozamiento y frenado activo.
  * Marchas automáticas: Avance (**D**), Punto Muerto (**N**) y Marcha Atrás (**R**).
  * Dirección con retorno progresivo del volante y radio de curvatura dinámico según la batalla (*wheelbase*) de la grúa.
  * Rodadura física sincronizada en los 5 ejes (10 ruedas).
* **Cinemática de Grúa y Telescopaje:**
  * Carga optimizada del modelo glTF (`LTM 1110 LIEBHERR.gltf` + `.bin`).
  * Despliegue secuencial de tramos telescópicos (1º a 6º tramo y flecha).
  * Cilindro hidráulico interactivo con orientación dinámica (*lookAt*) entre camisa y vástago.
* **Aparejo de Gancho 3D y Proyección Holográfica:**
  * **Bloque de polea y gancho 3D (Hook Block):** Bloque de polea Liebherr con detalles amarillos/negros, gancho de acero curvado y 4 eslingas tensoras que sujetan la carga.
  * **Retícula holográfica de suelo (Ground Target):** Proyección visual circular en el suelo o techo del edificio bajo la pluma, con efecto de pulso y cambio de color a amarillo de advertencia al descender la carga.
* **Optimización Extrema de Rendimiento:**
  * Ciudad procedural renderizada mediante **`InstancedMesh`** y búfer unificado de aristas: reducción de más de 140 llamadas de dibujado (*draw calls*) a **solo 2**, manteniendo 60 FPS estables.
  * Iluminación PBR calibrada con sombras suaves libres de artefactos (`shadow.normalBias`).
* **Telemetría y Sistema LMI (Load Moment Indicator):**
  * Cálculo en tiempo real del Momento de Vuelco:
    $$M = \text{Masa (t)} \times \text{Radio (m)}$$
  * Cálculo de potencia motriz estimada en HP.
  * Gráfico 2D dinámico (Canvas) con la curva de capacidad nominal y punto de trabajo actual.
  * HUD vehicular superpuesto con velocímetro en tiempo real (**KM/H**), marcha actual (**D/N/R**) y ángulo de dirección.

---

## 🕹️ Controles del Simulador

### 🚚 Conducción del Camión
| Tecla | Acción |
| :--- | :--- |
| `↑` (Flecha Arriba) | Acelerar hacia adelante / soltar para inercia |
| `↓` (Flecha Abajo) | Frenar / Marcha atrás (al estar detenido) |
| `←` (Flecha Izquierda) | Girar volante a la izquierda (gira solo en movimiento) |
| `→` (Flecha Derecha) | Girar volante a la derecha (gira solo en movimiento) |

### 🏗️ Operación de la Grúa
| Tecla / Control | Acción |
| :--- | :--- |
| `Q` / `A` | Rotar cabina / superestructura (Izquierda / Derecha) |
| `W` / `S` | Extender / Retraer pluma telescópica |
| `E` / `D` | Elevar / Descender ángulo de la pluma |
| `Z` / `X` | Subir / Bajar cable del cabrestante |

### 🎛️ Panel de Mandos Lateral (Sliders UI)
* **Masa Carga (t):** Ajusta el peso del bloque suspendido (0.5 t – 50 t).
* **Velocidad Cabrestante (m/s):** Modifica la rapidez del cable e influye en la potencia requerida (HP).
* **Rotación, Extensión y Ángulo:** Sliders sincronizados bidireccionalmente con los controles del teclado.

### 🎥 Cámara 3D (OrbitControls)
* **Clic Izquierdo + Arrastrar:** Rotar vista orbital alrededor de la grúa.
* **Clic Derecho + Arrastrar:** Desplazar la cámara (*pan*).
* **Rueda del Ratón:** Zoom in / Zoom out.

---

## 🚀 Cómo Ejecutar en Local (1 Clic)

1. Haz **doble clic en `start.bat`**.
2. Tu navegador predeterminado se abrirá automáticamente en [http://localhost:8000/](http://localhost:8000/).

---

## 📁 Estructura del Proyecto

```text
Crane_Simulator/
├── Assets3D/                       # Modelo 3D glTF optimizado (rastreado en Git)
│   ├── LTM 1110 LIEBHERR.gltf      # Estructura de nodos, materiales y jerarquía
│   └── LTM 1110 LIEBHERR.bin       # Datos binarios de mallas geométricas
├── CAD/                            # Archivos fuente originales de diseño (ignorados en git)
├── .gitignore                      # Reglas de exclusión de Git
├── GruaTEst.html                   # Visor de prueba para inspección de piezas glTF
├── index.html                      # Aplicación principal del simulador
├── README.md                       # Documentación del proyecto
└── start.bat                       # Lanzador en 1 clic para Windows
```
