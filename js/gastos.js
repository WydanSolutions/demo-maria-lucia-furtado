/*
 * Sección: Gastos del estudio (alquiler, luz, agua, muebles y útiles, papelería…).
 * - Vista MENSUAL: lo que hay que pagar ese mes, con los números arriba y el resultado abajo.
 * - Vista ANUAL: cuánto se gastó en cada categoría, mes a mes.
 *
 * CONTADO Y CRÉDITO (criterio de caja): una compra se carga UNA sola vez.
 * Si es a crédito, sus cuotas son la forma de pagarla: cada cuota aparece en el mes que vence,
 * nunca la compra entera. Así el "total del mes" siempre significa lo que sale del bolsillo.
 * Datos: colección "gastos" (la compra) + colección "cuotas" (los pagos programados de una compra).
 * La ficha de alta y edición está en gastos-form.js.
 */
/* ===== GASTOS ===== */
var gstAnio=null, gstMes=new Date().getMonth(), gstVista='mensual', gstQ='', gstCat='';
// Categorías con las que arranca. La usuaria puede agregar las que quiera (se guardan en gastoCats).
const GASTO_CATS_DEF=['Alquiler','Luz','Agua','Internet y teléfono','Muebles y útiles','Papelería y librería','Limpieza','Software y sistemas','Impuestos y tasas','Otros'];
const IVA_GASTO=0.22;
// Íconos por palabra clave: si crea una categoría nueva, igual le toca un ícono razonable.
const GASTO_ICOS=[[/alquil|local|oficina/i,'🏠'],[/luz|ute|electri/i,'💡'],[/agua|ose/i,'🚰'],[/internet|tel|antel|celu/i,'🌐'],
  [/mueble|equipa|comput|impres/i,'🪑'],[/papel|librer|insumo/i,'🖊'],[/limpie/i,'🧹'],[/software|sistema|licen|nube/i,'💻'],
  [/impuesto|tasa|dgi|bps|contrib/i,'🧾'],[/sueldo|personal|honorar/i,'👥'],[/curso|formac|capacit/i,'📚'],[/nafta|combusti|movili|viaje/i,'🚗'],
  [/banco|comisi/i,'🏦'],[/seguro/i,'🛡']];
function gstIco(c){ for(var i=0;i<GASTO_ICOS.length;i++){ if(GASTO_ICOS[i][0].test(c||''))return GASTO_ICOS[i][1]; } return '•'; }
function gastoCats(){ if(!Array.isArray(Store.data.gastoCats)||!Store.data.gastoCats.length)Store.data.gastoCats=GASTO_CATS_DEF.slice(); return Store.data.gastoCats; }
function gstCatAddName(n){ n=(n||'').trim(); if(n&&gastoCats().indexOf(n)<0){ gastoCats().push(n); Store.save(); syncGstListas(); } }
// Listas para autocompletar: categorías y proveedores ya usados.
function syncGstListas(){
  var dc=document.getElementById('dl-gastocats');
  if(dc)dc.innerHTML=gastoCats().map(function(c){return '<option value="'+esc(c)+'">';}).join('');
  var dp=document.getElementById('dl-proveedores');
  if(dp){
    var vistos={}, lista=[];
    Store.all('gastos').forEach(function(g){ var p=(g.proveedor||'').trim(); if(p&&!vistos[p.toLowerCase()]){vistos[p.toLowerCase()]=1;lista.push(p);} });
    dp.innerHTML=lista.sort(function(a,b){return a.localeCompare(b);}).map(function(p){return '<option value="'+esc(p)+'">';}).join('');
  }
}

function gstYear(){ return gstAnio||anioActivo(); }
function setGstAnio(y){ gstAnio=y; renderGastos(); }
function setGstMes(m){ gstMes=+m; renderGastos(); }
function setGstVista(v){ gstVista=v; renderGastos(); }

/* ===== fechas y cuotas ===== */
function gstAnioDe(x){ return x&&x.fecha?+x.fecha.slice(0,4):null; }
function gstMesDe(x){ return x&&x.fecha?+x.fecha.slice(5,7)-1:null; }
// Suma meses a una fecha. Si el día no existe en el mes destino (31 en febrero), va al último día.
function gstSumarMeses(iso,n){
  var p=(iso||today()).split('-'), d=+p[2];
  var t=new Date(+p[0],+p[1]-1+n,1);
  var ultimo=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();
  return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(Math.min(d,ultimo)).padStart(2,'0');
}
function gstCuotasDe(id){ return Store.all('cuotas').filter(function(c){return c.gastoId===id;}).sort(function(a,b){return a.n-b.n;}); }
// Arma (o rehace) las cuotas de una compra a crédito.
// Las cuotas YA PAGADAS no se tocan nunca: son historia real de la caja. El saldo se reparte entre las que faltan.
function gstSincronizarCuotas(g){
  var previas=gstCuotasDe(g.id), porN={};
  previas.forEach(function(c){ porN[c.n]=c; });
  if(g.forma!=='credito'){ previas.forEach(function(c){ Store.remove('cuotas',c.id); }); return; }
  var N=Math.max(1,parseInt(g.cuotas,10)||1), total=honNum(g.importe)||0;
  var yaPago=previas.filter(function(c){ return c.pagado&&c.n<=N; }).reduce(function(a,c){ return a+(honNum(c.importe)||0); },0);
  var faltan=[]; for(var n=1;n<=N;n++){ if(!(porN[n]&&porN[n].pagado))faltan.push(n); }
  var saldo=Math.max(0,Math.round((total-yaPago)*100)/100);
  var base=faltan.length?Math.floor(saldo/faltan.length*100)/100:0, acum=0;
  for(var k=1;k<=N;k++){
    var vieja=porN[k];
    if(vieja&&vieja.pagado)continue;                        // paga: se deja como está
    var ultima=(k===faltan[faltan.length-1]);
    var imp=ultima?Math.round((saldo-acum)*100)/100:base;    // la última ajusta para que sumen exacto
    if(!ultima)acum=Math.round((acum+base)*100)/100;
    var c=vieja||{gastoId:g.id,n:k};
    c.importe=imp; c.fecha=gstSumarMeses(g.primera||g.fecha,k-1); c.pagado=false; c.fechaPago='';
    Store.upsert('cuotas',c);
  }
  previas.forEach(function(c){ if(c.n>N)Store.remove('cuotas',c.id); }); // si achicó el plan
}
// Lo que falta pagar de cuotas después de este mes: la plata futura ya comprometida.
function gstComprometido(y,m){
  var corte=y+'-'+String(m+1).padStart(2,'0')+'-31', t=0, n=0;
  Store.all('cuotas').forEach(function(c){ if(!c.pagado&&c.fecha>corte){ t+=honNum(c.importe)||0; n++; } });
  return {total:t,n:n};
}

/* ===== las filas de un mes: gastos al contado + cuotas que vencen ese mes ===== */
function gstFilasMes(y,m){
  var filas=[];
  Store.all('gastos').forEach(function(g){
    if(g.forma==='credito')return;                         // la compra a crédito se ve a través de sus cuotas
    if(gstAnioDe(g)!==y||gstMesDe(g)!==m)return;
    filas.push({id:g.id,tipo:'gasto',g:g,fecha:g.fecha,importe:honNum(g.importe),pagado:!!g.pagado,det:''});
  });
  Store.all('cuotas').forEach(function(c){
    var g=Store.get('gastos',c.gastoId); if(!g)return;
    if(gstAnioDe(c)!==y||gstMesDe(c)!==m)return;
    filas.push({id:c.id,tipo:'cuota',g:g,c:c,fecha:c.fecha,importe:honNum(c.importe),pagado:!!c.pagado,det:'Cuota '+c.n+'/'+(g.cuotas||'?')});
  });
  return filas.sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
}
function gstFiltradas(){
  var q=gstQ.trim().toLowerCase();
  return gstFilasMes(gstYear(),gstMes).filter(function(f){
    if(gstCat&&(f.g.cat||'')!==gstCat)return false;
    if(q&&!((f.g.concepto||'')+' '+(f.g.cat||'')+' '+(f.g.proveedor||'')).toLowerCase().includes(q))return false;
    return true;
  });
}
function gstTotales(filas){
  var t={total:0,pag:0,pen:0,nPen:0};
  filas.forEach(function(f){ var n=f.importe||0; t.total+=n; if(f.pagado)t.pag+=n; else {t.pen+=n;t.nPen++;} });
  return t;
}
// IVA de las COMPRAS del mes (el crédito fiscal corresponde a la fecha de la factura, no a la de la cuota).
// Devuelve el IVA de las facturas y cuánto de eso se puede deducir (hay compras que se computan al 50%).
function gstIvaDelMes(y,m){
  var t=0, ded=0;
  Store.all('gastos').forEach(function(g){
    if(gstAnioDe(g)!==y||gstMesDe(g)!==m)return;
    var iva=honNum(g.iva)||0; t+=iva; ded+=gstIvaDeducible(g);
  });
  return {iva:t,ded:ded};
}
// Lo deducible de un gasto: el IVA por su porcentaje (100% o 50%).
function gstIvaDeducible(g){ return Math.round((honNum(g.iva)||0)*(g.ivaDed||100))/100; }
// La celda de IVA en la tabla: el IVA de la factura y, si se computa al 50%, cuánto queda deducible.
function gstCeldaIva(f){
  var g=f.g, iva=honNum(g.iva)||0;
  if(f.tipo==='cuota')return '<span class="muted-cell" data-tip="El IVA se cuenta en el mes de la compra, no en el de la cuota">—</span>';
  if(!g.conIva||!iva)return '<span class="muted-cell">—</span>';
  return money(iva)+((g.ivaDed||100)===50?'<span class="gst-ded">50% → '+money(gstIvaDeducible(g))+'</span>':'');
}
// Honorarios cobrados en el mes (para la línea de resultado). Si no está esa sección, devuelve null.
function gstCobradoDelMes(y,m){
  if(typeof honCalc!=='function')return null;
  var t=0;
  Store.all('honCli').forEach(function(r){ var c=honCalc(r,y,m); if(c.imp!==null&&c.est==='pag')t+=c.tot; });
  return t;
}

/* ===== guardar desde la tabla ===== */
function gstSet(id,f,v){ var g=Store.get('gastos',id); if(!g)return; g[f]=v; if(f==='cat')gstCatAddName(v); Store.upsert('gastos',g); renderGstBody(); }
function gstTogglePago(tipo,id){
  var col=tipo==='cuota'?'cuotas':'gastos', o=Store.get(col,id); if(!o)return;
  o.pagado=!o.pagado; o.fechaPago=o.pagado?(o.fechaPago||today()):'';
  Store.upsert(col,o); renderGstBody();
}
function gstBorrar(tipo,id){
  var g=tipo==='cuota'?Store.get('gastos',(Store.get('cuotas',id)||{}).gastoId):Store.get('gastos',id);
  if(!g)return;
  var cs=gstCuotasDe(g.id), pagas=cs.filter(function(c){return c.pagado;}).length;
  var msg=cs.length
    ? '¿Eliminar la compra «'+g.concepto+'»?\n\nSe borran también sus '+cs.length+' cuotas'+(pagas?' ('+pagas+' ya pagadas)':'')+'.'
    : '¿Eliminar este gasto?';
  if(!confirm(msg))return;
  cs.forEach(function(c){ Store.remove('cuotas',c.id); });
  Store.remove('gastos',g.id);
  renderGastos(); toast('Gasto eliminado');
}
// Duplicar: copia la compra sin los pagos hechos, para no volver a escribir todo.
function gstDuplicar(id){
  var g=Store.get('gastos',id); if(!g)return;
  var n=Object.assign({},g); delete n.id; delete n._t;
  n.fecha=today(); n.pagado=false; n.fechaPago=''; n.factura='';
  if(n.forma==='credito')n.primera=gstSumarMeses(today(),1);
  var nuevo=Store.upsert('gastos',n);
  gstSincronizarCuotas(nuevo);
  renderGastos(); toast('✓ Gasto duplicado: revisá la fecha y el importe');
}

/* ===== pantalla ===== */
function renderGastos(){
  var y=gstYear();
  var h='<div class="view-head"><div><h2>Gastos del estudio <span style="color:var(--muted);font-weight:400">'+y+'</span></h2>'
    +'<div class="sub">Lo que se paga para que el estudio funcione</div></div>'
    +'<span class="sld-top">'+yearSelect(y,'setGstAnio')
    +'<span class="gseg"><button class="gv'+(gstVista==='mensual'?' active':'')+'" onclick="setGstVista(\'mensual\')">▦ Mensual</button>'
    +'<button class="gv'+(gstVista==='anual'?' active':'')+'" onclick="setGstVista(\'anual\')">▤ Anual</button></span>'
    +expBtns('gastos')+'<button class="btn btn-sm btn-primary" onclick="gastoForm()">+ Gasto</button></span></div>';
  if(gstVista==='mensual'){
    h+='<div class="toolbar"><div class="search"><input placeholder="Buscar gasto…" value="'+esc(gstQ)+'" oninput="gstQ=this.value;renderGstBody()"></div>'
      +'<select class="filt" onchange="gstCat=this.value;renderGstBody()"><option value="">Todas las categorías</option>'
      +gastoCats().map(function(c){return '<option'+(c===gstCat?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select>'
      +'<button class="btn btn-sm" onclick="gstCopiarFijos()" data-tip="Trae los gastos marcados como fijos (alquiler, luz, agua…) del mes anterior">🔁 Traer los fijos del mes anterior</button></div>';
    h+='<div class="months">'+MESES.map(function(m,i){return '<button class="mbtn'+(i===gstMes?' active':'')+'" onclick="setGstMes('+i+')">'+m.toUpperCase()+'</button>';}).join('')+'</div>';
  }
  h+='<div id="gst-body"></div>';
  h+='<div class="hon-foot">💡 Marcá un gasto como <b>fijo</b> (alquiler, luz, agua…) y el mes que viene lo traés con un solo botón. Las compras <b>a crédito</b> aparecen en el mes de cada cuota, nunca el total de golpe.</div>';
  $('#view-gastos').innerHTML=h;
  syncGstListas(); renderGstBody();
}
function renderGstBody(){ $('#gst-body').innerHTML = gstVista==='anual' ? gstTablaAnual() : gstTablaMensual(); }

function gstTablaMensual(){
  var y=gstYear(), m=gstMes, filas=gstFiltradas(), t=gstTotales(filas), comp=gstComprometido(y,m);
  var kpis='<div class="kpis '+(comp.n?'kpis-4':'kpis-3')+'">'
    +kpiM('A pagar este mes',money(t.total),MESES_L[m],'')
    +kpiM('Pagado',money(t.pag),'','k-green')
    +kpiM('Pendiente',money(t.pen),t.nPen?(t.nPen+' sin pagar'):'todo al día',t.pen?'k-amber':'')
    +(comp.n?kpiM('Comprometido a futuro',money(comp.total),comp.n+(comp.n===1?' cuota por venir':' cuotas por venir'),'k-acento'):'')
    +'</div>';
  var cuerpo=filas.map(function(f){
    var g=f.g;
    return '<tr>'
      +'<td style="white-space:nowrap">'+(f.tipo==='cuota'?'<span class="gst-fecha">'+fDate(f.fecha)+'</span>':cellIn('gastos',g.id,'fecha',g.fecha,{type:'date'}))+'</td>'
      +'<td><div class="name-cell"><span class="gst-ico">'+gstIco(g.cat)+'</span>'
        +(f.tipo==='cuota'?'<b class="gst-nom">'+esc(g.concepto)+'</b>':cellIn('gastos',g.id,'concepto',g.concepto,{ph:'¿Qué se pagó?'}))
        +(f.det?'<span class="gst-cuota">'+f.det+'</span>':'')
        +(g.fijo?'<span class="gst-fijo" data-tip="Gasto fijo: se puede traer del mes anterior con un botón">fijo</span>':'')+'</div></td>'
      +'<td>'+(f.tipo==='cuota'?'<span class="muted-cell">'+esc(g.cat||'—')+'</span>':cellIn('gastos',g.id,'cat',g.cat,{list:'dl-gastocats',ph:'Categoría'}))+'</td>'
      +'<td class="num"><b>'+(f.importe===null?'<span class="muted-cell">—</span>':money(f.importe))+'</b></td>'
      +'<td class="num gst-iva">'+gstCeldaIva(f)+'</td>'
      +'<td>'+(f.pagado
        ?'<span class="pill st-done clk" onclick="gstTogglePago(\''+f.tipo+'\',\''+f.id+'\')" data-tip="Tocá para marcarlo como pendiente">Pagado</span>'
        :'<span class="pill st-pend clk" onclick="gstTogglePago(\''+f.tipo+'\',\''+f.id+'\')" data-tip="Tocá para marcarlo como pagado">Pendiente</span>')+'</td>'
      +'<td><div class="row-act">'
        +'<button class="btn-ghost" title="Ver o editar" onclick="gastoForm(\''+g.id+'\')">✎</button>'
        +'<button class="btn-ghost" title="Duplicar" onclick="gstDuplicar(\''+g.id+'\')">⧉</button>'
        +'<button class="btn-ghost" title="Eliminar" style="color:var(--red)" onclick="gstBorrar(\''+f.tipo+'\',\''+f.id+'\')">🗑</button>'
      +'</div></td></tr>';
  }).join('');
  if(!cuerpo)cuerpo=emptyRow(7,'Todavía no hay gastos cargados en '+MESES_L[m]+'.');
  var pie=filas.length?'<tr class="gst-tot"><td colspan="3">Total de '+MESES_L[m]+'</td><td class="num">'+money(t.total)+'</td><td colspan="3"></td></tr>':'';
  return kpis+'<div class="table-wrap"><table style="min-width:900px"><thead><tr><th>Fecha</th><th>Gasto</th><th>Categoría</th><th class="num">Importe</th><th class="num">IVA</th><th>Estado</th><th></th></tr></thead>'
    +'<tbody>'+cuerpo+pie+'</tbody></table></div>'+gstResultado(y,m,t);
}

// Barra de resultado del mes: lo que entró, lo que salió y la diferencia.
function gstResultado(y,m,t){
  var cob=gstCobradoDelMes(y,m), iv=gstIvaDelMes(y,m), iva=iv.iva;
  var celda=function(l,v,cls){ return '<div class="gst-res-i"><span>'+l+'</span><b'+(cls?' class="'+cls+'"':'')+'>'+v+'</b></div>'; };
  if(cob===null&&!iva)return '';
  var h='<div class="gst-res">';
  if(cob!==null){
    var dif=cob-t.pag;
    h+=celda('Honorarios cobrados',money(cob),'ok')
      +celda('Gastos pagados',money(t.pag))
      +celda('Diferencia',(dif<0?'− ':'')+money(Math.abs(dif)),dif<0?'neg':'ok');
  }
  if(iva)h+=celda(iv.ded===iva?'IVA de compras del mes':'IVA deducible del mes',money(iv.ded));
  return h+'</div>';
}

function gstTablaAnual(){
  var y=gstYear(), cats=[], porCat={}, porMes=new Array(12).fill(0), total=0;
  for(var m=0;m<12;m++){
    gstFilasMes(y,m).forEach(function(f){
      var c=(f.g.cat||'Sin categoría').trim(), n=f.importe||0;
      if(!porCat[c]){ porCat[c]=new Array(12).fill(0); cats.push(c); }
      porCat[c][m]+=n; porMes[m]+=n; total+=n;
    });
  }
  cats.sort(function(a,b){ var sa=porCat[a].reduce(function(x,z){return x+z;},0), sb=porCat[b].reduce(function(x,z){return x+z;},0); return sb-sa; });
  var meses=0; porMes.forEach(function(v){ if(v)meses++; });
  var kpis='<div class="kpis kpis-2">'
    +kpiM('Total del año',money(total),y,'')
    +kpiM('Promedio por mes',money(meses?Math.round(total/meses):0),meses?('sobre '+meses+(meses===1?' mes con gastos':' meses con gastos')):'','')
    +'</div>';
  if(!cats.length)return kpis+'<div class="table-wrap"><table><tbody>'+emptyRow(1,'Todavía no hay gastos cargados en '+y+'.')+'</tbody></table></div>';
  var head='<tr><th>Categoría</th>'+MESES.map(function(m){return '<th class="num">'+m+'</th>';}).join('')+'<th class="num">Total</th></tr>';
  var cuerpo=cats.map(function(c){
    var fila=porCat[c], suma=fila.reduce(function(x,z){return x+z;},0);
    return '<tr><td><div class="name-cell"><span class="gst-ico">'+gstIco(c)+'</span><b>'+esc(c)+'</b></div></td>'
      +fila.map(function(v){return '<td class="num">'+(v?numTxt(v):'<span class="muted-cell">—</span>')+'</td>';}).join('')
      +'<td class="num"><b>'+money(suma)+'</b></td></tr>';
  }).join('');
  var pie='<tr class="gst-tot"><td>Total por mes</td>'+porMes.map(function(v){return '<td class="num">'+(v?numTxt(v):'—')+'</td>';}).join('')+'<td class="num">'+money(total)+'</td></tr>';
  return kpis+'<div class="table-wrap"><table style="min-width:1040px"><thead>'+head+'</thead><tbody>'+cuerpo+pie+'</tbody></table></div>';
}

/* ===== traer los gastos fijos del mes anterior ===== */
function gstCopiarFijos(){
  var y=gstYear(), m=gstMes, pm=m-1, py=y; if(pm<0){ pm=11; py--; }
  var fijos=Store.all('gastos').filter(function(g){ return g.fijo&&g.forma!=='credito'&&gstAnioDe(g)===py&&gstMesDe(g)===pm; });
  if(!fijos.length){ toast('El mes anterior no tiene gastos fijos marcados'); return; }
  var yaHay=Store.all('gastos').filter(function(g){ return gstAnioDe(g)===y&&gstMesDe(g)===m; }), nuevos=0;
  fijos.forEach(function(g){
    var repetido=yaHay.some(function(x){ return (x.concepto||'').trim().toLowerCase()===(g.concepto||'').trim().toLowerCase(); });
    if(repetido)return;
    Store.upsert('gastos',{concepto:g.concepto,cat:g.cat,importe:g.importe,proveedor:g.proveedor||'',medio:g.medio||'',
      fecha:y+'-'+String(m+1).padStart(2,'0')+'-'+((g.fecha||'').slice(8,10)||'01'), pagado:false, fechaPago:'', factura:'',
      fijo:true, forma:'contado', conIva:!!g.conIva, iva:g.conIva?g.iva:0, notas:''});
    nuevos++;
  });
  renderGastos();
  toast(nuevos?('✓ Se trajeron '+nuevos+' gastos fijos de '+MESES_L[pm]):'Esos gastos fijos ya estaban cargados');
}

/* ===== datos de ejemplo para la demostración (todos inventados) ===== */
function seedGastos(){
  var yy=new Date().getFullYear(), mm=new Date().getMonth(), hoy=new Date().getDate();
  var f=function(m,d){ return yy+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); };
  var fijos=[
    {concepto:'Alquiler de la oficina',cat:'Alquiler',importe:28000,proveedor:'Inmobiliaria del Centro',medio:'Transferencia',dia:5},
    {concepto:'UTE',cat:'Luz',importe:3450,proveedor:'UTE',medio:'BROU',dia:12},
    {concepto:'OSE',cat:'Agua',importe:980,proveedor:'OSE',medio:'BROU',dia:12},
    {concepto:'Antel fibra y teléfono',cat:'Internet y teléfono',importe:2190,proveedor:'Antel',medio:'BROU',dia:15},
  ];
  var out=[];
  for(var k=3;k>=0;k--){
    var m=mm-k; if(m<0)continue;
    fijos.forEach(function(g,i){
      var pago=(k>0)||(g.dia<=hoy);
      out.push({id:'g'+m+'-'+i,fecha:f(m,g.dia),concepto:g.concepto,cat:g.cat,importe:g.importe,proveedor:g.proveedor,
        medio:g.medio,pagado:pago,fechaPago:pago?f(m,g.dia):'',factura:'',fijo:true,forma:'contado',conIva:false,iva:0,notas:''});
    });
  }
  out.push({id:'gx1',fecha:f(mm,8),concepto:'Resma de hojas y tóner',cat:'Papelería y librería',importe:1870,proveedor:'Librería Central',
    medio:'Efectivo',pagado:true,fechaPago:f(mm,8),factura:'A 4821',fijo:false,forma:'contado',conIva:true,iva:337,ivaModo:'incluido',ivaDed:100,notas:''});
  out.push({id:'gx3',fecha:f(mm,3),concepto:'Sistema de contabilidad (mensual)',cat:'Software y sistemas',importe:4200,proveedor:'',
    medio:'Transferencia',pagado:true,fechaPago:f(mm,3),factura:'',fijo:true,forma:'contado',conIva:false,iva:0,notas:''});
  out.push({id:'gx4',fecha:f(mm,28),concepto:'Servicio de limpieza',cat:'Limpieza',importe:2800,proveedor:'Marta Do Santos',
    medio:'Efectivo',pagado:false,fechaPago:'',factura:'',fijo:true,forma:'contado',conIva:false,iva:0,notas:''});
  out.push({id:'gx5',fecha:f(mm,22),concepto:'Combustible y peajes',cat:'Movilidad',importe:3200,proveedor:'Ancap',
    medio:'Visa',pagado:true,fechaPago:f(mm,22),factura:'B 9134',fijo:false,forma:'contado',conIva:true,iva:577,ivaModo:'incluido',ivaDed:50,notas:'El IVA del combustible se computa al 50%'});
  // Una compra a crédito, para que se vea cómo funcionan las cuotas.
  out.push({id:'gx2',fecha:f(mm,17),concepto:'Escritorio y silla',cat:'Muebles y útiles',importe:12600,proveedor:'Mueblería Rivera',
    medio:'Visa',pagado:false,fechaPago:'',factura:'A 1207',fijo:false,forma:'credito',cuotas:6,primera:gstSumarMeses(f(mm,17),1),
    conIva:true,iva:2272,ivaModo:'incluido',ivaDed:50,notas:'6 cuotas sin interés · el IVA de muebles se computa al 50%'});
  return out;
}
// Las cuotas de los ejemplos (se arman a partir de la compra a crédito).
function seedCuotas(gastos){
  var g=(gastos||[]).find(function(x){ return x.forma==='credito'; });
  if(!g)return [];
  var N=g.cuotas, total=honNum(g.importe)||0, base=Math.floor(total/N*100)/100, acum=0, out=[];
  for(var n=1;n<=N;n++){
    var ultima=(n===N), imp=ultima?Math.round((total-acum)*100)/100:base;
    if(!ultima)acum=Math.round((acum+base)*100)/100;
    out.push({id:'c'+n,gastoId:g.id,n:n,importe:imp,fecha:gstSumarMeses(g.primera,n-1),pagado:false,fechaPago:''});
  }
  return out;
}
