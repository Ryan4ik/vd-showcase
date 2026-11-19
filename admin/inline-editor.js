(() => {
  'use strict';
  const world=document.getElementById('vd-world');
  const ui=document.createElement('div');ui.id='ve-ui';document.body.append(ui);
  const state={doc:null,catalog:null,revision:0,csrf:'',selected:null,dirty:0,saved:0,saving:null,undo:[],redo:[],browse:false,range:null,panel:false};
  let timer,toastTimer,active=null,closingResolve=null,clickedLink=null,linkContext=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isMac=/Mac|iPhone|iPad/.test(navigator.platform),modName=isMac?'⌘':'Ctrl';
  const tips={save:modName+'+S',undo:modName+'+Z',redo:modName+'+Shift+Z / Ctrl+Y',duplicate:modName+'+D',delete:'Delete · только выбранная карточка','text-link':modName+'+K',shortcuts:modName+'+/',close:'Esc'};
  const btn=(label,action,extra='',cls='')=>`<button type="button" data-ve="${action}" ${extra} class="${cls}" ${tips[action]?`title="${tips[action]}"`:''}>${label}</button>`;

  const functionHelp={
    format:'Применяет жирное или курсивное начертание к выделенному тексту.',
    'text-link':'Добавляет или изменяет ссылку у выделенного текста.',
    'text-block':'Оформляет выделенный текст или вставляет новый элемент в позицию курсора.',
    'text-unbox':'Убирает плашку, сохраняя её текст.',
    'text-block-move':'Перемещает элемент, внутри которого находится курсор, на одну позицию.',
    'text-block-delete':'Удаляет элемент, внутри которого находится курсор, вместе с его содержимым.',
    'text-size-open':'Открывает размеры текста. С выделением меняет только выделенный фрагмент, без выделения — всё поле.',
    'text-size-pick':'Наведите для временного предпросмотра. Нажмите, чтобы сохранить размер.',
    'text-size-apply':'Применяет введённый размер в пикселях.',
    'text-preset':'Меняет цвет выделенного текста, сохраняя его размер и начертание.',
    'text-eyedropper':'Позволяет взять цвет с любого участка экрана и применить к выделенному тексту.',
    'reset-slot':'Сбрасывает цвет, размер, жирность, курсив и другое оформление поля до исходного дизайна. Текст сохраняется.',
    save:'Сохраняет черновик. Посетители увидят его после публикации.',publish:'Публикует сохранённые изменения на сайте.',
    undo:'Отменяет последнее изменение.',redo:'Повторяет отменённое изменение.',
    'node-form':'Открывает все поля и настройки оформления выбранной карточки.',
    'select-node':'Выбирает всю карточку вместо отдельного текста или изображения.',
    move:'Перемещает выбранную карточку вверх или вниз.',duplicate:'Создаёт копию выбранной карточки.',
    visibility:'Скрывает элемент от посетителей или снова показывает его.',delete:'Перемещает выбранную карточку в корзину.',
    'delete-section':'Перемещает весь раздел с его содержимым в корзину.',
    media:'Открывает библиотеку для выбора или загрузки изображения.',
    'clear-media':'Убирает изображение из этого поля.',
    settings:'Открывает настройки выбранной области сайта.',
    create:'Добавляет новый элемент выбранного типа.',close:'Закрывает окно настроек.',
    browse:'Переключает просмотр сайта и режим редактирования.',preview:'Показывает, как будет выглядеть сайт для посетителей.',
    trash:'Открывает удалённые элементы для восстановления.',shortcuts:'Показывает справку и сочетания клавиш.'
  };
  function addButtonHelp(root){for(const button of root.querySelectorAll('button')){
    if(button.dataset.helpReady)continue;
    const label=(button.getAttribute('aria-label')||button.textContent).trim();const action=button.dataset.ve;
    const description=functionHelp[action]|| (button.dataset.addGroup?'Добавляет элемент в эту группу.':button.dataset.cardNode?'Перемещает эту карточку в корзину.':button.dataset.imageSlot?'Открывает выбор изображения.':button.title||('Открывает или выполняет действие «'+label+'».'));
    const shortcut=tips[action];button.title=label+' — '+description+(shortcut?' ('+shortcut+')':'');button.dataset.helpReady='true';
  }}
  new MutationObserver(()=>addButtonHelp(ui)).observe(ui,{childList:true,subtree:true});
  new MutationObserver(()=>world.querySelectorAll('.ve-group-add,.ve-card-remove,.ve-image-button').forEach(b=>{if(!b.title)b.title=b.getAttribute('aria-label')||b.textContent.trim();})).observe(world,{childList:true,subtree:true});
  const fieldPath=(node,key)=>`data-node="${esc(node)}" data-field="${esc(key)}"`;
  const textOf=html=>{const t=document.createElement('template');t.innerHTML=html;return t.content.textContent.trim();};
  const safeLink=v=>!/[\s\\<>"']/.test(v)&&(/^(https:\/\/|mailto:|tel:|#[\w-]+$)/.test(v)||/^\/(?!\/)[\w/#?=.&%+-]*$/.test(v));
  function rich(html){
    const t=document.createElement('template');t.innerHTML=html;
    const walk=n=>{if(n.nodeType===3)return esc(n.nodeValue);if(n.nodeType!==1)return'';const tag=n.tagName.toLowerCase();if(['script','style','svg','img','iframe','video'].includes(tag))return'';if(tag==='br')return'<br>';let inside=[...n.childNodes].map(walk).join('');if(['b','strong'].includes(tag))return'<strong>'+inside+'</strong>';if(['i','em'].includes(tag))return'<em>'+inside+'</em>';if(tag==='a'&&safeLink(n.getAttribute('href')||''))return`<a href="${esc(n.getAttribute('href'))}" target="${n.target==='_blank'?'_blank':'_self'}" rel="noopener noreferrer">${inside}</a>`;if(tag==='span'&&!n.hasAttribute('data-cms-field')){
      if(n.style.fontWeight==='bold'||Number(n.style.fontWeight)>=600)inside='<strong>'+inside+'</strong>';
      if(n.style.fontStyle==='italic')inside='<em>'+inside+'</em>'; 
      if(n.classList.contains('cms-align')&&['left','center','right'].includes(n.style.textAlign))return '<span class="cms-align" style="text-align:'+n.style.textAlign+'">'+inside+'</span>';
      const size=n.getAttribute('style')?.match(/^font-size:\s*(1[01]?[0-9]|[2-9][0-9]|120)px;?$/i)?.[1];
      if(size)return '<span class="cms-size" style="font-size:'+size+'px">'+inside+'</span>';
      const color=n.getAttribute('style')?.match(/^color:\s*(#[0-9a-f]{6});?$/i)?.[1];
      if(color)return '<span class="cms-ink" style="color:'+color+'">'+inside+'</span>';
      const preset=['cms-plaque','cms-steps','cms-step','cms-paragraph','cms-subheading','cms-gradient','cms-ink','cms-accent'].find(name=>n.classList.contains(name))||(!n.className?'cms-accent':'');
      return preset?'<span class="'+preset+'">'+inside+'</span>':inside;
    }return inside+(['div','p'].includes(tag)?'<br>':'');};
    return[...t.content.childNodes].map(walk).join('').replace(/(?:<br>)+$/,'');
  }
  function locate(id,items=state.doc.sections,parent=null,group=null){for(let i=0;i<items.length;i++){const node=items[i];if(node.id===id)return{node,items,index:i,parent,group};for(const[g,children]of Object.entries(node.groups)){const found=locate(id,children,node,g);if(found)return found;}}return null;}
  const schema=n=>state.catalog.templates[n.template];
  const elementFor=(id,slot)=>world.querySelector(slot?`[data-cms-slot="${CSS.escape(id+':'+slot)}"]`:`[data-cms-node="${CSS.escape(id)}"]`);
  function status(value,error=false){const el=ui.querySelector('.ve-status');if(el){el.textContent=value;el.classList.toggle('error',error);}}
  function toast(value){ui.querySelector('.ve-toast').textContent=value;clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.querySelector('.ve-toast').textContent='',5500);}
  async function api(path,{method='GET',body,raw=false}={}){const r=await fetch('/api/'+path,{method,headers:{...(method!=='GET'?{'X-CSRF-Token':state.csrf}:{}),...(body?{'Content-Type':raw?'application/octet-stream':'application/json'}:{}),...(raw?{'X-File-Name':encodeURIComponent(body.name)}:{})},body:body?(raw?body:JSON.stringify(body)):undefined});const result=await r.json();if(!r.ok){if(r.status===401){openSheet('Войдите ещё раз',`<p>Сеанс завершён. Правки остаются в этом окне.</p><form id="ve-login" class="ve-stack"><label>Логин<input name="login" autocomplete="username" required></label><label>Пароль<input type="password" name="password" autocomplete="current-password" required></label><label>Код приложения или резервный код<input name="code" autocomplete="one-time-code" required></label><button type="submit" class="primary">Войти и продолжить</button></form>`);}throw Error(result.error||'Не удалось выполнить действие');}return result;}
  function checkpoint(){const s=JSON.stringify(state.doc);if(state.undo.at(-1)!==s)state.undo.push(s);if(state.undo.length>12)state.undo.shift();state.redo=[];}
  function changed(){state.dirty++;status('Есть изменения…');clearTimeout(timer);timer=setTimeout(()=>save().catch(()=>{}),900);}
  function mergeContactUpdates(sent,returned){
    for(const saved of returned.sections.filter(node=>['template1','template353'].includes(node.template))){
      const original=sent.sections.find(node=>node.id===saved.id),current=locate(saved.id)?.node;
      if(!original||!current)continue;
      for(const [key,html] of Object.entries(saved.content||{})){
        if(html===original.content?.[key]||current.content?.[key]!==original.content?.[key])continue;
        (current.content??={})[key]=html;
        const el=elementFor(current.id,key);
        if(el&&active?.el!==el)el.innerHTML=html;
      }
      for(const [key,group] of Object.entries(saved.groups)){
        if(JSON.stringify(group)===JSON.stringify(original.groups[key])||JSON.stringify(current.groups[key])!==JSON.stringify(original.groups[key]))continue;
        current.groups[key]=group;
        for(const node of group){
          const el=elementFor(node.id),slot=schema(node).editor[0];
          if(el?.tagName!=='A'||!slot?.link)continue;
          el.setAttribute('href',node.fields[slot.link]);
          const target=schema(node).fields.find(field=>field.attribute==='target');
          if(target)el.target=node.fields[target.key];
          const prior=original.groups[key].find(item=>item.id===node.id);
          const field=slot.fields[0];
          if(prior?.content?.[slot.key]===node.content?.[slot.key]&&prior?.fields[field]===node.fields[field])continue;
          const icons=[...el.querySelectorAll(':scope > svg')];
          if(node.content?.[slot.key]!==undefined)el.innerHTML=node.content[slot.key];
          else el.textContent=node.fields[field];
          el.append(...icons);
        }
      }
    }
  }
  async function save(){if(state.saving)await state.saving;if(state.saved===state.dirty)return;const dirty=state.dirty,document=structuredClone(state.doc);status('Сохраняю…');state.saving=api('draft',{method:'PUT',body:{document,revision:state.revision}}).then(r=>{mergeContactUpdates(document,r.document);state.revision=r.revision;state.saved=dirty;status(state.dirty===dirty?'Черновик сохранён':'Есть изменения…');}).catch(e=>{status(e.message,true);toast(e.message);throw e;}).finally(()=>state.saving=null);await state.saving;if(state.saved!==state.dirty)await save();}
  let updating=false;
  async function refresh({keepSheet=false}={}){
    if(updating)return;
    updating=true;
    finishText();
    try{
      await save();
      const response=await fetch('/?edit=1',{cache:'no-store'});
      if(!response.ok||response.redirected)throw Error('Не удалось обновить страницу редактора');
      const next=new DOMParser().parseFromString(await response.text(),'text/html');
      const nextWorld=next.getElementById('vd-world'),nextTheme=next.getElementById('cms-theme'),nextConfig=next.getElementById('cms-config');
      if(!nextWorld||!nextTheme||!nextConfig)throw Error('Не удалось загрузить черновик');
      const y=scrollY;
      const selected=state.selected;
      const preserve={
        planZone:world.querySelector('[data-plan-zone][aria-pressed=true]')?.dataset.planZone,
        specZone:world.querySelector('[data-zone-tab][aria-pressed=true]')?.dataset.zoneTab,
        seats:[...world.querySelectorAll('[data-pc-number][aria-pressed=true]')].map(el=>el.dataset.pcNumber),
        kind:world.querySelector('[data-kind][aria-pressed=true]')?.dataset.kind
      };
      markSelectedCard(null);
      disclosures.clear();
      document.getElementById('cms-theme').textContent=nextTheme.textContent;
      document.getElementById('cms-config').textContent=nextConfig.textContent;
      world.replaceChildren(...nextWorld.childNodes);
      document.dispatchEvent(new CustomEvent('vd-editor-render',{detail:preserve}));
      decorate();
      if(state.browse)disclose(false);
      if(selected&&locate(selected.id))selection(selected.id,selected.slot);
      else{state.selected=null;renderContext();}
      if(!keepSheet){
        ui.querySelector('.ve-sheet').hidden=true;
        ui.querySelector('.ve-sheet-body').replaceChildren();
      }
      scrollTo({top:y,behavior:'instant'});
      ui.dataset.renderCount=String(Number(ui.dataset.renderCount||0)+1);
    }finally{updating=false;}
  }
  function openSheet(title,html){ui.querySelector('.ve-sheet-head strong').textContent=title;ui.querySelector('.ve-sheet-body').innerHTML=html;ui.querySelector('.ve-sheet').hidden=false;}
  async function closeSheet(){if(state.panel){const frame=ui.querySelector('.ve-sheet iframe');await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{closingResolve=null;reject(Error('Настройки ещё не ответили. Подождите и повторите закрытие.'));},10000);closingResolve=result=>{clearTimeout(timeout);result?resolve():reject(Error('Не удалось сохранить настройки. Проверьте сообщение в форме.'));};frame.contentWindow.postMessage({type:'vd-panel-save'},location.origin);});state.panel=false;ui.querySelector('.ve-sheet').hidden=true;const latest=await api('draft');state.doc=latest.document;state.revision=latest.revision;state.saved=state.dirty;await refresh();return;}ui.querySelector('.ve-sheet').hidden=true;}
  function finishText(){if(!active)return;if(active.path){syncBoundText();const {el}=active;el.removeAttribute('contenteditable');active=null;state.range=null;showPalette();bindDynamic();return;}const {el,node,slot}=active;const value=rich(el.innerHTML);node.content??={};if(node.content[slot.key]!==value){node.content[slot.key]=value;if(/Название|Заголовок|Вопрос/.test(slot.label))node.title=textOf(value).slice(0,150)||'Без названия';changed();}el.removeAttribute('contenteditable');active=null;state.range=null;showPalette();}
  function startText(el,node,slot){if(active?.el===el)return;finishText();checkpoint();state.range=null;active={el,node,slot};el.contentEditable='true';el.spellcheck=true;el.focus({preventScroll:true});updateSizeLabel();}
  let selectedCard=null,cardOutlineObserver=null;
  function markSelectedCard(node){
    cardOutlineObserver?.disconnect();cardOutlineObserver=null;
    if(selectedCard){
      selectedCard.classList.remove('ve-card-selected','ve-card-relative');
      selectedCard.querySelectorAll(':scope > .ve-card-remove,:scope > .ve-card-outline').forEach(el=>el.remove());
      selectedCard=null;
    }
    if(!node)return;
    const template=schema(node),element=elementFor(node.id);
    const card=element?.closest('.ve-gallery-tile')||element;
    if(template.section||template.singleton||!card?.matches('article,figure,details,div,li'))return;
    selectedCard=card;
    if(getComputedStyle(card).position==='static')card.classList.add('ve-card-relative');
    card.classList.add('ve-card-selected');
    const remove=document.createElement('button');
    remove.type='button';
    remove.className='ve-card-remove';
    remove.dataset.cardNode=node.id;
    remove.setAttribute('aria-label','Перенести карточку в корзину');
    remove.title='Перенести карточку в корзину';
    remove.textContent='×';
    const outline=document.createElement('span');
    outline.className='ve-card-outline';
    outline.setAttribute('aria-hidden','true');
    card.append(outline,remove);
    const clip=getComputedStyle(card).clipPath;
    if(clip.startsWith('polygon(')){
      outline.style.border='0';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),polygon=document.createElementNS(svg.namespaceURI,'polygon');svg.setAttribute('width','100%');svg.setAttribute('height','100%');svg.style.overflow='visible';polygon.setAttribute('fill','none');polygon.setAttribute('stroke','#b879ef');polygon.setAttribute('stroke-width','6');polygon.setAttribute('stroke-linejoin','miter');svg.append(polygon);outline.append(svg);
      const value=(part,size)=>{const terms=part.replace(/calc\(|\)/g,'').replace(/\s+/g,'').match(/[+-]?[\d.]+(?:%|px)?/g)||[];return terms.reduce((sum,t)=>sum+parseFloat(t)*(t.endsWith('%')?size/100:1),0);};
      const redraw=()=>{const w=card.clientWidth,h=card.clientHeight;const points=clip.slice(8,-1).split(',').map(point=>{const parts=point.trim().match(/calc\([^)]*\)|[^\s]+/g);return value(parts[0],w)+','+value(parts[1],h);});polygon.setAttribute('points',points.join(' '));};redraw();cardOutlineObserver=new ResizeObserver(redraw);cardOutlineObserver.observe(card);
    }
  }
  function selection(id,slotKey=null){state.bound=null;clickedLink=null;const found=locate(id);if(!found)return;state.selected={id,slot:slotKey};markSelectedCard(found.node);world.querySelectorAll('.ve-selected').forEach(el=>el.classList.remove('ve-selected'));const el=elementFor(id,slotKey)||elementFor(id);if(!el?.parentElement?.classList.contains('ve-gallery-tile'))el?.classList.add('ve-selected');renderContext();}
  const isSocial=found=>['group34','group355'].includes(found.group);
  const isProtectedSocial=node=>state.catalog.protectedSocialIds?.includes(node.id);
  function textTools(style={}){return `${btn('<b>Ж</b>','format','data-command="bold" aria-label="Жирный"')}${btn('<i>К</i>','format','data-command="italic" aria-label="Курсив"')}${btn('Ссылка','text-link')}${btn('В плашку','text-block','data-kind=plaque')}${btn('Убрать плашку','text-unbox')}${btn('+ Текст','text-block','data-kind=paragraph data-new=true')}${btn('+ Плашка','text-block','data-kind=plaque data-new=true')}${btn('1 2 3','text-block','data-kind=steps')}${btn('Подзаголовок','text-block','data-kind=subheading')}${btn('Элемент ↑','text-block-move','data-direction=-1')}${btn('Элемент ↓','text-block-move','data-direction=1')}${btn('Удалить элемент','text-block-delete')}<div class="ve-size-control"><small>Размер текста</small>${btn('Авто ▾','text-size-open','aria-expanded="false"')}</div><label>Цвет<input type="color" data-slot-style="color" value="${style.color||'#b879ef'}"></label><label>Выравнивание<select data-slot-style="textAlign"><option value="">По дизайну</option>${['left','center','right'].map((v,i)=>`<option value="${v}" ${style.textAlign===v?'selected':''}>${['Слева','По центру','Справа'][i]}</option>`).join('')}</select></label>${btn('Сбросить стиль','reset-slot')}`;}
  function renderContext(){
    const context=ui.querySelector('.ve-context'),found=state.selected&&locate(state.selected.id);
    if(state.bound){context.innerHTML='<div class="ve-context-title"><strong>'+esc(state.bound.label)+'</strong><small>Изменения связаны с данными сайта</small></div><div class="ve-row">'+textTools()+btn('Все настройки зоны','settings','data-view="zones"')+btn('Тарифы и таблицы','settings','data-view="pricing"')+btn('План и места','settings','data-view="seats"')+'</div>';return;}
    if(!found){context.innerHTML='<div><strong>Выберите текст, картинку или карточку на странице</strong><br><small>Клик — редактирование · Ctrl/Cmd+Z — отмена · «Просмотр» — проверить кнопки сайта</small></div>';return;}
    const n=found.node,t=schema(n),s=t.editor.find(s=>s.key===state.selected.slot),style=n.slotStyles?.[s?.key]||{};
    let fields='';
    if(s?.kind==='richtext')fields=textTools(style);
    if(['image','video'].includes(s?.kind)){const value=n.fields[s.field]||'';fields=`${s.kind==='image'&&value?`<img src="${esc(value.startsWith('assets/')?'/'+value:value)}" alt="">`:''}<span><strong>${esc(value.split('/').pop()||'Изображение не выбрано')}</strong><br><small>${s.kind==='image'?'Изображение карточки':'Видеофайл'}</small></span>${btn('Заменить','media','','primary')}${btn('Убрать','clear-media')}<label>Заполнение<select data-slot-style="objectFit"><option value="">По дизайну</option><option value="contain" ${style.objectFit==='contain'?'selected':''}>Целиком</option><option value="cover" ${style.objectFit==='cover'?'selected':''}>Заполнить</option></select></label>${s.alt?`<label>Описание<input data-node-field="${s.alt}" value="${esc(n.fields[s.alt])}" placeholder="Что изображено"></label>`:''}`;}
    if(s?.kind==='embed')fields=`<small>Содержание виджета задаёт Яндекс</small>${btn('Настройки виджета','node-form')}`;
    if(s&&s.kind!=='richtext'&&elementFor(n.id,s.key)?.closest('a'))fields+=btn('Ссылка','text-link');
    context.innerHTML=`<div class="ve-context-title"><strong>${esc(s?.label||t.createLabel)}</strong><small>${esc(n.title)}</small></div><div class="ve-row">${fields}<span class="ve-divider"></span>${t.editor.some(x=>x.label==='Условия')?btn('Условия','conditions'):''}${btn('Все поля','node-form')}${btn('Карточка / блок','select-node')}${btn('↑','move','data-dir="-1" aria-label="Переместить выше"')}${btn('↓','move','data-dir="1" aria-label="Переместить ниже"')}${!t.singleton?btn('Копия','duplicate'):''}${btn(n.visible?'Скрыть':'Показать','visibility')}${t.singleton||isProtectedSocial(n)?'<small>Блок защищён</small>':(!s||isSocial(found))&&!t.section?btn('В корзину','delete','','danger'):''}</div>`;
  }
  const readPath=path=>path.reduce((v,k)=>v?.[k],state.doc);
  function writePath(path,value){const p=path.slice(0,-1).reduce((v,k)=>v[k],state.doc);if(p[path.at(-1)]!==value){p[path.at(-1)]=value;changed();}}
  const bookingNotice='Сообщи администратору дату, время и количество гостей.';
  function boundStyleTarget(path){
    const ownerPath=path[0]==='zones'?path.slice(0,2):path.slice(0,-1);
    return [readPath(ownerPath),path.slice(ownerPath.length).join('.')];
  }
  function syncBoundText(){
    const {el,path}=active;
    const plain=el.innerText;
    writePath(path,plain);
    const [owner,key]=boundStyleTarget(path);
    const html=rich(el.innerHTML);
    if(/<(?:span|strong|em|a)\b/.test(html)){
      owner.textStyles??={};
      if(owner.textStyles[key]?.html!==html||owner.textStyles[key]?.plain!==plain){
        owner.textStyles[key]={html,plain};
        changed();
      }
    }else if(owner.textStyles?.[key]){
      delete owner.textStyles[key];
      changed();
    }
  }
  function bindDynamic({preserveStatus=false}={}){
    const bind=(selector,path,label,{numeric=false,value}={})=>world.querySelectorAll(selector).forEach(el=>{el.dataset.vePath=JSON.stringify(path);el.dataset.veLabel=label;el.dataset.veNumeric=String(numeric);if(active?.el!==el){const plain=value??readPath(path)??'';const [owner,key]=boundStyleTarget(path);const style=owner?.textStyles?.[key];if(!numeric&&style?.plain===plain)el.innerHTML=style.html;else el.textContent=plain;}});
    for(const [prefix,attr]of [['plan','data-plan-zone'],['zone','data-zone-tab']]){
      const tab=world.querySelector('['+attr+'][aria-pressed=true]'),i=state.doc.zones.findIndex(z=>z.id===tab?.getAttribute(attr));if(i<0)continue;
      const z=state.doc.zones[i],p=['zones',i];
      bind('[data-'+prefix+'-title]',[...p,'name'],'Название зоны');bind('[data-'+prefix+'-meta]',[...p,prefix==='plan'?'seatsLabel':'meta'],'Подзаголовок зоны');bind('[data-'+prefix+'-copy]',[...p,prefix==='plan'?'shortDescription':'description'],'Описание зоны');
      if(prefix==='zone')z.specs.forEach((row,j)=>{bind('[data-zone-specs]>div:nth-child('+(j+1)+') dt',[...p,'specs',j,0],'Характеристика');bind('[data-zone-specs]>div:nth-child('+(j+1)+') dd',[...p,'specs',j,1],'Значение характеристики');});
      else{const t=state.doc.pricing[z.kind],row=t.rows.findIndex(r=>r.id===z.tariff);let visible=0;t.columns.forEach((c,col)=>{if(t.rows[row]?.values[col]==null)return;visible++;const selector='[data-plan-packages]>div:nth-child('+visible+')';bind(selector+' dt',['pricing',z.kind,'columns',col,'label'],'Название пакета');bind(selector+' dd',['pricing',z.kind,'rows',row,'values',col],'Стоимость пакета',{numeric:true,value:t.rows[row].values[col].toLocaleString('ru-RU')+' ₽'});});}
    }
    bind('[data-plan-status]',['settings','bookingNotice'],'Подсказка о бронировании',{value:preserveStatus?world.querySelector('[data-plan-status]')?.textContent:state.doc.settings.bookingNotice??bookingNotice});
    for(const z of state.doc.zones)world.querySelectorAll('[data-plan-zone="'+CSS.escape(z.id)+'"],[data-zone-tab="'+CSS.escape(z.id)+'"]').forEach(el=>el.textContent=z.name);
  }
  function editBound(el){finishText();markSelectedCard(null);checkpoint();world.querySelectorAll('.ve-selected').forEach(e=>e.classList.remove('ve-selected'));state.selected=null;state.bound={path:JSON.parse(el.dataset.vePath),label:el.dataset.veLabel};el.classList.add('ve-selected');renderContext();
    if(el.dataset.veNumeric==='true'){openSheet(state.bound.label,'<form id="ve-number-form" class="ve-stack"><label>Цена, ₽<input id="ve-number" type="number" min="0" max="10000000" step="any" value="'+readPath(state.bound.path)+'" required></label><button type="submit" class="primary">Применить</button></form>');ui.querySelector('#ve-number').focus();return;}
    state.range=null;active={el,path:state.bound.path};el.contentEditable='true';el.focus({preventScroll:true});updateSizeLabel();
  }
  function openLinkEditor(){
    const found=state.selected&&locate(state.selected.id),node=found?.node||(active?.path?{fields:{},content:{}}:null),slot=active?.path?{kind:'richtext',key:'bound'}:node&&schema(node).editor.find(x=>x.key===state.selected.slot),el=active?.path?active.el:node&&elementFor(node.id,slot?.key);
    if(!node||!slot||!el){toast('Выберите кнопку или текст на странице');return;}
    const selection=getSelection(),range=state.range&&el.contains(state.range.commonAncestorContainer)?state.range.cloneRange():null;
    const cursor=selection.anchorNode?.nodeType===1?selection.anchorNode:selection.anchorNode?.parentElement;
    let anchor=clickedLink?.isConnected?clickedLink:el.closest('a')||(cursor&&el.contains(cursor)?cursor.closest('a'):null);
    if(!anchor&&el.querySelectorAll('a').length===1)anchor=el.querySelector('a');
    const field=slot.link||anchor?.dataset.cmsLink?.split(':')[1];
    const target=range||document.createRange();if(!range||range.collapsed){if(!anchor)target.selectNodeContents(el);}
    linkContext={path:active?.path,node,slot,el,anchor,field,targetField:anchor?.dataset.cmsTarget?.split(':')[1],range:target};finishText();
    openSheet(anchor||field?'Изменить ссылку':'Добавить ссылку',
      '<form id="ve-link-form" class="ve-stack"><label>Адрес ссылки<input id="ve-link" type="text" autocomplete="url" value="'+esc(field?node.fields[field]:anchor?.getAttribute('href')||'')+'" placeholder="https://… · tel:+7… · mailto:… · #раздел" required></label><small>Можно указать сайт, телефон, почту или раздел этой страницы.</small><label>Открывать<select id="ve-link-target"><option value="_self">В этой вкладке</option><option value="_blank">В новой вкладке</option></select></label><label>Раздел сайта<select id="ve-link-section"><option value="">Выбрать раздел…</option>'+state.doc.sections.map(n=>'<option value="#'+esc(n.anchor)+'">'+esc(n.title)+'</option>').join('')+'</select></label><div class="ve-cardbar"><button type="submit" class="primary">Применить</button>'+btn('Отмена','close')+'</div></form>');
    ui.querySelector('#ve-link-target').value=anchor?.target==='_blank'?'_blank':'_self';ui.querySelector('#ve-link').focus();ui.querySelector('#ve-link').select();
  }
  async function applyLink(){
    const value=ui.querySelector('#ve-link').value.trim();if(!safeLink(value))throw Error('Введите HTTPS-ссылку, телефон, почту или #раздел');
    const {node,slot,el,anchor,field,targetField,range}=linkContext,target=ui.querySelector('#ve-link-target').value;checkpoint();
    if(field)node.fields[field]=value;if(targetField)node.fields[targetField]=target;
    if(anchor){anchor.setAttribute('href',value);anchor.target=target;anchor.rel='noopener noreferrer';}
    else{el.contentEditable='true';el.focus({preventScroll:true});getSelection().removeAllRanges();getSelection().addRange(range);document.execCommand('createLink',false,value);el.querySelectorAll('a').forEach(a=>{if(a.getAttribute('href')===value){a.target=target;a.rel='noopener noreferrer';}});el.removeAttribute('contenteditable');}
    if(linkContext.path){const previous=active;active={el,path:linkContext.path};syncBoundText();active=previous;}
    if(slot.kind==='richtext'&&(!field||anchor!==el)){node.content??={};node.content[slot.key]=rich(el.innerHTML);}
    changed();ui.querySelector('.ve-sheet').hidden=true;linkContext=null;await save();toast('Ссылка сохранена');
  }
  function slotValue(n,s){return n.content?.[s.key]??rich(elementFor(n.id,s.key)?.innerHTML||'');}
  function clearSelection(){finishText();markSelectedCard(null);state.selected=null;state.bound=null;world.querySelectorAll('.ve-selected').forEach(el=>el.classList.remove('ve-selected'));renderContext();}
  const countNodes=n=>1+Object.values(n.groups).flat().reduce((sum,c)=>sum+countNodes(c),0);
  async function trashView(parentId,groupKey){
    finishText();await save();const all=await api('trash'),p=parentId&&locate(parentId)?.node,g=p&&schema(p).groups.find(g=>g.key===groupKey),rows=g?all.filter(r=>g.templates.includes(r.template)):all;
    openSheet(g?'Вернуть удалённую карточку':'Корзина',`<p class="muted">Здесь сохраняются удалённые блоки вместе с текстами, изображениями и оформлением. Восстановление добавляет блок в черновик.</p><div class="ve-stack">${rows.map(r=>`<div class="ve-trash-row"><div><strong>${esc(r.title)}</strong><br><small>${esc(r.parent_title)} · ${new Date(r.created).toLocaleString('ru-RU')}${r.count>1?' · элементов: '+r.count:''}${r.parentMissing&&!g?' · сначала восстановите раздел':''}</small></div>${btn('Восстановить','restore-trash',`data-id="${r.id}" ${g?`data-parent="${p.id}" data-group="${g.key}"`:''}`)}</div>`).join('')||'<p>Удалённых блоков пока нет.</p>'}</div>`);
  }
  function removalDialog(){const found=state.selected&&locate(state.selected.id);if(!found)return;const n=found.node,t=schema(n);
    if(isProtectedSocial(n)){toast('Исходную соцсеть можно только скрыть.');return;}
    if(t.singleton){toast('Этот блок защищён от удаления. Его текст можно редактировать.');return;}
    if(state.selected.slot&&!isSocial(found)){toast('Сначала выберите карточку целиком кнопкой «Карточка / блок».');return;}
    openSheet(t.section?'Перенести раздел в корзину?':'Перенести карточку в корзину?',`<div class="ve-stack"><p><strong>${esc(n.title)}</strong></p><p class="muted">${t.section?'Будет убран весь раздел вместе с вложенными элементами ('+countNodes(n)+'). ':''}Содержимое сохранится в корзине. Его можно вернуть даже после закрытия сайта.</p>${t.section?`<label>Введите название раздела для подтверждения<input id="ve-removal-title" autocomplete="off" placeholder="${esc(n.title)}"></label>`:''}<div class="ve-cardbar">${btn('В корзину','confirm-remove','','danger')}${btn('Отмена','close')}</div></div>`);
  }
  function shortcutHelp(){openSheet('Горячие клавиши',`<p class="muted">${isMac?'На Mac используется ⌘.':'На Windows используется Ctrl; на Mac — ⌘.'} Сочетания работают и при русской раскладке. Во время ввода отмена и Delete относятся к тексту, а не к карточке.</p><div class="ve-shortcuts">${[[modName+' + S','Сохранить'],[modName+' + Z','Отменить'],[modName+' + Shift + Z / Ctrl + Y','Повторить'],[modName+' + B / I','Жирный / курсив в тексте'],[modName+' + K','Ссылка на выделенный текст'],[modName+' + D','Скопировать выбранный блок'],['Alt + ↑ / ↓','Переместить выбранную карточку'],['Enter','Редактировать выбранный элемент'],['Delete / Backspace','Карточка в корзину с подтверждением'],['Esc','Закрыть окно, закончить ввод или снять выделение'],[modName+' + / или ?','Эта подсказка']].map(([key,label])=>`<div><kbd>${esc(key)}</kbd><span>${label}</span></div>`).join('')}</div>`);}
  const disclosures=new Map();
  function disclose(edit){for(const[el,wasOpen]of disclosures){if(el.tagName==='DETAILS')el.open=edit||wasOpen;else{el.hidden=edit?false:wasOpen;const b=el.closest('article')?.querySelector('[data-conditions]');b?.setAttribute('aria-expanded',String(!el.hidden));}}}
  function nodeForm(){const n=locate(state.selected.id).node,t=schema(n);let html='<div class="ve-stack">';for(const s of t.editor.filter(s=>!s.readOnly)){if(s.kind==='richtext')html+=`<label>${esc(s.label)}<div class="ve-field-rich" contenteditable="true" role="textbox" aria-label="${esc(s.label)}" data-form-slot="${s.key}">${slotValue(n,s)}</div></label>`;else if(s.field)html+=`<label>${esc(s.label)}<input data-form-field="${s.field}" value="${esc(n.fields[s.field])}"></label>`;}for(const f of t.fields.filter(f=>f.type==='link'))html+=`<label>Адрес ссылки<input data-form-field="${f.key}" value="${esc(n.fields[f.key])}"></label>`;html+=`<div class="ve-grid"><label>Фон блока<input type="color" data-node-style="background" value="${n.style.background||'#211332'}"></label><label>Отступы<input type="number" min="0" max="160" data-node-style="padding" value="${n.style.padding??''}" placeholder="По дизайну"></label><label>Скругление<input type="number" min="0" max="160" data-node-style="borderRadius" value="${n.style.borderRadius??''}" placeholder="По дизайну"></label></div>${btn('Готово','apply-form','','primary')}${t.section&&!t.singleton?btn('Убрать раздел в корзину…','delete-section','','danger'):''}</div>`;checkpoint();openSheet('Содержимое и оформление',html);}
  async function settings(view){finishText();await save();checkpoint();state.panel=true;openSheet('Настройки сайта',`<iframe src="/admin?panel=${encodeURIComponent(view)}" title="Настройки сайта"></iframe>`);}
  async function mediaPicker(){const files=await api('media');const n=locate(state.selected.id).node,s=schema(n).editor.find(x=>x.key===state.selected.slot);const items=files.filter(f=>s.kind==='video'?/\.(mp4|webm)$/i.test(f.url):/\.(png|jpg|webp)$/i.test(f.url));openSheet('Выберите '+(s.kind==='video'?'видео':'изображение'),`<div class="ve-stack"><label>Загрузить файл · до 40 МБ<input type="file" id="ve-upload" accept="${s.kind==='video'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp'}"></label><div class="ve-media">${items.map(f=>btn(`${s.kind==='image'?`<img src="${esc(f.url)}" alt="" loading="lazy">`:''}<strong>${esc(f.name)}</strong><br><small>${Math.round(f.size/1024)} КБ</small>`,'choose-media',`data-url="${esc(f.url)}"`)).join('')}</div></div>`);}
  function freshNode(key){const t=state.catalog.templates[key],n=structuredClone(t.fresh||t.default);n.id=crypto.randomUUID();n.title=t.createLabel;if(n.anchor)n.anchor='section-'+n.id.slice(0,8);return n;}
  function addChoices(parentId,groupKey){const parent=parentId&&locate(parentId)?.node,g=parent&&schema(parent).groups.find(g=>g.key===groupKey);const choices=g?g.createTemplates:Object.values(state.catalog.templates).filter(t=>t.section&&!t.singleton&&['Текстовый раздел','Фотографии','Акции','Вопросы и ответы','События и сотрудничество'].includes(t.label)).filter((t,i,list)=>!list.slice(i+1).some(x=>x.label===t.label)).map(t=>t.key);openSheet(g?'Добавить: '+g.label:'Новый раздел',`<p class="muted">Начните с чистого блока. Все тексты, картинки и оформление можно изменить.</p><div class="ve-grid">${choices.map(k=>{const t=state.catalog.templates[k];return btn(`<strong>${esc(t.createLabel)}</strong><small>${esc(t.editor.filter(s=>s.kind==='richtext').slice(0,4).map(s=>s.label).join(' · '))}</small>`,'create',`data-template="${k}" ${parent?`data-parent="${parent.id}" data-group="${groupKey}"`:''}`,'ve-choice');}).join('')}</div>${g?'<div class="ve-cardbar">'+btn('Вернуть удалённую карточку','trash',`data-parent="${parent.id}" data-group="${g.key}"` )+'</div>':''}`);}
  function decorate(){
    world.querySelectorAll('.v-gallery > img[data-cms-node]').forEach(image=>{
      const tile=document.createElement('div');
      tile.className='ve-gallery-tile';
      image.before(tile);
      tile.append(image);
    });
    bindDynamic();
    world.querySelectorAll('.v-plan-zones,.v-zone-tabs').forEach(el=>{const b=document.createElement('div');b.className='ve-zone-tools';b.innerHTML='<button type="button" data-edit-view="zones">Зоны · добавить / изменить</button><button type="button" data-edit-view="pricing">Тарифы</button><button type="button" data-edit-view="seats">План и места</button>';el.after(b);});
    world.querySelectorAll('details,.v-promo-detail').forEach(el=>disclosures.set(el,el.tagName==='DETAILS'?el.open:el.hidden));disclose(true);
    for(const el of world.querySelectorAll('[data-cms-slot]')){const[id,key]=el.dataset.cmsSlot.split(':'),n=locate(id)?.node,s=n&&schema(n).editor.find(s=>s.key===key);if(s?.readOnly){el.removeAttribute('data-cms-slot');continue;}if(s?.kind==='richtext'){el.dataset.vePlaceholder=s.label;el.setAttribute('aria-label',s.label);}}
    world.querySelectorAll('.v-photo[data-cms-node]').forEach(el=>{const slot=el.querySelector('img[data-cms-slot]');if(!slot)return;const b=document.createElement('button');b.type='button';b.className='ve-image-button';b.dataset.imageSlot=slot.dataset.cmsSlot;b.textContent='Заменить фото';el.append(b);});
    world.querySelectorAll('[data-cms-group]').forEach(el=>{const header=el.closest('.v-nav');const[id,g]=el.dataset.cmsGroup.split(':'),n=locate(id)?.node,group=n&&schema(n).groups.find(x=>x.key===g);if(!group)return;const b=document.createElement('button');b.type='button';b.className='ve-group-add';b.dataset.addGroup=el.dataset.cmsGroup;b.textContent='+ '+(group.label==='Карточки акций'?'Добавить акцию':group.label==='Вопросы и ответы'?'Добавить вопрос':group.label==='Фотографии'?'Добавить фотографию':'Добавить: '+group.label.toLowerCase());if(header){
      let tools=header.querySelector('.ve-header-add');
      if(!tools){tools=document.createElement('div');tools.className='ve-header-add';header.append(tools);}
      b.textContent=group.label==='Пункты меню'?'+ Пункт меню':'+ Соцсеть';
      tools.append(b);
    }else el.after(b);});
    world.querySelectorAll('iframe[data-cms-slot]').forEach(el=>{el.parentElement.dataset.veFrame='';const b=document.createElement('button');b.className='ve-frame-cover';b.type='button';b.setAttribute('aria-label','Настройки виджета');b.dataset.frameSlot=el.dataset.cmsSlot;el.after(b);});
    world.querySelectorAll('iframe[data-yandex-map]').forEach(el=>{el.parentElement.dataset.veFrame='';const b=document.createElement('button');b.className='ve-frame-cover';b.type='button';b.setAttribute('aria-label','Настройки карты');b.dataset.editView='map';el.after(b);});
  }
  function layout(){ui.innerHTML=`<div class="ve-dock"><div class="ve-row ve-main-row"><div class="ve-row"><span class="ve-brand">VD / РЕДАКТОР</span><span class="ve-status">Черновик сохранён</span></div><div class="ve-row">${btn('↶','undo','aria-label="Отменить"')}${btn('↷','redo','aria-label="Повторить"')}${btn('+ Раздел','add-section')}${world.querySelector('.v-nav[data-cms-node]')?btn('Шапка','header-menu'):''}${btn('Тарифы','settings','data-view="pricing"')}${btn('Цвета','settings','data-view="theme"')}${btn('Ещё','more')}${btn('?','shortcuts','aria-label="Горячие клавиши"')}${btn('Просмотр','browse')}${btn('Сохранить','save')}${btn('Опубликовать','publish','','primary')}${btn('Выйти','exit')}</div></div><div class="ve-palette ve-row" hidden></div><div class="ve-context"></div></div><section class="ve-sheet" hidden><header class="ve-sheet-head"><strong></strong>${btn('Закрыть','close')}</header><div class="ve-sheet-body"></div></section><div class="ve-toast" role="status" aria-live="polite"></div>`;new ResizeObserver(entries=>document.documentElement.style.setProperty('--ve-height',entries[0].borderBoxSize[0].blockSize+'px')).observe(ui.querySelector('.ve-dock'));renderContext();}
  let textGesture=null, suppressSelectionClick=false;
  document.addEventListener('pointerdown',event=>{
    textGesture=null;
    suppressSelectionClick=false;
    if(event.button!==0||updating||!state.doc||state.browse||!ui.querySelector('.ve-sheet').hidden)return;
    const field=event.target.closest('[data-cms-slot],[data-ve-path]');
    if(!field||!world.contains(field)||field.dataset.veNumeric==='true')return;
    if(field.dataset.cmsSlot){
      const [id,key]=field.dataset.cmsSlot.split(':');
      const node=locate(id)?.node;
      const slot=node&&schema(node).editor.find(item=>item.key===key&&item.kind==='richtext');
      if(!slot)return;
      textGesture={field,node,slot,link:event.target.closest('a'),pointer:event.pointerId};
    }else textGesture={field,pointer:event.pointerId};
    const current=getSelection();textGesture.hadSelection=active?.el===field&&current.rangeCount&&!current.isCollapsed&&field.contains(current.anchorNode)&&field.contains(current.focusNode);textGesture.x=event.clientX;textGesture.y=event.clientY;
  },true);
  document.addEventListener('pointercancel',()=>{textGesture=null;},true);
  document.addEventListener('pointerup',event=>{
    const gesture=textGesture;
    textGesture=null;
    if(!gesture||gesture.pointer!==event.pointerId)return;
    const selected=getSelection();
    const {field,node,slot,link}=gesture;
    if(gesture.hadSelection&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<4&&field.contains(event.target)){
      let caret=document.caretRangeFromPoint?.(event.clientX,event.clientY);
      if(!caret&&document.caretPositionFromPoint){const p=document.caretPositionFromPoint(event.clientX,event.clientY);if(p){caret=document.createRange();caret.setStart(p.offsetNode,p.offset);}}
      if(caret&&field.contains(caret.startContainer)){caret.collapse(true);selected.removeAllRanges();selected.addRange(caret);state.range=caret.cloneRange();showPalette();return;}
    }
    if(!selected.rangeCount||selected.isCollapsed)return;
    const range=selected.getRangeAt(0).cloneRange();
    if(!range.intersectsNode(field))return;
    const bounds=document.createRange();
    bounds.selectNodeContents(field);
    if(range.compareBoundaryPoints(Range.START_TO_START,bounds)<0)range.setStart(bounds.startContainer,bounds.startOffset);
    if(range.compareBoundaryPoints(Range.END_TO_END,bounds)>0)range.setEnd(bounds.endContainer,bounds.endOffset);
    if(range.collapsed||!range.toString())return;
    if(active?.el!==field){
      if(node){
        selection(node.id,slot.key);
        clickedLink=link||field.closest('a');
        startText(field,node,slot);
      }else editBound(field);
    }
    selected.removeAllRanges();
    selected.addRange(range);
    state.range=range.cloneRange();
    showPalette();
    suppressSelectionClick=true;
    setTimeout(()=>{suppressSelectionClick=false;},0);
  },true);
  document.addEventListener('click',e=>{
    if(updating&&!ui.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();return;}
    if(suppressSelectionClick){e.preventDefault();e.stopImmediatePropagation();return;}
    if(ui.contains(e.target)||!state.doc||state.browse)return;if(!ui.querySelector('.ve-sheet').hidden){e.preventDefault();e.stopImmediatePropagation();return;}
    const removeCard=e.target.closest('.ve-card-remove');
    if(removeCard){
      e.preventDefault();e.stopImmediatePropagation();
      finishText();
      selection(removeCard.dataset.cardNode);
      removalDialog();
      return;
    }
    const imageButton=e.target.closest('[data-image-slot]');if(imageButton){e.preventDefault();e.stopImmediatePropagation();finishText();selection(...imageButton.dataset.imageSlot.split(':'));mediaPicker().catch(err=>toast(err.message));return;}
    const zoneTab=e.target.closest('[data-plan-zone],[data-zone-tab],[data-pc-number],[data-floor-zone],[data-seat-choices] button,[data-copy-choice]');if(zoneTab){finishText();return;}
    if(active?.el.contains(e.target)){
      const current=getSelection();state.range=current.rangeCount&&active.el.contains(current.anchorNode)?current.getRangeAt(0).cloneRange():null;showPalette();e.stopImmediatePropagation();if(e.target.closest('a'))e.preventDefault();return;
    }
    const bound=e.target.closest('[data-ve-path]');if(bound){e.preventDefault();e.stopImmediatePropagation();if(active?.el!==bound)editBound(bound);return;}
    const special=e.target.closest('[data-edit-view],[data-value]');
    if(special){e.preventDefault();e.stopImmediatePropagation();finishText();settings(special.dataset.editView||'pricing').catch(err=>toast(err.message));return;}
    const add=e.target.closest('[data-add-group]');if(add){e.preventDefault();e.stopImmediatePropagation();finishText();const[id,g]=add.dataset.addGroup.split(':');addChoices(id,g);return;}
    const frame=e.target.closest('[data-frame-slot]');const el=frame?elementFor(...frame.dataset.frameSlot.split(':')):e.target.closest('[data-cms-slot]');
    if(el){const[id,k]=el.dataset.cmsSlot.split(':'),n=locate(id)?.node,s=n&&schema(n).editor.find(x=>x.key===k);if(!s)return;e.preventDefault();e.stopImmediatePropagation();selection(id,k);clickedLink=e.target.closest('a')||el.closest('a');if(s.kind==='richtext')startText(el,n,s);else finishText();return;}
    const n=e.target.closest('[data-cms-node]');if(n){e.preventDefault();e.stopImmediatePropagation();finishText();const photo=n.matches('.v-photo')&&n.querySelector('img[data-cms-slot]');if(photo)selection(...photo.dataset.cmsSlot.split(':'));else selection(n.dataset.cmsNode);}
  },true);
  world.addEventListener('click',e=>{if(!state.browse&&e.target.closest('[data-plan-zone],[data-zone-tab],[data-pc-number],[data-floor-zone],[data-seat-choices] button'))bindDynamic({preserveStatus:true});});
  world.addEventListener('input',e=>{if(!active||e.target!==active.el)return;if(active.path){syncBoundText();return;}const n=active.node;n.content??={};n.content[active.slot.key]=rich(active.el.innerHTML);if(/Название|Заголовок|Вопрос/.test(active.slot.label))n.title=textOf(n.content[active.slot.key]).slice(0,150)||'Без названия';changed();});
  world.addEventListener('paste',e=>{if(!active)return;e.preventDefault();const text=e.clipboardData.getData('text/plain');const lines=text.trim().split(/\r?\n/);if(lines.length>1&&lines.every(line=>/^\d+[.)]\s+/.test(line))){const html='<span class="cms-steps">'+lines.map(line=>'<span class="cms-step">'+esc(line.replace(/^\d+[.)]\s+/,''))+'</span>').join('')+'</span>';document.execCommand('insertHTML',false,html);}else document.execCommand('insertText',false,text);});
  function showPalette(){
    const panel=ui.querySelector('.ve-palette');
    if(!panel)return;
    panel.hidden=!active||!state.range||state.range.collapsed||!active.el.contains(state.range.commonAncestorContainer);
    if(panel.hidden||panel.childElementCount)return;
    const theme=state.doc.theme;
    const colors=[
      ['Светлый текст',theme.text],['Чёрный как в заголовках','#171020'],['Тёмный текст',theme.lightText],
      ['Акцент',theme.accent],['Лиловый',theme.buttonStart],['Фиолетовый',theme.buttonEnd]
    ];
    panel.innerHTML='<strong>Выделенный текст</strong>'+
      colors.map(([label,color])=>btn('<span class="ve-swatch" style="background:'+esc(color)+'"></span>'+esc(label),'text-preset','data-color="'+esc(color)+'"')).join('')+
      btn('Фирменный градиент','text-preset','data-preset="cms-gradient"')+
      '<label>Свой цвет<input type="color" data-inline-color value="#b879ef"></label>'+
      (typeof EyeDropper==='function'?btn('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 5 5 5M4 16l9-9 4 4-9 9H4v-4Z"/><path d="m13 7 4-4a2.8 2.8 0 0 1 4 4l-4 4M4 20l-2 2"/></svg> Пипетка','text-eyedropper'):'');
  }

  function currentTextBlock(){const range=state.range;if(!active||!range||!active.el.contains(range.commonAncestorContainer))return null;const node=range.startContainer;return (node.nodeType===1?node:node.parentElement).closest('.cms-plaque,.cms-step,.cms-paragraph,.cms-subheading');}
  function selectBlock(block){const range=document.createRange();range.selectNodeContents(block);active.el.focus({preventScroll:true});getSelection().removeAllRanges();getSelection().addRange(range);state.range=range.cloneRange();active.el.dispatchEvent(new Event('input',{bubbles:true}));}
  function textBlockAction(action,data){
    if(!active){toast('Сначала выберите текст на странице');return;}
    const range=state.range?.cloneRange();if(!range||!active.el.contains(range.commonAncestorContainer)){toast('Выберите текст или поставьте курсор');return;}
    let block=currentTextBlock();
    checkpoint();
    if(action==='text-unbox'){if(!block?.matches('.cms-plaque')){toast('Поставьте курсор внутри плашки');return;}block.replaceWith(...block.childNodes);active.el.dispatchEvent(new Event('input',{bubbles:true}));return;}
    if(action==='text-block-delete'){if(!block)return;block.remove();active.el.dispatchEvent(new Event('input',{bubbles:true}));return;}
    if(action==='text-block-move'){if(!block)return;const sibling=Number(data.direction)<0?block.previousSibling:block.nextSibling;if(!sibling)return;if(Number(data.direction)<0)sibling.before(block);else sibling.after(block);selectBlock(block);return;}
    const kind=data.kind;
    if(kind==='plaque'&&!data.new&&range.collapsed){toast('Выделите текст для плашки');return;}
    if(data.new){range.collapse(false);}
    const wrapper=document.createElement('span');wrapper.className='cms-'+kind;
    if(kind==='steps'){
      const fragment=range.cloneContents();fragment.querySelectorAll('br').forEach(el=>el.replaceWith('\n'));fragment.querySelectorAll('div,p,.cms-paragraph,.cms-plaque,.cms-step,.cms-subheading').forEach(el=>{el.prepend('\n');el.append('\n');});const lines=fragment.textContent.split(/\r?\n/).map(x=>x.trim().replace(/^\d+[.)]\s*/, '')).filter(Boolean);
      range.deleteContents();for(const line of lines.length?lines:['Новый пункт']){const item=document.createElement('span');item.className='cms-step';item.textContent=line;wrapper.append(item);}
    }else if(!range.collapsed){wrapper.append(range.extractContents());wrapper.querySelectorAll('.cms-plaque').forEach(el=>el.replaceWith(...el.childNodes));}
    else wrapper.textContent=kind==='subheading'?'Подзаголовок':kind==='plaque'?'Текст плашки':'Новый текст';
    range.insertNode(wrapper);selectBlock(kind==='steps'?wrapper.lastChild:wrapper);
  }
  world.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.shiftKey||!active)return;
    const item=currentTextBlock();if(!item?.matches('.cms-step'))return;
    e.preventDefault();checkpoint();
    const range=state.range.cloneRange();range.deleteContents();
    const tail=document.createRange();tail.setStart(range.startContainer,range.startOffset);tail.setEnd(item,item.childNodes.length);
    const next=document.createElement('span');next.className='cms-step';next.append(tail.extractContents());if(!next.textContent)next.append(document.createElement('br'));item.after(next);
    selectBlock(next);getSelection().collapse(next,0);state.range=getSelection().getRangeAt(0).cloneRange();
  });


  function resetTextStyle(){
    if(!active)return;checkpoint();const {el,node,slot,path}=active;
    const copy=document.createElement('div');copy.innerHTML=el.innerHTML;
    copy.querySelectorAll('strong,b,em,i,.cms-ink,.cms-gradient,.cms-accent,.cms-size,.cms-align').forEach(x=>x.replaceWith(...x.childNodes));
    copy.querySelectorAll('[style]').forEach(x=>x.removeAttribute('style'));
    el.innerHTML=copy.innerHTML;el.removeAttribute('style');
    if(path){const [owner,key]=boundStyleTarget(path);if(owner.textStyles)delete owner.textStyles[key];syncBoundText();}
    else{if(node.slotStyles)delete node.slotStyles[slot.key];for(const f of slot.fields||[])if(node.fieldStyles)delete node.fieldStyles[f];
      for(const key of ['fontSize','fontWeight','fontFamily','fontStyle','color','textAlign','lineHeight','letterSpacing','textDecoration'])if(node.style)delete node.style[key];
      node.content??={};node.content[slot.key]=rich(el.innerHTML);
    }
    state.range=null;changed();refresh();
  }
  let sizeContext=null;

  let sizePreview=null;
  function rangePath(el,n){const out=[];while(n&&n!==el){out.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes,n));n=n.parentNode;}return out;}
  function captureSizePreview(){const {el,range}=sizeContext;sizePreview={html:el.innerHTML,style:el.getAttribute('style'),range:range?{start:rangePath(el,range.startContainer),end:rangePath(el,range.endContainer),so:range.startOffset,eo:range.endOffset}:null};}
  function restoreSizePreview(){if(!sizePreview||!sizeContext)return;const {el}=sizeContext,snapshot=sizePreview;sizePreview=null;el.innerHTML=snapshot.html;if(snapshot.style===null)el.removeAttribute('style');else el.setAttribute('style',snapshot.style);if(snapshot.range){const r=document.createRange(),v=snapshot.range;r.setStart(v.start.reduce((n,i)=>n.childNodes[i],el),v.so);r.setEnd(v.end.reduce((n,i)=>n.childNodes[i],el),v.eo);sizeContext.range=r;state.range=r.cloneRange();}else sizeContext.range=null;}
  ui.addEventListener('pointerover',e=>{const b=e.target.closest('[data-ve=text-size-pick]');if(b&&!b.contains(e.relatedTarget))applyTextSize(b.dataset.size,true);});
  ui.addEventListener('pointerout',e=>{const b=e.target.closest('[data-ve=text-size-pick]');if(b&&!b.contains(e.relatedTarget))restoreSizePreview();});
  function updateSizeLabel(){
    const button=ui.querySelector('[data-ve=text-size-open]');if(!button||!active||sizePreview)return;
    const selected=getSelection(),range=selected.rangeCount?selected.getRangeAt(0):null,sizes=new Set();
    if(range&&!range.collapsed&&active.el.contains(range.commonAncestorContainer)){
      const walker=document.createTreeWalker(active.el,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode())if(text.textContent.trim()&&range.intersectsNode(text))sizes.add(Number(parseFloat(getComputedStyle(text.parentElement).fontSize).toFixed(1)));
    }
    if(!sizes.size){const anchor=selected.anchorNode,element=anchor&&active.el.contains(anchor)?(anchor.nodeType===1?anchor:anchor.parentElement):active.el;sizes.add(Number(parseFloat(getComputedStyle(element).fontSize).toFixed(1)));}
    button.textContent=(sizes.size>1?'Разные':[...sizes][0]+' px')+' ▾';
  }
  function openSizePanel(button){
    const existing=ui.querySelector('.ve-size-panel');if(existing){restoreSizePreview();existing.remove();button.setAttribute('aria-expanded','false');return;}
    if(!active){toast('Сначала выберите текст');return;}
    const range=state.range?.cloneRange();
    sizeContext={el:active.el,node:active.node,slot:active.slot,path:active.path,range:range&&!range.collapsed?range:null};
    const panel=document.createElement('div');panel.className='ve-size-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Размер текста');
    panel.innerHTML='<strong>'+ (sizeContext.range?'Размер выделенного текста':'Размер всего текстового поля')+'</strong><div class="ve-size-presets">'+btn('Авто','text-size-pick','data-size="auto"')+[10,12,14,16,18,20,24,28,32,36,48,64,72,96,120].map(n=>btn(n,'text-size-pick','data-size="'+n+'"')).join('')+'</div><label>Свой размер, px<input type="number" min="10" max="120" step="1" data-size-input placeholder="10–120"></label>'+btn('Применить','text-size-apply');
    ui.append(panel);button.setAttribute('aria-expanded','true');
    const rect=button.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(innerWidth-300,rect.left))+'px';panel.style.bottom=Math.max(8,innerHeight-rect.top+8)+'px';
  }
  function applyTextSize(raw,preview=false){
    restoreSizePreview();
    if(!sizeContext)return;const automatic=raw==='auto',value=Number(raw);if(!automatic&&(!Number.isInteger(value)||value<10||value>120)){toast('Размер от 10 до 120 px');return;}
    const {el,node,slot,path,range}=sizeContext;if(preview)captureSizePreview();else checkpoint();
    if(range&&el.contains(range.commonAncestorContainer)){
      // Split size wrappers at selection boundaries, so reset affects only selected letters.
      const fragment=range.extractContents();fragment.querySelectorAll('.cms-size').forEach(span=>span.replaceWith(...span.childNodes));
      const marker=document.createElement('span');range.insertNode(marker);
      let parent=marker.parentElement;
      while(parent&&parent!==el){
        if(parent.classList.contains('cms-size')){
          const tail=document.createRange();tail.setStartAfter(marker);tail.setEnd(parent,parent.childNodes.length);const after=parent.cloneNode(false);after.append(tail.extractContents());parent.after(marker);if(after.hasChildNodes())marker.after(after);
          if(!parent.textContent)parent.remove();
        }
        parent=marker.parentElement===parent?parent.parentElement:marker.parentElement;
      }
      const wrapper=document.createElement('span');if(!automatic){wrapper.className='cms-size';wrapper.setAttribute('style','font-size:'+value+'px');}wrapper.append(fragment);marker.replaceWith(wrapper);
      const next=document.createRange();next.selectNodeContents(wrapper);el.focus({preventScroll:true});getSelection().removeAllRanges();getSelection().addRange(next);state.range=next.cloneRange();
      if(automatic)wrapper.replaceWith(...wrapper.childNodes);
      if(!preview){if(path)syncBoundText();else{node.content??={};node.content[slot.key]=rich(el.innerHTML);}}
    }else{
      if(path){const whole=document.createRange();whole.selectNodeContents(el);sizeContext.range=whole;applyTextSize(raw,preview);return;}
      if(!preview)node.slotStyles??={};const style=preview?{}:(node.slotStyles[slot.key]??={});if(automatic){delete style.fontSize;el.style.removeProperty('font-size');}else{style.fontSize=value;el.style.setProperty('font-size',value+'px','important');}
    }
    if(preview)return;
    changed();ui.querySelector('.ve-size-panel')?.remove();ui.querySelector('[data-ve=text-size-open]')?.setAttribute('aria-expanded','false');sizeContext=null;
  }
  ui.addEventListener('keydown',e=>{if(e.target.matches('[data-size-input]')&&e.key==='Enter'){e.preventDefault();applyTextSize(e.target.value);}if(e.key==='Escape'&&ui.querySelector('.ve-size-panel')){e.stopPropagation();restoreSizePreview();ui.querySelector('.ve-size-panel').remove();sizeContext=null;}});
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.ve-size-panel,[data-ve=text-size-open]')){restoreSizePreview();ui.querySelector('.ve-size-panel')?.remove();sizeContext=null;}});
  function applyTextPreset(preset,color){
    const range=state.range;
    if(!active||!range||range.collapsed||!active.el.contains(range.commonAncestorContainer))return;
    if(color&&!/^#[0-9a-f]{6}$/i.test(color))return;
    const container=range.commonAncestorContainer;
    const existing=(container.nodeType===1?container:container.parentElement)?.closest('.cms-ink,.cms-gradient');
    const replaceExisting=existing&&existing!==active.el&&active.el.contains(existing)&&existing.textContent===range.toString();
    const fragment=range.extractContents();
    const prior='.cms-ink,.cms-gradient,.cms-accent';
    fragment.querySelectorAll(prior).forEach(el=>el.replaceWith(...el.childNodes));
    const span=document.createElement('span');
    span.className=preset||'cms-ink';
    if(color)span.setAttribute('style','color:'+color);
    span.append(fragment);
    if(replaceExisting)existing.replaceWith(span);else range.insertNode(span);
    range.selectNodeContents(span);
    const selected=getSelection();
    active.el.focus({preventScroll:true});
    selected.removeAllRanges();
    selected.addRange(range);
    state.range=range.cloneRange();
    active.el.dispatchEvent(new Event('input',{bubbles:true}));
  }
  document.addEventListener('selectionchange',()=>{
    const s=getSelection();
    if(active&&s.rangeCount&&active.el.contains(s.anchorNode)&&active.el.contains(s.focusNode))state.range=s.getRangeAt(0).cloneRange();
    else if(active&&!s.rangeCount&&!ui.contains(document.activeElement))state.range=null;
    showPalette();
    updateSizeLabel();
  });
  ui.addEventListener('pointerdown',e=>{if(e.target.closest('[data-ve^="text-size"],[data-ve^="text-block"],[data-ve=text-unbox],[data-ve=format],[data-ve=text-link],[data-ve=text-preset],[data-ve=text-eyedropper]'))e.preventDefault();});
  ui.addEventListener('change',e=>{if(e.target.matches('[data-inline-color]'))applyTextPreset(null,e.target.value);});
  ui.addEventListener('paste',e=>{if(e.target.closest('[data-form-slot]')){e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}});
  ui.addEventListener('focusin',e=>{if(e.target.matches('input,select,textarea,[data-form-slot]'))checkpoint();});
  ui.addEventListener('input',e=>{const el=e.target,found=state.selected&&locate(state.selected.id);if(active?.path&&el.dataset.slotStyle){checkpoint();const r=document.createRange();r.selectNodeContents(active.el);state.range=r; if(el.dataset.slotStyle==='color')applyTextPreset(null,el.value);else if(el.dataset.slotStyle==='textAlign'){const field=active.el;field.querySelectorAll('.cms-align').forEach(x=>x.replaceWith(...x.childNodes));if(el.value){const span=document.createElement('span');span.className='cms-align';span.style.textAlign=el.value;span.append(...field.childNodes);field.append(span);}syncBoundText();}return;}if(!found)return;const n=found.node;
    if(el.dataset.slotStyle){const key=el.dataset.slotStyle;n.slotStyles??={};const s=n.slotStyles[state.selected.slot]??={};if(el.value==='')delete s[key];else s[key]=el.type==='number'?Number(el.value):el.value;const target=elementFor(n.id,state.selected.slot);target?.style.setProperty(key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),el.value+(el.type==='number'&&el.value?'px':''),'important');changed();}
    if(el.dataset.nodeField){n.fields[el.dataset.nodeField]=el.value;changed();}
  });
  ui.addEventListener('change',async e=>{if(e.target.id==='ve-link-section'){ui.querySelector('#ve-link').value=e.target.value;return;}if(e.target.id!=='ve-upload')return;const f=e.target.files[0];if(!f)return;try{if(f.size>40*1024*1024)throw Error('Максимум 40 МБ');e.target.disabled=true;const r=await api('media',{method:'POST',body:f,raw:true});const n=locate(state.selected.id).node,s=schema(n).editor.find(x=>x.key===state.selected.slot);checkpoint();n.fields[s.field]=r.url;changed();await refresh();}catch(err){toast(err.message);e.target.disabled=false;}});
  ui.addEventListener('submit',async e=>{if(e.target.id==='ve-number-form'){e.preventDefault();writePath(state.bound.path,Number(ui.querySelector('#ve-number').value));try{await refresh();}catch(err){toast(err.message);}return;}if(e.target.id==='ve-link-form'){e.preventDefault();try{await applyLink();}catch(err){toast(err.message);}return;}if(e.target.id!=='ve-login')return;e.preventDefault();try{const r=await api('login',{method:'POST',body:Object.fromEntries(new FormData(e.target))});state.csrf=r.csrf;ui.querySelector('.ve-sheet').hidden=true;await save();toast('Вход выполнен, правки сохранены');}catch(err){toast(err.message);}});
  ui.addEventListener('click',async e=>{
    const b=e.target.closest('[data-ve]');if(!b||updating)return;const a=b.dataset.ve,d=b.dataset,found=state.selected&&locate(state.selected.id),n=found?.node,s=n&&schema(n).editor.find(x=>x.key===state.selected.slot);
    try{
      if(state.panel&&a!=='close'){toast('Сначала закройте окно настроек');return;}
      if(a==='reset-slot'){resetTextStyle();return;}
      if(a==='text-size-open'){openSizePanel(b);return;}
      if(a==='text-size-pick'){applyTextSize(d.size);return;}
      if(a==='text-size-apply'){applyTextSize(ui.querySelector('[data-size-input]').value);return;}
      if(a.startsWith('text-block')||a==='text-unbox'){textBlockAction(a,d);return;}
      if(a==='text-preset'){applyTextPreset(d.preset,d.color);return;}
      if(a==='text-eyedropper'){
        try{const {sRGBHex}=await new EyeDropper().open();applyTextPreset(null,sRGBHex);}
        catch(error){if(error.name!=='AbortError')throw error;}
        return;
      }
      if(a==='format'){if(!active){toast('Сначала выберите текст на странице');return;}active.el.focus({preventScroll:true});if(state.range){getSelection().removeAllRanges();getSelection().addRange(state.range);}if(d.command==='accent'){const range=getSelection().getRangeAt(0);if(range.collapsed){toast('Выделите слова для акцента');return;}const span=document.createElement('span');span.className='cms-accent';span.append(range.extractContents());range.insertNode(span);active.el.dispatchEvent(new Event('input',{bubbles:true}));}else document.execCommand(d.command,false);return;}
      if(a==='text-link'||a==='button-link'){openLinkEditor();return;}
      if(a==='apply-link'){await applyLink();return;}
      finishText();
      if(a==='close'){await closeSheet();return;}
      if(a==='save'){await save();toast('Черновик сохранён');return;}
      if(a==='settings'){await settings(d.view);return;}
      if(a==='trash'){await trashView(d.parent,d.group);return;}
      if(a==='shortcuts'){shortcutHelp();return;}
      if(a==='delete-section'){state.selected.slot=null;removalDialog();return;}
      if(a==='delete'){removalDialog();return;}
      if(a==='confirm-remove'){await save();checkpoint();const r=await api('trash/remove',{method:'POST',body:{nodeId:n.id,revision:state.revision,confirmation:ui.querySelector('#ve-removal-title')?.value}});state.doc=r.document;state.revision=r.revision;state.saved=state.dirty;state.selected=null;await refresh();return;}
      if(a==='restore-trash'){await save();checkpoint();const r=await api('trash/restore',{method:'POST',body:{id:Number(d.id),revision:state.revision,parentId:d.parent,groupKey:d.group}});state.doc=r.document;state.revision=r.revision;state.saved=state.dirty;await refresh();return;}
      if(a==='more'){openSheet('Инструменты сайта','<div class="ve-grid">'+[['sections','Разделы и скрытые элементы'],['zones','Игровые зоны'],['seats','План клуба'],['map','Карта и ориентиры'],['media','Медиатека'],['seo','Поиск и резервная копия'],['history','История и восстановление'],['security','Доступ и безопасность']].map(([v,label])=>btn(label,'settings',`data-view="${v}"`,'ve-choice')).join('')+btn('Корзина · восстановить блоки','trash','','ve-choice')+'</div>');return;}
      if(a==='browse'){state.browse=!state.browse;disclose(!state.browse);document.documentElement.classList.toggle('ve-browse',state.browse);b.textContent=state.browse?'Редактировать':'Просмотр';toast(state.browse?'Кнопки и ссылки сайта работают. Нажмите «Редактировать», чтобы продолжить.':'Выберите элемент на странице');return;}
      if(a==='exit'){await save();if(!confirm('Выйти из режима владельца? Черновик сохранён.'))return;await api('logout',{method:'POST',body:{}});sessionStorage.removeItem('vd-inline-return');location.href='/vd-showcase/';return;}
      if(a==='publish'){await save();if(!confirm('Опубликовать текущие изменения для всех посетителей? Предыдущая версия сохранится в истории.'))return;await api('publish',{method:'POST',body:{revision:state.revision,note:'Перед публикацией из визуального редактора'}});toast('Изменения опубликованы');return;}
      if(a==='undo'||a==='redo'){const from=a==='undo'?state.undo:state.redo,to=a==='undo'?state.redo:state.undo;if(!from.length){toast('Нет изменений для '+(a==='undo'?'отмены':'повтора'));return;}to.push(JSON.stringify(state.doc));state.doc=JSON.parse(from.pop());changed();await refresh();return;}
      if(a==='header-menu'){
        const header=world.querySelector('.v-nav[data-cms-node]');
        const node=locate(header.dataset.cmsNode)?.node;
        if(!node)return;
        const groups=schema(node).groups.map(group=>btn('Добавить: '+esc(group.label.toLowerCase()),'header-add',`data-node="${node.id}" data-group="${group.key}"`));
        openSheet('Шапка сайта','<div class="ve-stack">'+groups.join('')+'</div>');
        return;
      }
      if(a==='header-add'){addChoices(d.node,d.group);return;}
      if(a==='add-section'){addChoices();return;}
      if(a==='conditions'){const slot=schema(n).editor.find(x=>x.label==='Условия'),el=elementFor(n.id,slot?.key);if(el){const details=el.closest('details');if(details)details.open=true;el.hidden=false;selection(n.id,slot.key);startText(el,n,slot);el.scrollIntoView({block:'center'});}return;}
      if(a==='node-form'){nodeForm();return;}
      if(a==='apply-form'){ui.querySelectorAll('[data-form-slot]').forEach(el=>{n.content??={};n.content[el.dataset.formSlot]=rich(el.innerHTML);});ui.querySelectorAll('[data-form-field]').forEach(el=>n.fields[el.dataset.formField]=el.value);ui.querySelectorAll('[data-node-style]').forEach(el=>{if(el.value==='')delete n.style[el.dataset.nodeStyle];else n.style[el.dataset.nodeStyle]=el.type==='number'?Number(el.value):el.value;});changed();await refresh({keepSheet:true});return;}
      if(a==='select-node'){selection(n.id);return;}
      if(a==='media'){await mediaPicker();return;}
      checkpoint();
      if(a==='reset-slot'){if(n.slotStyles)delete n.slotStyles[state.selected.slot];changed();await refresh();return;}
      if(a==='choose-media'||a==='clear-media'){n.fields[s.field]=a==='clear-media'?'':d.url;}
      else if(a==='visibility')n.visible=!n.visible;
      else if(a==='move'){const i=found.index,j=i+Number(d.dir);if(j<0||j>=found.items.length)return;[found.items[i],found.items[j]]=[found.items[j],found.items[i]];}
      
      else if(a==='duplicate'){const clone=x=>{const c=structuredClone(x);c.id=crypto.randomUUID();if(c.anchor)c.anchor='section-'+c.id.slice(0,8);for(const g in c.groups)c.groups[g]=c.groups[g].map(clone);return c;};const copy=clone(n);copy.title+=' — копия';found.items.splice(found.index+1,0,copy);state.selected={id:copy.id};}
      else if(a==='create'){const item=freshNode(d.template);if(d.parent)locate(d.parent).node.groups[d.group].push(item);else{let position=state.doc.sections.findIndex(x=>x.id===state.selected?.id);if(position<0)position=state.doc.sections.length-2;state.doc.sections.splice(position+1,0,item);}state.selected={id:item.id};}
      else return;
      changed();await refresh();
    }catch(err){toast(err.message);}
  });
  document.addEventListener('keydown',e=>{
    if(!state.doc||updating||e.isComposing||e.getModifierState('AltGraph'))return;
    const mod=e.ctrlKey||e.metaKey,code=e.code||({s:'KeyS',z:'KeyZ',y:'KeyY',k:'KeyK',d:'KeyD',b:'KeyB',i:'KeyI'}[e.key.toLowerCase()]||e.key);
    const typing=!!e.target.closest('input,textarea,select,[contenteditable=true]'),sheet=ui.querySelector('.ve-sheet:not([hidden])');
    const run=(action,selector='')=>{e.preventDefault();ui.querySelector('[data-ve="'+action+'"]'+selector)?.click();};
    if(mod&&code==='KeyS'){e.preventDefault();if(sheet?.querySelector('form')){sheet.querySelector('form').requestSubmit();return;}if(sheet?.querySelector('[data-ve=apply-form]')){sheet.querySelector('[data-ve=apply-form]').click();return;}if(!state.panel)save().catch(()=>{});return;}
    if(code==='Escape'){
      e.preventDefault();if(sheet){closeSheet().catch(err=>toast(err.message));return;}
      if(active){finishText();ui.querySelector('[data-ve=save]').focus();return;}
      if(state.browse){ui.querySelector('[data-ve=browse]').click();return;}clearSelection();return;
    }
    if(state.panel||sheet||state.browse)return;
    if(mod&&code==='KeyK'&&state.selected){run('text-link');return;}
    if(mod&&['KeyB','KeyI'].includes(code)&&active&&!active.path){e.preventDefault();document.execCommand(code==='KeyB'?'bold':'italic',false);return;}
    if(typing)return;
    if(mod&&code==='KeyZ'){run(e.shiftKey?'redo':'undo');return;}
    if(mod&&code==='KeyY'){run('redo');return;}
    if((mod&&code==='Slash')||e.key==='?'){run('shortcuts');return;}
    const n=state.selected&&locate(state.selected.id)?.node,t=n&&schema(n);
    if(mod&&code==='KeyD'){e.preventDefault();if(n&&!t.singleton)run('duplicate');return;}
    if(e.altKey&&['ArrowUp','ArrowDown'].includes(code)){run('move','[data-dir="'+(code==='ArrowUp'?-1:1)+'"]');return;}
    if(['Delete','Backspace'].includes(code)){e.preventDefault();if(n&&!state.selected.slot&&!t.section&&!t.singleton)removalDialog();else toast('Выберите карточку целиком. Текстовые элементы отдельно не удаляются.');return;}
    if(code==='Enter'&&n){e.preventDefault();const slot=t.editor.find(s=>s.key===state.selected.slot),el=elementFor(n.id,slot?.key);if(slot?.kind==='richtext')startText(el,n,slot);else if(['image','video'].includes(slot?.kind))mediaPicker().catch(err=>toast(err.message));else nodeForm();}
  });
  window.addEventListener('beforeunload',e=>{if(state.dirty!==state.saved){e.preventDefault();e.returnValue='';}});
  window.addEventListener('message',e=>{const frame=ui.querySelector('.ve-sheet iframe');if(e.origin!==location.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='vd-panel-close'){closeSheet().catch(err=>toast(err.message));return;}if(e.data?.type==='vd-panel-saved'&&closingResolve){closingResolve(e.data.ok);closingResolve=null;}});
  Promise.all([api('session'),api('catalog'),api('draft')]).then(([session,catalog,draft])=>{state.csrf=session.csrf;state.catalog=catalog;state.doc=draft.document;state.revision=draft.revision;layout();decorate();}).catch(e=>{ui.innerHTML='<div class="ve-dock">'+esc(e.message)+' · <a href="/admin">Открыть вход</a></div>';});
})();
