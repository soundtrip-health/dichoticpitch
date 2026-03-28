/**
 * Dichotic Pitch AudioWorkletProcessor
 *
 * M1: Silent skeleton — outputs silence, validates worklet lifecycle.
 * M2+ will add noise generation and the full DP pipeline.
 */
class DPProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
    console.log('DPProcessor created');
  }

  handleMessage(e) {
    const { type } = e.data;
    console.log(`DPProcessor received: ${type}`);
  }

  process(inputs, outputs, parameters) {
    // Stereo output — fill with silence for M1
    const outL = outputs[0][0];
    const outR = outputs[0][1];

    for (let i = 0; i < outL.length; i++) {
      outL[i] = 0;
      outR[i] = 0;
    }

    return true; // keep processor alive
  }
}

registerProcessor('dp-processor', DPProcessor);
