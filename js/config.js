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
    +'<select class="ysel" onchange="cfgSetAnio(this.value)">'+yo+'</select></div></div></div>'+vencCfgCard();
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

/* ===== IMPUESTOS: cuáles le corresponden y corregir las fechas ===== */
/* Antes acá había un segundo grupo, «Aportes», donde ella definía obligaciones sin calendario
   (Caja de Profesionales, Fondo de Solidaridad…). Se sacó junto con los cuadros de Impuestos que
   las mostraban; está en el historial de Git por si se retoma. */
function vencCfgGrupo(gid,on){
  var c=vencCfg(), a=c.grupos.filter(function(x){ return x!==gid; });
  if(on)a.push(gid);
  c.grupos=a; Store.save(); renderConfig();
}

function vencCfgCard(){
  var y=anioActivo(), c=vencCfg(), mios=c.grupos.length;
  var h='<div class="card"><div class="card-head"><h3>🏛 Mis impuestos</h3>'
    +'<span class="csub">'+mios+' marcado'+(mios===1?'':'s')+' · '+y+'</span></div><div class="card-body">';
  h+='<p class="muted-cell" style="font-size:13px;margin:2px 0 14px">Tocá el grupo para abrirlo y marcá '
    +'<b>los que te corresponden a vos</b>. Esos son los que aparecen en los avisos y en el Panel. '
    +'Los de DGI y BPS igual se siguen viendo en el Calendario, porque te sirven para tus clientes.</p>';

  h+=vencCfgDesplegable('impuestos','🏛','Impuestos','DGI y BPS, con el calendario del año ya cargado',
      VENC_GRUPOS.map(function(g){ return vencCfgFila(g,y); }).join(''),
      VENC_GRUPOS.filter(function(g){ return vencEsMio(g.id); }).length, VENC_GRUPOS.length,
      '<div class="venc-aviso">⚠ Estas fechas son una <b>ayuda</b>, no la fuente oficial: DGI las corrige durante '
      +'el año por resoluciones nuevas (en '+y+' ya cambió seis, marcadas con *). Revisalas y tocá «Sin revisar» '
      +'para dejarlas confirmadas. <a href="https://www.gub.uy/direccion-general-impositiva/" target="_blank" '
      +'rel="noopener">Ver el calendario en gub.uy →</a></div>'
      +(vencHayAnio(y)?'':'<div class="venc-aviso">Todavía no están las fechas de '+y+'. DGI y BPS publican el '
        +'calendario del año siguiente en diciembre; hasta entonces las podés cargar a mano.</div>'));

  h+='<hr style="border:none;border-top:1px solid var(--border-soft);margin:18px 0 12px">';
  h+='<label class="chkline"><input type="checkbox" onchange="vencToggleFeriados()" '+(c.feriados!==false?'checked':'')
    +'> Mostrar los feriados en el calendario</label>';
  h+='<div class="muted-cell" style="font-size:12px;margin-top:8px">Los feriados también salen de fuentes públicas '
    +'y algunas no coinciden en cuáles son laborables: revisalos antes de usarlos.</div>';
  return h+'</div></div>';
}

/* El grupo se abre al tocarlo. Arranca cerrado, salvo que ella lo haya dejado abierto. */
function vencCfgDesplegable(id,ico,titulo,sub,contenido,marcados,total,intro){
  var abierto=(vencCfg().abiertos||[]).indexOf(id)>=0;
  return '<details class="venc-grupo"'+(abierto?' open':'')+' ontoggle="vencCfgAbrir(\''+id+'\',this.open)">'
    +'<summary><span class="vg-ico">'+ico+'</span><span class="vg-t"><b>'+titulo+'</b><span>'+esc(sub)+'</span></span>'
    +'<span class="vg-n'+(marcados?' on':'')+'">'+marcados+' de '+total+'</span></summary>'
    +'<div class="vg-body">'+(intro||'')+contenido+'</div></details>';
}
function vencCfgAbrir(id,abierto){
  var c=vencCfg();
  if(!Array.isArray(c.abiertos))c.abiertos=[];
  var i=c.abiertos.indexOf(id);
  if(abierto&&i<0)c.abiertos.push(id);
  if(!abierto&&i>=0)c.abiertos.splice(i,1);
  Store.save();
}

/* Una fila de la lista: el casillero, el nombre, y abajo las fechas del año. */
function vencCfgFila(g,y){
  var mio=vencEsMio(g.id), ok=vencConfirmado(g.id,y);
  return '<div class="venc-g'+(mio?' mio':'')+'">'
    +'<label class="venc-g-top"><input type="checkbox" '+(mio?'checked':'')+' onchange="vencCfgGrupo(\''+g.id+'\',this.checked)">'
    +'<i style="background:'+g.color+'"></i><b>'+esc(vencNombre(g))+'</b>'
    +'<span class="venc-ok'+(ok?' on':'')+'" onclick="event.preventDefault();vencConfirmar(\''+g.id+'\','+y+','+(!ok)+')">'
    +(ok?'✓ Revisado':'Sin revisar')+'</span></label>'
    +(g.nota?'<div class="venc-nota">'+esc(g.nota)+'</div>':'')
    +'<div class="venc-meses">'+vencMesesHtml(g,y)+'</div></div>';
}

function vencMesesHtml(g,y){
  var out='';
  for(var m=0;m<12;m++){
    var iso=vencFecha(g.id,y,m);
    var cambio=VENC_CAMBIOS[vencClave(g.id,y,m)];
    var mano=vencCfg().editadas[vencClave(g.id,y,m)];
    if(!iso&&g.tipo!=='mensual'&&!mano)continue;
    out+='<label class="venc-m'+(mano?' mano':'')+(cambio?' cambio':'')+'"'
      +(cambio?' data-tip="Fecha corregida por '+esc(cambio)+'"':'')+'>'
      +'<span>'+MESES[m].toUpperCase()+'</span>'
      +'<input type="date"'+DR+' value="'+(iso||'')+'" onchange="if(dateOk(this))vencSetFecha(\''+g.id+'\','+y+','+m+',this.value)"></label>';
  }
  return out||'<div class="muted-cell" style="font-size:12px">Sin fechas para '+y+'.</div>';
}
