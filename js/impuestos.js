/*
 * Subpestaña: Impuestos (dentro de Finanzas).
 *  - Calcula el IVA mes a mes: el IVA de lo FACTURADO en Honorarios menos el IVA deducible de Gastos.
 *  - Una calculadora chica de IVA, para cuentas sueltas.
 *  - El registro de lo que dio a pagar cada período: cuánto, cuándo vence, si se pagó y con qué comprobante.
 * Las fechas de vencimiento salen de vencimientos.js (y se pueden corregir a mano desde Configuración).
 */
/* ===== IMPUESTOS ===== */
var impAnio=null, impCalcBase='', impCalcModo='mas';
const IMP_IVA=0.22;

function impYear(){ return impAnio||anioActivo(); }
function setImpAnio(y){ impAnio=y; renderImpuestos(); }
function impFrecuencia(){ return vencCfg().frecuencia==='bimestral'?'bimestral':'mensual'; }
function setImpFrecuencia(f){ vencCfg().frecuencia=f; Store.save(); renderImpuestos(); }

/* ===== EL CÁLCULO ===== */
// IVA de lo facturado en Honorarios (honCalc ya lo cobra solo cuando la fila tiene N° de factura).
function impIvaVentas(y,m){
  var t=0;
  honRows().forEach(function(r){ var c=honCalc(r,y,m); if(c.imp!==null)t+=c.iva||0; });
  return Math.round(t*100)/100;
}
// IVA deducible de los gastos del mes (ya contempla el 50% cuando corresponde).
function impIvaCompras(y,m){ return Math.round(gstIvaDelMes(y,m).ded*100)/100; }

// Los períodos del año, según trabaje mensual o bimestral.
function impPeriodos(y){
  var out=[];
  if(impFrecuencia()==='bimestral'){
    for(var i=0;i<6;i++){ var a=i*2; out.push({meses:[a,a+1],label:MESES_L[a]+'-'+MESES_L[a+1],mesFin:a+1}); }
  } else {
    for(var m=0;m<12;m++) out.push({meses:[m],label:MESES_L[m],mesFin:m});
  }
  return out.map(function(p){
    var v=0,c=0;
    p.meses.forEach(function(m){ v+=impIvaVentas(y,m); c+=impIvaCompras(y,m); });
    p.ventas=Math.round(v*100)/100; p.compras=Math.round(c*100)/100;
    p.pagar=Math.round((v-c)*100)/100;
    return p;
  });
}

/* ===== EL REGISTRO ===== */
function impRegistro(y){ return Store.all('impuestos').filter(function(x){ return x.anio===y; })
  .sort(function(a,b){ return (a.venc||'').localeCompare(b.venc||''); }); }
function impEstado(x){ return x.pagado?'pag':(x.venc&&daysTo(x.venc)<0?'venc':'pen'); }
const IMP_EST={pag:'Pagado',pen:'Pendiente',venc:'Vencido'};
function impVencidos(){ return Store.all('impuestos').filter(function(x){ return impEstado(x)==='venc'; }); }

function impSet(id,f,v){ var x=Store.get('impuestos',id); if(!x)return; x[f]=v; Store.upsert('impuestos',x); impRefrescar(); }
function impTogglePago(id){
  var x=Store.get('impuestos',id); if(!x)return;
  x.pagado=!x.pagado; if(x.pagado&&!x.fechaPago)x.fechaPago=today(); if(!x.pagado)x.fechaPago='';
  Store.upsert('impuestos',x); renderImpuestos();
}
function impBorrar(id){
  var x=Store.get('impuestos',id); if(!x)return;
  if(!confirm('¿Borrar «'+(x.concepto||'este registro')+'» de '+(x.periodo||'')+'?'))return;
  Store.remove('impuestos',id); renderImpuestos(); toast('Borrado');
}
function impRefrescar(){ var k=document.getElementById('imp-kpis'); if(k)k.innerHTML=impKpisHtml(impYear()); }

// Crea las filas del año con los vencimientos de los grupos que le corresponden (sin repetir).
function impTraerVencimientos(){
  var y=impYear(), lista=vencDelAnio(y,true), nuevos=0;
  if(!lista.length){ toast('Primero elegí tus vencimientos en Configuración'); return; }
  lista.forEach(function(v){
    var ya=Store.all('impuestos').some(function(x){ return x.anio===y&&x.mes===v.mes&&x.gid===v.gid; });
    if(ya)return;
    Store.data.impuestos.push({id:'i'+Date.now()+Math.floor(Math.random()*9999),anio:y,mes:v.mes,gid:v.gid,
      concepto:v.grupo.org+' · '+v.grupo.nombre,periodo:v.periodo,importe:'',venc:v.iso,
      pagado:false,fechaPago:'',comprobante:'',notas:''});
    nuevos++;
  });
  Store.save(); renderImpuestos();
  toast(nuevos?('✓ '+nuevos+' vencimiento'+(nuevos===1?'':'s')+' agregado'+(nuevos===1?'':'s')):'Ya estaban todos cargados');
}

/* ===== LA PANTALLA ===== */
function renderImpuestos(){
  var y=impYear();
  var h='<div class="view-head"><div><h2>Impuestos <span style="color:var(--muted);font-weight:400">'+y+'</span></h2>'
    +'<div class="sub">El IVA de lo que facturaste, menos el de tus gastos</div></div>'
    +'<span class="sld-top">'+yearSelect(y,'setImpAnio')
    +'<span class="gseg"><button class="gv'+(impFrecuencia()==='mensual'?' active':'')+'" onclick="setImpFrecuencia(\'mensual\')">Mensual</button>'
    +'<button class="gv'+(impFrecuencia()==='bimestral'?' active':'')+'" onclick="setImpFrecuencia(\'bimestral\')">Bimestral</button></span>'
    +expBtns('imp')+'<button class="btn btn-sm btn-primary" onclick="impForm()">+ Registro</button></span></div>';

  h+='<div id="imp-kpis">'+impKpisHtml(y)+'</div>';
  h+='<div class="imp-cols">'+impTablaIva(y)+impCalculadora()+'</div>';
  h+=impProximos();
  h+=impTablaRegistro(y);
  h+='<div class="hon-foot">💡 El IVA de ventas sale de Honorarios y solo cuenta las filas que tienen <b>N° de factura</b>. '
    +'El de compras sale de Gastos y ya contempla el 50% cuando corresponde. Las fechas de vencimiento se cambian en '
    +'<b>⋯ → Configuración → Vencimientos</b>.</div>';
  $('#view-imp').innerHTML=h;
  impCalcPintar(); // el desglose de la calculadora, ya con lo que estuviera escrito
}

// Plata con el signo delante, para que un número a favor se lea claro.
function impMoney(n){ return n<0 ? '− '+money(Math.abs(n)) : money(n); }
function impKpisHtml(y){
  var per=impPeriodos(y), v=0,c=0;
  per.forEach(function(p){ v+=p.ventas; c+=p.compras; });
  var reg=impRegistro(y), pend=reg.filter(function(x){ return !x.pagado; });
  var debe=pend.reduce(function(a,x){ return a+(honNum(x.importe)||0); },0);
  var venc=reg.filter(function(x){ return impEstado(x)==='venc'; }).length;
  return '<div class="kpis kpis-4">'
    +kpiM('IVA facturado · '+y,money(v),'de los honorarios con factura','')
    +kpiM('IVA de gastos',money(c),'deducible','k-green')
    +kpiM('Diferencia del año',impMoney(Math.round((v-c)*100)/100),(v-c)>=0?'a pagar':'a favor',(v-c)>=0?'':'k-green')
    +kpiM('Sin pagar',money(debe),venc?(venc+' vencido'+(venc===1?'':'s')):(pend.length+' registro'+(pend.length===1?'':'s')),venc?'k-alerta':'k-amber')
    +'</div>';
}

function impTablaIva(y){
  var per=impPeriodos(y), tv=0,tc=0;
  var filas=per.map(function(p){
    tv+=p.ventas; tc+=p.compras;
    var hay=p.ventas||p.compras;
    return '<tr'+(hay?'':' class="imp-vacio"')+'><td>'+p.label+'</td>'
      +'<td class="num">'+(p.ventas?money(p.ventas):'—')+'</td>'
      +'<td class="num">'+(p.compras?money(p.compras):'—')+'</td>'
      +'<td class="num"><b class="'+(p.pagar<0?'imp-favor':'')+'">'+(hay?impMoney(p.pagar):'—')+'</b></td></tr>';
  }).join('');
  var tot=Math.round((tv-tc)*100)/100;
  return '<div class="card"><div class="card-head"><h3>IVA período por período</h3><span class="csub">'+(impFrecuencia()==='bimestral'?'Bimestral':'Mensual')+'</span></div>'
    +'<div class="table-wrap" style="border:none;box-shadow:none;border-radius:0">'
    +'<table class="t-mini"><thead><tr><th>Período</th><th class="num">IVA facturado</th><th class="num">IVA de gastos</th><th class="num">A pagar</th></tr></thead>'
    +'<tbody>'+filas+'<tr class="gst-tot"><td>TOTAL '+y+'</td><td class="num">'+money(tv)+'</td><td class="num">'+money(tc)+'</td>'
    +'<td class="num"><b class="'+(tot<0?'imp-favor':'')+'">'+impMoney(tot)+'</b></td></tr></tbody></table></div></div>';
}

/* Calculadora suelta: escribís un monto y te muestra neto, IVA y total. */
function impCalcSet(v){ impCalcBase=v; impCalcPintar(); }
function impCalcModoSet(m){ impCalcModo=m; renderImpuestos(); }
function impCalcPintar(){
  var el=document.getElementById('imp-calc-out'); if(!el)return;
  var n=honNum(impCalcBase);
  if(n===null){ el.innerHTML='<div class="muted-cell" style="font-size:13px">Escribí un importe para ver el desglose.</div>'; return; }
  var neto,iva,total;
  if(impCalcModo==='mas'){ neto=n; iva=Math.round(n*IMP_IVA*100)/100; total=Math.round((neto+iva)*100)/100; }
  else { total=n; neto=Math.round(n/(1+IMP_IVA)*100)/100; iva=Math.round((total-neto)*100)/100; }
  el.innerHTML='<div class="gd-row"><span>Neto (sin IVA)</span><b>'+money(neto)+'</b></div>'
    +'<div class="gd-row"><span>IVA 22%</span><b>'+money(iva)+'</b></div>'
    +'<div class="gd-row gd-tot"><span>Total con IVA</span><b>'+money(total)+'</b></div>';
}
function impCalculadora(){
  return '<div class="card"><div class="card-head"><h3>Calculadora de IVA</h3></div><div class="card-body">'
    +'<div class="gst-forma gseg" style="width:100%;margin-bottom:12px">'
    +'<button class="gv'+(impCalcModo==='mas'?' active':'')+'" onclick="impCalcModoSet(\'mas\')">Es el neto · sumar IVA</button>'
    +'<button class="gv'+(impCalcModo==='incluido'?' active':'')+'" onclick="impCalcModoSet(\'incluido\')">Es el total · sacar IVA</button></div>'
    +'<div class="field"><input id="imp-calc" value="'+esc(impCalcBase)+'" placeholder="Ej: 10.000" oninput="impCalcSet(this.value)" inputmode="decimal"></div>'
    +'<div class="gst-desglose" id="imp-calc-out"></div></div></div>';
}

function impProximos(){
  var lista=vencProximos(4,true);
  if(!lista.length)return '';
  return '<div class="card" style="margin-bottom:18px"><div class="card-head"><h3>Tus próximos vencimientos</h3>'
    +'<button class="btn btn-sm" onclick="impTraerVencimientos()">📥 Traer los del año al registro</button></div><div class="card-body">'
    +lista.map(function(v){ var dd=daysTo(v.iso), p=v.iso.split('-');
      return '<div class="vrow"><div class="vdate"><div class="d">'+p[2]+'</div><div class="m">'+MESES[+p[1]-1]+'</div></div>'
        +'<div class="vmain"><div class="vt">'+esc(vencTexto(v))+'</div><div class="vs">'+esc(v.periodo)+(v.cambio?' · fecha corregida por '+esc(v.cambio):'')+'</div></div>'
        +'<span class="vd" style="color:'+vencColor(dd)+'">'+(dd===0?'hoy':dd+'d')+'</span></div>';
    }).join('')+'</div></div>';
}

function impIn(id,f,v,o){ o=o||{}; var d=o.type==='date';
  return '<input class="cell-in'+(o.cls?' '+o.cls:'')+'"'+(o.type?' type="'+o.type+'"':'')+(d?DR:'')
    +' value="'+esc(v==null?'':v)+'" placeholder="'+(o.ph||'—')+'" onchange="'+(d?'if(dateOk(this))':'')
    +'impSet(\''+id+'\',\''+f+'\',this.value)">'; }

function impTablaRegistro(y){
  var reg=impRegistro(y);
  var body=reg.length?reg.map(function(x){
    var est=impEstado(x), dd=x.venc?daysTo(x.venc):null;
    return '<tr><td>'+esc(x.concepto||'')+'<div class="muted-cell" style="font-size:11.5px">'+esc(x.periodo||'')+'</div></td>'
      +'<td>'+impIn(x.id,'importe',numTxt(honNum(x.importe)),{cls:'num',ph:'$'})+'</td>'
      +'<td>'+impIn(x.id,'venc',x.venc,{type:'date'})+(est!=='pag'&&dd!==null&&dd<=10?'<div class="muted-cell" style="font-size:11px;color:'+vencColor(dd)+'">'+(dd<0?'vencido':dd===0?'vence hoy':'faltan '+dd+' días')+'</div>':'')+'</td>'
      +'<td><span class="pill clk imp-'+est+'" onclick="impTogglePago(\''+x.id+'\')">'+IMP_EST[est]+'</span></td>'
      +'<td>'+impIn(x.id,'fechaPago',x.fechaPago,{type:'date'})+'</td>'
      +'<td>'+impIn(x.id,'comprobante',x.comprobante,{ph:'+ N°'})+'</td>'
      +'<td><div class="row-act"><button class="btn-ghost" title="Editar" onclick="impForm(\''+x.id+'\')">✎</button>'
      +'<button class="btn-ghost" title="Borrar" style="color:var(--red)" onclick="impBorrar(\''+x.id+'\')">🗑</button></div></td></tr>';
  }).join(''):emptyRow(7,'Todavía no registraste impuestos de '+y+'. Usá «📥 Traer los del año al registro» o «+ Registro».');
  return '<div class="card-head" style="padding-left:0;border:none"><h3>Registro de '+y+'</h3>'
    +'<button class="btn btn-sm" onclick="impTraerVencimientos()">📥 Traer los vencimientos del año</button></div>'
    +'<div class="table-wrap"><table style="min-width:900px"><thead><tr><th>Impuesto</th><th class="num">Importe</th>'
    +'<th>Vencimiento</th><th>Estado</th><th>Fecha de pago</th><th>Comprobante</th><th></th></tr></thead>'
    +'<tbody>'+body+'</tbody></table></div>';
}

/* ===== ALTA / EDICIÓN ===== */
function impForm(id){
  var x=id?Store.get('impuestos',id):{}; curForm={form:'imp',id:id||null};
  var mios=VENC_GRUPOS.filter(function(g){ return vencEsMio(g.id); });
  var ops=mios.concat(VENC_GRUPOS.filter(function(g){ return !vencEsMio(g.id); }));
  $('#modal-title').textContent=id?'Editar registro':'Nuevo registro de impuesto';
  $('#modal-del').style.display=id?'inline-flex':'none';
  $('#modal-body').innerHTML='<div class="field"><label>Impuesto <span class="req">*</span></label>'
    +'<input data-k="concepto" list="dl-impuestos" autocomplete="off" value="'+esc(x.concepto||'')+'" placeholder="Ej: DGI · Servicios Personales"></div>'
    +'<datalist id="dl-impuestos">'+ops.map(function(g){ return '<option value="'+esc(g.org+' · '+g.nombre)+'">'; }).join('')+'</datalist>'
    +'<div class="field-2"><div class="field"><label>Período</label><input data-k="periodo" value="'+esc(x.periodo||'')+'" placeholder="Ej: Enero-Febrero"></div>'
    +'<div class="field"><label>Importe</label><input data-k="importe" value="'+esc(numTxt(honNum(x.importe)))+'" placeholder="Ej: 12.500"></div></div>'
    +'<div class="field-2"><div class="field"><label>Vence el</label><input type="date"'+DR+' data-k="venc" value="'+esc(x.venc||'')+'"></div>'
    +'<div class="field"><label>Fecha de pago</label><input type="date"'+DR+' data-k="fechaPago" value="'+esc(x.fechaPago||'')+'"></div></div>'
    +'<div class="field"><label>N° de comprobante o boleta</label><input data-k="comprobante" value="'+esc(x.comprobante||'')+'"></div>'
    +'<div class="field"><label>Notas</label><textarea data-k="notas">'+esc(x.notas||'')+'</textarea></div>';
  $('#modal').classList.add('open');
}
function impSave(){
  if(!modalDatesOk())return;
  var o={}; $('#modal-body').querySelectorAll('[data-k]').forEach(function(el){ o[el.dataset.k]=el.value; });
  if(!(o.concepto||'').trim()){ toast('Falta el impuesto'); return; }
  var x=curForm.id?Store.get('impuestos',curForm.id):{anio:impYear(),mes:null,gid:''};
  x.concepto=o.concepto.trim(); x.periodo=o.periodo||''; x.importe=honNum(o.importe);
  x.venc=o.venc||''; x.fechaPago=o.fechaPago||''; x.pagado=!!o.fechaPago;
  x.comprobante=o.comprobante||''; x.notas=o.notas||'';
  if(x.venc)x.anio=+x.venc.slice(0,4);
  Store.upsert('impuestos',x); closeModal(); renderImpuestos(); toast('Guardado');
}
function impDel(){ var id=curForm.id; closeModal(); impBorrar(id); }

function impExpRows(){
  var y=impYear();
  return {title:'Impuestos '+y,
    cols:['Impuesto','Período','Importe','Vencimiento','Estado','Fecha de pago','Comprobante','Notas'],
    data:impRegistro(y).map(function(x){ return [x.concepto||'',x.periodo||'',numTxt(honNum(x.importe)),
      fDate(x.venc),IMP_EST[impEstado(x)],fDate(x.fechaPago),x.comprobante||'',x.notas||'']; })};
}

/* Datos de ejemplo para la demostración (inventados). */
function seedImpuestos(){
  var y=new Date().getFullYear(), out=[];
  if(!VENC_TABLA[y])return out;
  [[0,'Nov-Dic del año anterior',true],[2,'Enero-Febrero',true],[4,'Marzo-Abril',true],[6,'Mayo-Junio',false]].forEach(function(p,i){
    var iso=vencFecha('dgi_sp',y,p[0]); if(!iso)return;
    out.push({id:'is'+i,anio:y,mes:p[0],gid:'dgi_sp',concepto:'DGI · Servicios Personales',periodo:p[1],
      importe:[9800,11200,10450,12300][i],venc:iso,pagado:p[2],fechaPago:p[2]?iso:'',
      comprobante:p[2]?'B-'+(4100+i):'',notas:''});
  });
  return out;
}
