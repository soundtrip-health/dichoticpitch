# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dichotic Pitch Generator** — a browser-based instrument for creating dichotic pitch (DP) tunes in real time, evolving from legacy Matlab/Octave stimulus-generation scripts. Users play a piano keyboard UI and hear dichotic pitch notes synthesized via the Web Audio API with WebGL visualizations.

The scientific foundation: dichotic pitch is a perceived pitch extracted by the brain from two noise sequences, neither of which alone contains pitch cues. It exploits interaural time differences (ITD) between ears (Dougherty et al., 1998).

## Tech Stack

- **Vite** — dev server and build (`npm run dev` on port 3000)
- **Vanilla JS** — ES modules, no framework
- **Three.js** + custom GLSL shaders — WebGL audio-reactive visualizations
- **Web Audio API** + AudioWorklet — real-time DSP in `dp-worklet.js`
- **dat.GUI** — parameter controls
- **fft.js** — vendored in `src/audio/fft.js` (AudioWorklet can't resolve node_modules)
- **Express** — thin production server on port 3001 (not needed for dev)

## Commands

```bash
npm run dev       # Vite dev server (port 3000, proxies /api to 3001)
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm run server    # Express production server (port 3001)
```

## Legacy Matlab Reference

`src_matlab/` contains the original Matlab/Octave implementation. Run `DPdemo.m` in Matlab/Octave. Key files: `dichoticPitch.m`, `multiBandpass.m`, `doBandpass.m`, `shift.m`, `cosWindow.m`. Pre-computed demos in `demos/`.

## Core Algorithm (dichoticPitch.m → dp-worklet.js)

**Critical: noise is generated directly in the frequency domain** (flat amplitude, random phases, conjugate-symmetric). There is no forward FFT — only IFFTs.

```
[freq domain]  Generate sig spectrum: flat amp, random phases (conjugate-symmetric)
[freq domain]  Generate back spectrum: independent random phases
[freq domain]  Build combined filter mask (bandpass + SBR + renorm + LPF — one multiply)
[freq domain]  sigFiltered = sig * sigMask;  backFiltered = back * backMask
[freq→time]    sig_time = IFFT(sigFiltered);  back_time = IFFT(backFiltered)
[time domain]  Hann window for overlap-add
[time domain]  left = sig_time + back_time
[time domain]  right = circShift(sig_time, tsSig) + circShift(back_time, tsBack)
```

**Filter masks** (per Matlab lines 86-95):
- `sigMask[bin]` = `sbr * renorm` in-band, `0` out-of-band
- `backMask[bin]` = `max(1-sbr,0) * renorm` in-band, `1` out-of-band
- Renorm = `1/sqrt(sbr² + (1-sbr)²)` when sbr < 1 (folded into masks, no extra FFT pass)
- LPF = zero bins above cutoff

**Overlap-add**: 2048-pt FFT, 1024-sample hop, 50% Hann window. AudioWorklet delivers 128-sample quanta; every 8 quanta triggers a new block.

## Architecture

```
src/
├── main.js              # bootstrap: AudioContext, AudioEngine, VizManager, UIManager
├── audio/
│   ├── AudioEngine.js   # main-thread graph: WorkletNode → Gain → Analyser → dest
│   ├── dp-worklet.js    # AudioWorkletProcessor — ALL DSP here
│   ├── fft.js           # vendored fft.js
│   ├── noise-shaper.js  # rain/waterfall spectral tilt
│   └── note-utils.js    # MIDI→freq, bandwidth, note names
├── viz/
│   ├── VizManager.js    # Three.js scene, camera, render loop
│   ├── shaders/         # GLSL vertex/fragment shaders
│   └── geometries.js    # buffer geometry helpers
├── ui/
│   ├── UIManager.js     # wires events, MIDI input
│   ├── PianoKeyboard.js # SVG piano (C3–C6), mouse/touch/keyboard
│   ├── ParamPanel.js    # dat.GUI: sbr, time shifts, panning, noise mode
│   └── TransportBar.js  # start/stop, noise mode, master volume
└── utils/
    ├── constants.js     # sample rate, FFT size, note tables
    └── event-bus.js     # simple pub/sub
```

**Data flow**: User input → event bus → AudioEngine → MessagePort → worklet → audio output. Worklet posts analysis data back → VizManager updates shaders each rAF frame.

**Key runtime parameters**: `sbr` (0..>1), `tsSigMs`/`tsBackMs` (±0.6ms optimal), `noiseMode` (rain|waterfall), `tonePan`/`bgPan` ([-1,1]), `lpfCutoff`, `masterGain`

## Design Constraints

- All DSP in AudioWorkletProcessor — no allocations in `process()` (preallocated buffers)
- Lock-free state sync via MessagePort; no blocking on audio thread
- Parameter changes smoothed over ~20ms (one-pole exponential)
- fft.js vendored because AudioWorklet modules can't resolve node_modules imports
- Parity tests: offline JS rendering vs. Matlab reference (same seed, same params)

## Development Plan

Full plan with 10 milestones at `~/.claude/plans/keen-exploring-rossum.md`.
