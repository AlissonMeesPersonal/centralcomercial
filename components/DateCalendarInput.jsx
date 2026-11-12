"use client";

import {useRef} from "react";
import {CalendarDays} from "lucide-react";

/**
 * Abertura do seletor nativo em qualquer ponto do campo, não apenas no
 * pequeno indicador do navegador. Preserva o valor ISO (data/hora) para
 * os formulários e utiliza o formato de exibição local do dispositivo.
 */
export default function DateCalendarInput({
 type="date",value="",onChange,disabled=false,required=false,
 min,max,id,name,ariaLabel,className="",step
}){
 const fieldRef=useRef(null);
 const openPicker=()=>{
  const field=fieldRef.current;
  if(!field||field.disabled)return;
  try{
   if(typeof field.showPicker==="function"){field.showPicker();return;}
  }catch{
   // Em navegadores sem showPicker (ou com restrição de contexto),
   // o campo permanece editável e recebe o foco normalmente.
  }
  field.focus();
 };
 return <span className={"cc-date-calendar-input "+className}>
  <input
   ref={fieldRef}
   type={type}
   value={value}
   onChange={onChange}
   disabled={disabled}
   required={required}
   min={min}
   max={max}
   id={id}
   name={name}
   step={step}
   aria-label={ariaLabel}
   onClick={openPicker}
   onKeyDown={event=>{
    if((event.key==="ArrowDown"&&event.altKey)||event.key==="F4"){
     event.preventDefault();
     openPicker();
    }
   }}
  />
  <button
   type="button"
   className="cc-date-calendar-trigger"
   title="Abrir calendário"
   aria-label={"Abrir calendário"+(ariaLabel?" de "+ariaLabel.toLowerCase():"")}
   disabled={disabled}
   onClick={openPicker}
  >
   <CalendarDays size={17}/>
  </button>
 </span>;
}
