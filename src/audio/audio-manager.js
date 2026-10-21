class SquadAudioManager {
  constructor(options = {}) {
    this.contextFactory = options.contextFactory || (() => {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      return AudioContextConstructor ? new AudioContextConstructor() : null;
    });
    this.schedule = options.setInterval || window.setInterval.bind(window);
    this.cancelSchedule = options.clearInterval || window.clearInterval.bind(window);
    this.random = options.random || Math.random;
    this.context = null;
    this.musicBus = null;
    this.effectsBus = null;
    this.shotReverb = null;
    this.musicEnabled = true;
    this.effectsEnabled = true;
    this.musicVolume = 0.16;
    this.effectsVolume = 0.48;
    this.musicTimer = null;
    this.musicStep = 0;
    this.lastShotAt = -Infinity;
  }

  unlock() {
    if (!this.context) {
      try { this.context = this.contextFactory(); } catch { return false; }
      if (!this.context) return false;
      this.musicBus = this.context.createGain();
      this.effectsBus = this.context.createGain();
      this.shotReverb = this.context.createConvolver();
      const impulseLength = Math.floor(this.context.sampleRate * 0.12);
      const impulse = this.context.createBuffer(2, impulseLength, this.context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const samples = impulse.getChannelData(channel);
        for (let index = 0; index < impulseLength; index++) {
          const decay = 1 - index / impulseLength;
          samples[index] = (this.random() * 2 - 1) * decay * decay * 0.32;
        }
      }
      this.shotReverb.buffer = impulse;
      const reverbReturn = this.context.createGain();
      reverbReturn.gain.value = 0.2;
      this.shotReverb.connect(reverbReturn);
      reverbReturn.connect(this.effectsBus);
      this.musicBus.connect(this.context.destination);
      this.effectsBus.connect(this.context.destination);
      this.applyVolumes();
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    if (this.musicEnabled && this.musicTimer === null) this.startMusicLoop();
    return true;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    if (!this.context && this.musicEnabled) return;
    if (this.musicEnabled && this.musicTimer === null) this.startMusicLoop();
    if (!this.musicEnabled && this.musicTimer !== null) {
      this.cancelSchedule(this.musicTimer);
      this.musicTimer = null;
    }
    this.applyVolumes();
  }

  setEffectsEnabled(enabled) {
    this.effectsEnabled = Boolean(enabled);
    this.applyVolumes();
  }

  setMusicVolume(value) {
    this.musicVolume = this.clampVolume(value);
    this.applyVolumes();
  }

  setEffectsVolume(value) {
    this.effectsVolume = this.clampVolume(value);
    this.applyVolumes();
  }

  clampVolume(value) {
    const volume = Number(value);
    return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
  }

  applyVolumes() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicEnabled ? this.musicVolume : 0, now, 0.035);
    this.effectsBus.gain.setTargetAtTime(this.effectsEnabled ? this.effectsVolume : 0, now, 0.02);
  }

  startMusicLoop() {
    if (!this.context || !this.musicEnabled || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.playMusicStep();
    this.musicTimer = this.schedule(() => this.playMusicStep(), 300);
  }

  playMusicStep() {
    if (!this.context || !this.musicEnabled) return;
    const melody = [392, 0, 493.88, 0, 587.33, 0, 493.88, 0, 440, 0, 587.33, 0, 659.25, 0, 587.33, 0];
    const bass = [98, 98, 0, 98, 110, 110, 0, 110, 82.41, 82.41, 0, 82.41, 87.31, 87.31, 0, 87.31];
    const note = melody[this.musicStep];
    const bassNote = bass[this.musicStep];
    if (note) this.tone(note, 0.21, 'triangle', 0.12, this.musicBus);
    if (bassNote) this.tone(bassNote, 0.24, 'sawtooth', 0.07, this.musicBus);
    if (this.musicStep % 4 === 0) this.tone(note || 392, 0.1, 'sine', 0.045, this.musicBus, 1.5);
    this.musicStep = (this.musicStep + 1) % melody.length;
  }

  tone(frequency, duration, type, volume, destination, endFrequency = frequency) {
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.015);
  }

  play(eventName) {
    if (!this.context || !this.effectsEnabled) return false;
    if (eventName === 'shot' || eventName === 'shot-player' || eventName === 'shot-enemy') {
      const now = this.context.currentTime;
      if (now - this.lastShotAt < 0.095) return false;
      this.lastShotAt = now;
      const enemyShot = eventName === 'shot-enemy';
      const pitch = (enemyShot ? 104 : 88) + this.random() * 12;
      this.tone(pitch, 0.115, 'triangle', enemyShot ? 0.21 : 0.25, this.effectsBus, 38 + this.random() * 8);
      this.noiseBurst(enemyShot ? 0.092 : 0.105, enemyShot ? 0.19 : 0.23, enemyShot ? 1150 : 920);
      return true;
    }
    if (eventName === 'boss-arrival') {
      this.tone(82, 1.05, 'sawtooth', 0.3, this.effectsBus, 31);
      this.tone(123, 0.8, 'triangle', 0.2, this.effectsBus, 45);
      this.tone(55, 1.25, 'sine', 0.32, this.effectsBus, 34);
      return true;
    }
    if (eventName === 'heal') {
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        this.tone(frequency, 0.42, 'sine', 0.19, this.effectsBus);
        if (index < 2) this.tone(frequency * 2, 0.24, 'triangle', 0.055, this.effectsBus);
      });
      return true;
    }
    return false;
  }

  noiseBurst(duration, volume, cutoff) {
    if (!this.context.createBufferSource || !this.context.createBiquadFilter) return;
    const sampleCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index++) {
      const decay = 1 - index / sampleCount;
      samples[index] = (this.random() * 2 - 1) * decay * decay;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    envelope.gain.setValueAtTime(volume, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.playbackRate.value = 0.92 + this.random() * 0.12;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.effectsBus);
    envelope.connect(this.shotReverb);
    source.start(now);
    source.stop(now + duration);
  }

  dispose() {
    if (this.musicTimer !== null) this.cancelSchedule(this.musicTimer);
    this.musicTimer = null;
    if (this.context && this.context.state !== 'closed') this.context.close();
  }
}
