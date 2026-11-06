# Crane Simulator — Gemelo Digital 3D (Liebherr LTM 1110)

Simulador interactivo en tiempo real y gemelo digital de la grúa móvil **Liebherr LTM 1110**, desarrollado con tecnologías web estándar (**HTML5**, **CSS3**, **JavaScript ES6**) y renderizado 3D mediante **Three.js**.

---

## 🏗️ Características Principales

* **Física Realista de Péndulo Pesado 3D y Control Anti-Sway Calibrado:**
  * **Oscilador armónico suspendido y amortiguado:** Dinámica de péndulo esférico suave calibrada con acoplamiento inercial elástico de pluma y resistencia aerodinámica, eliminando vibraciones bruscas o hipersensibilidad.
  * **Comportamiento en reposo nítido:** En ausencia de maniobra, la carga se asienta suavemente y permanece completamente inmóvil (zona muerta de micro-balanceo).
  * **Aparejo cinemático solidario:** El gancho y las 4 eslingas se orientan en tiempo real siguiendo el ángulo del cable y los vértices de la carga.
  * **Colisiones y fricción con el suelo:** Al posar la carga o chocar lateralmente contra obstáculos, la oscilación se amortigua y rebota elásticamente.
  * **Cable Volumétrico 3D y Sombra de Contacto:** Cable principal de acero modelado en geometría cilíndrica 3D PBR reflectante (en lugar de líneas de 1px) y disco de sombra suave proyectado en el suelo bajo la carga.
  * **HUD de Misión Estable:** Lecturas limpias de `DIST` y `ALT` sin parpadeo numérico, acompañadas de indicador de estado (`ESTABLE`, `CALMANDO`, `OSCILANDO`).
* **Ambientación de Obra Civil & Estructura en Construcción:**
  * **Edificio en Fase de Estructura de Hormigón Armado:** Losas de forjado sucesivas (Planta Baja, Planta 1 a +5m, Planta 2 a +10m y Azotea a +20m) con pilares cuadrados, esperas de armadura de ferralla hacia el cielo y andamios modulares de obra.
  * **Plataformas Voladas de Recepción (Cantilever Decks):** Plataformas metálicas amarillas en voladizo en las plantas 1 y 2 con barandillas provisionales de seguridad rojas para recepción técnica de cargas suspendidas.
  * **Terreno de Obra PBR Realista:** Suelo de zahorra/grava compactada, viales de rodadura de camiones, planchas de acero de reparto de carga para los apoyos del camión y delimitación perimetral con barreras New Jersey bicolor rojo y blanco.
  * **Campamento de Obra:** Casetas modulares prefabricadas de oficina técnica con escalera exterior metálica.
* **Sistema de Recogida y Depósito (Pick & Place) con Variedad de Cargas:**
  * **Geometrías y Cargas Reales:** Contenedor marítimo 20ft (18T), Tubería cilíndrica de hormigón armado (14T), Climatizador industrial HVAC (8.5T) y Transformador eléctrico de subestación (28T).
  * **Ciclo de Misión en Dos Etapas (Recogida + Depósito):** Maniobra con gancho libre hasta el cáncamo de izado en el acopio, pulsa Espacio para amarrar, transporta hasta las plataformas de descarga del edificio y pulsa Espacio para depositar.
* **Sistema Multi-Cámara Profesional (Teclas 1, 2, 3, 4):**
  * **`1` — Cámara Grúa (Órbita Global):** Vista general para maniobra y conducción del chasis.
  * **`2` — Cámara Gancho (Hook Cam):** Enfoca la carga suspendida desde arriba para posar con precisión milimétrica.
  * **`3` — Cámara Zona (Target Cam):** Enfoca la plataforma de entrega y la flecha de misión activa.
  * **`4` — Cámara Cabina (Cab Cam):** Vista desde el puesto del operador mirando hacia la pluma.
  * *Transiciones suaves (LERP) y seguimiento automático de objetivos sin tirones.*
* **Gestión Avanzada de Colisiones (OBB Multi-Esfera + Rebote Elástico):**
  * Detección de colisión orientada en 360° siguiendo la rotación real del chasis (morro, cabina y trasera).
  * Rebote elástico y desenganche suave de paredes para no quedarse trabado.
* **Iluminación Diurna Natural y Renderizado PBR:**
  * Atmósfera exterior luminosa bajo cielo diurno radiante y sol nítido.
  * Mapa de entorno 360° (IBL) para reflejos realistas en pintura amarilla y metales cromados.
  * Sombras suaves de alta definición 4K.
* **Display de Cabina Liebherr LICCON:**
  * Tacómetro digital de RPM diésel con respuesta dinámica.
  * Velocímetro rígido sin deformaciones en KM/H con barra LED.
  * Transmisión (**R / N / D**) y volante vectorial sincronizado.

---

## 🕹️ Controles del Simulador

### 🎥 Selector de Cámaras
| Tecla / Botón | Modo de Cámara |
| :--- | :--- |
| `1` | **Cámara Grúa:** Órbita alrededor del chasis del camión |
| `2` | **Cámara Gancho:** Enfoca la carga para posar con precisión |
| `3` | **Cámara Zona:** Enfoca la diana y la flecha objetivo activa |
| `4` | **Cámara Cabina:** Vista desde el puesto del operador |

### 🚚 Conducción del Camión
| Tecla | Acción |
| :--- | :--- |
| `↑` (Flecha Arriba) | Acelerar hacia adelante / soltar para freno de motor |
| `↓` (Flecha Abajo) | Frenar / Marcha atrás inmediata al estar detenido |
| `←` (Flecha Izquierda) | Girar volante a la izquierda |
| `→` (Flecha Derecha) | Girar volante a la derecha |

### 🏗️ Operación de la Grúa
| Tecla / Control | Acción |
| :--- | :--- |
| `Q` / `A` | Rotar cabina / superestructura (Izquierda / Derecha) |
| `W` / `S` | Extender / Retraer tramos telescópicos |
| `E` / `D` | Elevar / Descender ángulo de la pluma |
| `Z` / `X` | Enrollar / Desenrollar cable del cabrestante |
| Espacio | **Enganchar Carga** (en recogida) / **Depositar Carga** (en diana) |

---

## 🚀 Cómo Ejecutar en Local (1 Clic)

1. Haz **doble clic en `start.bat`**.
2. Tu navegador se abrirá automáticamente en [http://localhost:8000/](http://localhost:8000/).


---

## 🏛️ Arquitectura Modular (ES6 Modules)

El proyecto cuenta con una arquitectura desacoplada basada en módulos estándar de JavaScript:

```
Crane_Simulator/
│
├── index.html                  # Shell HTML declarativo y carga de módulos
├── start.bat                   # Servidor local HTTP y apertura automática
├── css/
│   └── style.css               # Estilos del dashboard, HUD LICCON y telemetría
│
└── src/
    ├── main.js                 # Punto de entrada y orquestador del bucle principal
    ├── config/
    │   └── constants.js        # Constantes físicas, parámetros vehiculares y LMI
    ├── core/
    │   ├── three.js            # Wrapper de Three.js y extensiones
    │   ├── SceneManager.js     # Renderizador PBR, cámaras, IBL y luces
    │   └── InputManager.js     # Captura de teclado y alternancia de cámaras
    ├── crane/
    │   ├── CraneModel.js       # Cargador GLTF, rig de pluma, hidráulicos y ruedas
    │   ├── CraneController.js  # Conducción Ackermann, colisiones OBB y RPM
    │   └── WinchRigging.js     # Cabrestante, gancho, física pendular y cables
    ├── environment/
    │   └── Environment.js      # Suelo PBR, edificios, patio de contenedores y mapa de colisiones
    ├── systems/
    │   └── MissionSystem.js    # Misiones, dianas concéntricas, flechas 3D y beacons
    └── ui/
        └── HUDManager.js       # Display LICCON, tacómetro, marchas y gráfico 2D LMI
```
