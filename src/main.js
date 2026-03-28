import { AudioEngine } from './audio/AudioEngine.js';
import { UIManager } from './ui/UIManager.js';

let audioEngine = null;

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

      console.log('AudioEngine initialized — UI ready');
    } catch (err) {
      console.error('Failed to initialize audio:', err);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
