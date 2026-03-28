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
      console.log('AudioEngine initialized — shaped noise playing');
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

  const modeBtn = document.createElement('button');
  modeBtn.id = 'mode-btn';
  modeBtn.textContent = 'Rain';
  modeBtn.addEventListener('click', () => {
    const isRain = modeBtn.textContent === 'Rain';
    const newMode = isRain ? 'waterfall' : 'rain';
    modeBtn.textContent = isRain ? 'Waterfall' : 'Rain';
    audioEngine.setNoiseMode(newMode);
  });

  // M4 test: toggle a ~500Hz DP note (MIDI 71 = B4 ≈ 494Hz)
  const TEST_NOTE = 71;
  let testNoteOn = false;
  const testBtn = document.createElement('button');
  testBtn.id = 'test-btn';
  testBtn.textContent = 'Test 500Hz';
  testBtn.addEventListener('click', () => {
    testNoteOn = !testNoteOn;
    if (testNoteOn) {
      audioEngine.noteOn(TEST_NOTE);
      testBtn.textContent = 'Stop 500Hz';
      testBtn.classList.add('active');
    } else {
      audioEngine.noteOff(TEST_NOTE);
      testBtn.textContent = 'Test 500Hz';
      testBtn.classList.remove('active');
    }
  });

  container.appendChild(stopBtn);
  container.appendChild(modeBtn);
  container.appendChild(testBtn);
}

document.addEventListener('DOMContentLoaded', init);
