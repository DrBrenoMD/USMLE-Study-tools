/**
 * Centralized High-Fidelity Audio Manager
 * - Emits soft, gentle, warm bell chimes (suaves, aveludados e agradáveis, sem estridência)
 * - Eliminates DAC / Bluetooth latency and audio clipping by maintaining a continuous
 *   inaudible sub-carrier so no notes are ever swallowed or truncated.
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
   * Keeps physical audio DAC & Bluetooth links warm and active with an inaudible
   * continuous sub-carrier. Uses real non-zero sub-audible waveform so hardware DSP
   * sleep detectors do not put the audio pipeline to sleep.
   */
  public startKeepAlive(): void {
    if (this.isKeepAliveRunning) return;

    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // 2-second buffer containing inaudible 20Hz sub-bass waveform
      const sampleRate = ctx.sampleRate || 44100;
      const buffer = ctx.createBuffer(1, sampleRate * 2, sampleRate);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin((2 * Math.PI * 20 * i) / sampleRate) * 0.0001;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0002, ctx.currentTime);

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
   * Play a warm, organic bell chime tone with smooth attack and generous decay.
   * Uses fundamental sine wave plus a subtle second harmonic to create a rounded, soothing bell sound.
   */
  public playTone(
    freq: number,
    duration: number = 0.65,
    volumeMultiplier: number = 0.5,
    startTimeOffset: number = 0
  ): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Safe lead time to ensure full attack is played through DAC
      const start = ctx.currentTime + Math.max(0.03, startTimeOffset);

      // Master gain for this note
      const masterGain = ctx.createGain();
      const peakVol = Math.max(0.08, Math.min(0.75, 0.45 * (volumeMultiplier / 0.5)));

      // Fundamental oscillator (soft pure sine)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, start);

      // Subtle harmonic overtone (1 octave up, -18dB) for warmth and rich chime body
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, start);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.12, start);

      // Smooth, natural bell envelope:
      // 1. Soft 35ms linear attack (eliminates clicks/pops and harsh onset)
      // 2. Short sustain body
      // 3. Gentle exponential decay so sound resonates smoothly without abrupt cut-off
      masterGain.gain.setValueAtTime(0.0001, start);
      masterGain.gain.linearRampToValueAtTime(peakVol, start + 0.035);
      masterGain.gain.exponentialRampToValueAtTime(peakVol * 0.4, start + Math.min(0.25, duration * 0.45));
      masterGain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc1.connect(masterGain);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc1.start(start);
      osc2.start(start);
      osc1.stop(start + duration + 0.05);
      osc2.stop(start + duration + 0.05);
    } catch (e) {
      console.warn('playTone error:', e);
    }
  }

  /**
   * Alarme de Resolução / Questão:
   * Sino suave em C5 (523.25 Hz) - timbre aveludado e acolhedor, não estridente.
   */
  public playSolveAlarm(volumeMultiplier: number = 0.5): void {
    this.playTone(523.25, 0.70, volumeMultiplier);
  }

  /**
   * Alarme de Revisão - Modo Tutored:
   * Sino quente em A4 (440.00 Hz) - relaxante e claramente distinguível da resolução.
   */
  public playReviewAlarm(volumeMultiplier: number = 0.5): void {
    this.playTone(440.00, 0.65, volumeMultiplier);
  }

  /**
   * Alarme de Ciclo Pomodoro / Bloco de Estudo:
   * Melodia harmônica relaxante de 3 notas ascendentes em médios suaves: G4 (392 Hz) -> A4 (440 Hz) -> C5 (523 Hz)
   */
  public playCycleAlarm(volumeMultiplier: number = 0.5): void {
    try {
      const notes = [392.00, 440.00, 523.25];
      notes.forEach((freq, i) => {
        this.playTone(freq, 0.60, volumeMultiplier * 0.85, i * 0.16);
      });
    } catch (e) {
      console.warn('playCycleAlarm error:', e);
    }
  }

  /**
   * Sons curtos de navegação e ação (Next, Submit, Anterior) - toques discretos e agradáveis
   */
  public playActionBeep(action: 'next' | 'submit' | 'prev', volumeMultiplier: number = 0.5): void {
    switch (action) {
      case 'next':
        // Toque suave em C5 (523 Hz, 0.28s)
        this.playTone(523.25, 0.28, volumeMultiplier * 0.75);
        break;
      case 'submit':
        // Toque suave em E4 (329 Hz, 0.32s)
        this.playTone(329.63, 0.32, volumeMultiplier * 0.75);
        break;
      case 'prev':
        // Toque aveludado em C4 (261 Hz, 0.26s)
        this.playTone(261.63, 0.26, volumeMultiplier * 0.7);
        break;
    }
  }
}

export const audioManager = new AudioManager();
