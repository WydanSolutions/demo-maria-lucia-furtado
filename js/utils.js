/*
 * Funciones de ayuda: fechas, formato, avisos, etiquetas de estado.
 */
/* ===== utils ===== */
const $=s=>document.querySelector(s);
function esc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function cliName(id){const c=Store.get('clientes',id);return c?c.nombre:'—';}
function fDate(iso){if(!iso)return '—';const p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function daysTo(iso){if(!iso)return null;const t=new Date();t.setHours(0,0,0,0);const p=iso.split('-').map(Number);const x=new Date(p[0],p[1]-1,p[2]);return Math.round((x-t)/86400000);}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}
function urgRank(u){return {Alta:3,Media:2,Baja:1}[u]||0;}
function urgPill(u){if(!u)return '<span class="muted-cell">—</span>';const c={Alta:'urg-alta',Media:'urg-media',Baja:'urg-baja'}[u];return '<span class="pill '+c+'">'+u+'</span>';}
function estPill(e){const m={'Pendiente':'st-pend','En proceso':'st-proc','Presentada':'st-done','Hecha':'st-done'};return '<span class="pill '+(m[e]||'st-pend')+'">'+e+'</span>';}
function clkEst(col,id,e,opts){const m={'Pendiente':'st-pend','En proceso':'st-proc','Presentada':'st-done','Hecha':'st-done'};return '<span class="pill clk '+(m[e]||'st-pend')+'" onclick=\'ddStatus(event,"'+col+'","'+id+'",'+JSON.stringify(opts)+')\'>'+e+' ▾</span>';}
function vencColor(dd){return dd<0?'var(--red)':dd<=3?'var(--acento)':dd<=10?'var(--amber)':'var(--muted)';}
function actions(kind,id){return '<div class="row-act"><button class="btn-ghost" title="Editar" onclick="openForm(\''+kind+'\',\''+id+'\')">✎</button><button class="btn-ghost" title="Eliminar" style="color:var(--red)" onclick="quickDel(\''+kind+'\',\''+id+'\')">🗑</button></div>';}
function emptyRow(cols,msg){return '<tr><td colspan="'+cols+'"><div class="empty"><div class="e-ico">📭</div><p>'+msg+'</p></div></td></tr>';}
// Fecha de hoy en hora local (toISOString usa hora UTC: en Uruguay, después de las 21 h daba el día siguiente).
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
// Rango permitido en todos los campos de fecha (evita años de 5 cifras o fechas absurdas por un error de tipeo).
const DR=' min="2000-01-01" max="2099-12-31"';
const DR_NAC=' min="1900-01-01" max="2099-12-31"'; // fechas de nacimiento
// Valida contra el min/max de cada campo (así un año a medio tipear, como 0002, no se guarda).
function dateOk(el){if(!el.value)return true;var min=el.min||'2000-01-01',max=el.max||'2099-12-31';if(el.value<min||el.value>max){toast('Revisá la fecha: tiene que estar entre '+fDate(min)+' y '+fDate(max));return false;}return true;}
function modalDatesOk(){return !Array.from(document.querySelectorAll('#modal-body input[type="date"]')).some(function(i){return !dateOk(i);});}

/* ===== año de trabajo (el año fiscal se puede fijar a mano en Configuración) ===== */
function anioActivo(){return +Store.data.anioFiscal||new Date().getFullYear();}
function yearSelect(sel,fn){var now=new Date().getFullYear(),min=Math.min(2024,sel,anioActivo()),max=Math.max(now+1,sel,anioActivo()),o='';for(var y=max;y>=min;y--)o+='<option'+(y===sel?' selected':'')+'>'+y+'</option>';return '<select class="ysel" title="Año" onchange="'+fn+'(+this.value)">'+o+'</select>';}

/* ===== edición directa en la tabla ===== */
function cellSet(col,id,f,v,re){var o=Store.get(col,id);if(!o)return;o[f]=v;Store.upsert(col,o);if(re)renderView(CUR);}
function cellIn(col,id,f,v,opt){opt=opt||{};var d=opt.type==='date';return '<input class="cell-in'+(opt.cls?' '+opt.cls:'')+'"'+(opt.type?' type="'+opt.type+'"':'')+(d?DR:'')+(opt.list?' list="'+opt.list+'" autocomplete="off"':'')+' value="'+esc(v||'')+'" placeholder="'+(opt.ph||'—')+'" onchange="'+(d?'if(dateOk(this))':'')+'cellSet(\''+col+'\',\''+id+'\',\''+f+'\',this.value,'+(opt.re?'true':'false')+')">';}

/* ===== clientes: autocompletar y vínculo con su ficha ===== */
// Si dos clientes tienen el mismo nombre (ej. el mismo contribuyente con dos aportaciones), se distinguen por su tipo: "Nombre (Rural)".
function cliLabel(c){if(!c)return '';var n=(c.nombre||'').trim().toLowerCase();var dup=c.tipo&&Store.all('clientes').some(function(x){return x!==c&&x.id!==c.id&&(x.nombre||'').trim().toLowerCase()===n;});return dup?c.nombre+' ('+c.tipo+')':c.nombre;}
function cliNameOr(id){var c=id&&Store.get('clientes',id);return c?cliLabel(c):'';}
function cliByName(n){n=(n||'').trim().toLowerCase();if(!n)return null;var cs=Store.all('clientes');return cs.find(function(c){return cliLabel(c).trim().toLowerCase()===n;})||cs.find(function(c){return (c.nombre||'').trim().toLowerCase()===n;})||null;}
// Devuelve el id del cliente con ese nombre. Si no existe, lo crea en Info. Clientes.
function ensureCli(nombre,tipo){nombre=(nombre||'').trim();if(!nombre)return '';var c=cliByName(nombre);if(c)return c.id;c=Store.upsert('clientes',{nombre:nombre,tipo:tipo||''});syncCliList();toast('✓ «'+nombre+'» se agregó a Info. Clientes');return c.id;}
function syncCliList(){var dl=document.getElementById('dl-clientes');if(!dl)return;dl.innerHTML=Store.all('clientes').filter(function(c){return !c.archivado;}).map(cliLabel).sort(function(a,b){return a.localeCompare(b);}).map(function(n){return '<option value="'+esc(n)+'">';}).join('');}
function cliLink(id,fallback){var c=id&&Store.get('clientes',id);if(!c)return '<span class="cli-name">'+esc(fallback||'—')+'</span>';return '<a class="cli-link" title="Ver la ficha del cliente" onclick="event.stopPropagation();goCli(\''+c.id+'\')">'+esc(cliLabel(c))+'</a>';}
function goCli(id){var c=Store.get('clientes',id);if(!c)return;_clarch=c.archivado?'arch':'act';_clq='';_clt='';cliView='panel';cliSel=id;switchView('clientes');}
function cliInput(v,onchange,ph){return '<input class="cell-in" list="dl-clientes" autocomplete="off" value="'+esc(v||'')+'" placeholder="'+(ph||'Escribí el nombre…')+'" onchange="'+onchange+'">';}

/* ===== globo de ayuda: cualquier elemento con data-tip muestra ese texto al pasar el mouse ===== */
(function(){var tip=null;document.addEventListener('mouseover',function(e){var el=e.target.closest?e.target.closest('[data-tip]'):null;if(!tip){tip=document.createElement('div');tip.className='tip';document.body.appendChild(tip);}if(!el){tip.classList.remove('show');return;}tip.textContent=el.getAttribute('data-tip');tip.classList.add('show');var r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;tip.style.left=Math.min(Math.max(8,r.left+r.width/2-tw/2),window.innerWidth-tw-8)+'px';tip.style.top=(r.top-th-8<8?r.bottom+8:r.top-th-8)+'px';});})();
