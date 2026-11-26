// Keyboard + mouse input, one job: turn physical keys into named pilot actions
// the flight model reads, and report edge-triggered presses (gear, pause, ...).
export const KEYS = {
  KeyW: 'throttleUp',
  KeyS: 'throttleDown',
  ArrowUp: 'pitchUp',
  ArrowDown: 'pitchDown',
  ArrowLeft: 'bankLeft',
  KeyA: 'bankLeft',
  ArrowRight: 'bankRight',
  KeyD: 'bankRight',
  Space: 'boost',
};

export class Input {
  constructor() {
    this.held = new Set();
    /** Actions pressed since the last consume() call. */
    this.pressed = new Set();
    this.onKeyDown = (event) => {
      if (event.repeat) return;
      const action = KEYS[event.code];
      if (action) {
        event.preventDefault();
        this.held.add(action);
        return;
      }
      // One-shot keys.
      if (event.code === 'KeyG') this.pressed.add('gear');
      else if (event.code === 'KeyR') this.pressed.add('restart');
      else if (event.code === 'KeyP' || event.code === 'Escape') this.pressed.add('pause');
      else if (event.code === 'KeyM') this.pressed.add('mute');
      else if (event.code === 'Enter') this.pressed.add('confirm');
      else if (event.code === 'Digit1') this.pressed.add('mission1');
      else if (event.code === 'Digit2') this.pressed.add('mission2');
      else if (event.code === 'Digit3') this.pressed.add('mission3');
    };
    this.onKeyUp = (event) => {
      const action = KEYS[event.code];
      if (action) this.held.delete(action);
    };
    this.onBlur = () => this.held.clear();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  isHeld(action) {
    return this.held.has(action);
  }

  /** True once per physical press; call once a frame and clear. */
  wasPressed(action) {
    return this.pressed.has(action);
  }

  endFrame() {
    this.pressed.clear();
  }

  /** Used by the shot stager and autopilot: pretend a key is held. */
  forceHeld(action, on) {
    if (on) this.held.add(action);
    else this.held.delete(action);
  }
}
