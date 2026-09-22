'use client';

import {useEffect,useEffectEvent,useState} from 'react';
import type {HealthEntryView} from '@/components/health/HealthTimelineScreen';

export type CalendarObservationSource={
  petKey:string;guest:boolean;entries:HealthEntryView[];
  read:(from:string,to:string,before:string|null,signal:AbortSignal)=>Promise<{entries:HealthEntryView[];nextCursor:string|null}>;
  onOpen:(entry:HealthEntryView)=>void;
};

// Match the six Monday-first weeks displayed by the existing calendar.
export function calendarWindow(month:Date){
  const start=new Date(month.getFullYear(),month.getMonth(),1);
  start.setDate(start.getDate()-(start.getDay()+6)%7);
  const end=new Date(start);end.setDate(end.getDate()+42);
  return {from:start.toISOString(),to:end.toISOString()};
}

export function useCalendarObservations(source:CalendarObservationSource|undefined,month:Date,enabled:boolean){
  const {from,to}=calendarWindow(month);
  const key=`${source?.petKey}:${from}:${to}`;
  const [result,setResult]=useState<{key:string;entries:HealthEntryView[];error:boolean}|null>(null);
  const [revision,setRevision]=useState(0);
  const read=useEffectEvent((cursor:string|null,signal:AbortSignal)=>source!.read(from,to,cursor,signal));
  const guest=source?.guest,petKey=source?.petKey;
  useEffect(()=>{
    if(!enabled||guest||!petKey)return;
    const controller=new AbortController();
    void (async()=>{
      const entries=new Map<string,HealthEntryView>(),cursors=new Set<string>();
      try{
        let cursor:string|null=null;
        do{
          const page=await read(cursor,controller.signal);
          if(controller.signal.aborted)return;
          page.entries.forEach(entry=>entries.set(entry.id,entry));
          cursor=page.nextCursor;
          if(cursor){if(cursors.has(cursor))throw new Error('REPEATED_CURSOR');cursors.add(cursor);}
        }while(cursor);
        setResult({key,entries:[...entries.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),error:false});
      }catch{if(!controller.signal.aborted)setResult({key,entries:[],error:true});}
    })();
    return()=>controller.abort();
  },[enabled,guest,petKey,from,to,key,revision]);
  return {
    entries:guest?(source?.entries||[]).filter(e=>Date.parse(e.createdAt)>=Date.parse(from)&&Date.parse(e.createdAt)<Date.parse(to)):result?.key===key?result.entries:[],
    loading:Boolean(source&&!guest&&enabled&&result?.key!==key),
    error:Boolean(!guest&&result?.key===key&&result.error),
    retry:()=>{setResult(null);setRevision(v=>v+1);},
  };
}
