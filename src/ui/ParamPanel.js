import { DEFAULTS, VIZ_DEFAULTS } from '../utils/constants.js';
import { bus } from '../utils/event-bus.js';
import * as dat from 'dat.gui';

/**
 * dat.GUI parameter panel — DSP controls + spiral visualization options.
 */
export class ParamPanel {
  constructor(container, { onParamChange }) {
    this.onParamChange = onParamChange;

    this.params = {
      sbr: DEFAULTS.sbr,
      tsSigMs: DEFAULTS.tsSigMs,
      tsBackMs: DEFAULTS.tsBackMs,
      lpfCutoff: DEFAULTS.lpfCutoff,
      noiseMode: DEFAULTS.noiseMode,
      masterGain: DEFAULTS.masterGain,
    };

    this.gui = new dat.GUI({ autoPlace: false, width: 260 });
    container.appendChild(this.gui.domElement);

    // ── DSP ──────────────────────────────────────────────
    const dsp = this.gui.addFolder('DSP');
    dsp.add(this.params, 'sbr', 0, 2, 0.01).name('SBR')
      .onChange(v => this._change('sbr', v));
    dsp.add(this.params, 'tsSigMs', -1, 1, 0.01).name('Sig Shift (ms)')
      .onChange(v => this._change('tsSigMs', v));
    dsp.add(this.params, 'tsBackMs', -1, 1, 0.01).name('Back Shift (ms)')
      .onChange(v => this._change('tsBackMs', v));
    dsp.add(this.params, 'lpfCutoff', 1000, 20000, 100).name('LPF Cutoff')
      .onChange(v => this._change('lpfCutoff', v));
    dsp.add(this.params, 'noiseMode', ['rain', 'waterfall', 'wind', 'stream']).name('Noise Mode')
      .onChange(v => this._change('noiseMode', v));
    dsp.add(this.params, 'masterGain', 0, 1, 0.01).name('Volume')
      .onChange(v => this._change('masterGain', v));
    dsp.open();

    // ── Visualization ────────────────────────────────────
    this.vizParams = { ...VIZ_DEFAULTS };
    const viz = this.gui.addFolder('Visualization');

    viz.add(this.vizParams, 'mode', ['spiral', 'wavySpiral', 'flower', 'circle'])
      .name('Mode').onChange(v => this._vizChange('mode', v));
    viz.add(this.vizParams, 'animate').name('Animate')
      .onChange(v => this._vizChange('animate', v));
    viz.add(this.vizParams, 'intensity', 0.05, 1, 0.01).name('Intensity')
      .onChange(v => this._vizChange('intensity', v));
    viz.add(this.vizParams, 'fov', 1, 150, 1).name('Zoom (FOV)')
      .onChange(v => this._vizChange('fov', v));
    viz.add(this.vizParams, 'pointSize', 1, 10, 0.5).name('Point Size')
      .onChange(v => this._vizChange('pointSize', v));
    viz.open();

    // Spiral
    const spiralF = viz.addFolder('Spiral');
    spiralF.add(this.vizParams, 'spiralA', 0, 50, 0.01).name('Inner Radius')
      .onChange(v => this._vizChange('spiralA', v));
    spiralF.add(this.vizParams, 'spiralB', 0, 5, 0.01).name('Outer Radius')
      .onChange(v => this._vizChange('spiralB', v));
    spiralF.add(this.vizParams, 'spiralAngle', 0, 50, 0.01).name('Angle')
      .onChange(v => this._vizChange('spiralAngle', v));

    // Wavy Spiral
    const wavyF = viz.addFolder('Wavy Spiral');
    wavyF.add(this.vizParams, 'wavyA', 0, 50, 0.01).name('Inner Radius')
      .onChange(v => this._vizChange('wavyA', v));
    wavyF.add(this.vizParams, 'wavyB', 0, 3, 0.01).name('Outer Radius')
      .onChange(v => this._vizChange('wavyB', v));
    wavyF.add(this.vizParams, 'wavyAngle', 1, 4, 0.01).name('Angle')
      .onChange(v => this._vizChange('wavyAngle', v));
    wavyF.open();

    // Flower
    const flowerF = viz.addFolder('Flower');
    flowerF.add(this.vizParams, 'flowerA', 0, 50, 0.01).name('Inner Radius')
      .onChange(v => this._vizChange('flowerA', v));
    flowerF.add(this.vizParams, 'flowerB', 0, 3, 0.01).name('Outer Radius')
      .onChange(v => this._vizChange('flowerB', v));
    flowerF.add(this.vizParams, 'flowerAngle', 1, 4, 0.01).name('Angle')
      .onChange(v => this._vizChange('flowerAngle', v));

    // Circle
    const circleF = viz.addFolder('Circle');
    circleF.add(this.vizParams, 'circleRadius', 10, 100, 1).name('Radius')
      .onChange(v => this._vizChange('circleRadius', v));

    // Color
    const colorF = viz.addFolder('Color');
    colorF.add(this.vizParams, 'colorEmphasis', ['red', 'green', 'blue']).name('Emphasis')
      .onChange(v => this._vizChange('colorEmphasis', v));
    colorF.add(this.vizParams, 'colorR', 0, 1, 0.01).name('Red')
      .onChange(v => this._vizChange('colorR', v));
    colorF.add(this.vizParams, 'colorG', 0, 1, 0.01).name('Green')
      .onChange(v => this._vizChange('colorG', v));
    colorF.add(this.vizParams, 'colorB', 0, 1, 0.01).name('Blue')
      .onChange(v => this._vizChange('colorB', v));
    colorF.open();
  }

  _change(param, value) {
    this.onParamChange(param, value);
    if (param === 'tsSigMs' || param === 'tsBackMs') {
      bus.emit('viz:' + param, value);
    }
  }

  _vizChange(key, value) {
    this.vizParams[key] = value;
    bus.emit('viz:param', { key, value });
  }
}
