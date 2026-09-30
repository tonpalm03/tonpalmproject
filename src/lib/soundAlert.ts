/**
 * Sound Alert and Audio Unlock Engine for Delivery Orders
 * Specially optimized for iOS Safari, PWA, and Mobile Chrome
 */

class SoundAlertEngine {
  private ctx: AudioContext | null = null;
  private isUnlocked = false;
  private wakeLockSentinel: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.attachUnlockListeners();
      this.attachVisibilityListener();
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    return this.ctx;
  }

  private attachUnlockListeners() {
    const unlockEvents = ['touchstart', 'touchend', 'click', 'pointerup', 'keydown'];
    const onUserInteraction = () => {
      this.unlock();
      unlockEvents.forEach((event) => {
        window.removeEventListener(event, onUserInteraction);
      });
    };

    unlockEvents.forEach((event) => {
      window.addEventListener(event, onUserInteraction, { passive: true });
    });
  }

  private attachVisibilityListener() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        // iOS might suspend audio context when backgrounded, resume it when back
        if (this.ctx && this.ctx.state === 'suspended') {
          try {
            await this.ctx.resume();
          } catch (e) {
            console.warn('Resume audio on visible error:', e);
          }
        }
      }
    });
  }

  /**
   * Unlocks the Web Audio API on iOS and mobile browsers
   */
  public async unlock(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Play an ultra-short silent buffer to unlock the hardware audio pipeline
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      this.isUnlocked = true;
      return true;
    } catch (err) {
      console.warn('Audio unlock warning:', err);
      return false;
    }
  }

  public isReady(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /**
   * Plays a loud, pleasant, high-contrast 2-stage doorbell chime ("Ding-Dong! ... Ding-Dong!")
   */
  public async playOrderChime(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      // Professional loud chime chords (Frequencies designed for restaurant noisy environments)
      // Chord 1 (High bell - Ding): 784Hz (G5) + 1046.5Hz (C6 overtone)
      // Chord 2 (Low bell - Dong): 523.25Hz (C5) + 659.25Hz (E5 overtone)
      // Chord 3 (Higher Ding): 880Hz (A5) + 1174.66Hz (D6)
      // Chord 4 (Final Dong): 587.33Hz (D5) + 740Hz (F#5)
      const chimeTones = [
        // Bell 1: Ding (0.0s)
        { freq: 784.00, start: 0.00, duration: 0.45, gain: 0.55 },
        { freq: 1046.50, start: 0.02, duration: 0.40, gain: 0.30 },

        // Bell 1: Dong (0.35s)
        { freq: 523.25, start: 0.35, duration: 0.70, gain: 0.60 },
        { freq: 659.25, start: 0.38, duration: 0.55, gain: 0.35 },

        // Bell 2: Ding (0.90s)
        { freq: 880.00, start: 0.90, duration: 0.45, gain: 0.55 },
        { freq: 1174.66, start: 0.92, duration: 0.40, gain: 0.30 },

        // Bell 2: Dong (1.25s)
        { freq: 587.33, start: 1.25, duration: 0.80, gain: 0.65 },
        { freq: 740.00, start: 1.28, duration: 0.65, gain: 0.35 }
      ];

      chimeTones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Warm and bright bell harmonics
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        // Instant attack followed by exponential bell decay
        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.025);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      // Mobile phone vibration
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([250, 150, 250, 150, 400]);
        } catch (e) {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.warn('Play chime error:', err);
      return false;
    }
  }

  /**
   * Plays a cheerful, bright brass chime when opening the store ("เปิดร้านรับออเดอร์!")
   * Welcoming ascending chime: Ding-Ling-Dong!
   */
  public async playShopOpenSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const openTones = [
        // Tone 1 (Ding)
        { freq: 587.33, start: 0.00, duration: 0.30, gain: 0.45 }, // D5
        { freq: 1174.66, start: 0.01, duration: 0.20, gain: 0.25 }, // D6 overtone

        // Tone 2 (Ling)
        { freq: 739.99, start: 0.09, duration: 0.35, gain: 0.50 }, // F#5
        { freq: 1479.98, start: 0.10, duration: 0.25, gain: 0.25 }, // F#6 overtone

        // Tone 3 (Dong)
        { freq: 880.00, start: 0.20, duration: 0.60, gain: 0.60 }, // A5
        { freq: 1760.00, start: 0.21, duration: 0.45, gain: 0.30 }, // A6 sparkle

        // Final high sparkle
        { freq: 1174.66, start: 0.32, duration: 0.70, gain: 0.50 }, // D6
        { freq: 2349.32, start: 0.33, duration: 0.50, gain: 0.20 }, // D7 shimmer
      ];

      openTones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([60, 40, 100]);
        } catch (e) {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.warn('Play shop open sound error:', err);
      return false;
    }
  }

  /**
   * Plays a calm, gentle descending chime when closing the store ("ปิดร้านชั่วคราว")
   */
  public async playShopCloseSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const closeTones = [
        { freq: 880.00, start: 0.00, duration: 0.28, gain: 0.40 }, // A5
        { freq: 659.25, start: 0.14, duration: 0.35, gain: 0.45 }, // E5
        { freq: 440.00, start: 0.28, duration: 0.55, gain: 0.50 }, // A4
      ];

      closeTones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(120);
        } catch (e) {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.warn('Play shop close sound error:', err);
      return false;
    }
  }

  /**
   * Plays appropriate sound based on shop open/close toggle
   */
  public async playShopToggleSound(isOpen: boolean): Promise<boolean> {
    if (isOpen) {
      return this.playShopOpenSound();
    } else {
      return this.playShopCloseSound();
    }
  }

  /**
   * Plays a crisp, gentle message notification chime ("ปิ๊ง!")
   */
  public async playMessageSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const tones = [
        { freq: 880.00, start: 0.00, duration: 0.12, gain: 0.35 }, // A5
        { freq: 1318.51, start: 0.08, duration: 0.25, gain: 0.40 }, // E6
      ];

      tones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 30, 60]);
        } catch (e) {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.warn('Play message sound error:', err);
      return false;
    }
  }

  /**
   * Plays a crisp, cheerful, positive ascending chime when merchant accepts an order ("รับออเดอร์เรียบร้อย!")
   * Ascending celebration chord: C5 -> E5 -> G5 -> C6 (Ding-Ring-Ring-Chime!)
   */
  public async playOrderAcceptedSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const acceptTones = [
        // Note 1: C5
        { freq: 523.25, start: 0.00, duration: 0.25, gain: 0.45 },
        { freq: 1046.50, start: 0.01, duration: 0.18, gain: 0.20 }, // C6 overtone

        // Note 2: E5
        { freq: 659.25, start: 0.08, duration: 0.28, gain: 0.50 },
        { freq: 1318.51, start: 0.09, duration: 0.20, gain: 0.22 }, // E6 overtone

        // Note 3: G5
        { freq: 783.99, start: 0.16, duration: 0.35, gain: 0.55 },
        { freq: 1567.98, start: 0.17, duration: 0.25, gain: 0.25 }, // G6 overtone

        // Note 4: C6 (High clear bell resolution)
        { freq: 1046.50, start: 0.24, duration: 0.65, gain: 0.65 },
        { freq: 2093.00, start: 0.25, duration: 0.45, gain: 0.28 }, // C7 sparkle
      ];

      acceptTones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.012);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      // Joyful haptic vibration
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 30, 80]);
        } catch (e) {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.warn('Play order accepted sound error:', err);
      return false;
    }
  }

  /**
   * Plays an energetic, uplifting departure sound when order is ready and merchant goes out to deliver
   * ("ปรุงเสร็จแล้ว กำลังออกไปส่ง (10 บ.) 🛵💨")
   * Upbeat engine rev / chime fanfare: A4 -> D5 -> F#5 -> A5 -> D6
   */
  public async playOrderDeliveringSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const tones = [
        { freq: 440.00, start: 0.00, duration: 0.16, gain: 0.35 }, // A4
        { freq: 587.33, start: 0.06, duration: 0.20, gain: 0.40 }, // D5
        { freq: 739.99, start: 0.12, duration: 0.24, gain: 0.45 }, // F#5
        { freq: 880.00, start: 0.18, duration: 0.30, gain: 0.50 }, // A5
        { freq: 1174.66, start: 0.25, duration: 0.60, gain: 0.65 }, // D6 (Final bright bell)
        { freq: 1760.00, start: 0.26, duration: 0.45, gain: 0.25 }, // A6 sparkle
      ];

      tones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([60, 40, 90]);
        } catch (e) {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.warn('Play delivering sound error:', err);
      return false;
    }
  }

  /**
   * Plays a crisp, ultra-satisfying cash register "Ka-Ching!" + coin clink celebration chime
   * when merchant delivers and collects money ("ส่งถึงมือแล้ว + รับเงินเรียบร้อย 💰✨")
   */
  public async playOrderCompletedSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      // Part 1: "Ka" metallic latch click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(1480, now);
      clickOsc.frequency.exponentialRampToValueAtTime(800, now + 0.04);
      clickGain.gain.setValueAtTime(0.35, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.04);

      // Part 2: "Ching!" - High register cash bells & coins
      const chingTones = [
        // Ringing bell
        { freq: 2093.00, start: 0.04, duration: 0.85, gain: 0.55 }, // C7
        { freq: 2637.02, start: 0.04, duration: 0.90, gain: 0.50 }, // E7
        { freq: 3135.96, start: 0.05, duration: 0.70, gain: 0.35 }, // G7
        { freq: 4186.01, start: 0.05, duration: 0.50, gain: 0.20 }, // C8 shimmer

        // Coins landing in cash box
        { freq: 2793.83, start: 0.20, duration: 0.35, gain: 0.40 }, // F7
        { freq: 3520.00, start: 0.26, duration: 0.50, gain: 0.45 }, // A7
        { freq: 4186.01, start: 0.32, duration: 0.75, gain: 0.50 }, // C8 final coin
      ];

      chingTones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 40, 120]);
        } catch (e) {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.warn('Play completed sound error:', err);
      return false;
    }
  }

  /**
   * Plays a crisp, satisfying soft pop / bubble sound when adding item to cart
   */
  public async playAddToCartSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.04);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.28, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(25); } catch (_) {}
      }

      return true;
    } catch (err) {
      console.warn('Play add to cart sound error:', err);
      return false;
    }
  }

  /**
   * Plays a joyful, celebratory chime when customer successfully places an order
   */
  public async playOrderPlacedSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const successTones = [
        { freq: 523.25, start: 0.00, duration: 0.20, gain: 0.35 }, // C5
        { freq: 659.25, start: 0.08, duration: 0.22, gain: 0.40 }, // E5
        { freq: 783.99, start: 0.16, duration: 0.28, gain: 0.45 }, // G5
        { freq: 1046.50, start: 0.24, duration: 0.60, gain: 0.55 }, // C6
        { freq: 1318.51, start: 0.32, duration: 0.70, gain: 0.40 }, // E6 sparkle
      ];

      successTones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.012);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([50, 40, 80]); } catch (_) {}
      }

      return true;
    } catch (err) {
      console.warn('Play order placed sound error:', err);
      return false;
    }
  }

  /**
   * Plays live update sound on customer screen when order state advances
   */
  public async playCustomerStatusSound(status: 'cooking' | 'delivering' | 'completed'): Promise<boolean> {
    if (status === 'completed') {
      return this.playOrderCompletedSound();
    }
    if (status === 'delivering') {
      return this.playOrderDeliveringSound();
    }
    return this.playOrderAcceptedSound();
  }

  /**
   * Plays a crisp coin / cash sound when admin tops up or adjusts merchant credit
   */
  public async playAdminTopupSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const coinTones = [
        { freq: 2637.02, start: 0.00, duration: 0.25, gain: 0.40 }, // E7
        { freq: 3135.96, start: 0.06, duration: 0.35, gain: 0.45 }, // G7
        { freq: 3951.07, start: 0.12, duration: 0.50, gain: 0.50 }, // B7
      ];

      coinTones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([40, 30, 60]); } catch (_) {}
      }

      return true;
    } catch (err) {
      console.warn('Play admin topup sound error:', err);
      return false;
    }
  }

  /**
   * Plays a noble celebration fanfare when admin promotes a user to merchant
   */
  public async playAdminPromoteSound(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const fanfareTones = [
        { freq: 523.25, start: 0.00, duration: 0.15, gain: 0.35 }, // C5
        { freq: 659.25, start: 0.08, duration: 0.15, gain: 0.40 }, // E5
        { freq: 783.99, start: 0.16, duration: 0.18, gain: 0.45 }, // G5
        { freq: 1046.50, start: 0.24, duration: 0.55, gain: 0.60 }, // C6
      ];

      fanfareTones.forEach(({ freq, start, duration, gain: peakGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0.001, now + start);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + start + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([50, 40, 80]); } catch (_) {}
      }

      return true;
    } catch (err) {
      console.warn('Play admin promote sound error:', err);
      return false;
    }
  }


  /**
   * Screen Wake Lock API to prevent phone screen from going to sleep while restaurant is waiting for orders
   */
  public async requestWakeLock(): Promise<boolean> {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
        });
        return true;
      } catch (e) {
        console.warn('Wake lock error:', e);
        return false;
      }
    }
    return false;
  }

  public releaseWakeLock() {
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release().catch(() => {});
      this.wakeLockSentinel = null;
    }
  }
}

export const soundAlert = new SoundAlertEngine();
