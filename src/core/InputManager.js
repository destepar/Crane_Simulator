export class InputManager {
    constructor(onCameraChange, onAction) {
        this.keys = {};
        this.onCameraChange = onCameraChange;
        this.onAction = onAction;

        this._initListeners();
    }

    _initListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '1' && this.onCameraChange) this.onCameraChange('orbit');
            if (e.key === '2' && this.onCameraChange) this.onCameraChange('hook');
            if (e.key === '3' && this.onCameraChange) this.onCameraChange('target');
            if (e.key === '4' && this.onCameraChange) this.onCameraChange('cab');

            if ((e.code === 'Space' || e.key === ' ') && this.onAction) {
                e.preventDefault();
                this.onAction();
            }

            this.keys[e.key] = true;
            this.keys[e.key.toLowerCase()] = true;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    isPressed(key) {
        return !!this.keys[key] || !!this.keys[key.toLowerCase()];
    }
}
