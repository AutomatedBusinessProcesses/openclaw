---
name: transcribe
description: Transcribe attached or referenced audio and voice notes with local-only speech-to-text. Use for /transcribe, raw voice-note transcripts, and any audio transcription request where audio must not be uploaded to an API provider.
metadata: { "openclaw": { "requires": { "config": ["tools.media.audio.localOnly"] } } }
---

# Transcribe

Return the transcript. Do not summarize unless the user explicitly asks for a
summary after the transcript.

Privacy rules

- Treat `tools.media.audio.localOnly: true` as a hard boundary.
- Never use OpenAI Whisper API, Deepgram, Mistral, Gemini, Realtime, or any
  provider/network STT path for uploaded audio.
- Approved local engines: `whisper-cli`, `whisper`, `sherpa-onnx-offline`, and
  `parakeet-mlx`.
- If OpenClaw already supplied `Transcript` or an `[Audio] ... Transcript`
  block, use that text. Do not re-transcribe.
- If only a local audio file path is supplied, use an approved local CLI only.
- If no transcript or approved local engine is available, say transcription is
  blocked until local STT is installed/configured. Do not suggest uploading the
  audio.

Output

- Start with `Transcript`.
- Preserve timestamps, speaker labels, and uncertain words when present.
- Lightly clean obvious CLI noise, but do not polish away content.
- If the user also asks for notes or action items, put them after the transcript
  under a separate heading.
