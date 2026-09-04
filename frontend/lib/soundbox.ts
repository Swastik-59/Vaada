// ============================================================
// VAADA — Audio Soundbox & Voice Synthesis Engine
// Dual-tone harmonic chime (Web Audio API) + Bilingual Voice Synthesis
// ============================================================

class SoundboxEngine {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Play an ascending harmonic payment confirmation chord chime
   * Frequencies: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
   */
  public playSettlementChime(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C major chord arpeggio
      const noteDelay = 0.08;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * noteDelay);

        gain.gain.setValueAtTime(0, now + idx * noteDelay);
        gain.gain.linearRampToValueAtTime(0.22, now + idx * noteDelay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * noteDelay + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * noteDelay);
        osc.stop(now + idx * noteDelay + 0.5);
      });
    } catch {
      // Audio playback silently gracefully ignored if blocked by autoplay policy
    }
  }

  public playPaymentChime(): void {
    this.playSettlementChime();
  }

  /**
   * Bilingual / Indian Enterprise Voice Soundbox announcement:
   * "Vaada Gateway: Rupees [amount] received via [rail]. Transaction verified."
   */
  public speakSettlementAnnouncement(amount: number, rail: string = "Dynamic UPI"): void {
    if (this.isMuted) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech

      const formattedAmount = amount.toLocaleString("en-IN");
      const message = `Vaada Gateway: Rupees ${formattedAmount} received via ${rail}. Transaction verified and reconciled.`;

      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.02;
      utterance.pitch = 1.05;

      // Prefer Indian English voice if installed on system
      const voices = window.speechSynthesis.getVoices();
      const inVoice = voices.find(
        (v) => v.lang.includes("en-IN") || v.name.toLowerCase().includes("india") || v.lang.includes("hi-IN")
      );
      if (inVoice) {
        utterance.voice = inVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis error handled safely
    }
  }

  /**
   * Full settlement celebration: Chime immediately, followed by spoken announcement
   */
  public triggerSettlementCelebration(amount: number, rail: string = "Dynamic UPI"): void {
    this.playSettlementChime();
    setTimeout(() => {
      this.speakSettlementAnnouncement(amount, rail);
    }, 450);
  }
}

export const soundbox = new SoundboxEngine();
