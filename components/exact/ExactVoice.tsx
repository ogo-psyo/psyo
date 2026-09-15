'use client';
import { useEffect, useRef, useState } from 'react';
import { ExactIcon, ExactPage } from './ExactShell';

type Props = { active:boolean; draft:string; onDraft:(text:string)=>void; onClose:()=>void; onUse:(text:string)=>void; onTranscribe:(audio:Blob)=>Promise<{transcript:string}> };
export function ExactVoice(props:Props) {
 const [phase,setPhase]=useState<'idle'|'requesting'|'recording'|'transcribing'>('idle');
 const [error,setError]=useState('');
 const [hasAudio,setHasAudio]=useState(false);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),audio=useRef<Blob|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),version=useRef(0);
 function release(){if(timer.current)clearTimeout(timer.current);stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;}
 function cancel(){version.current++;if(recorder.current?.state==='recording')recorder.current.stop();release();setPhase('idle');props.onClose();}
 useEffect(()=>()=>{version.current++;if(recorder.current?.state==='recording')recorder.current.stop();if(timer.current)clearTimeout(timer.current);stream.current?.getTracks().forEach(track=>track.stop());},[]);
 async function transcribe(blob:Blob,token:number){
  setPhase('transcribing');setError('');
  try{const result=await props.onTranscribe(blob);if(version.current!==token)return;if(!result.transcript?.trim())throw new Error('EMPTY');props.onDraft(result.transcript.trim());audio.current=null;setHasAudio(false);}
  catch{if(version.current===token)setError('Не удалось распознать запись. Можно повторить или написать текст.');}
  finally{if(version.current===token)setPhase('idle');}
 }
 async function start(){
  if(phase!=='idle')return;const token=++version.current;setError('');setPhase('requesting');
  try{
   if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined')throw new Error('UNSUPPORTED');
   const acquired=await navigator.mediaDevices.getUserMedia({audio:true});if(version.current!==token){acquired.getTracks().forEach(track=>track.stop());return;}
   stream.current=acquired;const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
   const current=new MediaRecorder(acquired,mime?{mimeType:mime}:undefined),chunks:Blob[]=[];recorder.current=current;
   current.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
   current.onstop=()=>{release();if(version.current!==token)return;const blob=new Blob(chunks,{type:current.mimeType});audio.current=blob;setHasAudio(Boolean(blob.size));if(!blob.size){setError('Запись получилась пустой. Попробуй ещё раз.');setPhase('idle');return;}void transcribe(blob,token);};
   current.onerror=()=>{if(version.current!==token)return;version.current++;release();setPhase('idle');setError('Запись прервалась. Попробуй ещё раз.');};
   current.start();setPhase('recording');timer.current=setTimeout(()=>{if(current.state==='recording')current.stop();},60000);
  }catch{if(version.current===token){release();setPhase('idle');setError('Микрофон недоступен. Проверь разрешение браузера или напиши текст.');}}
 }
 if(!props.active)return null;
 return <ExactPage viewKey="voice" onBack={cancel}>
  <h1>Скажи голосом</h1><p className="lead">Сначала проверишь текст. Сообщение само не отправится.</p>
  <div className="soft"><p role="status">{phase==='recording'?'Слушаю… До одной минуты.':phase==='transcribing'?'Распознаю запись…':phase==='requesting'?'Жду разрешение на микрофон…':'Можно начать с любой мысли.'}</p>
   {phase==='recording'?<button type="button" className="primary full" onClick={()=>recorder.current?.stop()}>Закончить запись</button>:<button type="button" className="primary full" disabled={phase!=='idle'} onClick={()=>void start()}><ExactIcon name="mic"/>Записать голосом</button>}
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  {error&&hasAudio&&<button type="button" className="text-button" disabled={phase!=='idle'} onClick={()=>{if(audio.current)void transcribe(audio.current,++version.current);}}>Повторить распознавание</button>}
  <div className="field"><label htmlFor="exact-voice-text">Текст сообщения</label><textarea id="exact-voice-text" value={props.draft} onChange={event=>props.onDraft(event.target.value)} disabled={phase==='transcribing'} /></div>
  <button type="button" className="primary full" disabled={phase!=='idle'||!props.draft.trim()} onClick={()=>{props.onUse(props.draft.trim());cancel();}}>К сообщению</button>
  <p className="hint section-gap">После завершения записи аудио отправится на распознавание. В Псё оно не сохраняется.</p>
 </ExactPage>;
}
