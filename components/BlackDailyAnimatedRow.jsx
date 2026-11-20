"use client";
import {useEffect,useRef,useState} from "react";

const asInt=value=>Math.max(0,Math.round(Number(value)||0));
const format=value=>asInt(value).toLocaleString("pt-BR");

// A animação é controlada por requestAnimationFrame: a primeira barra sempre
// começa em zero e cresce somente depois de entrar na área visível da tela.
// Se um novo dia superar os anteriores, todos se ajustam à nova escala.
export default function BlackDailyAnimatedRow({day,amount,maxAmount,index=0}){
 const rootRef=useRef(null);
 const progressRef=useRef({count:0,percent:0});
 const [visible,setVisible]=useState(false);
 const [progress,setProgress]=useState({count:0,percent:0});
 const value=asInt(amount);
 const scale=Math.max(1,asInt(maxAmount));
 const targetPercent=Math.max(0,Math.min(100,(100*value)/scale));
 const label=day.slice(8,10)+"/"+day.slice(5,7)+"/"+day.slice(0,4);
 const delay=Math.min(index,13)*180;

 useEffect(()=>{
  const element=rootRef.current;
  if(!element)return;
  if(typeof IntersectionObserver!=="function"){
   setVisible(true);
   return;
  }
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){
    setVisible(true);
    observer.disconnect();
   }
  },{threshold:0.08});
  observer.observe(element);
  return ()=>observer.disconnect();
 },[]);

 useEffect(()=>{
  if(!visible)return;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if(reduced){
   const final={count:value,percent:targetPercent};
   progressRef.current=final;
   setProgress(final);
   return;
  }
  const initial=progressRef.current;
  const totalChange=Math.abs(value-initial.count)+Math.abs(targetPercent-initial.percent);
  if(totalChange<0.0001)return;

  const duration=1350;
  // O escalonamento só acontece na primeira apresentação, nunca no polling.
  const initialDelay=initial.count===0&&initial.percent===0?delay:0;
  let start=null;
  let frame=0;
  let active=true;
  const draw=timestamp=>{
   if(!active)return;
   if(start===null)start=timestamp;
   const t=Math.min(1,Math.max(0,(timestamp-start-initialDelay)/duration));
   const easing=1-Math.pow(1-t,3);
   const next={
    count:Math.round(initial.count+(value-initial.count)*easing),
    percent:initial.percent+(targetPercent-initial.percent)*easing
   };
   progressRef.current=next;
   setProgress(next);
   if(t<1)frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);
  return ()=>{active=false;cancelAnimationFrame(frame);};
 },[visible,value,targetPercent,delay]);

 return <div className="cc-black-daily-row" ref={rootRef} role="group"
  aria-label={label+": "+format(value)+" "+(value===1?"lead":"leads")}>
  <div className="cc-black-daily-labels">
   <span className="cc-black-daily-date">{label}</span>
   <strong className="cc-black-daily-total" aria-hidden="true">
    {format(progress.count)} <span>{value===1?"lead":"leads"}</span>
   </strong>
  </div>
  <div className="cc-black-daily-track" aria-hidden="true">
   <span className="cc-black-daily-fill" style={{width:progress.percent+"%"}}/>
  </div>
 </div>;
}
