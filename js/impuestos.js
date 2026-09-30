/*
 * Subpestaña: Impuestos (dentro de Finanzas).
 *
 * TODO EN UN SOLO CUADRO (pedido de la usuaria, 30/09/2026): el registro del año tiene una fila por
 * período y ahí mismo están el IVA facturado, el IVA de gastos, lo que da a pagar de IVA, el IRPF,
 * el vencimiento, el estado y el comprobante. El IVA facturado y el de gastos los calcula la página;
 * el IVA a pagar y el IRPF los escribe ella (el IVA viene sugerido).
 *
 * IVA e IRPF van juntos en la misma fila porque vencen el mismo día: DGI los pone en la misma línea
 * de su cuadro de Servicios Personales.
 *
 * Abajo, un segundo cuadro con el resto de los impuestos y aportes que haya marcado (Caja de
 * Profesionales, Fondo de Solidaridad…), que tienen sus propias fechas.
 */
/* ===== IMPUESTOS ===== */
var impAnio=null;
const IMP_EST={pag:'Pagado',pen:'Pendiente',venc:'Vencido'};

function impYear(){ return impAnio||anioActivo(); }
function setImpAnio(y){ impAnio=y; renderImpuestos(); }
function impFrecuencia(){ return vencCfg().frecuencia==='mensual'?'mensual':'bimestral'; }
function setImpFrecuencia(f){ vencCfg().frecuencia=f; Store.save(); renderImpuestos(); }

/* ===== LO QUE CALCULA LA PÁGINA ===== */
// IVA de lo facturado en Honorarios (honCalc ya lo cobra solo cuando la fila tiene N° de factura).
function impIvaVentas(y,m){
  var t=0;
  honRows().forEach(function(r){ var c=honCalc(r,y,m); if(c.imp!==null)t+=c.iva||0; });
  return Math.round(t*100)/100;
}
// IVA deducible de los gastos del mes (ya contempla el 50% cuando corresponde).
function impIvaCompras(y,m){ return Math.round(gstIvaDelMes(y,m).ded*100)/100; }

/* Los períodos del año, según trabaje mensual o bimestral.
   En bimestral, el bimestre i (meses 2i y 2i+1) vence en el mes 2i+2, igual que el cuadro de DGI:
   Enero-Febrero vence en marzo, y Noviembre-Diciembre en enero del año siguiente. */
function impPeriodos(y){
  var bim=impFrecuencia()==='bimestral', out=[];
  for(var i=0;i<(bim?6:12);i++){
    var meses=bim?[i*2,i*2+1]:[i];
    var vAnio=y, vMes=null;
    if(bim){ vMes=(i*2+2)%12; if(i===5)vAnio=y+1; }
    var v=0,c=0;
    meses.forEach(function(m){ v+=impIvaVentas(y,m); c+=impIvaCompras(y,m); });
    v=Math.round(v*100)/100; c=Math.round(c*100)/100;
    out.push({i:i,meses:meses,ventas:v,compras:c,sugerido:Math.round((v-c)*100)/100,
      label:bim?(MESES_L[i*2]+'-'+MESES_L[i*2+1]):MESES_L[i],
      venc:vMes===null?null:vencFecha('dgi_sp',vAnio,vMes)});
  }
  return out;
}

/* ===== EL REGISTRO ===== */
/* Una fila por período (tipo 'periodo'), más las de los otros impuestos y aportes (tipo 'otro'). */
function impFilaPeriodo(y,pi,crear){
  var f=Store.all('impuestos').find(function(x){ return x.tipo==='periodo'&&x.anio===y&&x.pi===pi; });
  if(!f&&crear){
    f={id:'ip'+y+'-'+pi+'-'+Math.floor(Math.random()*999),tipo:'periodo',anio:y,pi:pi,
       iva:null,irpf:null,venc:'',pagado:false,fechaPago:'',comprobante:'',notas:''};
    Store.data.impuestos.push(f);
  }
  return f;
}
function impOtros(y){
  return Store.all('impuestos').filter(function(x){ return x.tipo!=='periodo'&&x.anio===y; })
    .sort(function(a,b){ return (a.venc||'').localeCompare(b.venc||''); });
}
function impEstado(x){ return x.pagado?'pag':(x.venc&&daysTo(x.venc)<0?'venc':'pen'); }
function impTotalFila(x){ return (honNum(x.iva)||0)+(honNum(x.irpf)||0); }
function impVencidos(){ return Store.all('impuestos').filter(function(x){
  return impEstado(x)==='venc' && (x.tipo==='periodo'?impTotalFila(x)>0:true); }); }

/* Guardar un dato del período (crea la fila la primera vez que escribe algo). */
function impSetPer(y,pi,campo,valor){
  var f=impFilaPeriodo(y,pi,true);
  f[campo]=(campo==='iva'||campo==='irpf')?honNum(valor):valor;
  Store.save(); impRefrescar();
}
function impTogglePagoPer(y,pi){
  var f=impFilaPeriodo(y,pi,true);
  f.pagado=!f.pagado; if(f.pagado&&!f.fechaPago)f.fechaPago=today(); if(!f.pagado)f.fechaPago='';
  Store.save(); renderImpuestos();
}
/* Rellena el IVA de los períodos que estén vacíos con lo que calculó la página. */
function impUsarCalculado(){
  var y=impYear(), n=0;
  impPeriodos(y).forEach(function(p){
    if(!p.ventas&&!p.compras)return;
    var f=impFilaPeriodo(y,p.i,false);
    if(f&&honNum(f.iva)!==null)return;
    impFilaPeriodo(y,p.i,true).iva=p.sugerido; n++;
  });
  Store.save(); renderImpuestos();
  toast(n?('✓ '+n+' período'+(n===1?'':'s')+' completado'+(n===1?'':'s')):'Ya estaban todos completos');
}

/* Las otras obligaciones (las que no son IVA/IRPF de Servicios Personales). */
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

/* Crea las filas de los impuestos y aportes que haya marcado, sin repetir.
   El IVA y el IRPF de Servicios Personales no entran acá: van en el cuadro de períodos. */
function impTraerVencimientos(){
  var y=impYear(), lista=vencDelAnio(y,true).filter(function(v){ return v.gid!=='dgi_sp'&&v.gid!=='dgi_irpf'; });
  if(!lista.length){ toast('No tenés otros impuestos marcados (⋯ → Configuración)'); return; }
  var nuevos=0;
  lista.forEach(function(v){
    var ya=Store.all('impuestos').some(function(x){ return x.tipo!=='periodo'&&x.anio===y&&x.mes===v.mes&&x.gid===v.gid; });
    if(ya)return;
    Store.data.impuestos.push({id:'i'+Date.now()+Math.floor(Math.random()*9999),tipo:'otro',anio:y,mes:v.mes,gid:v.gid,
      concepto:vencNombre(v.grupo),periodo:v.periodo,importe:vencImporte(v.gid),venc:v.iso,
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
    +'<div class="sub">Lo que facturaste, lo que gastaste y lo que hay que pagar</div></div>'
    +'<span class="sld-top">'+yearSelect(y,'setImpAnio')
    +'<span class="gseg"><button class="gv'+(impFrecuencia()==='bimestral'?' active':'')+'" onclick="setImpFrecuencia(\'bimestral\')">Bimestral</button>'
    +'<button class="gv'+(impFrecuencia()==='mensual'?' active':'')+'" onclick="setImpFrecuencia(\'mensual\')">Mensual</button></span>'
    +expBtns('imp')+'<button class="btn btn-sm btn-primary" onclick="impForm()">+ Registro</button></span></div>';
  h+='<div id="imp-kpis">'+impKpisHtml(y)+'</div>';
  h+=impTablaPeriodos(y);
  h+=impTablaOtros(y);
  h+=impProximos();
  h+='<div class="hon-foot">💡 El <b>IVA facturado</b> sale de Honorarios y cuenta solo las filas con N° de factura. '
    +'El <b>IVA de gastos</b> sale de Gastos y ya contempla el 50% cuando corresponde. Lo que escribas en '
    +'<b>IVA a pagar</b> e <b>IRPF</b> manda sobre lo calculado: la sugerencia es una ayuda. '
    +'Los demás impuestos y aportes los elegís en <b>⋯ → Configuración → Mis impuestos y aportes</b>.</div>';
  $('#view-imp').innerHTML=h;
}

function impMoney(n){ return n<0 ? '− '+money(Math.abs(n)) : money(n); }

function impKpisHtml(y){
  var per=impPeriodos(y), v=0,c=0,aPagar=0,sinPagar=0,venc=0;
  per.forEach(function(p){
    v+=p.ventas; c+=p.compras;
    var f=impFilaPeriodo(y,p.i,false); if(!f)return;
    var t=impTotalFila(f); aPagar+=t;
    if(!f.pagado){ sinPagar+=t; if(impEstado(f)==='venc'&&t>0)venc++; }
  });
  impOtros(y).forEach(function(x){
    var t=honNum(x.importe)||0; aPagar+=t;
    if(!x.pagado){ sinPagar+=t; if(impEstado(x)==='venc')venc++; }
  });
  return '<div class="kpis kpis-4">'
    +kpiM('IVA facturado · '+y,money(v),'de los honorarios con factura','')
    +kpiM('IVA de gastos',money(c),'deducible','k-green')
    +kpiM('A pagar en el año',money(aPagar),'IVA, IRPF y aportes','')
    +kpiM('Sin pagar',money(sinPagar),venc?(venc+' vencido'+(venc===1?'':'s')):'al día',venc?'k-alerta':(sinPagar?'k-amber':'k-green'))
    +'</div>';
}

/* --- El cuadro principal: una fila por período, con todo adentro --- */
function impTablaPeriodos(y){
  var per=impPeriodos(y), t={v:0,c:0,iva:0,irpf:0};
  var filas=per.map(function(p){
    var f=impFilaPeriodo(y,p.i,false)||{};
    var iva=honNum(f.iva), irpf=honNum(f.irpf);
    var venc=f.venc||p.venc||'';
    var est=(f.pagado?'pag':(venc&&daysTo(venc)<0?'venc':'pen'));
    var hayAlgo=p.ventas||p.compras||iva!==null||irpf!==null;
    t.v+=p.ventas; t.c+=p.compras; t.iva+=iva||0; t.irpf+=irpf||0;
    return '<tr'+(hayAlgo?'':' class="imp-vacio"')+'>'
      +'<td><b>'+p.label+'</b></td>'
      +'<td class="num">'+(p.ventas?money(p.ventas):'—')+'</td>'
      +'<td class="num">'+(p.compras?money(p.compras):'—')+'</td>'
      +'<td>'+impInPer(y,p.i,'iva',iva,{ph:p.sugerido?numTxt(p.sugerido):'—',sug:p.sugerido})+'</td>'
      +'<td>'+impInPer(y,p.i,'irpf',irpf,{ph:'—'})+'</td>'
      +'<td>'+impInPer(y,p.i,'venc',venc,{type:'date'})+'</td>'
      +'<td>'+((iva||irpf)?'<span class="pill clk imp-'+est+'" onclick="impTogglePagoPer('+y+','+p.i+')">'+IMP_EST[est]+'</span>'
                         :'<span class="muted-cell">—</span>')+'</td>'
      +'<td>'+impInPer(y,p.i,'fechaPago',f.fechaPago,{type:'date'})+'</td>'
      +'<td>'+impInPer(y,p.i,'comprobante',f.comprobante,{ph:'+ N°'})+'</td></tr>';
  }).join('');
  var tot='<tr class="gst-tot"><td>TOTAL '+y+'</td><td class="num">'+money(t.v)+'</td><td class="num">'+money(t.c)+'</td>'
    +'<td class="num"><b>'+money(t.iva)+'</b></td><td class="num"><b>'+money(t.irpf)+'</b></td><td colspan="4"></td></tr>';
  return '<div class="card-head imp-head"><h3>Registro de '+y+'</h3>'
    +'<button class="btn btn-sm" onclick="impUsarCalculado()">✨ Completar el IVA con lo calculado</button></div>'
    +'<div class="table-wrap"><table style="min-width:1080px"><thead><tr>'
    +'<th>Período</th><th class="num">IVA facturado</th><th class="num">IVA de gastos</th>'
    +'<th class="num">IVA a pagar</th><th class="num">IRPF</th>'
    +'<th>Vence</th><th>Estado</th><th>Fecha de pago</th><th>Comprobante</th>'
    +'</tr></thead><tbody>'+filas+tot+'</tbody></table></div>';
}

function impInPer(y,pi,campo,v,o){
  o=o||{}; var d=o.type==='date';
  var val=(campo==='iva'||campo==='irpf')?numTxt(v):(v==null?'':v);
  return '<input class="cell-in'+(d?'':' num')+(o.sug&&v==null?' imp-sug':'')+'"'+(d?' type="date"'+DR:'')
    +' value="'+esc(val)+'" placeholder="'+esc(o.ph||'—')+'"'
    +(o.sug?' data-tip="La página calculó '+esc(numTxt(o.sug))+'. Podés escribir otro importe."':'')
    +' onchange="'+(d?'if(dateOk(this))':'')+'impSetPer('+y+','+pi+',\''+campo+'\',this.value)">';
}

/* --- El segundo cuadro: el resto de los impuestos y aportes --- */
function impTablaOtros(y){
  var otros=impOtros(y);
  var marcados=vencDelAnio(y,true).filter(function(v){ return v.gid!=='dgi_sp'&&v.gid!=='dgi_irpf'; }).length;
  var body=otros.length?otros.map(function(x){
    var est=impEstado(x), dd=x.venc?daysTo(x.venc):null;
    return '<tr><td>'+esc(x.concepto||'')+'<div class="muted-cell" style="font-size:11.5px">'+esc(x.periodo||'')+'</div></td>'
      +'<td>'+impIn(x.id,'importe',numTxt(honNum(x.importe)),{cls:'num',ph:'$'})+'</td>'
      +'<td>'+impIn(x.id,'venc',x.venc,{type:'date'})
        +(est!=='pag'&&dd!==null&&dd<=10?'<div class="muted-cell" style="font-size:11px;color:'+vencColor(dd)+'">'+(dd<0?'vencido':dd===0?'vence hoy':'faltan '+dd+' días')+'</div>':'')+'</td>'
      +'<td><span class="pill clk imp-'+est+'" onclick="impTogglePago(\''+x.id+'\')">'+IMP_EST[est]+'</span></td>'
      +'<td>'+impIn(x.id,'fechaPago',x.fechaPago,{type:'date'})+'</td>'
      +'<td>'+impIn(x.id,'comprobante',x.comprobante,{ph:'+ N°'})+'</td>'
      +'<td><div class="row-act"><button class="btn-ghost" title="Editar" onclick="impForm(\''+x.id+'\')">✎</button>'
      +'<button class="btn-ghost" title="Borrar" style="color:var(--red)" onclick="impBorrar(\''+x.id+'\')">🗑</button></div></td></tr>';
  }).join(''):emptyRow(7, marcados
      ? 'Tocá «Traer los vencimientos del año» y se cargan solos.'
      : 'Acá van tus otros impuestos y aportes (Caja de Profesionales, Fondo de Solidaridad…). Elegí cuáles te corresponden en ⋯ → Configuración.');
  return '<div class="card-head imp-head"><h3>Otros impuestos y aportes</h3>'
    +'<button class="btn btn-sm" onclick="impTraerVencimientos()">📥 Traer los vencimientos del año</button></div>'
    +'<div class="table-wrap"><table style="min-width:880px"><thead><tr><th>Impuesto o aporte</th><th class="num">Importe</th>'
    +'<th>Vence</th><th>Estado</th><th>Fecha de pago</th><th>Comprobante</th><th></th></tr></thead>'
    +'<tbody>'+body+'</tbody></table></div>';
}

function impIn(id,f,v,o){ o=o||{}; var d=o.type==='date';
  return '<input class="cell-in'+(o.cls?' '+o.cls:'')+'"'+(o.type?' type="'+o.type+'"':'')+(d?DR:'')
    +' value="'+esc(v==null?'':v)+'" placeholder="'+(o.ph||'—')+'" onchange="'+(d?'if(dateOk(this))':'')
    +'impSet(\''+id+'\',\''+f+'\',this.value)">'; }

function impProximos(){
  var lista=vencProximos(4,true);
  if(!lista.length)return '';
  return '<div class="card" style="margin-top:18px"><div class="card-head"><h3>Tus próximos vencimientos</h3></div><div class="card-body">'
    +lista.map(function(v){ var dd=daysTo(v.iso), p=v.iso.split('-');
      return '<div class="vrow"><div class="vdate"><div class="d">'+p[2]+'</div><div class="m">'+MESES[+p[1]-1]+'</div></div>'
        +'<div class="vmain"><div class="vt">'+esc(vencTexto(v))+'</div><div class="vs">'+esc(v.periodo)+(v.cambio?' · fecha corregida por '+esc(v.cambio):'')+'</div></div>'
        +'<span class="vd" style="color:'+vencColor(dd)+'">'+(dd===0?'hoy':dd+'d')+'</span></div>';
    }).join('')+'</div></div>';
}

/* ===== ALTA / EDICIÓN de los otros impuestos y aportes ===== */
function impForm(id){
  var x=id?Store.get('impuestos',id):{}; curForm={form:'imp',id:id||null};
  var todos=vencGruposTodos();
  var ops=todos.filter(function(g){ return vencEsMio(g.id); }).concat(todos.filter(function(g){ return !vencEsMio(g.id); }));
  $('#modal-title').textContent=id?'Editar registro':'Nuevo registro';
  $('#modal-del').style.display=id?'inline-flex':'none';
  $('#modal-body').innerHTML='<div class="field"><label>Impuesto o aporte <span class="req">*</span></label>'
    +'<input data-k="concepto" list="dl-impuestos" autocomplete="off" value="'+esc(x.concepto||'')+'" placeholder="Ej: CJPPU · Caja de Profesionales"></div>'
    +'<datalist id="dl-impuestos">'+ops.map(function(g){ return '<option value="'+esc(vencNombre(g))+'">'; }).join('')+'</datalist>'
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
  var x=curForm.id?Store.get('impuestos',curForm.id):{tipo:'otro',anio:impYear(),mes:null,gid:''};
  x.concepto=o.concepto.trim(); x.periodo=o.periodo||''; x.importe=honNum(o.importe);
  x.venc=o.venc||''; x.fechaPago=o.fechaPago||''; x.pagado=!!o.fechaPago;
  x.comprobante=o.comprobante||''; x.notas=o.notas||'';
  if(x.venc)x.anio=+x.venc.slice(0,4);
  Store.upsert('impuestos',x); closeModal(); renderImpuestos(); toast('Guardado');
}
function impDel(){ var id=curForm.id; closeModal(); impBorrar(id); }

function impExpRows(){
  var y=impYear(), datos=[];
  impPeriodos(y).forEach(function(p){
    var f=impFilaPeriodo(y,p.i,false)||{};
    datos.push([p.label,numTxt(p.ventas),numTxt(p.compras),numTxt(honNum(f.iva)),numTxt(honNum(f.irpf)),
      fDate(f.venc||p.venc),IMP_EST[impEstado(f.id?f:{venc:p.venc})],fDate(f.fechaPago),f.comprobante||'']);
  });
  impOtros(y).forEach(function(x){
    datos.push([x.concepto+(x.periodo?' · '+x.periodo:''),'','',numTxt(honNum(x.importe)),'',
      fDate(x.venc),IMP_EST[impEstado(x)],fDate(x.fechaPago),x.comprobante||'']);
  });
  return {title:'Impuestos '+y,
    cols:['Período','IVA facturado','IVA de gastos','IVA a pagar','IRPF','Vence','Estado','Fecha de pago','Comprobante'],
    data:datos};
}

/* Datos de ejemplo para la demostración (inventados). */
function seedImpuestos(){
  var y=new Date().getFullYear(), out=[];
  if(!VENC_TABLA[y])return out;
  // Los tres primeros bimestres ya pagos, el cuarto vencido sin pagar.
  [[0,3916,2400,true],[1,3916,2650,true],[2,3916,2500,true],[3,3916,2800,false]].forEach(function(p,i){
    var vMes=(p[0]*2+2)%12;
    out.push({id:'ip'+i,tipo:'periodo',anio:y,pi:p[0],iva:p[1],irpf:p[2],
      venc:vencFecha('dgi_sp',y,vMes)||'',pagado:p[3],
      fechaPago:p[3]?(vencFecha('dgi_sp',y,vMes)||''):'',comprobante:p[3]?'B-'+(4100+i):'',notas:''});
  });
  return out;
}
