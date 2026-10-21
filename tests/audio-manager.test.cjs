const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class AudioParamMock {
  constructor() { this.calls = []; }
  setTargetAtTime(...args) { this.calls.push(['target', ...args]); }
  setValueAtTime(...args) { this.calls.push(['set', ...args]); }
  linearRampToValueAtTime(...args) { this.calls.push(['linear', ...args]); }
  exponentialRampToValueAtTime(...args) { this.calls.push(['exponential', ...args]); }
}

class AudioNodeMock {
  constructor() { this.gain = new AudioParamMock(); this.frequency = new AudioParamMock(); this.playbackRate = new AudioParamMock(); this.connections = []; }
  connect(destination) { this.connections.push(destination); }
  start() {}
  stop() {}
}

class AudioBufferMock {
  constructor(channels, length) { this.channels = Array.from({ length: channels }, () => new Float32Array(length)); }
  getChannelData(index) { return this.channels[index]; }
}

class AudioContextMock {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 1;
    this.sampleRate = 8000;
    this.destination = new AudioNodeMock();
    this.oscillators = [];
    this.gains = [];
    this.sources = [];
    this.closed = false;
  }
  createGain() { const node = new AudioNodeMock(); this.gains.push(node); return node; }
  createOscillator() { const node = new AudioNodeMock(); this.oscillators.push(node); return node; }
  createBuffer(channels, length) { return new AudioBufferMock(channels, length); }
  createBufferSource() { const node = new AudioNodeMock(); this.sources.push(node); return node; }
  createBiquadFilter() { return new AudioNodeMock(); }
  createConvolver() { return new AudioNodeMock(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
}

const context = vm.createContext({ window: { setInterval, clearInterval } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/audio/audio-manager.js'), 'utf8'), context);
const AudioManager = vm.runInContext('SquadAudioManager', context);

test('audio unlock starts the looping score only after interaction and sound buses keep effects louder', async () => {
  const audioContext = new AudioContextMock();
  let scheduled = null;
  let cancelled = false;
  const audio = new AudioManager({
    contextFactory: () => audioContext,
    setInterval: callback => { scheduled = callback; return 17; },
    clearInterval: id => { assert.equal(id,17); cancelled = true; }
  });

  assert.equal(audio.context,null,'audio is not created before the first interaction');
  assert.equal(audio.unlock(),true);
  await Promise.resolve();
  assert.equal(audioContext.state,'running');
  assert.equal(typeof scheduled,'function');
  assert.ok(audioContext.oscillators.length >= 2,'first notes are scheduled immediately');
  assert.equal(audioContext.gains[0].gain.calls.at(-1)[1],0.16);
  assert.equal(audioContext.gains[1].gain.calls.at(-1)[1],0.48);

  const before = audioContext.oscillators.length;
  scheduled();
  assert.ok(audioContext.oscillators.length > before,'the motif advances on its loop timer');
  audio.setMusicEnabled(false);
  assert.equal(cancelled,true);
  assert.equal(audio.musicTimer,null);
  audio.dispose();
  assert.equal(audioContext.closed,true);
});

test('shot report has a percussive noise layer, player/enemy voicing, short reverb and respects mute/overlap controls', () => {
  const audioContext = new AudioContextMock();
  const audio = new AudioManager({ contextFactory: () => audioContext, setInterval: () => 1, clearInterval: () => {}, random: () => 0.5 });
  audio.unlock();
  const initial = audioContext.oscillators.length;

  assert.equal(audio.play('shot-player'),true);
  const afterShot = audioContext.oscillators.length;
  assert.equal(afterShot - initial,1,'the sub impact avoids an artificial high-pitched layer');
  assert.equal(audioContext.sources.length,1,'a filtered noise transient supplies the sharp report');
  assert.equal(audio.play('shot-enemy'),false,'rapid allied/enemy shots share one mix limiter');
  audioContext.currentTime += 0.1;
  assert.equal(audio.play('shot-enemy'),true);
  assert.equal(audioContext.sources.length,2);
  audioContext.currentTime += 0.1;
  assert.equal(audio.play('boss-arrival'),true);
  assert.equal(audioContext.oscillators.length - afterShot,4);
  assert.equal(audio.play('heal'),true);
  assert.equal(audioContext.oscillators.length - afterShot,9);

  audio.setEffectsVolume(1.5);
  assert.equal(audio.effectsVolume,1);
  audio.setEffectsEnabled(false);
  const mutedCount = audioContext.oscillators.length;
  assert.equal(audio.play('heal'),false);
  assert.equal(audioContext.oscillators.length,mutedCount);
  audio.setEffectsVolume(-1);
  assert.equal(audio.effectsVolume,0);
  audio.dispose();
});
