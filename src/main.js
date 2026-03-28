import { AudioEngine } from './audio/AudioEngine.js';

let audioEngine = null;

async function init() {
  const overlay = document.getElementById('start-overlay');
  const startBtn = document.getElementById('start-btn');
  const transportBar = document.getElementById('transport-bar');

  startBtn.addEventListener('click', async () => {
    try {
      audioEngine = new AudioEngine();
      await audioEngine.init();
      overlay.classList.add('hidden');
      showTransport(transportBar);
      console.log('AudioEngine initialized — white noise playing');
    } catch (err) {
      console.error('Failed to initialize audio:', err);
    }
  });
}

function showTransport(container) {
  const stopBtn = document.createElement('button');
  stopBtn.id = 'stop-btn';
  stopBtn.textContent = 'Stop';
  stopBtn.addEventListener('click', () => {
    if (stopBtn.textContent === 'Stop') {
      audioEngine.stopNoise();
      stopBtn.textContent = 'Start';
    } else {
      audioEngine.startNoise();
      stopBtn.textContent = 'Stop';
    }
  });
  container.appendChild(stopBtn);
}

document.addEventListener('DOMContentLoaded', init);
