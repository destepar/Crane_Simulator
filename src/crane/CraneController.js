import { VEHICLE_CONFIG } from '../config/constants.js';

export class CraneController {
    constructor(craneGroup, obstacles) {
        this.craneGroup = craneGroup;
        this.obstacles = obstacles;

        this.vehicleSpeed = 0;
        this.steerAngle = 0;
        this.currentRpm = 700;
        this.moveDist = 0;
    }

    checkOBBCollision(cx, cz, rotY) {
        const forwardX = Math.cos(rotY);
        const forwardZ = -Math.sin(rotY);
        const sphereRadius = VEHICLE_CONFIG.COLLISION_SPHERE_RADIUS;

        const testPoints = [
            { x: cx + forwardX * 4.8, z: cz + forwardZ * 4.8, part: 'FRONT' },
            { x: cx, z: cz, part: 'CENTER' },
            { x: cx - forwardX * 4.8, z: cz - forwardZ * 4.8, part: 'REAR' }
        ];

        for (const obs of this.obstacles) {
            for (const pt of testPoints) {
                const nearX = Math.max(obs.minX, Math.min(pt.x, obs.maxX));
                const nearZ = Math.max(obs.minZ, Math.min(pt.z, obs.maxZ));
                const dx = pt.x - nearX;
                const dz = pt.z - nearZ;

                if ((dx * dx + dz * dz) < (sphereRadius * sphereRadius)) {
                    return { collided: true, part: pt.part, normalX: dx, normalZ: dz };
                }
            }
        }
        return { collided: false };
    }

    update(inputManager, dt, camera) {
        const keys = inputManager.keys;

        // 1. Manejo del Volante / Dirección
        if (keys.ArrowLeft) {
            this.steerAngle = Math.min(VEHICLE_CONFIG.MAX_STEER_RAD, this.steerAngle + VEHICLE_CONFIG.STEER_RATE * dt);
        } else if (keys.ArrowRight) {
            this.steerAngle = Math.max(-VEHICLE_CONFIG.MAX_STEER_RAD, this.steerAngle - VEHICLE_CONFIG.STEER_RATE * dt);
        } else {
            if (this.steerAngle > 0) {
                this.steerAngle = Math.max(0, this.steerAngle - VEHICLE_CONFIG.STEER_RETURN_RATE * dt);
            } else if (this.steerAngle < 0) {
                this.steerAngle = Math.min(0, this.steerAngle + VEHICLE_CONFIG.STEER_RETURN_RATE * dt);
            }
        }

        // 2. Aceleración, frenos y reversa
        if (keys.ArrowUp) {
            if (this.vehicleSpeed < -0.4) {
                this.vehicleSpeed = Math.min(0, this.vehicleSpeed + VEHICLE_CONFIG.BRAKE_FORCE * dt);
            } else {
                this.vehicleSpeed = Math.min(VEHICLE_CONFIG.FORWARD_MAX, this.vehicleSpeed + VEHICLE_CONFIG.FORWARD_ACCEL * dt);
            }
        } else if (keys.ArrowDown) {
            if (this.vehicleSpeed > 0.4) {
                this.vehicleSpeed = Math.max(0, this.vehicleSpeed - VEHICLE_CONFIG.BRAKE_FORCE * dt);
            } else {
                this.vehicleSpeed = Math.max(-VEHICLE_CONFIG.REVERSE_MAX, this.vehicleSpeed - VEHICLE_CONFIG.REVERSE_ACCEL * dt);
            }
        } else {
            if (this.vehicleSpeed > 0) {
                this.vehicleSpeed = Math.max(0, this.vehicleSpeed - VEHICLE_CONFIG.HEAVY_COAST * dt);
            } else if (this.vehicleSpeed < 0) {
                this.vehicleSpeed = Math.min(0, this.vehicleSpeed + VEHICLE_CONFIG.HEAVY_COAST * dt);
            }
        }

        // 3. Giro Ackermann (solo si el vehículo se mueve)
        if (Math.abs(this.vehicleSpeed) > 0.05) {
            const turnRate = (this.vehicleSpeed / VEHICLE_CONFIG.WHEELBASE) * Math.tan(this.steerAngle);
            this.craneGroup.rotation.y += turnRate * dt;
        }

        // 4. Traslación con colisiones OBB y rebote elástico
        this.moveDist = this.vehicleSpeed * dt;
        if (Math.abs(this.moveDist) > 0.0001) {
            const moveX = Math.cos(this.craneGroup.rotation.y) * this.moveDist;
            const moveZ = -Math.sin(this.craneGroup.rotation.y) * this.moveDist;

            const oldX = this.craneGroup.position.x;
            const oldZ = this.craneGroup.position.z;
            const nextX = oldX + moveX;
            const nextZ = oldZ + moveZ;

            const colTest = this.checkOBBCollision(nextX, nextZ, this.craneGroup.rotation.y);
            if (!colTest.collided) {
                this.craneGroup.position.x = nextX;
                this.craneGroup.position.z = nextZ;
            } else {
                this.vehicleSpeed = -this.vehicleSpeed * 0.35;
                const flash = document.getElementById('impactFlash');
                if (flash) {
                    flash.className = 'impact-flash hit';
                    setTimeout(() => { if (flash) flash.className = 'impact-flash'; }, 180);
                }
            }

            const dX = this.craneGroup.position.x - oldX;
            const dZ = this.craneGroup.position.z - oldZ;
            if (camera) {
                camera.position.x += dX;
                camera.position.z += dZ;
            }
        }

        // 5. Simulación de RPM diésel
        const isAccelerating = (keys.ArrowUp && this.vehicleSpeed >= -0.4) || (keys.ArrowDown && this.vehicleSpeed < -0.2);
        let targetRpm = 700;
        if (isAccelerating) {
            targetRpm = 1150 + (Math.abs(this.vehicleSpeed) / VEHICLE_CONFIG.FORWARD_MAX) * 750;
        } else if (Math.abs(this.vehicleSpeed) > 0.5) {
            targetRpm = 800 + (Math.abs(this.vehicleSpeed) / VEHICLE_CONFIG.FORWARD_MAX) * 350;
        }
        this.currentRpm += (targetRpm - this.currentRpm) * Math.min(1.0, dt * 6.0);
    }
}
