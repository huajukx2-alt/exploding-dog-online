# Thai game announcer

35 prerecorded MP3 cues, hosted with the game. Both UI languages use this Thai
voice pack; player names, card names and turn counts remain in the visual captions.
There is no browser speech synthesis or per-play synthesis request.

Voice: HeyGen Nut - Punchy & Dynamic, ID a1c6bc99aba042abbac5c48d80f07807.
Requested engine: heygen_voice; returned engine: orca (provider compatibility name).
One synthesis request, a06da76ba43246d88895360afb192f98, at natural speed 1.0.
Original duration: 159.137959 seconds, including separation pauses.

Exact submitted SSML and provenance are in scripts/voice-source.json.
manifest.json records each phrase, measured MP3 duration, and source cut bounds.
The original WAV and partial provider timestamps are retained locally under
.test-output/voice. scripts/build-voice-pack.py rebuilds the clips from those
local files without generating again. Nine missing phrase boundaries were
recovered from waveform silence; remaining boundaries use provider break timing.
Clips retain the original pitch and speed, with leading silence shortened.

Validation: FFmpeg decoding and automated queue/event/mute/error tests.
Listening review was unavailable during authoring: Thai pronunciation, delivery,
and the nine waveform-derived joins still require human listening.
