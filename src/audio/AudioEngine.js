export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.workletNode = null;
    this.gainNode = null;
    this.analyser = null;
  }

  async init() {
    this.ctx = new AudioContext({ sampleRate: 48000 });

    // Load the worklet processor
    const workletUrl = new URL('./dp-worklet.js', import.meta.url).href;
    await this.ctx.audioWorklet.addModule(workletUrl);

    // Create nodes
    this.workletNode = new AudioWorkletNode(this.ctx, 'dp-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.7;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Connect graph: worklet → gain → analyser → destination
    this.workletNode.connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Resume context (autoplay policy)
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    console.log(`AudioContext: ${this.ctx.sampleRate}Hz, state=${this.ctx.state}`);
  }

  /** Send a message to the worklet via its MessagePort */
  postToWorklet(msg) {
    if (this.workletNode) {
      this.workletNode.port.postMessage(msg);
    }
  }

  destroy() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
