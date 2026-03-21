export type AmbientSoundPreset = 'off' | 'rain' | 'thunderstorm' | 'ocean' | 'wind';

const NOISE_BUFFER_CACHE = new WeakMap<AudioContext, AudioBuffer>();

const createWhiteNoiseBuffer = (context: AudioContext): AudioBuffer => {
  const cached = NOISE_BUFFER_CACHE.get(context);
  if (cached) {
    return cached;
  }

  const duration = 2;
  const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  NOISE_BUFFER_CACHE.set(context, buffer);
  return buffer;
};

const createNoiseSource = (context: AudioContext): AudioBufferSourceNode => {
  const source = context.createBufferSource();
  source.buffer = createWhiteNoiseBuffer(context);
  source.loop = true;
  return source;
};

const connectNoiseChain = (
  context: AudioContext,
  output: AudioNode,
  options: {
    highPassHz?: number;
    lowPassHz?: number;
    gain: number;
  }
): (() => void) => {
  const source = createNoiseSource(context);
  const highPass = context.createBiquadFilter();
  const lowPass = context.createBiquadFilter();
  const gainNode = context.createGain();

  highPass.type = 'highpass';
  lowPass.type = 'lowpass';
  highPass.frequency.value = options.highPassHz ?? 0;
  lowPass.frequency.value = options.lowPassHz ?? 20000;
  gainNode.gain.value = options.gain;

  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(gainNode);
  gainNode.connect(output);
  source.start();

  return () => {
    source.stop();
    source.disconnect();
    highPass.disconnect();
    lowPass.disconnect();
    gainNode.disconnect();
  };
};

const createRain = (context: AudioContext, output: AudioNode): (() => void) =>
  connectNoiseChain(context, output, {
    highPassHz: 420,
    lowPassHz: 7600,
    gain: 0.32,
  });

const createThunderstorm = (context: AudioContext, output: AudioNode): (() => void) => {
  const stopRain = connectNoiseChain(context, output, {
    highPassHz: 320,
    lowPassHz: 6400,
    gain: 0.26,
  });

  const timeoutIds = new Set<number>();

  const spawnThunder = () => {
    const now = context.currentTime;

    const osc = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(30 + Math.random() * 26, now);
    filter.type = 'lowpass';
    filter.frequency.value = 220;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 3.4);

    const cleanupId = globalThis.setTimeout(() => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      timeoutIds.delete(cleanupId);
    }, 3600);
    timeoutIds.add(cleanupId);
  };

  const scheduleThunder = () => {
    const delay = 5200 + Math.random() * 9800;
    const scheduleId = globalThis.setTimeout(() => {
      timeoutIds.delete(scheduleId);
      spawnThunder();
      scheduleThunder();
    }, delay);
    timeoutIds.add(scheduleId);
  };

  scheduleThunder();

  return () => {
    stopRain();
    timeoutIds.forEach((id) => globalThis.clearTimeout(id));
    timeoutIds.clear();
  };
};

const createOcean = (context: AudioContext, output: AudioNode): (() => void) => {
  const source = createNoiseSource(context);
  const highPass = context.createBiquadFilter();
  const lowPass = context.createBiquadFilter();
  const gainNode = context.createGain();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();

  highPass.type = 'highpass';
  lowPass.type = 'lowpass';
  highPass.frequency.value = 120;
  lowPass.frequency.value = 1400;

  gainNode.gain.value = 0.2;
  lfo.type = 'sine';
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.12;

  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(gainNode);
  gainNode.connect(output);

  lfo.connect(lfoGain);
  lfoGain.connect(gainNode.gain);

  source.start();
  lfo.start();

  return () => {
    source.stop();
    lfo.stop();
    source.disconnect();
    highPass.disconnect();
    lowPass.disconnect();
    gainNode.disconnect();
    lfo.disconnect();
    lfoGain.disconnect();
  };
};

const createWind = (context: AudioContext, output: AudioNode): (() => void) => {
  const source = createNoiseSource(context);
  const highPass = context.createBiquadFilter();
  const lowPass = context.createBiquadFilter();
  const bandPass = context.createBiquadFilter();
  const gainNode = context.createGain();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();

  highPass.type = 'highpass';
  lowPass.type = 'lowpass';
  bandPass.type = 'bandpass';

  highPass.frequency.value = 180;
  lowPass.frequency.value = 2400;
  bandPass.frequency.value = 700;
  bandPass.Q.value = 0.8;
  gainNode.gain.value = 0.24;

  lfo.type = 'sine';
  lfo.frequency.value = 0.11;
  lfoGain.gain.value = 180;

  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(bandPass);
  bandPass.connect(gainNode);
  gainNode.connect(output);

  lfo.connect(lfoGain);
  lfoGain.connect(bandPass.frequency);

  source.start();
  lfo.start();

  return () => {
    source.stop();
    lfo.stop();
    source.disconnect();
    highPass.disconnect();
    lowPass.disconnect();
    bandPass.disconnect();
    gainNode.disconnect();
    lfo.disconnect();
    lfoGain.disconnect();
  };
};

export const AMBIENT_SOUND_PRESETS: readonly AmbientSoundPreset[] = [
  'off',
  'rain',
  'thunderstorm',
  'ocean',
  'wind',
] as const;

export const createAmbientSoundGraph = (
  context: AudioContext,
  output: AudioNode,
  preset: AmbientSoundPreset
): (() => void) => {
  switch (preset) {
    case 'rain':
      return createRain(context, output);
    case 'thunderstorm':
      return createThunderstorm(context, output);
    case 'ocean':
      return createOcean(context, output);
    case 'wind':
      return createWind(context, output);
    default:
      return () => undefined;
  }
};
