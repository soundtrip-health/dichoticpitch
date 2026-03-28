import { AudioEngine } from './audio/AudioEngine.js';

let audioEngine = null;

async function init() {
  const overlay = document.getElementById('start-overlay');
  const startBtn = document.getElementById('start-btn');

  startBtn.addEventListener('click', async () => {
    try {
      audioEngine = new AudioEngine();
      await audioEngine.init();
      overlay.classList.add('hidden');
      console.log('AudioEngine initialized — worklet running');
    } catch (err) {
      console.error('Failed to initialize audio:', err);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
