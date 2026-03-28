import { AudioEngine } from './audio/AudioEngine.js';
import { UIManager } from './ui/UIManager.js';
import { VizManager } from './viz/VizManager.js';

let audioEngine = null;
let vizManager = null;

async function init() {
  const overlay = document.getElementById('start-overlay');
  const startBtn = document.getElementById('start-btn');

  startBtn.addEventListener('click', async () => {
    try {
      audioEngine = new AudioEngine();
      await audioEngine.init();
      overlay.classList.add('hidden');

      // Wire up all UI controls
      new UIManager(audioEngine);

      // Start visualization
      const canvas = document.getElementById('viz-canvas');
      vizManager = new VizManager(canvas, audioEngine);
      startRenderLoop();

      console.log('AudioEngine initialized — UI + Viz ready');
    } catch (err) {
      console.error('Failed to initialize audio:', err);
    }
  });
}

function startRenderLoop() {
  function frame() {
    if (vizManager) vizManager.update();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', init);
