"use strict";

/** Below this peak RMS (0..1) nothing was said: a muted microphone or a pocket. */
const SILENCE_RMS = 0.015;

/**
 * One microphone take, for every place in the game that records a voice. It owns the stream,
 * the MediaRecorder, the time and size limits and a level meter, and it always hands the
 * microphone back: whatever ends the take (stop, limit, error, abort), the tracks are stopped.
 *
 * The result says why a take is not usable instead of the caller guessing: `short` (below the
 * minimum duration) and `silent` (nothing above the noise floor). The level meter is optional;
 * without Web Audio a take is simply never judged silent.
 */
class VoiceRecorder {
  static supported() {
    return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
  }
  constructor({ minSeconds = 0, maxSeconds = 600, maxBytes = Infinity, signal = null } = {}) {
    Object.assign(this, { minSeconds, maxSeconds, maxBytes, signal });
    this.take = null;
  }
  get recording() {
    return Boolean(this.take);
  }
  /** Resolves once recording has started with `{ finished }`, the result when the take stops. */
  async start() {
    if (this.take) throw Error("already_recording");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (this.signal?.aborted) {
      stream.getTracks().forEach((track) => track.stop());
      throw Error("aborted");
    }
    const recorder = new MediaRecorder(stream),
      chunks = [];
    const take = { stream, recorder, chunks, bytes: 0, peak: null, startedAt: performance.now() };
    this.take = take;
    take.meter = this.meter(stream, take);
    take.timer = setTimeout(() => this.stop(), this.maxSeconds * 1000);
    take.finished = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
        take.bytes += event.data.size;
        if (take.bytes > this.maxBytes) this.stop();
      };
      recorder.onstop = () => {
        this.release(take);
        const seconds = (performance.now() - take.startedAt) / 1000;
        resolve({
          blob: new Blob(chunks, { type: recorder.mimeType }),
          seconds,
          short: seconds < this.minSeconds,
          silent: take.peak !== null && take.peak < SILENCE_RMS,
        });
      };
      recorder.onerror = (event) => {
        this.release(take);
        reject(event.error || Error("recording_failed"));
      };
    });
    this.signal?.addEventListener("abort", () => this.stop(), { once: true });
    recorder.start(1000);
    return { finished: take.finished };
  }
  stop() {
    const take = this.take;
    if (!take) return;
    clearTimeout(take.timer);
    if (take.recorder.state !== "inactive") take.recorder.stop();
    else this.release(take);
  }
  release(take) {
    if (this.take === take) this.take = null;
    clearTimeout(take.timer);
    take.stream.getTracks().forEach((track) => track.stop());
    take.meter?.();
  }
  /** Tracks the loudest moment of the take; returns its own teardown. */
  meter(stream, take) {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return null;
    try {
      const context = new Context(),
        analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      take.peak = 0;
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += v * v;
        take.peak = Math.max(take.peak, Math.sqrt(sum / samples.length));
      }, 100);
      return () => {
        clearInterval(timer);
        context.close().catch(() => {});
      };
    } catch (_) {
      take.peak = null;
      return null;
    }
  }
}
module.exports = { VoiceRecorder };
