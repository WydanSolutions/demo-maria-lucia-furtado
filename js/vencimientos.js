/*
 * Impuestos y aportes: cuáles le corresponden, cuándo vencen, y los feriados del año.
 * (La pantalla para configurarlos está en config.js.)
 *
 * Hay dos clases de obligación:
 *  1) LAS OFICIALES (VENC_GRUPOS): las de DGI y BPS, con el calendario del año ya cargado.
 *  2) LAS SUYAS (venc.propios): las que no tienen un calendario que podamos cargar (Caja de
 *     Profesionales, Fondo de Solidaridad, la DJ anual de IRPF, BPS de empresas…). Vienen con el
 *     nombre puesto, y ella define cada cuánto vencen y qué día. También puede agregar otras.
 * Todas arrancan APAGADAS salvo el IVA, que es el único que la página calcula sola: el resto
 * las marca ella (⋯ → Configuración).
 *
 * ⚠ Las fechas oficiales son una AYUDA, no la fuente oficial: DGI las corrige durante el año por
 * resoluciones nuevas (en 2026 cambió seis). Por eso cada fecha se puede cambiar a mano y cada
 * grupo se marca «Revisado» cuando ella lo confirma.
 * Tomadas el 30/09/2026 de la Resolución DGI 2284/025, del cuadro actualizado de gub.uy y de
 * bps.gub.uy (Servicios Personales).
 */

/* ===== 1) LAS QUE TIENEN CALENDARIO OFICIAL CARGADO ===== */
const VENC_GRUPOS=[
  {id:'dgi_sp',     org:'DGI', nombre:'IVA (Servicios Personales)', corto:'IVA Serv. Pers.', tipo:'bimestral', color:'var(--v-sp)',
   nota:'Pagos a cuenta de IVA, por el bimestre anterior. Es el único que la página calcula sola, con lo cargado en Honorarios y Gastos.'},
  {id:'dgi_irpf',   org:'DGI', nombre:'IRPF (Servicios Personales)', corto:'IRPF Serv. Pers.', tipo:'bimestral', color:'var(--v-irpf)',
   tablaDe:'dgi_sp',
   nota:'Los anticipos de IRPF vencen el mismo día que el IVA: DGI los pone en la misma línea. El importe lo ponés vos.'},
  {id:'dgi_cede',   org:'DGI', nombre:'CEDE',                 corto:'CEDE',             tipo:'mensual',   color:'var(--v-cede)',
   nota:'Una sola fecha para todos: no depende del último dígito del RUT.'},
  {id:'dgi_nocede', org:'DGI', nombre:'No CEDE',              corto:'No CEDE',          tipo:'mensual',   color:'var(--v-nocede)',
   nota:'Una sola fecha para todos: no depende del último dígito del RUT.'},
  {id:'dgi_ivamin', org:'DGI', nombre:'IVA mínimo · Pequeña empresa', corto:'IVA mínimo', tipo:'mensual', color:'var(--v-ivamin)',
   nota:'Literal E. Se paga por el mes anterior.'},
  {id:'bps_sp',     org:'BPS', nombre:'Servicios Personales', corto:'BPS Serv. Pers.',  tipo:'mensual',   color:'var(--v-bps)',
   nota:'Aportes y anticipos Fonasa, por el mes anterior. Solo si aportás a BPS: los profesionales universitarios independientes suelen aportar a la Caja de Profesionales.'},
];

/* ===== 2) LAS QUE DEFINE ELLA (vienen con el nombre puesto y sin fecha) ===== */
const VENC_PROPIOS_DEF=[
  {id:'p_cjppu',    org:'CJPPU', nombre:'Caja de Profesionales', tipo:'bimestral', dia:0, mes:0,
   nota:'Aporte jubilatorio de los profesionales universitarios independientes. Es un monto fijo según la categoría: cargalo acá abajo y se repite solo.'},
  {id:'p_fondo',    org:'Fondo de Solidaridad', nombre:'Aporte anual', tipo:'anual', dia:0, mes:0,
   nota:'Aporte anual de los egresados universitarios. Es un monto fijo en BPC.'},
  {id:'p_fondo_ad', org:'Fondo de Solidaridad', nombre:'Adicional', tipo:'anual', dia:0, mes:0,
   nota:'El adicional del Fondo de Solidaridad, si te corresponde.'},
  {id:'p_bps_emp',  org:'BPS', nombre:'Empresas (con empleados)', tipo:'mensual', dia:0,
   nota:'Solo si tenés empleados. La fecha depende del último dígito del número de empresa.'},
  {id:'p_irpf_dj',  org:'DGI', nombre:'IRPF · Declaración anual', tipo:'anual', dia:0, mes:6,
   nota:'La fecha depende del último dígito de la cédula: ponela vos.'},
  {id:'p_irae',     org:'DGI', nombre:'IRAE', tipo:'anual', dia:0, mes:0,
   nota:'Si alguna vez tributás por IRAE en lugar de IRPF.'},
];
const VENC_TIPOS={mensual:'Todos los meses',bimestral:'Cada dos meses',anual:'Una vez al año'};

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
  'dgi_ivamin|2026|5':'Res. 1412/2026','dgi_sp|2026|6':'Res. 1721/2026','dgi_irpf|2026|6':'Res. 1721/2026',
};
/* Qué período cubre cada pago bimestral (el mes en que vence → qué bimestre paga). */
const VENC_BIMESTRE={0:'Nov-Dic del año anterior',2:'Enero-Febrero',4:'Marzo-Abril',6:'Mayo-Junio',8:'Julio-Agosto',10:'Setiembre-Octubre'};

/* ===== FERIADOS ===== */
/* laboral:true = feriado laborable (se trabaja salvo que el empleador decida lo contrario).
   Las fuentes públicas no coinciden en algunos: por eso se pueden apagar. */
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
const VENC_CFG_DEF={grupos:['dgi_sp'],editadas:{},confirmadas:{},ocultas:[],importes:{},propios:[],abiertos:[],feriados:true,frecuencia:'bimestral'};
function vencCfg(){
  var d=Store.data;
  if(!d)return VENC_CFG_DEF; // todavía se están armando los datos
  if(!d.venc||typeof d.venc!=='object')d.venc={};
  // Solo el IVA viene marcado: es el que la página calcula sola. El resto lo elige ella.
  if(!Array.isArray(d.venc.grupos))d.venc.grupos=['dgi_sp'];
  if(!d.venc.editadas||typeof d.venc.editadas!=='object')d.venc.editadas={};
  if(!d.venc.confirmadas||typeof d.venc.confirmadas!=='object')d.venc.confirmadas={};
  if(!d.venc.importes||typeof d.venc.importes!=='object')d.venc.importes={};
  if(!Array.isArray(d.venc.ocultas))d.venc.ocultas=[];
  if(!Array.isArray(d.venc.abiertos))d.venc.abiertos=[];
  if(!Array.isArray(d.venc.propios))d.venc.propios=VENC_PROPIOS_DEF.map(function(p){ return Object.assign({},p); });
  if(d.venc.feriados!==false)d.venc.feriados=true;
  return d.venc;
}

/* Todas las obligaciones en una sola lista: las oficiales y las suyas. */
function vencPropios(){ return vencCfg().propios||[]; }
function vencGruposTodos(){
  return VENC_GRUPOS.concat(vencPropios().map(function(p){
    return Object.assign({corto:p.nombre,color:'var(--v-propio)',propio:true},p);
  }));
}
function vencGrupo(id){ return vencGruposTodos().find(function(g){ return g.id===id; })||null; }
function vencNombre(g){ return g.org+' · '+g.nombre; }

function vencEsMio(gid){ return vencCfg().grupos.indexOf(gid)>=0; }
function vencVisible(gid){ return vencCfg().ocultas.indexOf(gid)<0; }
function vencConfirmado(gid,y){ return vencCfg().confirmadas[gid+'|'+y]===true; }
function vencClave(gid,y,m){ return gid+'|'+y+'|'+m; }
/* Importe fijo que se repite (Caja de Profesionales, Fondo de Solidaridad…). */
function vencImporte(gid){ var v=vencCfg().importes[gid]; return v==null||v===''?null:v; }
function vencSetImporte(gid,v){ var n=honNum(v); var c=vencCfg(); if(n===null)delete c.importes[gid]; else c.importes[gid]=n; Store.save(); }

/* La fecha de un grupo en un mes: la que puso ella si la cambió, si no la que corresponda.
   Devuelve null si ese grupo no vence ese mes, o si todavía no tiene día definido. */
function vencFecha(gid,y,m){
  var mano=vencCfg().editadas[vencClave(gid,y,m)];
  if(mano==='')return null;              // la borró a propósito
  if(mano)return mano;
  var g=vencGrupo(gid); if(!g)return null;
  // Si el día no existe en ese mes (un 31 en febrero), va al último día.
  var armar=function(dia){ if(!dia)return null; var ult=new Date(y,m+1,0).getDate();
    return y+'-'+String(m+1).padStart(2,'0')+'-'+String(Math.min(dia,ult)).padStart(2,'0'); };

  if(g.propio){
    if(!g.dia)return null;                                      // todavía no puso el día
    if(g.tipo==='mensual')  return armar(g.dia);
    if(g.tipo==='bimestral')return (m%2===(+g.mes||0)%2)?armar(g.dia):null;
    return m===(+g.mes||0)?armar(g.dia):null;                   // anual
  }
  var t=VENC_TABLA[y]; if(!t)return null;
  var datos=t[g.tablaDe||gid]; if(!datos)return null;
  if(g.tipo==='bimestral'){
    var par=datos.find(function(p){ return p[0]===m; });
    return par?armar(par[1]):null;
  }
  return armar(datos[m]);
}
function vencSetFecha(gid,y,m,iso){ vencCfg().editadas[vencClave(gid,y,m)]=iso||''; Store.save(); }
function vencReset(gid,y,m){ delete vencCfg().editadas[vencClave(gid,y,m)]; Store.save(); }
function vencConfirmar(gid,y,on){ vencCfg().confirmadas[gid+'|'+y]=!!on; Store.save(); if(CUR==='config')renderConfig(); }
function vencHayAnio(y){ return !!VENC_TABLA[y]; }

/* Todos los vencimientos de un año, ordenados por fecha. */
function vencDelAnio(y,soloMios){
  var out=[];
  vencGruposTodos().forEach(function(g){
    if(soloMios&&!vencEsMio(g.id))return;
    for(var m=0;m<12;m++){
      var iso=vencFecha(g.id,y,m); if(!iso)continue;
      out.push({iso:iso,gid:g.id,grupo:g,mes:m,anio:y,mio:vencEsMio(g.id),
        periodo:vencPeriodo(g,m,y),cambio:VENC_CAMBIOS[vencClave(g.id,y,m)]||''});
    }
  });
  return out.sort(function(a,b){ return a.iso.localeCompare(b.iso); });
}
function vencPeriodo(g,m,y){
  if(g.tipo==='anual')return 'Año '+y;
  if(g.tipo==='bimestral')return VENC_BIMESTRE[m]||(MESES_L[(m+11)%12]+'-'+MESES_L[m]);
  return MESES_L[(m+11)%12];
}
function feriadosDelAnio(y){
  return (FERIADOS[y]||[]).map(function(x){ return {iso:y+'-'+x[0],nombre:x[1],laboral:x[2]}; });
}
/* Los próximos n vencimientos desde hoy. */
function vencProximos(n,soloMios){
  var hoy=today(), y=+hoy.slice(0,4), lista=vencDelAnio(y,soloMios).concat(vencDelAnio(y+1,soloMios));
  return lista.filter(function(v){ return v.iso>=hoy; }).slice(0,n||6);
}
function vencTexto(v){ return v.grupo.org+' · '+v.grupo.corto; }

/* ===== LA FILA DE COLORES ARRIBA DEL CALENDARIO ===== */
function calLeyendaVenc(){
  // Las obligaciones que definió ella solo aparecen si están marcadas: si no, la fila se llenaría
  // de cosas que no usa.
  var chips=vencGruposTodos().filter(function(g){ return !g.propio||vencEsMio(g.id); }).map(function(g){
      var on=vencVisible(g.id), mio=vencEsMio(g.id);
      return '<button class="vchip'+(on?'':' off')+(mio?' mio':'')+'" onclick="vencToggleGrupo(\''+g.id+'\')"'
        +' data-tip="'+esc(g.nota||'')+'"><i style="background:'+g.color+'"></i>'+(mio?'★ ':'')+esc(g.org+' · '+g.corto)+'</button>';
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
