/*
 * Vencimientos oficiales de DGI y BPS, y feriados del año.
 *
 * ⚠ IMPORTANTE: estas fechas son una AYUDA, no una fuente oficial. DGI las corrige durante el año
 * por resoluciones nuevas (en 2026 cambió seis: CEDE de abril, mayo y junio, y No CEDE de febrero,
 * julio y agosto). Por eso:
 *   - cada fecha se puede cambiar a mano y queda guardada (Store.data.venc.editadas);
 *   - cada grupo se marca como «revisado» cuando la contadora lo confirma (venc.confirmadas);
 *   - mientras no esté revisado, la página avisa que hay que confirmarlo en gub.uy.
 * Tomadas el 30/09/2026 de la Resolución DGI 2284/025 y del cuadro actualizado de gub.uy, y de
 * bps.gub.uy para Servicios Personales.
 */

/* ===== GRUPOS DE VENCIMIENTOS ===== */
const VENC_GRUPOS=[
  {id:'dgi_sp',     org:'DGI', nombre:'Servicios Personales', corto:'Serv. Personales', tipo:'bimestral', color:'var(--v-sp)',
   nota:'Pagos a cuenta de IVA e IRPF. Vence cada dos meses, por el bimestre anterior.'},
  {id:'dgi_cede',   org:'DGI', nombre:'CEDE',                 corto:'CEDE',             tipo:'mensual',   color:'var(--v-cede)',
   nota:'Una sola fecha para todos: no depende del último dígito del RUT.'},
  {id:'dgi_nocede', org:'DGI', nombre:'No CEDE',              corto:'No CEDE',          tipo:'mensual',   color:'var(--v-nocede)',
   nota:'Una sola fecha para todos: no depende del último dígito del RUT.'},
  {id:'dgi_ivamin', org:'DGI', nombre:'IVA mínimo · Pequeña empresa', corto:'IVA mínimo', tipo:'mensual', color:'var(--v-ivamin)',
   nota:'Literal E. Se paga por el mes anterior.'},
  {id:'bps_sp',     org:'BPS', nombre:'Servicios Personales', corto:'BPS Serv. Pers.',  tipo:'mensual',   color:'var(--v-bps)',
   nota:'Aportes y anticipos Fonasa, por el mes anterior. Para EMPRESAS la fecha depende del último dígito del número de empresa: esas las cargás vos.'},
];
function vencGrupo(id){ return VENC_GRUPOS.find(function(g){ return g.id===id; })||null; }

/* Los días de cada mes, por año y por grupo. Los meses van de 0 (enero) a 11 (diciembre).
   En los bimestrales solo hay pago en los meses de la lista: [mes, día]. */
const VENC_TABLA={
  2026:{
    dgi_cede:  [22,23,23,23,25,23,22,24,22,22,23,22],
    dgi_nocede:[26,25,25,27,25,25,28,27,25,26,25,28],
    dgi_ivamin:[20,20,20,20,20,23,20,20,21,20,20,21],
    bps_sp:    [26,24,25,24,25,24,27,24,25,26,25,23],
    dgi_sp:    [[0,26],[2,25],[4,25],[6,28],[8,25],[10,25]],
  }
};
/* Las fechas que DGI cambió después de la resolución original: se muestran como aviso. */
const VENC_CAMBIOS={
  'dgi_cede|2026|3':'Res. 956/2026',  'dgi_cede|2026|4':'Res. 1168/2026', 'dgi_cede|2026|5':'Res. 1412/2026',
  'dgi_nocede|2026|1':'Res. 631/2026','dgi_nocede|2026|6':'Res. 1721/2026','dgi_nocede|2026|7':'Res. 1912/2026',
  'dgi_ivamin|2026|5':'Res. 1412/2026','dgi_sp|2026|6':'Res. 1721/2026',
};
/* Qué período cubre cada pago bimestral de Servicios Personales (el mes en que vence → qué bimestre paga). */
const VENC_BIMESTRE={0:'Nov-Dic del año anterior',2:'Enero-Febrero',4:'Marzo-Abril',6:'Mayo-Junio',8:'Julio-Agosto',10:'Setiembre-Octubre'};

/* ===== FERIADOS ===== */
/* laboral:true = feriado laborable (se trabaja salvo que el empleador decida lo contrario).
   Las fuentes no coinciden en algunos: por eso también se pueden corregir. */
const FERIADOS={
  2026:[
    ['01-01','Año Nuevo',false],              ['01-06','Día de Reyes',true],
    ['02-16','Carnaval',true],                ['02-17','Carnaval',true],
    ['04-02','Jueves de Turismo',true],       ['04-03','Viernes de Turismo',true],
    ['04-19','Desembarco de los 33 Orientales',true],
    ['05-01','Día de los Trabajadores',false],['05-18','Batalla de Las Piedras',true],
    ['06-19','Natalicio de Artigas',true],    ['07-18','Jura de la Constitución',false],
    ['08-25','Declaratoria de la Independencia',false],
    ['10-12','Día de la Diversidad Cultural',true], ['11-02','Día de los Difuntos',true],
    ['12-25','Navidad · Día de la Familia',false],
  ]
};

/* ===== CONFIGURACIÓN DE LA USUARIA ===== */
const VENC_CFG_DEF={grupos:['dgi_sp','bps_sp'],editadas:{},confirmadas:{},ocultas:[],feriados:true};
function vencCfg(){
  var d=Store.data;
  if(!d)return VENC_CFG_DEF; // todavía se están armando los datos
  if(!d.venc||typeof d.venc!=='object')d.venc={};
  if(!Array.isArray(d.venc.grupos))d.venc.grupos=['dgi_sp','bps_sp'];
  if(!d.venc.editadas||typeof d.venc.editadas!=='object')d.venc.editadas={};
  if(!d.venc.confirmadas||typeof d.venc.confirmadas!=='object')d.venc.confirmadas={};
  if(!Array.isArray(d.venc.ocultas))d.venc.ocultas=[];
  if(d.venc.feriados!==false)d.venc.feriados=true;
  return d.venc;
}
function vencEsMio(gid){ return vencCfg().grupos.indexOf(gid)>=0; }
function vencVisible(gid){ return vencCfg().ocultas.indexOf(gid)<0; }
function vencConfirmado(gid,y){ return vencCfg().confirmadas[gid+'|'+y]===true; }
function vencClave(gid,y,m){ return gid+'|'+y+'|'+m; }

/* La fecha de un grupo en un mes: la que puso ella si la cambió, si no la de la tabla.
   Devuelve null si ese grupo no vence ese mes (por ejemplo, un bimestral en un mes sin pago). */
function vencFecha(gid,y,m){
  var mano=vencCfg().editadas[vencClave(gid,y,m)];
  if(mano==='')return null;              // la borró a propósito
  if(mano)return mano;
  var t=VENC_TABLA[y]; if(!t||!t[gid])return null;
  var g=vencGrupo(gid);
  if(g&&g.tipo==='bimestral'){
    var par=t[gid].find(function(p){ return p[0]===m; });
    return par?y+'-'+String(m+1).padStart(2,'0')+'-'+String(par[1]).padStart(2,'0'):null;
  }
  var dia=t[gid][m];
  return dia?y+'-'+String(m+1).padStart(2,'0')+'-'+String(dia).padStart(2,'0'):null;
}
function vencSetFecha(gid,y,m,iso){ vencCfg().editadas[vencClave(gid,y,m)]=iso||''; Store.save(); }
function vencReset(gid,y,m){ delete vencCfg().editadas[vencClave(gid,y,m)]; Store.save(); }
function vencConfirmar(gid,y,on){ vencCfg().confirmadas[gid+'|'+y]=!!on; Store.save(); if(typeof renderConfig==='function'&&CUR==='config')renderConfig(); }
function vencHayAnio(y){ return !!VENC_TABLA[y]; }

/* Todos los vencimientos de un año, ya ordenados. Cada uno: fecha, grupo, si le corresponde a ella. */
function vencDelAnio(y,soloMios){
  var out=[];
  VENC_GRUPOS.forEach(function(g){
    if(soloMios&&!vencEsMio(g.id))return;
    for(var m=0;m<12;m++){
      var iso=vencFecha(g.id,y,m); if(!iso)continue;
      out.push({iso:iso,gid:g.id,grupo:g,mes:m,anio:y,mio:vencEsMio(g.id),
        periodo:g.tipo==='bimestral'?VENC_BIMESTRE[m]:MESES_L[(m+11)%12],
        cambio:VENC_CAMBIOS[vencClave(g.id,y,m)]||''});
    }
  });
  return out.sort(function(a,b){ return a.iso.localeCompare(b.iso); });
}
function feriadosDelAnio(y){
  var f=FERIADOS[y]||[];
  return f.map(function(x){ return {iso:y+'-'+x[0],nombre:x[1],laboral:x[2]}; });
}
/* Los próximos n vencimientos desde hoy (los de ella primero si se piden solo los suyos). */
function vencProximos(n,soloMios){
  var hoy=today(), y=+hoy.slice(0,4), lista=vencDelAnio(y,soloMios).concat(vencDelAnio(y+1,soloMios));
  return lista.filter(function(v){ return v.iso>=hoy; }).slice(0,n||6);
}
/* Etiqueta corta para el calendario y el Panel. */
function vencTexto(v){ return v.grupo.org+' · '+v.grupo.corto; }

/* ===== LA FILA DE COLORES ARRIBA DEL CALENDARIO ===== */
/* Cada grupo es una pastilla: tocándola se apaga o se prende en el calendario.
   Los que le corresponden a ella llevan una estrella. */
function calLeyendaVenc(){
  var chips=VENC_GRUPOS.map(function(g){
    var on=vencVisible(g.id), mio=vencEsMio(g.id);
    return '<button class="vchip'+(on?'':' off')+(mio?' mio':'')+'" onclick="vencToggleGrupo(\''+g.id+'\')"'
      +' data-tip="'+esc(g.nota)+'"><i style="background:'+g.color+'"></i>'+(mio?'★ ':'')+esc(g.org+' · '+g.corto)+'</button>';
  }).join('');
  var fer=vencCfg().feriados!==false;
  chips+='<button class="vchip'+(fer?'':' off')+'" onclick="vencToggleFeriados()"><i style="background:var(--v-feriado)"></i>Feriados</button>';
  return '<div class="vleyenda">'+chips+'<span class="vleyenda-n">★ son los tuyos · tocá una para mostrarla u ocultarla</span></div>';
}
function vencToggleGrupo(gid){
  var c=vencCfg(), i=c.ocultas.indexOf(gid);
  if(i>=0)c.ocultas.splice(i,1); else c.ocultas.push(gid);
  Store.save(); calRefresh();
}
function vencToggleFeriados(){ var c=vencCfg(); c.feriados=c.feriados===false; Store.save(); calRefresh(); }

/* ===== CONFIGURACIÓN: cuáles le corresponden y corregir las fechas ===== */
function vencCfgGrupo(gid,on){
  var c=vencCfg(), a=c.grupos.filter(function(x){ return x!==gid; });
  if(on)a.push(gid);
  c.grupos=a; Store.save(); renderConfig();
}
function vencCfgCard(){
  var y=anioActivo(), c=vencCfg();
  var h='<div class="card"><div class="card-head"><h3>🏛 Vencimientos de DGI y BPS</h3><span class="csub">'+y+'</span></div><div class="card-body">';
  if(!vencHayAnio(y)){
    h+='<div class="venc-aviso">Todavía no están cargadas las fechas de '+y+'. DGI y BPS publican el calendario del año siguiente en diciembre. '
      +'Podés cargarlas a mano tocando cada fecha cuando salgan.</div>';
  }
  h+='<div class="venc-aviso">⚠ Estas fechas son una <b>ayuda</b>, no la fuente oficial: DGI las corrige durante el año por resoluciones nuevas '
    +'(en '+y+' ya cambió seis). Revisalas y marcá «Revisado» para que deje de avisarte. '
    +'<a href="https://www.gub.uy/direccion-general-impositiva/" target="_blank" rel="noopener">Ver el calendario en gub.uy →</a></div>';
  h+='<p class="muted-cell" style="font-size:13px;margin:14px 0 8px">Marcá <b>cuáles te corresponden a vos</b>. Esos son los que aparecen en Impuestos y en el Panel; el resto igual se ve en el Calendario.</p>';
  h+=VENC_GRUPOS.map(function(g){
    var mio=vencEsMio(g.id), ok=vencConfirmado(g.id,y);
    return '<div class="venc-g'+(mio?' mio':'')+'">'
      +'<label class="venc-g-top"><input type="checkbox" '+(mio?'checked':'')+' onchange="vencCfgGrupo(\''+g.id+'\',this.checked)">'
      +'<i style="background:'+g.color+'"></i><b>'+esc(g.org+' · '+g.nombre)+'</b>'
      +'<span class="venc-ok'+(ok?' on':'')+'" onclick="event.preventDefault();vencConfirmar(\''+g.id+'\','+y+','+(!ok)+')">'+(ok?'✓ Revisado':'Sin revisar')+'</span></label>'
      +'<div class="venc-nota">'+esc(g.nota)+'</div>'
      +'<div class="venc-meses">'+vencMesesHtml(g,y)+'</div></div>';
  }).join('');
  h+='<label class="chkline" style="margin-top:14px"><input type="checkbox" onchange="vencToggleFeriados()" '+(c.feriados!==false?'checked':'')+'> Mostrar los feriados en el calendario</label>';
  h+='<div class="muted-cell" style="font-size:12px;margin-top:8px">Los feriados también se toman de fuentes públicas y algunas no coinciden en cuáles son laborables: revisalos antes de usarlos.</div>';
  return h+'</div></div>';
}
function vencMesesHtml(g,y){
  var out='';
  for(var m=0;m<12;m++){
    var iso=vencFecha(g.id,y,m);
    var cambio=VENC_CAMBIOS[vencClave(g.id,y,m)];
    var mano=vencCfg().editadas[vencClave(g.id,y,m)];
    if(!iso&&g.tipo==='bimestral'&&!mano)continue;
    out+='<label class="venc-m'+(mano?' mano':'')+(cambio?' cambio':'')+'"'+(cambio?' data-tip="Fecha corregida por '+esc(cambio)+'"':'')+'>'
      +'<span>'+MESES[m].toUpperCase()+'</span>'
      +'<input type="date"'+DR+' value="'+(iso||'')+'" onchange="if(dateOk(this))vencSetFecha(\''+g.id+'\','+y+','+m+',this.value)"></label>';
  }
  return out||'<div class="muted-cell" style="font-size:12px">Sin fechas cargadas para '+y+'.</div>';
}
