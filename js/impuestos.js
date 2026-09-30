/*
 * Subpestaña: Impuestos (dentro de Finanzas).
 *
 * UN SOLO CUADRO (decisión de la usuaria, 30/09/2026): el «Registro del año», con una fila por
 * período. Ahí está todo: el IVA facturado, el IVA de gastos, lo que da a pagar de IVA, el IRPF,
 * el vencimiento, el estado y el comprobante.
 *   - El IVA facturado y el IVA de gastos los calcula la página.
 *   - El IVA a pagar y el IRPF los escribe ella (el IVA viene sugerido).
 * IVA e IRPF van juntos en la misma fila porque vencen el mismo día: DGI los pone en la misma
 * línea de su cuadro de Servicios Personales.
 *
 * Antes hubo otros dos cuadros («Por mes» y «Otros impuestos y aportes») y una calculadora de IVA;
 * los tres se sacaron a pedido de la usuaria. Están en el historial de Git por si se retoman.
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
   El IVA de Servicios Personales vence por bimestre: el bimestre i (meses 2i y 2i+1) vence en el
   mes 2i+2, igual que el cuadro de DGI. Enero-Febrero vence en marzo, y Noviembre-Diciembre en
   enero del año siguiente (ese queda sin fecha hasta que DGI publique el año nuevo).
   En la vista mensual, cada mes muestra el vencimiento del bimestre al que pertenece. */
function impPeriodos(y){
  var bim=impFrecuencia()==='bimestral', out=[];
  for(var i=0;i<(bim?6:12);i++){
    var meses=bim?[i*2,i*2+1]:[i];
    var b=bim?i:Math.floor(i/2), vAnio=(b===5?y+1:y), vMes=(b*2+2)%12;
    var v=0,c=0;
    meses.forEach(function(m){ v+=impIvaVentas(y,m); c+=impIvaCompras(y,m); });
    v=Math.round(v*100)/100; c=Math.round(c*100)/100;
    out.push({i:i,meses:meses,ventas:v,compras:c,sugerido:Math.round((v-c)*100)/100,
      label:bim?(MESES_L[i*2]+'-'+MESES_L[i*2+1]):MESES_L[i],
      venc:vencFecha('dgi_sp',vAnio,vMes)});
  }
  return out;
}

/* ===== EL REGISTRO ===== */
/* Una fila por período. Se crea recién cuando ella escribe algo. */
function impFilaPeriodo(y,pi,crear){
  var f=Store.all('impuestos').find(function(x){ return x.anio===y&&x.pi===pi; });
  if(!f&&crear){
    f={id:'ip'+y+'-'+pi+'-'+Math.floor(Math.random()*999),tipo:'periodo',anio:y,pi:pi,
       iva:null,irpf:null,venc:'',pagado:false,fechaPago:'',comprobante:'',notas:''};
    Store.data.impuestos.push(f);
  }
  return f;
}
function impEstado(x){ return x.pagado?'pag':(x.venc&&daysTo(x.venc)<0?'venc':'pen'); }
function impTotalFila(x){ return (honNum(x.iva)||0)+(honNum(x.irpf)||0); }
// Para el contador rojo de la subpestaña y el indicador del Panel.
function impVencidos(){ return Store.all('impuestos').filter(function(x){
  return impEstado(x)==='venc' && impTotalFila(x)>0; }); }

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
function impRefrescar(){ var k=document.getElementById('imp-kpis'); if(k)k.innerHTML=impKpisHtml(impYear()); }

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

/* ===== LA PANTALLA ===== */
function renderImpuestos(){
  var y=impYear();
  var h='<div class="view-head"><div><h2>Impuestos <span style="color:var(--muted);font-weight:400">'+y+'</span></h2>'
    +'<div class="sub">Lo que facturaste, lo que gastaste y lo que hay que pagar</div></div>'
    +'<span class="sld-top">'+yearSelect(y,'setImpAnio')
    +'<span class="gseg"><button class="gv'+(impFrecuencia()==='bimestral'?' active':'')+'" onclick="setImpFrecuencia(\'bimestral\')">Bimestral</button>'
    +'<button class="gv'+(impFrecuencia()==='mensual'?' active':'')+'" onclick="setImpFrecuencia(\'mensual\')">Mensual</button></span>'
    +expBtns('imp')+'</span></div>';
  h+='<div id="imp-kpis">'+impKpisHtml(y)+'</div>';
  h+=impTablaPeriodos(y);
  h+='<div class="hon-foot">💡 El <b>IVA facturado</b> sale de Honorarios y cuenta solo las filas con N° de factura. '
    +'El <b>IVA de gastos</b> sale de Gastos y ya contempla el 50% cuando corresponde. Lo que escribas en '
    +'<b>IVA a pagar</b> e <b>IRPF</b> manda sobre lo calculado: la sugerencia es una ayuda. '
    +'Las fechas de vencimiento se corrigen en <b>⋯ → Configuración</b>.</div>';
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
  return '<div class="kpis kpis-4">'
    +kpiM('IVA facturado · '+y,money(v),'de los honorarios con factura','')
    +kpiM('IVA de gastos',money(c),'deducible','k-green')
    +kpiM('A pagar en el año',money(aPagar),'IVA e IRPF','')
    +kpiM('Sin pagar',money(sinPagar),venc?(venc+' vencido'+(venc===1?'':'s')):'al día',venc?'k-alerta':(sinPagar?'k-amber':'k-green'))
    +'</div>';
}

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
      +'<td class="imp-venc">'+impInPer(y,p.i,'venc',venc,{type:'date'})
        +(venc?'':'<div class="imp-falta">vence en enero de '+(y+1)+', que DGI publica en diciembre</div>')+'</td>'
      +'<td class="num">'+(p.ventas?money(p.ventas):'—')+'</td>'
      +'<td class="num">'+(p.compras?money(p.compras):'—')+'</td>'
      +'<td>'+impInPer(y,p.i,'iva',iva,{ph:p.sugerido?numTxt(p.sugerido):'—',sug:p.sugerido})+'</td>'
      +'<td>'+impInPer(y,p.i,'irpf',irpf,{ph:'—'})+'</td>'
      +'<td>'+((iva||irpf)?'<span class="pill clk imp-'+est+'" onclick="impTogglePagoPer('+y+','+p.i+')">'+IMP_EST[est]+'</span>'
                         :'<span class="muted-cell">—</span>')+'</td>'
      +'<td>'+impInPer(y,p.i,'fechaPago',f.fechaPago,{type:'date'})+'</td>'
      +'<td>'+impInPer(y,p.i,'comprobante',f.comprobante,{ph:'+ N°'})+'</td></tr>';
  }).join('');
  var tot='<tr class="gst-tot"><td>TOTAL '+y+'</td><td></td><td class="num">'+money(t.v)+'</td><td class="num">'+money(t.c)+'</td>'
    +'<td class="num"><b>'+money(t.iva)+'</b></td><td class="num"><b>'+money(t.irpf)+'</b></td><td colspan="3"></td></tr>';
  return '<div class="card-head imp-head"><h3>Registro de '+y+'</h3>'
    +'<button class="btn btn-sm" onclick="impUsarCalculado()">✨ Completar el IVA con lo calculado</button></div>'
    +'<div class="table-wrap"><table style="min-width:1020px"><thead><tr>'
    +'<th>Período</th><th class="imp-venc">Vence</th>'
    +'<th class="num">IVA facturado</th><th class="num">IVA de gastos</th>'
    +'<th class="num">IVA a pagar</th><th class="num">IRPF</th>'
    +'<th>Estado</th><th>Fecha de pago</th><th>Comprobante</th>'
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

function impExpRows(){
  var y=impYear(), datos=[];
  impPeriodos(y).forEach(function(p){
    var f=impFilaPeriodo(y,p.i,false)||{};
    datos.push([p.label,fDate(f.venc||p.venc),numTxt(p.ventas),numTxt(p.compras),
      numTxt(honNum(f.iva)),numTxt(honNum(f.irpf)),
      IMP_EST[impEstado(f.id?f:{venc:p.venc})],fDate(f.fechaPago),f.comprobante||'']);
  });
  return {title:'Impuestos '+y,
    cols:['Período','Vence','IVA facturado','IVA de gastos','IVA a pagar','IRPF','Estado','Fecha de pago','Comprobante'],
    data:datos};
}

/* Datos de ejemplo para la demostración (inventados).
   Coherentes con los honorarios de ejemplo: un solo cliente factura 8.900 por mes → IVA 1.958 →
   3.916 por bimestre. Los tres primeros bimestres pagos, el cuarto vencido. */
function seedImpuestos(){
  var y=new Date().getFullYear(), out=[];
  if(!VENC_TABLA[y])return out;
  [[0,3916,2400,true],[1,3916,2650,true],[2,3916,2500,true],[3,3916,2800,false]].forEach(function(p,i){
    var vMes=(p[0]*2+2)%12;
    out.push({id:'ip'+i,tipo:'periodo',anio:y,pi:p[0],iva:p[1],irpf:p[2],
      venc:vencFecha('dgi_sp',y,vMes)||'',pagado:p[3],
      fechaPago:p[3]?(vencFecha('dgi_sp',y,vMes)||''):'',comprobante:p[3]?'B-'+(4100+i):'',notas:''});
  });
  return out;
}
