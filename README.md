# Crane Simulator — Gemelo Digital 3D (Liebherr LTM 1110)

Simulador interactivo en tiempo real y gemelo digital de la grúa móvil **Liebherr LTM 1110**, desarrollado con tecnologías web estándar (**HTML5**, **CSS3**, **JavaScript ES6**) y renderizado 3D mediante **Three.js**.

---

## 🏗️ Características Principales

* **Modo Misiones y Sistema de Recompensas por Izado (Gameplay):**
  * **Zona A (Suelo / Fácil - 100 PTS):** Bahía de carga en plataforma de suelo.
  * **Zona B (Contenedores / Media - 250 PTS):** Posado de precisión sobre el 2º nivel de contenedores apilados en el patio logístico.
  * **Zona C (Azotea Rascacielos / Experto - 500 PTS):** Izado técnico a más de 70m de altura sobre el helipuerto de la torre principal (operando en el límite LMI).
  * **Detección de posado suave:** Requiere mantener la carga estable dentro de la diana a velocidad de izado segura ($v < 1.2\text{ m/s}$).
  * HUD de Misión con telemetría en tiempo real: distancia horizontal, cota de altura, barra de aproximación y marcador acumulado de puntos.
* **Gestión Avanzada de Colisiones (OBB Multi-Esfera + Rebote Elástico):**
  * Detección de colisión orientada en 360° siguiendo la rotación real del chasis (morro, cabina y trasera).
  * Respuesta elástica con absorción de impacto y desenganche automático de paredes.
  * Alerta visual de impacto en cabina.
* **Iluminación Diurna Natural y Renderizado PBR:**
  * Iluminación de obra exterior radiante con cielo diurno azul luminoso y sol neutro.
  * Mapa de entorno 360° (IBL) mediante `PMREMGenerator` para reflejos especulares de pintura y cromo.
  * Sombras suaves de alta definición 4K (`PCFSoftShadowMap`).
* **Display de Cabina Liebherr LICCON:**
  * Selector de transmisión (**R / N / D**) con retroiluminación LED.
  * Velocímetro digital rígido en **KM/H** con barra de aceleración.
  * Tacómetro digital de **RPM del motor diésel** con respuesta de carga.
  * Volante vectorial giratorio con lectura de grados de giro.
* **Cinemática Realista de Grúa:**
  * Pluma telescópica de 6 tramos con extensión secuencial y cable solidario a la punta.
  * Aparejo de gancho 3D con polea Liebherr y 4 eslingas tensoras a la carga.
  * Diagrama de capacidad LMI (Load Moment Indicator) con curva de vuelco en tiempo real.

---

## 🕹️ Controles del Simulador

### 🚚 Conducción del Camión
| Tecla | Acción |
| :--- | :--- |
| `↑` (Flecha Arriba) | Acelerar hacia adelante / soltar para freno de motor |
| `↓` (Flecha Abajo) | Frenar / Marcha atrás inmediata al estar detenido |
| `←` (Flecha Izquierda) | Girar dirección a la izquierda |
| `→` (Flecha Derecha) | Girar dirección a la derecha |

### 🏗️ Operación de la Grúa
| Tecla / Control | Acción |
| :--- | :--- |
| `Q` / `A` | Rotar cabina / superestructura (Izquierda / Derecha) |
| `W` / `S` | Extender / Retraer tramos de pluma |
| `E` / `D` | Elevar / Descender ángulo de la pluma |
| `Z` / `X` | Enrollar / Desenrollar cable del cabrestante |

---

## 🚀 Cómo Ejecutar en Local (1 Clic)

1. Haz **doble clic en `start.bat`**.
2. Tu navegador se abrirá automáticamente en [http://localhost:8000/](http://localhost:8000/).
