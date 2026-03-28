/**
 * Dichotic Pitch AudioWorkletProcessor
 *
 * M2: White noise generation — stereo output, controllable via MessagePort.
 * M3+ will add spectral shaping, M4+ the full DP pipeline.
 */
class DPProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.running = false;
    this.amplitude = 0.3; // conservative default to avoid blasting ears
    this.port.onmessage = this.handleMessage.bind(this);
    console.log('DPProcessor created');
  }

  handleMessage(e) {
    const { type, value } = e.data;
    switch (type) {
      case 'start':
        this.running = true;
        break;
      case 'stop':
        this.running = false;
        break;
      case 'paramUpdate':
        if (e.data.param === 'masterGain') {
          this.amplitude = value;
        }
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const outL = outputs[0][0];
    const outR = outputs[0][1];

    if (!this.running) {
      for (let i = 0; i < outL.length; i++) {
        outL[i] = 0;
        outR[i] = 0;
      }
      return true;
    }

    // White noise: uniform random in [-amplitude, +amplitude], independent per ear
    const amp = this.amplitude;
    for (let i = 0; i < outL.length; i++) {
      outL[i] = (Math.random() * 2 - 1) * amp;
      outR[i] = (Math.random() * 2 - 1) * amp;
    }

    return true;
  }
}

registerProcessor('dp-processor', DPProcessor);
