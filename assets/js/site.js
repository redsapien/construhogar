(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const dialog=$('#agenda'),form=$('#agenda-form'),panels=$$('.form-step');
  const service=$('#service'),name=$('#name'),date=$('#visit-date'),time=$('#visit-time'),consent=$('#contact-consent');
  const next=$('#next-button'),back=$('#back-button'),send=$('#send-button'),summary=$('#agenda-summary');
  const state={step:1,focus:null,month:new Date(),pickedDate:'',pickedTime:'',angle:.55,tilt:.28,zoom:1,drag:null,raf:0};
  const waPhone='573163813056', labels=['Nombre','Requerimiento','Fecha y hora'];
  const today=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`};
  const bogotaNow=()=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
  
  // A small inline canvas renderer: no ES modules, CDN, WebGL or server needed.
  const canvas=$('#house-canvas');let ctx=null;try{ctx=canvas?.getContext('2d')||null}catch(_){};
  const boxList=[];
  function addBox(x,y,z,w,h,d,color,edge='#6dbdff'){boxList.push({x,y,z,w,h,d,color,edge})}
  function buildHouse(){
    addBox(0,-.13,0,13,.18,9,'#183759','#478dcb');
    addBox(0,.02,0,8,.14,5.6,'#5d7895','#8acbff');
    addBox(.25,2.85,0,7.1,.14,5.2,'#5d7895','#8acbff');
    // Exterior corner posts and beams, deliberately conceptual, not engineering specifications.
    for(const x of [-3.8,3.8])for(const z of [-2.55,2.55])addBox(x,2.72,z,.14,5.1,.14,'#38aaff','#a9ddff');
    for(const y of [1.3,3.65,5.4])for(const z of [-2.55,2.55])addBox(0,y,z,7.7,.13,.13,'#3998e4','#b5e4ff');
    for(const y of [1.3,3.65,5.4])for(const x of [-3.8,3.8])addBox(x,y,0,.13,.13,5.1,'#327fca','#9fd8ff');
    // Wall panels behind the open facade and inner partition hints.
    addBox(0,1.5,-2.72,7.65,2.45,.12,'#233b56','#5785ae');
    addBox(0,4.45,-2.55,6.9,2.1,.12,'#284562','#70a3d0');
    addBox(-1.5,1.35,.4,2.2,2.4,.1,'#32587d','#6ba8dd');
    addBox(1.65,1.35,-.5,2.1,2.4,.1,'#233f5d','#6ba8dd');
    addBox(.2,4.35,-.4,.12,1.9,3.8,'#4685bb','#9cd7ff');
    // Blue steel roofline and floor slab, shown as architectural massing.
    addBox(0,5.55,0,7.55,.22,5.55,'#142a43','#6cbcff');
    addBox(0,.16,0,8,.12,5.7,'#6685a1','#b0d8f8');
    // Stair-like graphic element; illustrative only.
    for(let i=0;i<7;i++)addBox(-2.5+i*.22,.28+i*.21,.9+i*.27,.75,.1,.34,'#1587ed','#8bd0ff');
    addBox(-4.9,.03,2.9,1.2,.07,2.2,'#253e59','#4581b7');
  }
  buildHouse();
  const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
  function fitCanvas(){if(!canvas||!ctx)return;const r=canvas.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,1.6);if(!r.width||!r.height)return;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);drawHouse()}
  function shadeColor(hex,factor){const n=parseInt(hex.slice(1),16),r=Math.min(255,Math.max(0,Math.round((n>>16)*factor))),g=Math.min(255,Math.max(0,Math.round(((n>>8)&255)*factor))),b=Math.min(255,Math.max(0,Math.round((n&255)*factor)));return `rgb(${r},${g},${b})`}
  function drawHouse(){if(!ctx||!canvas)return;const r=canvas.getBoundingClientRect(),W=r.width,H=r.height;if(!W||!H)return;ctx.clearRect(0,0,W,H);
    const glow=ctx.createRadialGradient(W*.5,H*.52,10,W*.5,H*.52,Math.max(W,H)*.7);glow.addColorStop(0,'#102c4d');glow.addColorStop(1,'#061222');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(48,137,219,.12)';ctx.lineWidth=1;for(let x=0;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    const ca=Math.cos(state.angle),sa=Math.sin(state.angle),ct=Math.cos(state.tilt),st=Math.sin(state.tilt),scale=Math.min(W/21,H/15)*state.zoom,ox=W*.50,oy=H*.68;
    const project=(x,y,z)=>{const rx=x*ca-z*sa,rz=x*sa+z*ca,ry=y*ct-rz*st,depth=y*st+rz*ct;const perspective=15/(15+depth);return [ox+rx*scale*perspective,oy-ry*scale*perspective,depth]};
    const polys=[];for(const b of boxList){const pts=[[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],[b.x+b.w/2,b.y-b.h/2,b.z-b.d/2],[b.x-b.w/2,b.y+b.h/2,b.z-b.d/2],[b.x+b.w/2,b.y+b.h/2,b.z-b.d/2],[b.x-b.w/2,b.y-b.h/2,b.z+b.d/2],[b.x+b.w/2,b.y-b.h/2,b.z+b.d/2],[b.x-b.w/2,b.y+b.h/2,b.z+b.d/2],[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2]].map(v=>project(...v));for(const f of faces){const facePts=f.map(i=>pts[i]);const area=facePts.reduce((v,p,i)=>v+p[0]*facePts[(i+1)%4][1]-facePts[(i+1)%4][0]*p[1],0)/2;if(area<0){const avg=f.reduce((a,i)=>a+pts[i][2],0)/4;polys.push({pts:facePts,avg,color:b.color,edge:b.edge,shade:[.60,1.18,.74,1.02,.68,.86][faces.indexOf(f)]||.8})}}}
    polys.sort((a,b)=>b.avg-a.avg);for(const p of polys){ctx.beginPath();p.pts.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.fillStyle=shadeColor(p.color,p.shade);ctx.fill();ctx.strokeStyle=p.edge;ctx.lineWidth=.75;ctx.stroke()}
    // Viewfinder marks and caption.
    ctx.strokeStyle='rgba(96,184,255,.44)';ctx.lineWidth=1;const c=18;[[12,12,1,1],[W-12,12,-1,1],[12,H-12,1,-1],[W-12,H-12,-1,-1]].forEach(([x,y,dx,dy])=>{ctx.beginPath();ctx.moveTo(x+dx*c,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*c);ctx.stroke()});
  }
  if(canvas&&ctx){try{if('ResizeObserver'in window)new ResizeObserver(fitCanvas).observe(canvas);window.addEventListener('resize',fitCanvas,{passive:true});fitCanvas()}catch(err){console.warn('No se pudo mostrar la maqueta:',err);$('#home-viewer')?.classList.add('is-fallback')}}else{$('#home-viewer')?.classList.add('is-fallback')}
  $$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{const v=btn.dataset.view;state.angle=v==='front'?0:v==='side'?1.4:v==='top'?0:.55;state.tilt=v==='top'?1.25:.28;state.zoom=v==='reset'?1:.92;$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));drawHouse()}));
  if(canvas){const pointers=new Map();let lastDistance=0;
    const distance=()=>{const pts=[...pointers.values()];return pts.length>1?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0};
    canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastDistance=distance();try{canvas.setPointerCapture(e.pointerId)}catch(_){}});
    canvas.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2){const d=distance();if(lastDistance>0&&d>0)state.zoom=Math.max(.62,Math.min(1.7,state.zoom*d/lastDistance));lastDistance=d}else{state.angle+=(e.clientX-prev.x)*.008;state.tilt=Math.max(-.6,Math.min(1.25,state.tilt+(e.clientY-prev.y)*.004))}drawHouse()});
    for(const n of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(n,e=>{pointers.delete(e.pointerId);lastDistance=distance()});
    canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(.62,Math.min(1.7,state.zoom*(e.deltaY>0?.94:1.06)));drawHouse()},{passive:false});
  }

  const monthLabel=$('#calendar-month'),grid=$('#calendar-grid'),pickedDate=$('#visit-date'),pickedTime=$('#visit-time');
  const dateObject=iso=>{const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d,12)};
  const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function setMonth(d){state.month=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()}
  function renderCalendar(){if(!grid)return;const y=state.month.getFullYear(),m=state.month.getMonth();monthLabel.textContent=new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(state.month);grid.replaceChildren();const first=(new Date(y,m,1).getDay()+6)%7;for(let i=0;i<first;i++){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');grid.append(blank)}const days=new Date(y,m+1,0).getDate();for(let d=1;d<=days;d++){const dateObj=new Date(y,m,d,12),iso=isoDate(dateObj),btn=document.createElement('button');btn.type='button';btn.className='calendar-day';btn.textContent=d;btn.dataset.date=iso;btn.setAttribute('aria-label',new Intl.DateTimeFormat('es-CO',{dateStyle:'full'}).format(dateObj));btn.setAttribute('aria-pressed',String(iso===state.pickedDate));const past=iso<today();btn.disabled=past;if(iso===state.pickedDate){btn.classList.add('is-selected');btn.setAttribute('aria-pressed','true')}btn.addEventListener('click',()=>{state.pickedDate=iso;pickedDate.value=iso;state.pickedTime='';pickedTime.value='';$$('.calendar-day').forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-pressed','false')});btn.classList.add('is-selected');btn.setAttribute('aria-pressed','true');refreshTimes();renderSummary()});grid.append(btn)}$('#calendar-prev').disabled=y===Number(today().slice(0,4))&&m<=Number(today().slice(5,7))-1;}
  function refreshTimes(){const now=bogotaNow(),same=state.pickedDate===today();$$('.time-slot').forEach(b=>{const t=b.dataset.time;b.disabled=!state.pickedDate||(same&&t<=now);b.classList.toggle('is-selected',t===state.pickedTime);b.setAttribute('aria-pressed',String(t===state.pickedTime))})}
  $('#calendar-prev')?.addEventListener('click',()=>setMonth(new Date(state.month.getFullYear(),state.month.getMonth()-1,1)));
  $('#calendar-next')?.addEventListener('click',()=>setMonth(new Date(state.month.getFullYear(),state.month.getMonth()+1,1)));
  $$('.time-slot').forEach(b=>b.addEventListener('click',()=>{state.pickedTime=b.dataset.time;pickedTime.value=state.pickedTime;refreshTimes();renderSummary()}));
  renderCalendar();refreshTimes();
  $$('.need-card').forEach(b=>b.addEventListener('click',()=>{$$('.need-card').forEach(x=>{x.setAttribute('aria-pressed',String(x===b));x.classList.toggle('selected',x===b)});service.value=b.dataset.need;$('.step-error',panels[0]).textContent=''}));
  function renderSummary(){const rows=[['Nombre',name.value.trim()],['Requerimiento',service.value],['Fecha',state.pickedDate?new Intl.DateTimeFormat('es-CO',{dateStyle:'medium'}).format(dateObject(state.pickedDate)):'—'],['Hora',state.pickedTime||'—']];summary.replaceChildren(...rows.flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;return[dt,dd]}))}
  function stepError(i,msg){$('.step-error',panels[i]).textContent=msg}
  function validStep(){if(state.step===1){if(!name.value.trim()){stepError(0,'Escriba su nombre para continuar.');name.focus();return false}}if(state.step===2){if(!service.value){stepError(1,'Seleccione su requerimiento.');$('.need-card').focus();return false}}if(state.step===3){if(!state.pickedDate||state.pickedDate<today()){stepError(2,'Elija una fecha vigente del calendario.');return false}if(state.pickedDate===today()&&state.pickedTime&&state.pickedTime<=bogotaNow()){state.pickedTime='';time.value='';refreshTimes()}if(!state.pickedTime){stepError(2,'Elija la hora que prefiere proponer.');return false}}if(state.step===3&&!consent.checked){stepError(2,'Marque la autorización para enviar su solicitud.');consent.focus();return false}stepError(state.step-1,'');return true}
  function renderStep(){panels.forEach(p=>p.hidden=Number(p.dataset.step)!==state.step);$('#step-count').textContent=`Paso ${state.step} de 3`;$('#step-caption').textContent=labels[state.step-1];$('#progressbar').setAttribute('aria-valuenow',state.step);$('#progress-fill').style.width=`${state.step*100/3}%`;back.hidden=state.step===1;next.hidden=state.step===3;send.hidden=state.step!==3;$('#form-error').textContent='';if(state.step===3){setMonth(state.pickedDate?dateObject(state.pickedDate):dateObject(today()));refreshTimes();renderSummary()};dialog.scrollTop=0}
  function openModal(selected=''){nav?.classList.remove('is-open');menu?.setAttribute('aria-expanded','false');state.focus=document.activeElement;form.reset();state.pickedDate='';state.pickedTime='';service.value='';$$('.need-card').forEach(b=>{b.setAttribute('aria-pressed','false');b.classList.remove('selected')});const map={'Construcción':'Construcción nueva','Remodelación':'Remodelación','Servicios locativos':'Servicios locativos','Consulta de vivienda y lote':'Consulta de vivienda y lote'};if(map[selected]){service.value=map[selected];const b=$$('.need-card').find(card=>card.dataset.need===map[selected]);if(b){b.setAttribute('aria-pressed','true');b.classList.add('selected')}}state.step=1;state.month=dateObject(today());$('#calendar-prev').disabled=false;date.value='';time.value='';$('#agenda-summary').replaceChildren();$('#wa-fallback').hidden=true;$('#wa-fallback-link').removeAttribute('href');$$('.step-error').forEach(e=>e.textContent='');$('#form-error').textContent='';renderCalendar();refreshTimes();if(typeof dialog.showModal==='function'){dialog.showModal()}else{dialog.setAttribute('open','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true')}document.body.classList.add('locked');name.focus()}
  function closeModal(){if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');document.body.classList.remove('locked');state.focus?.focus()}
  $$('[data-open-agenda]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.service||'')));$('.close-agenda').addEventListener('click',closeModal);dialog.addEventListener('click',e=>{if(e.target===dialog)closeModal()});dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal()});
  next.addEventListener('click',()=>{if(!validStep())return;state.step++;renderStep()});back.addEventListener('click',()=>{state.step=Math.max(1,state.step-1);renderStep()});
  form.addEventListener('submit',e=>{e.preventDefault();if(!validStep())return;const text=['Hola Construhogar. Quiero solicitar una conversación sobre mi proyecto.','',`Nombre: ${name.value.trim()}`,`Requerimiento: ${service.value}`,`Fecha preferida: ${state.pickedDate}`,`Hora preferida: ${state.pickedTime}`,'','Entiendo que es una solicitud sujeta a confirmación de disponibilidad.'].join('\n');const url=`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;$('#wa-fallback-link').href=url;$('#wa-fallback').hidden=false;$('#form-error').textContent='Al continuar, se abrirá WhatsApp con su solicitud. La cita queda pendiente de confirmación.';const w=window.open(url,'_blank');if(w){try{w.opener=null}catch(_){}}});
  const menu=$('.mobile-menu'),nav=$('#nav-links');menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');nav.classList.toggle('is-open',open)});$$('#nav-links a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('is-open');menu?.setAttribute('aria-expanded','false')}));
  $$('.faq-item').forEach(item=>item.addEventListener('toggle',()=>{if(item.open)$$('.faq-item').forEach(other=>{if(other!==item)other.open=false})}));
  const preloader=$('#preloader');const reveal=()=>{if(!preloader)return;preloader.classList.add('is-done');setTimeout(()=>preloader.remove(),500)};window.addEventListener('load',reveal,{once:true});setTimeout(reveal,1400);
})();
