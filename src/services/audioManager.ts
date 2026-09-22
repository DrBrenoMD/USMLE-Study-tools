/**
 * Centralized High-Fidelity Audio Manager
 * - Emits soft, gentle, pure SINE wave tones (suaves e agradáveis, sem estridência)
 * - Solves DAC / Bluetooth sleep latency via a continuous silent keep-alive carrier
 *   so the gentle attack is never swallowed or cut off.
 */

class AudioManager {
  private ctx: AudioContext | null = null;
  private keepAliveSource: AudioBufferSourceNode | null = null;
  private keepAliveGain: GainNode | null = null;
  private isKeepAliveRunning: boolean = false;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Unlock AudioContext on initial user gesture (click/tap)
   */
  public init(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {
      console.warn('AudioContext init failed:', e);
    }
  }

  /**
   * Keeps the physical audio DAC & Bluetooth headset awake by playing
   * an inaudible, zero-CPU looping buffer.
   * This completely avoids the 200-400ms wake-up clipping without needing loud or harsh sounds.
   */
  public startKeepAlive(): void {
    if (this.isKeepAliveRunning) return;

    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Create a 1-second silent buffer
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // Inaudible gain (0.00005) to keep physical DAC/Bluetooth link active
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.00005, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.keepAliveSource = source;
      this.keepAliveGain = gain;
      this.isKeepAliveRunning = true;
    } catch (e) {
      console.warn('Could not start audio keep-alive carrier:', e);
    }
  }

  /**
   * Stops the keep-alive stream when pacer and timer are stopped
   */
  public stopKeepAlive(): void {
    if (!this.isKeepAliveRunning) return;

    try {
      if (this.keepAliveSource) {
        this.keepAliveSource.stop();
        this.keepAliveSource.disconnect();
        this.keepAliveSource = null;
      }
      if (this.keepAliveGain) {
        this.keepAliveGain.disconnect();
        this.keepAliveGain = null;
      }
    } catch (e) {
      // Ignore
    } finally {
      this.isKeepAliveRunning = false;
    }
  }

  /**
   * Play a pure, soft SINE wave tone with smooth linear attack and gentle exponential decay.
   * Zero harmonics, zero distortion, smooth on ears.
   */
  public playTone(
    freq: number,
    duration: number = 0.35,
    volumeMultiplier: number = 0.5,
    startTimeOffset: number = 0
  ): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const start = ctx.currentTime + startTimeOffset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pure sine wave for the softest, most natural bell sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      // Calibrated soft volume (base peak 0.35 scaled by volumeMultiplier)
      const peakVol = Math.max(0.05, Math.min(0.6, 0.35 * (volumeMultiplier / 0.5)));

      // Smooth attack: 15ms fade-in to prevent any "click/pop"
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peakVol, start + 0.02);
      // Soft gentle exponential decay
      gain.gain.exponentialRampToValueAtTime(0.005, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration + 0.03);
    } catch (e) {
      console.warn('playTone error:', e);
    }
  }

  /**
   * Alarme de Resolução / Questão (880 Hz)
   * Som original suave: onda senoidal pura em 880 Hz com decaimento suave.
   */
  public playSolveAlarm(volumeMultiplier: number = 0.5): void {
    this.playTone(880, 0.35, volumeMultiplier);
  }

  /**
   * Alarme de Revisão - Modo Tutored (660 Hz)
   * Som original suave: onda senoidal pura em 660 Hz mais aveludada.
   */
  public playReviewAlarm(volumeMultiplier: number = 0.5): void {
    this.playTone(660, 0.35, volumeMultiplier);
  }

  /**
   * Alarme de Ciclo Pomodoro / Timer (Melodia de 4 notas senoidais)
   * C5 (523 Hz), E5 (659 Hz), G5 (784 Hz), C6 (1046 Hz) com envelopes suaves e espaçados.
   */
  public playCycleAlarm(volumeMultiplier: number = 0.5): void {
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        this.playTone(freq, 0.28, volumeMultiplier * 0.85, i * 0.1);
      });
    } catch (e) {
      console.warn('playCycleAlarm error:', e);
    }
  }

  /**
   * Sons curtos de ação (Next, Submit, Anterior) - senoides puras e discretas
   */
  public playActionBeep(action: 'next' | 'submit' | 'prev', volumeMultiplier: number = 0.5): void {
    switch (action) {
      case 'next':
        // Beep curto e suave (880 Hz, 0.18s)
        this.playTone(880, 0.18, volumeMultiplier);
        break;
      case 'submit':
        // Beep agradável de transição (660 Hz, 0.22s)
        this.playTone(660, 0.22, volumeMultiplier);
        break;
      case 'prev':
        // Beep grave suave (520 Hz, 0.16s)
        this.playTone(520, 0.16, volumeMultiplier * 0.9);
        break;
    }
  }
}

export const audioManager = new AudioManager();
