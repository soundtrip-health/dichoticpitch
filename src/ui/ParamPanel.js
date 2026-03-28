import { DEFAULTS } from '../utils/constants.js';
import * as dat from 'dat.gui';

/**
 * dat.GUI parameter panel for DSP controls.
 */
export class ParamPanel {
  constructor(container, { onParamChange }) {
    this.onParamChange = onParamChange;

    this.params = {
      sbr: DEFAULTS.sbr,
      tsSigMs: DEFAULTS.tsSigMs,
      tsBackMs: DEFAULTS.tsBackMs,
      lpfCutoff: DEFAULTS.lpfCutoff,
      tonePan: DEFAULTS.tonePan,
      bgPan: DEFAULTS.bgPan,
      noiseMode: DEFAULTS.noiseMode,
      masterGain: DEFAULTS.masterGain,
    };

    this.gui = new dat.GUI({ autoPlace: false, width: 260 });
    container.appendChild(this.gui.domElement);

    const dsp = this.gui.addFolder('DSP');
    dsp.add(this.params, 'sbr', 0, 2, 0.01).name('SBR').onChange(v => this._change('sbr', v));
    dsp.add(this.params, 'tsSigMs', -1, 1, 0.01).name('Sig Shift (ms)').onChange(v => this._change('tsSigMs', v));
    dsp.add(this.params, 'tsBackMs', -1, 1, 0.01).name('Back Shift (ms)').onChange(v => this._change('tsBackMs', v));
    dsp.add(this.params, 'lpfCutoff', 1000, 20000, 100).name('LPF Cutoff').onChange(v => this._change('lpfCutoff', v));
    dsp.open();

    const spatial = this.gui.addFolder('Spatial');
    spatial.add(this.params, 'tonePan', -1, 1, 0.01).name('Tone Pan').onChange(v => this._change('tonePan', v));
    spatial.add(this.params, 'bgPan', -1, 1, 0.01).name('Background Pan').onChange(v => this._change('bgPan', v));
    spatial.open();

    const master = this.gui.addFolder('Master');
    master.add(this.params, 'noiseMode', ['rain', 'waterfall', 'wind', 'stream']).name('Noise Mode').onChange(v => this._change('noiseMode', v));
    master.add(this.params, 'masterGain', 0, 1, 0.01).name('Volume').onChange(v => this._change('masterGain', v));
    master.open();
  }

  _change(param, value) {
    this.onParamChange(param, value);
  }
}
