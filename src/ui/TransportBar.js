/**
 * Start/stop transport control.
 */
export class TransportBar {
  constructor(container, { onStart, onStop }) {
    this.onStart = onStart;
    this.onStop = onStop;
    this.running = true;

    const btn = document.createElement('button');
    btn.id = 'stop-btn';
    btn.textContent = 'Stop';
    btn.addEventListener('click', () => {
      this.running = !this.running;
      btn.textContent = this.running ? 'Stop' : 'Start';
      if (this.running) this.onStart();
      else this.onStop();
    });

    container.appendChild(btn);
  }
}
