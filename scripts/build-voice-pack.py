"""Cut the retained HeyGen master at phrase gaps, without another synthesis call."""
import json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
meta = json.loads((ROOT / 'scripts/voice-source.json').read_text(encoding='utf-8'))
words = json.loads((ROOT / '.test-output/voice/timestamps.json').read_text(encoding='utf-8'))
gaps = [(w['start'], w['end']) for w in words if w['word'].startswith('<break')]
# The provider response truncates timestamps in the middle. These nine phrase
# gaps are measured from the original waveform, not evenly estimated words.
gaps += [(74.372132,76.569365),(78.743651,81.092290),(83.311224,85.215760),
         (87.474467,89.061224),(91.726689,92.914807),(97.015488,99.317302),
         (102.000907,102.891111),(106.138118,107.658458),(110.933810,113.242721)]
gaps.sort()
assert len(gaps) == len(meta['lines']) - 1 == 34
cuts = [0] + [(a+b)/2 for a,b in gaps] + [meta['sourceDuration']]
out = ROOT / 'public/voice/th'
out.mkdir(parents=True, exist_ok=True)
manifest = {}
for i, (key,text) in enumerate(meta['lines']):
    start,end = cuts[i], cuts[i+1]
    target = out / (key + '.mp3')
    subprocess.run(['ffmpeg','-y','-v','error','-ss',str(start),'-i',str(ROOT / '.test-output/voice/original.wav'),
                    '-t',str(end-start),'-af','silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB:start_silence=0.12',
                    '-ac','1','-codec:a','libmp3lame','-b:a','96k',str(target)],check=True)
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(target)]))
    manifest[key]={'text':text,'file':'/voice/th/'+key+'.mp3','duration':duration,'sourceStart':start,'sourceEnd':end}
(ROOT/'public/voice/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built',len(manifest),'clips; total bytes:',sum(p.stat().st_size for p in out.glob('*.mp3')))
