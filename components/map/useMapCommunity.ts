'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {WalkSignal} from '@/lib/socialCore';
export type Hazard={id:string;title:string;point:{lat:number;lng:number};radius:number;expiresAt:string;isMine:boolean};
export function useMapCommunity({active,guest,petId,center,authHeaders}:{active:boolean;guest:boolean;petId:string;center:{lat:number;lng:number};authHeaders:()=>Record<string,string>}){
 const [signals,setSignals]=useState<WalkSignal[]>([]),[hazards,setHazards]=useState<Hazard[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const latest=useRef({center,authHeaders});latest.current={center,authHeaders};
 const epoch=useRef(0),revision=useRef(0),controller=useRef<AbortController|null>(null);
 const cell=`${center.lat.toFixed(2)}:${center.lng.toFixed(2)}`;
 const reload=useCallback(async()=>{
  if(!active||guest)return;
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const token=epoch.current;const request=++revision.current;
  try{const point=latest.current.center;const params=new URLSearchParams({petId,lat:String(point.lat),lng:String(point.lng)});const r=await fetch(`/api/map/live?${params}`,{headers:latest.current.authHeaders(),signal:abort.signal,cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();if(token!==epoch.current||request!==revision.current)return;setSignals(data.signals);setHazards(data.hazards);setError('');}
  catch{if(!abort.signal.aborted&&token===epoch.current)setError('Не удалось обновить отметки.');}
 },[active,guest,petId]);
 useEffect(()=>{epoch.current++;setSignals([]);setHazards([]);setError('');return()=>{epoch.current++;controller.current?.abort();};},[petId,guest]);
 useEffect(()=>{
  if(!active||guest)return;const tick=()=>{const now=Date.now();setSignals(v=>v.filter(s=>Date.parse(s.expiresAt)>now));setHazards(v=>v.filter(h=>Date.parse(h.expiresAt)>now));if(!document.hidden)void reload();};
  const delay=setTimeout(tick,350),timer=setInterval(tick,15000);document.addEventListener('visibilitychange',tick);
  return()=>{clearTimeout(delay);clearInterval(timer);controller.current?.abort();document.removeEventListener('visibilitychange',tick);};
 },[active,guest,cell,reload]);
 async function mutate(method:'PUT'|'DELETE',body:Record<string,unknown>,key?:string){
  if(busy||guest)return false;setBusy(true);setError('');const token=epoch.current;
  try{const r=await fetch('/api/map/live',{method,headers:{...latest.current.authHeaders(),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify({...body,petId})});if(!r.ok)throw Error();if(token!==epoch.current)return false;await reload();return true;}
  catch{if(token===epoch.current)setError('Не удалось сохранить. Повтори — введённое осталось.');return false;}finally{setBusy(false);}
 }
 return {signals,hazards,error,busy,reload,mutate,petId};
}
