/**
 * Start/stop transport control with spacebar shortcut.
 */
export class TransportBar {
  constructor(container, { onStart, onStop }) {
    this.onStart = onStart;
    this.onStop = onStop;
    this.running = true;

    const btn = document.createElement('button');
    btn.id = 'stop-btn';
    btn.textContent = 'Stop';
    btn.classList.add('running');
    btn.addEventListener('click', () => this._toggle());

    // Spacebar toggles transport (only when not typing in an input)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        this._toggle();
      }
    });

    this.btn = btn;
    container.appendChild(btn);
  }

  _toggle() {
    this.running = !this.running;
    this.btn.textContent = this.running ? 'Stop' : 'Start';
    this.btn.classList.toggle('running', this.running);
    if (this.running) this.onStart();
    else this.onStop();
  }
}
