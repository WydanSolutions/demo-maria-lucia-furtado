/*
 * Configuración (se abre desde ⋯ arriba a la derecha): sincronización con Google Calendar y año fiscal.
 */
/* ===== CONFIG ===== */
function renderConfig(){
  const g=Store.data.gcal||{}, anio=+Store.data.anioFiscal||0, now=new Date().getFullYear();
  let yo='<option value="">Automático ('+now+')</option>';for(let y=now+2;y>=2024;y--)yo+='<option'+(y===anio?' selected':'')+'>'+y+'</option>';
  let h='<div class="view-head"><div><h2>⚙ Configuración</h2><div class="sub">Opciones generales de la página</div></div></div>';
  h+='<div class="gridw" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr))">'
    +'<div class="card"><div class="card-head"><h3>📅 Sincronización con Google Calendar</h3></div><div class="card-body">'
    +'<p class="muted-cell" style="font-size:13px;margin:6px 0 14px">Los eventos que crees en tu Google Calendar van a aparecer en el Calendario de esta página. Pegá la <b>URL secreta en formato iCal</b> de tu calendario.</p>'
    +'<div class="field"><label>URL iCal de Google Calendar</label><input id="gcal-url" value="'+esc(g.url||'')+'" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autocomplete="off"></div>'
    +'<label class="chkline" style="margin-bottom:14px"><input type="checkbox" id="gcal-auto" '+(g.auto!==false?'checked':'')+'> Sincronizar automáticamente cada 15 minutos</label>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-primary" onclick="gcalGuardar()">💾 Guardar</button><button class="btn btn-sm" onclick="gcalSync(true)">🔄 Sincronizar ahora</button><button class="btn btn-sm" onclick="gcalAyuda()">❓ Cómo obtener la URL</button></div>'
    +'<div class="muted-cell" style="font-size:12px;margin-top:12px">Última sincronización: <b>'+(g.last?new Date(g.last).toLocaleString('es-UY'):'nunca')+'</b></div>'
    +(g.msg?'<div style="font-size:12px;margin-top:6px;color:var(--amber)">'+esc(g.msg)+'</div>':'')
    +'</div></div>'
    +'<div class="card"><div class="card-head"><h3>🗓 Año fiscal</h3></div><div class="card-body">'
    +'<p class="muted-cell" style="font-size:13px;margin:6px 0 12px">Es el año que se abre por defecto en Declaraciones, Sueldos, Honorarios, Empresas y el Panel. En "Automático" se usa el año actual.</p>'
    +'<select class="ysel" onchange="cfgSetAnio(this.value)">'+yo+'</select></div></div></div>';
  $('#view-config').innerHTML=h;
}
function cfgSetAnio(v){ Store.data.anioFiscal=v?+v:''; Store.save(); declAnio=null; honAnio=null; sldAnio=anioActivo(); toast(v?'Año fiscal: '+v:'Año fiscal automático'); renderConfig(); }

/* ===== Google Calendar (lectura del calendario en formato iCal) ===== */
var _gcalTimer=null;
function gcalGuardar(){
  const url=($('#gcal-url').value||'').trim();
  if(url&&!/^https:\/\/calendar\.google\.com\/calendar\/ical\//.test(url)){toast('Esa no parece una URL iCal de Google Calendar');return;}
  Store.data.gcal.url=url; Store.data.gcal.auto=$('#gcal-auto').checked; Store.data.gcal.msg=''; Store.save(); gcalProgramar(); toast('Configuración guardada');
  if(url)gcalSync(true); else renderConfig();
}
function gcalProgramar(){ clearInterval(_gcalTimer); const g=Store.data.gcal; if(g&&g.url&&g.auto!==false)_gcalTimer=setInterval(function(){gcalSync(false);},15*60*1000); }
function gcalSync(manual){
  const g=Store.data.gcal; if(!g||!g.url){ if(manual)toast('Primero pegá la URL y tocá Guardar'); return; }
  // En la página conectada, el calendario lo lee un proceso automático de Wydan (Google Apps Script):
  // el navegador solo no puede, Google lo bloquea.
  fetch(g.url).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}).then(function(txt){
    const evs=parseIcs(txt); Store.data.gcalEvents=evs; g.last=Date.now(); g.msg=''; Store.save();
    if(manual)toast('✓ '+evs.length+' eventos de Google Calendar'); if(CUR==='config')renderConfig(); if(CUR==='cal'||CUR==='panel')calRefresh();
  }).catch(function(){
    // Google no deja que una página lea el calendario directamente desde el navegador.
    g.msg='Todavía no se puede leer el calendario desde esta versión de prueba: Google lo bloquea si se pide directo desde el navegador. Se activa cuando la página esté publicada y conectada.';
    Store.save(); if(manual)toast('No se pudo sincronizar todavía'); if(CUR==='config')renderConfig();
  });
}
// Lee el archivo iCal y devuelve [{fecha:'AAAA-MM-DD', titulo}] (eventos de día completo o con hora).
function parseIcs(txt){ const out=[]; txt=txt.replace(/\r?\n[ \t]/g,''); txt.split('BEGIN:VEVENT').slice(1).forEach(function(b){ const d=(b.match(/\nDTSTART[^:]*:(\d{8})/)||[])[1]; if(!d)return; const s=((b.match(/\nSUMMARY[^:]*:(.*)/)||[])[1]||'(sin título)').replace(/\\,/g,',').replace(/\\n/g,' ').trim(); out.push({fecha:d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8),titulo:s}); }); return out; }
function gcalAyuda(){ curForm={form:'noop'}; $('#modal-title').textContent='Cómo obtener la URL iCal'; $('#modal-del').style.display='none';
  $('#modal-body').innerHTML='<ol style="padding-left:18px;line-height:1.9;font-size:13.5px"><li>Abrí <b>Google Calendar</b> en la computadora.</li><li>A la izquierda, pasá el mouse sobre tu calendario → <b>⋮</b> → <b>Configuración y uso compartido</b>.</li><li>Bajá hasta <b>Integrar el calendario</b>.</li><li>Copiá la <b>Dirección secreta en formato iCal</b>.</li><li>Pegala acá y tocá <b>Guardar</b>.</li></ol><div class="muted-cell" style="font-size:12px;margin-top:10px">⚠ Esa dirección es secreta: quien la tenga puede ver tu calendario. No la compartas por mail ni en capturas.</div>';
  $('#modal').classList.add('open'); }
