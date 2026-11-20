"use client";
import {useEffect,useRef,useState} from "react";

const asInt=value=>Math.max(0,Number(value)||0);
const format=value=>asInt(value).toLocaleString("pt-BR");

// Cada dia anima independentemente. Quando a maior captação muda, as larguras
// anteriores se ajustam à nova escala sem recarregar ou piscar a página.
export default function BlackDailyAnimatedRow({day,amount,maxAmount,index=0}){
 const rootRef=useRef(null);
 const displayedRef=useRef(0);
 const [visible,setVisible]=useState(false);
 const [displayed,setDisplayed]=useState(0);
 const value=asInt(amount);
 const scale=Math.max(1,asInt(maxAmount));
 const width=Math.min(100,100*value/scale);
 const label=day.slice(8,10)+"/"+day.slice(5,7)+"/"+day.slice(0,4);
 const stagger=Math.min(index,13)*140;

 useEffect(()=>{
  const element=rootRef.current;
  if(!element)return;
  if(typeof IntersectionObserver==="undefined"){
   setVisible(true);
   return;
  }
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){
    setVisible(true);
    observer.disconnect();
   }
  },{threshold:0.12});
  observer.observe(element);
  return ()=>observer.disconnect();
 },[]);

 useEffect(()=>{
  if(!visible)return;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if(reduced){
   displayedRef.current=value;
   setDisplayed(value);
   return;
  }
  let frame=0;
  const from=displayedRef.current;
  const delta=value-from;
  if(delta===0)return;
  const duration=1050;
  const delay=displayedRef.current===0?stagger:0;
  let started=null;
  const step=now=>{
   if(started===null)started=now;
   const progress=Math.min(1,Math.max(0,(now-started-delay)/duration));
   const eased=1-Math.pow(1-progress,3);
   const current=Math.round(from+delta*eased);
   if(current!==displayedRef.current){
    displayedRef.current=current;
    setDisplayed(current);
   }
   if(progress<1)frame=requestAnimationFrame(step);
  };
  frame=requestAnimationFrame(step);
  return ()=>cancelAnimationFrame(frame);
 },[value,visible,stagger]);

 return <div className="cc-black-daily-row" ref={rootRef} role="group" aria-label={label+": "+format(value)+" "+(value===1?"lead":"leads")}>
  <div className="cc-black-daily-labels">
   <span className="cc-black-daily-date">{label}</span>
   <strong className="cc-black-daily-total" aria-hidden="true">{format(displayed)} <span>{value===1?"lead":"leads"}</span></strong>
  </div>
  <div className="cc-black-daily-track" aria-hidden="true">
   <span className="cc-black-daily-fill" style={{
    width:visible?width+"%":"0%",
    transitionDelay:stagger+"ms"
   }}/>
  </div>
 </div>;
}
