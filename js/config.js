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

/* ===== IMPUESTOS Y APORTES: cuáles le corresponden, cuándo vencen y cuánto ===== */
function vencCfgGrupo(gid,on){
  var c=vencCfg(), a=c.grupos.filter(function(x){ return x!==gid; });
  if(on)a.push(gid);
  c.grupos=a; Store.save(); renderConfig();
}
function vencPropioSet(gid,campo,valor){
  var p=vencPropios().find(function(x){ return x.id===gid; }); if(!p)return;
  p[campo]=(campo==='tipo')?valor:(+valor||0);
  Store.save(); renderConfig();
}
function vencPropioNuevo(){
  var c=vencCfg();
  c.propios.push({id:'p'+Date.now()+Math.floor(Math.random()*999),org:'',nombre:'Nuevo impuesto',
    tipo:'mensual',dia:0,mes:0,nota:''});
  Store.save(); renderConfig();
}
function vencPropioBorrar(gid){
  var p=vencPropios().find(function(x){ return x.id===gid; }); if(!p)return;
  if(!confirm('¿Sacar «'+(p.nombre||'este impuesto')+'» de la lista? Lo que ya registraste no se borra.'))return;
  var c=vencCfg();
  c.propios=c.propios.filter(function(x){ return x.id!==gid; });
  c.grupos=c.grupos.filter(function(x){ return x!==gid; });
  Store.save(); renderConfig(); toast('Sacado de la lista');
}
/* El nombre de los propios se escribe como «Organismo · Nombre» en un solo campo. */
function vencPropioRenombrar(gid,texto){
  var p=vencPropios().find(function(x){ return x.id===gid; }); if(!p)return;
  var partes=String(texto).split('·');
  if(partes.length>1){ p.org=partes.shift().trim(); p.nombre=partes.join('·').trim()||'Sin nombre'; }
  else { p.org=''; p.nombre=(texto||'').trim()||'Sin nombre'; }
  Store.save(); renderConfig();
}

function vencCfgCard(){
  var y=anioActivo(), c=vencCfg(), mios=c.grupos.length;
  var h='<div class="card"><div class="card-head"><h3>🏛 Mis impuestos y aportes</h3>'
    +'<span class="csub">'+mios+' marcado'+(mios===1?'':'s')+' · '+y+'</span></div><div class="card-body">';
  h+='<p class="muted-cell" style="font-size:13px;margin:2px 0 14px">Marcá <b>los que te corresponden a vos</b>. '
    +'Esos son los que aparecen en Impuestos, en los avisos y en el Panel. Los de DGI y BPS igual se siguen '
    +'viendo en el Calendario, porque te sirven para tus clientes.</p>';

  /* --- Bloque 1: las que ya traen el calendario --- */
  h+='<div class="venc-tit">Con el calendario del año ya cargado</div>';
  if(!vencHayAnio(y))
    h+='<div class="venc-aviso">Todavía no están las fechas de '+y+'. DGI y BPS publican el calendario del año '
      +'siguiente en diciembre; hasta entonces las podés cargar a mano.</div>';
  h+='<div class="venc-aviso">⚠ Estas fechas son una <b>ayuda</b>, no la fuente oficial: DGI las corrige durante '
    +'el año por resoluciones nuevas (en '+y+' ya cambió seis, marcadas con *). Revisalas y tocá «Sin revisar» '
    +'para dejarlas confirmadas. <a href="https://www.gub.uy/direccion-general-impositiva/" target="_blank" '
    +'rel="noopener">Ver el calendario en gub.uy →</a></div>';
  h+=VENC_GRUPOS.map(function(g){ return vencCfgFila(g,y); }).join('');

  /* --- Bloque 2: las que define ella --- */
  h+='<div class="venc-tit">Los tuyos · vos ponés cada cuánto vencen</div>';
  h+='<p class="muted-cell" style="font-size:12.5px;margin:0 0 10px">Estos no tienen un calendario que podamos '
    +'cargar: elegí cada cuánto vencen y qué día. Si es un importe fijo (como la Caja de Profesionales o el '
    +'Fondo de Solidaridad), cargalo una vez y se repite solo en cada período.</p>';
  h+=vencPropios().map(function(g){
    return vencCfgFila(Object.assign({corto:g.nombre,color:'var(--v-propio)',propio:true},g),y);
  }).join('');
  h+='<button class="btn btn-sm" style="margin-top:4px" onclick="vencPropioNuevo()">+ Agregar un impuesto o aporte</button>';

  h+='<hr style="border:none;border-top:1px solid var(--border-soft);margin:18px 0 12px">';
  h+='<label class="chkline"><input type="checkbox" onchange="vencToggleFeriados()" '+(c.feriados!==false?'checked':'')
    +'> Mostrar los feriados en el calendario</label>';
  h+='<div class="muted-cell" style="font-size:12px;margin-top:8px">Los feriados también salen de fuentes públicas '
    +'y algunas no coinciden en cuáles son laborables: revisalos antes de usarlos.</div>';
  return h+'</div></div>';
}

/* Una fila de la lista: el casillero, el nombre, y abajo las fechas (o los campos para definirlas). */
function vencCfgFila(g,y){
  var mio=vencEsMio(g.id), ok=vencConfirmado(g.id,y), imp=vencImporte(g.id);
  var h='<div class="venc-g'+(mio?' mio':'')+'">'
    +'<label class="venc-g-top"><input type="checkbox" '+(mio?'checked':'')+' onchange="vencCfgGrupo(\''+g.id+'\',this.checked)">'
    +'<i style="background:'+g.color+'"></i>';
  if(g.propio){
    h+='<input class="cell-in boxed venc-nom" value="'+esc(g.org?g.org+' · '+g.nombre:g.nombre)+'" '
      +'onclick="event.preventDefault();event.stopPropagation()" '
      +'onchange="vencPropioRenombrar(\''+g.id+'\',this.value)">'
      +'<button class="btn-ghost" title="Sacar de la lista" style="color:var(--red);margin-left:auto" '
      +'onclick="event.preventDefault();vencPropioBorrar(\''+g.id+'\')">🗑</button>';
  } else {
    h+='<b>'+esc(vencNombre(g))+'</b>'
      +'<span class="venc-ok'+(ok?' on':'')+'" onclick="event.preventDefault();vencConfirmar(\''+g.id+'\','+y+','+(!ok)+')">'
      +(ok?'✓ Revisado':'Sin revisar')+'</span>';
  }
  h+='</label>';
  if(g.nota)h+='<div class="venc-nota">'+esc(g.nota)+'</div>';

  if(g.propio){
    h+='<div class="venc-def">'
      +'<label><span>Vence</span><select onchange="vencPropioSet(\''+g.id+'\',\'tipo\',this.value)">'
      +Object.keys(VENC_TIPOS).map(function(t){ return '<option value="'+t+'"'+(g.tipo===t?' selected':'')+'>'+VENC_TIPOS[t]+'</option>'; }).join('')
      +'</select></label>'
      +(g.tipo!=='mensual'?'<label><span>'+(g.tipo==='anual'?'En el mes de':'A partir de')+'</span>'
        +'<select onchange="vencPropioSet(\''+g.id+'\',\'mes\',this.value)">'
        +MESES_L.map(function(n,i){ return '<option value="'+i+'"'+((+g.mes||0)===i?' selected':'')+'>'+n+'</option>'; }).join('')
        +'</select></label>':'')
      +'<label><span>Día</span><input type="number" min="1" max="31" value="'+(g.dia||'')+'" placeholder="—" '
      +'onchange="vencPropioSet(\''+g.id+'\',\'dia\',this.value)"></label>'
      +'<label><span>Importe fijo</span><input value="'+esc(numTxt(imp))+'" placeholder="opcional" '
      +'onchange="vencSetImporte(\''+g.id+'\',this.value);renderConfig()"></label>'
      +'</div>';
    if(g.dia)h+='<div class="venc-meses">'+vencMesesHtml(g,y)+'</div>';
    else if(mio)h+='<div class="venc-falta">Falta el día: hasta que lo pongas, no aparece en los avisos ni en el registro.</div>';
  } else {
    h+='<div class="venc-meses">'+vencMesesHtml(g,y)+'</div>';
  }
  return h+'</div>';
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
