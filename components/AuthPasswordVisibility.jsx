"use client";

import {useEffect} from "react";

// O Neon Auth UI (Better Auth UI) usa PasswordInput sem enableToggle
// nos formulários de login e recuperação. Adicionamos apenas o botão de
// apresentação, sem ler, armazenar ou enviar o valor da senha.
const SHOW_ICON='<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const HIDE_ICON='<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 18 18"/><path d="M10.6 5.1A11.3 11.3 0 0 1 12 5c6.4 0 10 7 10 7a13 13 0 0 1-3.3 4.1M6.3 6.3C3.6 8.3 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.7-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

export default function AuthPasswordVisibility(){
 useEffect(()=>{
  const root=document.getElementById("26fit-auth-fields");
  if(!root)return;

  const setup=()=>{
   const inputs=root.querySelectorAll('input[type="password"],input[data-fit-password-eye="true"]');
   for(const input of inputs){
    if(!(input instanceof HTMLInputElement))continue;

    // Campos como cadastro já possuem botão nativo do Neon Auth UI.
    const parent=input.parentElement;
    if(!parent)continue;
    if(input.dataset.fitPasswordEye!=="true"){
     const existing=parent.querySelector("button");
     if(existing)continue;
     input.dataset.fitPasswordEye="true";
     parent.classList.add("auth-password-eye-wrap");
     const button=document.createElement("button");
     button.type="button";
     button.className="auth-password-eye-control";
     button.setAttribute("aria-label","Mostrar senha");
     button.setAttribute("title","Mostrar senha");
     button.setAttribute("aria-pressed","false");
     button.innerHTML=SHOW_ICON;
     button.addEventListener("click",()=>{
      const visible=button.getAttribute("aria-pressed")!=="true";
      button.setAttribute("aria-pressed",String(visible));
      button.setAttribute("aria-label",visible?"Ocultar senha":"Mostrar senha");
      button.setAttribute("title",visible?"Ocultar senha":"Mostrar senha");
      button.innerHTML=visible?HIDE_ICON:SHOW_ICON;
      input.type=visible?"text":"password";
      input.focus({preventScroll:true});
     });
     parent.appendChild(button);
    }
    // Se React atualizar o input (por exemplo, ao digitar), mantém o
    // estado de visibilidade do controle sem modificar o valor informado.
    const control=parent.querySelector(".auth-password-eye-control");
    if(control){
     const expected=control.getAttribute("aria-pressed")==="true"?"text":"password";
     if(input.type!==expected)input.type=expected;
    }
   }
  };

  setup();
  const observer=new MutationObserver(setup);
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:["type"]});
  return ()=>observer.disconnect();
 },[]);
 return null;
}
