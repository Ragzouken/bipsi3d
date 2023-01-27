class Input {
    static MOUSE_BUTTONS = ["MouseLeft", "MouseMiddle", "MouseRight"];

    constructor(element) {
        this.element = element;
        this.hovered = element;
        this.pressed = new Set();
        this.released = new Set();
        this.held = new Set();

        window.addEventListener("pointerdown", (event) => {
            if (event.target !== (this.element ?? event.target)) return;

            const button = Input.MOUSE_BUTTONS[event.button] ?? "MouseUnknown";
            this.press(button);
        });
    
        window.addEventListener("pointerup", (event) => {
            if (event.target !== (this.element ?? event.target)) return;

            const button = Input.MOUSE_BUTTONS[event.button] ?? "MouseUnknown";
            this.release(button);
        });

        window.addEventListener("pointermove", (event) => {
            this.hovered = event.target;
        });

        window.addEventListener("keydown", (event) => {
            // if (isElementTextInput(event.target)) return;
    
            this.press(event.key);
            this.press(event.key.toLowerCase());

            if (event.key.includes("Arrow")) event.preventDefault();
    
            if (event.key.includes("Control")) {
                event.preventDefault();
                event.stopPropagation();
            }
        });
    
        window.addEventListener("keyup", (event) => {
            this.release(event.key);
            this.release(event.key.toLowerCase());
    
            if (event.key.includes("Alt")) {
                event.preventDefault();
                event.stopPropagation();
            }
        });

        window.addEventListener("contextmenu", () => this.clearHeld());
        window.addEventListener("blur", () => this.clearHeld());
    }

    press(key) {
        this.pressed.add(key);
        this.held.add(key);
    }

    release(key) {
        this.released.add(key);
        this.held.delete(key);
    }

    step() {
        this.pressed.clear();
        this.released.clear();
    }

    clearHeld() {
        this.held.clear();
    }
}
