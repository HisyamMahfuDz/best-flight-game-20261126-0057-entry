// Synthesised sound, no audio files: a WebAudio engine hum whose pitch follows
// the throttle, plus chimes, thuds and clicks. Everything is built from
// oscillators, so the game loads nothing over the network.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
  }

  /** Create the context on the first user gesture (browsers require it). */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    // Engine: two detuned sawtooths through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const second = this.ctx.createOscillator();
    second.type = 'sawtooth';
    second.frequency.value = 55 * 1.5;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    second.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    second.start();
    this.engineSecond = second;
    // Wind: looped noise through a band-pass, gain follows airspeed.
    const noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    source.connect(band);
    band.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    source.start();
  }

  /** Call every frame: throttle 0..1, speed in m/s. */
  setFlight(throttle, speed, boosting) {
    if (!this.ctx || this.muted) return;
    const freq = 48 + throttle * 70 + (boosting ? 26 : 0);
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
    this.engineSecond.frequency.setTargetAtTime(freq * 1.5, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.02 + throttle * 0.05, this.ctx.currentTime, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.0009), this.ctx.currentTime, 0.15);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.windGain) this.windGain.gain.value = 0;
    }
  }

  /** Short two-note chime for a ring or checkpoint. */
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [880, 1318].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.16, t + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.55);
    });
  }

  /** Low thud for a touchdown or a hard hit. */
  thud(hard) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hard ? 90 : 140, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(hard ? 0.5 : 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Click for menu buttons. */
  click() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }
}
