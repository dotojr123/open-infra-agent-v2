import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Mesmo limite de entrada documentado pro Edge TTS (evita erro no meio da síntese)
const MAX_TTS_CHARS = 5000;

export function getDefaultTtsConfig() {
  return {
    provider: (process.env.TTS_PROVIDER || 'edge').toLowerCase(),
    voice: process.env.TTS_VOICE || 'pt-BR-AntonioNeural',
    // "+20%" ≈ 1.2x — a voz padrão do Edge TTS soa devagar demais pro cockpit
    rate: process.env.TTS_RATE || '+20%',
  };
}

function escapeSsml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function synthesizeSpeech(text: string, voiceOverride?: string, rateOverride?: string): Promise<Buffer> {
  const { provider, voice: defaultVoice, rate: defaultRate } = getDefaultTtsConfig();

  if (provider !== 'edge') {
    throw new Error(`Provider de TTS "${provider}" não suportado (só "edge" por enquanto)`);
  }

  const voice = voiceOverride || defaultVoice;
  const rate = rateOverride || defaultRate;
  const truncated = text.length > MAX_TTS_CHARS ? text.slice(0, MAX_TTS_CHARS) : text;
  const safeText = escapeSsml(truncated);

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(safeText, { rate });

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    audioStream.on('close', () => resolve());
    audioStream.on('error', (err: Error) => reject(err));
  });

  return Buffer.concat(chunks);
}
