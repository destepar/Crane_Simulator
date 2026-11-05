// Constantes físicas, vehiculares y de seguridad LMI

export const G = 9.81;
export const MAX_MOMENT = 800;       // Ton-metro límite estructural de vuelco
export const MAX_HP_ENGINE = 800;    // Potencia máxima del motor diésel

// Dinámica vehicular Liebherr LTM 1110 (Ackermann + Inercia)
export const VEHICLE_CONFIG = {
    FORWARD_MAX: 14.0,       // ~50 km/h velocidad punta hacia adelante
    REVERSE_MAX: 5.0,        // ~18 km/h marcha atrás
    FORWARD_ACCEL: 5.5,      // Aceleración lineal m/s^2
    REVERSE_ACCEL: 4.5,      // Aceleración marcha atrás m/s^2
    BRAKE_FORCE: 25.0,       // Fuerza de frenado contundente m/s^2
    HEAVY_COAST: 8.0,        // Freno de motor / inercia de rodadura m/s^2
    MAX_STEER_RAD: 0.45,     // ~26 grados de giro máximo
    STEER_RATE: 1.7,         // Velocidad de giro de volante
    STEER_RETURN_RATE: 2.4,  // Retorno automático del volante al centro
    WHEELBASE: 15.0,         // Batalla efectiva entre ejes (m)
    COLLISION_SPHERE_RADIUS: 2.4
};
