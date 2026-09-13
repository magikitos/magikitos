class WoodlandAudio {
  constructor() {
    this.context = null;
    this.on = false;
    this.timer = null;
    this.step = 0;
  }
  async start() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      if (!this.context) {
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.gain.value = 0.3;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 3;
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
        this.echo = this.context.createDelay(1);
        this.echo.delayTime.value = 0.29;
        const feedback = this.context.createGain();
        feedback.gain.value = 0.17;
        this.echo.connect(feedback);
        feedback.connect(this.echo);
        feedback.connect(this.master);
      }
      await this.context.resume();
      if (this.context.state !== "running") return false;
      this.on = true;
      this.next = this.context.currentTime + 0.08;
      this.master.gain.setTargetAtTime(0.3, this.context.currentTime, 0.15);
      clearInterval(this.timer);
      this.timer = setInterval(() => this.schedule(), 100);
      this.schedule();
      return true;
    } catch (_) {
      this.on = false;
      return false;
    }
  }
  stop() {
    this.on = false;
    clearInterval(this.timer);
    this.timer = null;
    if (this.context) {
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.04);
      this.context.suspend().catch(() => {});
    }
  }
  tone(midi, when, length, volume, shape = "sine", echo = false) {
    if (!this.on || !this.context) return;
    const c = this.context,
      osc = c.createOscillator(),
      amp = c.createGain();
    osc.type = shape;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(volume, when + 0.025);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(amp);
    amp.connect(this.master);
    if (echo) amp.connect(this.echo);
    osc.start(when);
    osc.stop(when + length + 0.04);
    osc.onended = () => {
      osc.disconnect();
      amp.disconnect();
    };
  }
  schedule() {
    if (!this.on || document.hidden) return;
    const halfBeat = 60 / 76 / 2;
    const chords = [
      [48, 55, 60, 64],
      [53, 60, 65, 69],
      [57, 60, 64, 67],
      [55, 62, 67, 71],
      [48, 55, 62, 64],
      [53, 60, 64, 69],
      [50, 57, 62, 65],
      [55, 59, 62, 67],
    ];
    const melody = [
      76, 0, 79, 0, 74, 72, 0, 0, 77, 0, 76, 0, 72, 0, 69, 0, 76, 79, 0, 81, 0,
      79, 76, 0, 74, 0, 71, 0, 67, 0, 0, 0, 72, 0, 76, 79, 0, 74, 0, 0, 77, 0,
      81, 0, 79, 77, 0, 0, 74, 0, 77, 0, 76, 0, 74, 0, 71, 0, 74, 0, 72, 0, 0,
      0,
    ];
    while (this.next < this.context.currentTime + 0.25) {
      const step = this.step % 128,
        chord = chords[Math.floor(step / 16)];
      if (step % 16 === 0)
        for (const n of chord) this.tone(n, this.next, halfBeat * 15, 0.022);
      const arp = [1, 2, 3, 2, 1, 3, 2, 3][step % 8];
      this.tone(
        chord[arp] + 12,
        this.next,
        0.8,
        step % 2 ? 0.045 : 0.065,
        "triangle",
        true,
      );
      const note = melody[Math.floor(step / 2)];
      if (note && step % 2 === 0) {
        this.tone(note, this.next, 1.1, 0.075, "sine", true);
        this.tone(note + 12, this.next, 0.85, 0.009);
      }
      this.next += halfBeat;
      this.step++;
    }
  }
  effect(kind) {
    if (!this.on) return;
    const now = this.context.currentTime;
    if (kind === "found")
      [72, 76, 79, 84].forEach((n, i) =>
        this.tone(n, now + i * 0.13, 0.7, 0.11, "triangle", true),
      );
    else if (kind === "knock")
      [0, 0.16].forEach((t) => this.tone(48, now + t, 0.1, 0.1, "triangle"));
    else this.tone(79, now, 0.06, 0.025, "sine");
  }
}

module.exports = { WoodlandAudio };
