import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Mesmo motor STT que o Hermes usa (ver /root/.hermes/config.yaml: stt.local.model)
// — faster-whisper (CTranslate2), bem mais leve em RAM que onnxruntime/transformers.js.
// Roda como subprocesso Python curto por requisição: carrega, transcreve, sai.
// Sem processo residente = sem memória presa entre gravações num host apertado.
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base';
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const SCRIPT_PATH = path.join(__dirname, '../scripts/transcribe.py');

function runTranscribeScript(audioPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT_PATH, audioPath, WHISPER_MODEL]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim().slice(-500) || `transcribe.py saiu com código ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as { text?: string; error?: string };
        if (parsed.error) reject(new Error(parsed.error));
        else resolve(parsed.text || '');
      } catch {
        reject(new Error(`Saída inesperada do transcribe.py: ${stdout.slice(-500)}`));
      }
    });
  });
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
  const inputPath = path.join(tmpDir, `stt-in-${id}.${ext}`);

  await fs.writeFile(inputPath, audioBuffer);
  try {
    const text = await runTranscribeScript(inputPath);
    return text.trim();
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
}
