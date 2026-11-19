(() => {
  'use strict';
  let cleanup;
  function initialize(preserve={}){
  cleanup?.abort();
  cleanup=new AbortController();
  const {signal}=cleanup;
  const config=JSON.parse(document.getElementById('cms-config').textContent);
  const root=document.getElementById('vd-world');
  const $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)];
  const set=(s,value)=>{const el=$(s);if(el)el.textContent=value;};
  function styled(el,owner,key,plain){
    if(!el)return;
    const style=owner.textStyles?.[key];
    if(style?.plain===plain)el.innerHTML=style.html;
    else el.textContent=plain;
  }
  const money=n=>Number(n).toLocaleString('ru-RU')+' ₽';
  let selection={zone:config.zones[0]?.id};
  const selected=new Set((preserve.seats??(preserve.seat?[preserve.seat]:[])).map(String).filter(n=>config.seats.some(s=>String(s.number)===n)));
  const selectedSeats=()=>config.seats.filter(s=>selected.has(String(s.number))).sort((a,b)=>String(a.number).localeCompare(String(b.number),'ru',{numeric:true}));
  const seatList=()=>selectedSeats().map(s=>s.number).join(', ');
  function bookingMessage(){const z=config.zones.find(z=>z.id===selection.zone);return 'Здравствуйте! Хочу забронировать '+(selected.size?(selected.size===1?'место ':'места ')+selectedSeats().map(s=>s.number+' ('+(config.zones.find(z=>z.id===s.zone)?.name??s.zone)+')').join(', '):'зону '+z.name)+' в VD Club: '+config.settings.address+'.';}
  async function copySelection(){try{await navigator.clipboard.writeText(bookingMessage());set('[data-copy-choice]','Выбор скопирован ✓');set('[data-plan-status]','Выбор скопирован. Вставь сообщение в переписку с администратором.');}catch{set('[data-plan-status]',bookingMessage()+' Скопируй этот текст и отправь администратору.');}}
  function toggleSeat(id,pc){pc=String(pc);selected.has(pc)?selected.delete(pc):selected.add(pc);choose(id);}
  function choose(id){
    const zone=config.zones.find(z=>z.id===id);if(!zone)return;selection={zone:id};
    styled($('[data-plan-title]'),zone,'name',zone.name);styled($('[data-plan-meta]'),zone,'seatsLabel',selected.size?'ВЫБРАНЫ МЕСТА: '+seatList():zone.seatsLabel);styled($('[data-plan-copy]'),zone,'shortDescription',zone.shortDescription);
    const packages=$('[data-plan-packages]');
    if(packages){packages.replaceChildren();const table=config.pricing[zone.kind],row=table.rows.find(r=>r.id===zone.tariff);table.columns.forEach((c,i)=>{if(row?.values[i]==null)return;const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');styled(dt,c,'label',c.label);dd.textContent=money(row.values[i]);div.append(dt,dd);packages.append(div);});}
    styled($('[data-plan-status]'),config.settings,'bookingNotice',selected.size?`Выбраны места: ${seatList()}. Наличие на нужное время подтвердит администратор.`:(config.settings.bookingNotice??'Сообщи администратору дату, время и количество гостей.'));
    $$('[data-floor-zone]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.floorZone===id)));
    $$('[data-plan-zone]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.planZone===id)));
    $$('[data-pc-number]').forEach(b=>{b.setAttribute('aria-pressed',String(selected.has(b.dataset.pcNumber)));b.dataset.zoneActive=String(b.dataset.pcZone===id);});
    if($('[data-seat-picker]'))$('[data-seat-picker]').hidden=zone.kind==='ps';
    const choices=$('[data-seat-choices]');if(choices){choices.replaceChildren();config.seats.filter(s=>s.zone===id).forEach(s=>{const b=document.createElement('button');b.type='button';b.textContent=s.number;b.setAttribute('aria-pressed',String(selected.has(String(s.number))));b.setAttribute('aria-label','Место '+s.number);b.onclick=()=>toggleSeat(id,s.number);choices.append(b);});}
    set('[data-copy-choice]','Скопировать выбор');
  }
  $$('[data-floor-zone]').forEach(el=>{el.onclick=()=>choose(el.dataset.floorZone);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(el.dataset.floorZone);}};});
  $$('[data-plan-zone]').forEach(b=>b.onclick=()=>choose(b.dataset.planZone));
  $$('[data-pc-number]').forEach(b=>b.onclick=()=>toggleSeat(b.dataset.pcZone,b.dataset.pcNumber));
  if(config.zones.length){const seat=config.seats.find(item=>item.number===preserve.seat);choose(seat?.zone||config.zones.find(z=>z.id===preserve.planZone)?.id||config.zones[0].id,seat?.number);}
  $('[data-copy-choice]')?.addEventListener('click',copySelection,{signal});
  $('.v-plan-sidebar .v-book-actions .v-main')?.addEventListener('click',()=>{if(!document.documentElement.hasAttribute('data-vd-edit-mode'))void copySelection();},{signal});
  $('[data-floor-zoom]')?.addEventListener('click',e=>{const scroller=$('.v-floor-scroll');if(!scroller)return;const zoomed=scroller.dataset.zoomed!=='true';scroller.dataset.zoomed=String(zoomed);e.currentTarget.setAttribute('aria-pressed',String(zoomed));e.currentTarget.textContent=zoomed?'Показать целиком':'Увеличить +';set('[data-zoom-hint]',zoomed?'Листай схему вбок':'Вся схема клуба');if(!zoomed)scroller.scrollLeft=0;});
  function specs(id){const z=config.zones.find(z=>z.id===id);if(!z)return;styled($('[data-zone-meta]'),z,'meta',z.meta);styled($('[data-zone-title]'),z,'name',z.name);styled($('[data-zone-copy]'),z,'description',z.description);const dl=$('[data-zone-specs]');if(dl){dl.replaceChildren();z.specs.forEach(([k,v],i)=>{const d=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');styled(dt,z,'specs.'+i+'.0',k);styled(dd,z,'specs.'+i+'.1',v);d.append(dt,dd);dl.append(d);});}$$('[data-zone-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zoneTab===id)));}
  $$('[data-zone-tab]').forEach(b=>b.onclick=()=>specs(b.dataset.zoneTab));if(config.zones.length)specs(config.zones.find(z=>z.id===preserve.specZone)?.id||config.zones[0].id);
  let kind=preserve.kind==='ps'?'ps':'pc';
  function price(button){$$('[data-value]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));set('.v-selection-title',button?button.dataset.zone+' / '+button.dataset.hours:'Нет доступных пакетов');set('.v-selection-price',button?money(button.dataset.value):'');}
  function tab(value){kind=value;$$('[data-pc]').forEach(el=>el.hidden=kind!=='pc');$$('[data-ps]').forEach(el=>el.hidden=kind!=='ps');$$('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));price($(`[data-kind-value="${kind}"]`));}
  $$('[data-value]').forEach(b=>{b.dataset.duration=b.dataset.hours;b.onclick=()=>price(b);});$$('[data-kind]').forEach(b=>b.onclick=()=>tab(b.dataset.kind));tab(kind);
  $$('[data-conditions]').forEach(b=>b.onclick=()=>{const p=b.closest('article')?.querySelector('.v-promo-detail');if(!p)return;const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));p.hidden=!open;});
  const menu=$('.v-links'),menuButton=$('.v-menu-toggle');
  const closeMenu=()=>{if(menu)menu.dataset.open='false';menuButton?.setAttribute('aria-expanded','false');};
  menuButton?.addEventListener('click',()=>{if(!menu)return;const open=menu.dataset.open!=='true';menu.dataset.open=String(open);menuButton.setAttribute('aria-expanded',String(open));});menu?.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();},{signal});
  $$('[data-landmark]').forEach(b=>b.onclick=()=>{const m=config.landmarks.find(m=>m.id===b.dataset.landmark),frame=$('[data-yandex-map]');if(!m||!frame)return;frame.src=m.url;frame.title=m.caption;set('[data-map-caption]',m.caption);$$('[data-landmark]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  const emblem=$('.v-orbit'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(emblem){const hit=document.createElement('div');hit.className='v-orbit v-orbit-hit';hit.setAttribute('aria-hidden','true');emblem.after(hit);const reset=()=>['x','y','glow-x','glow-y','glow-opacity'].forEach(p=>emblem.style.removeProperty('--emblem-'+p));hit.onpointermove=e=>{if(reduced.matches||e.pointerType==='touch')return;const r=hit.getBoundingClientRect(),x=2*(e.clientX-r.left)/r.width-1,y=2*(e.clientY-r.top)/r.height-1;Object.entries({x:-y*16+'deg',y:x*16+'deg','glow-x':50+x*34+'%','glow-y':50+y*34+'%','glow-opacity':'.75'}).forEach(([p,v])=>emblem.style.setProperty('--emblem-'+p,v));};hit.onpointerleave=reset;reduced.addEventListener('change',reset,{signal});}
  const video=$('[data-hero-video]'),toggle=$('[data-hero-toggle]');
  if(video&&toggle&&config.settings.videoEnabled){
    const sync=()=>{toggle.textContent=video.paused?'▶':'❚❚';toggle.setAttribute('aria-label',video.paused?'Воспроизвести фоновое видео':'Приостановить фоновое видео');};
    const prepare=()=>{video.defaultMuted=true;video.muted=true;video.playsInline=true;video.setAttribute('webkit-playsinline','');if(!video.dataset.loaded){video.querySelectorAll('source').forEach(s=>s.src=s.dataset.src);video.dataset.loaded='true';video.load();}};
    toggle.hidden=false;toggle.onclick=()=>{prepare();video.paused?video.play().catch(sync):video.pause();};
    video.onplay=sync;video.onpause=sync;video.onplaying=()=>video.dataset.playing='';video.onerror=()=>{delete video.dataset.playing;sync();};
    reduced.addEventListener('change',()=>{if(reduced.matches)video.pause();},{signal});
    if(config.settings.autoplay&&!reduced.matches){prepare();video.play().catch(sync);}sync();
  }
  const ticker=$('.v-ticker');if(ticker&&window.ResizeObserver){const observer=new ResizeObserver(()=>{if(!ticker.clientWidth)return;const probe=document.createElement('div');probe.style.height='var(--poster-cut)';ticker.append(probe);const rise=probe.getBoundingClientRect().height;probe.remove();ticker.style.setProperty('--ribbon-angle',(-Math.atan(rise/ticker.clientWidth)*180/Math.PI)+'deg');});observer.observe(ticker);signal.addEventListener('abort',()=>observer.disconnect(),{once:true});}
  }
  initialize();
  if(document.documentElement.hasAttribute('data-vd-edit-mode'))document.addEventListener('vd-editor-render',event=>initialize(event.detail));
})();

