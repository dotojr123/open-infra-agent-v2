#!/usr/bin/env python3
"""Transcreve um arquivo de áudio com faster-whisper (mesmo motor STT do Hermes).

Uso: python3 transcribe.py <caminho_do_audio> [modelo]

Roda como subprocesso curto por requisição: carrega o modelo, transcreve e
sai — não fica residente ocupando RAM entre uma gravação e outra, ao
contrário do runtime onnxruntime/transformers.js usado antes.
"""
import sys
import json

from faster_whisper import WhisperModel


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "uso: transcribe.py <audio> [modelo]"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"

    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, _ = model.transcribe(audio_path, language="pt", task="transcribe")
        text = "".join(segment.text for segment in segments).strip()
        print(json.dumps({"text": text}))
    except Exception as exc:  # noqa: BLE001 — repassa qualquer erro pro Node como JSON
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
