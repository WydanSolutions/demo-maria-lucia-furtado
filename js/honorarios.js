/*
 * Sección: Honorarios. Vista mensual (detalle de cobro de cada cliente) y anual (grilla por mes).
 * - IVA 22%: solo cuando la fila tiene N° de factura.
 * - Estado: Pagado (tiene fecha de pago) · Atrasado (el mes terminó sin pago) · Pendiente.
 * Datos: honCli = clientes con su honorario mensual · honMov = lo registrado cada mes (factura, recibo, pago…).
 */
/* ===== HONORARIOS ===== */
var honAnio=null, honMes=new Date().getMonth(), honVista='mensual', honQ='', honArch=false;
const IVA=0.22, HON_EST={pag:'Pagado',pen:'Pendiente',atr:'Atrasado'};
function honYear(){return honAnio||anioActivo();}
function setHonAnio(y){honAnio=y;renderHon();}
function setHonVista(v){honVista=v;renderHon();}
function setHonMes(m){honMes=m;renderHon();}
// Datos de ejemplo (inventados).
function seedHon(){
  var yy=new Date().getFullYear(), mm=new Date().getMonth();
  var cli=[{id:'h1',clienteId:'c1',importe:2500,medio:'BROU'},{id:'h2',clienteId:'c2',importe:8900,medio:'Itaú'},{id:'h3',clienteId:'c3',importe:4000,medio:'Transferencia'},{id:'h4',clienteId:'c6',importe:1500,medio:'Efectivo'}];
  var mov=[];
  for(var m=0;m<mm;m++) cli.forEach(function(r){ if(r.id==='h3'&&m>=mm-2)return; mov.push({id:'hm'+r.id+'-'+m,rowId:r.id,anio:yy,mes:m,factura:r.id==='h2'?String(100+m):'',recibo:'',fecha:yy+'-'+String(m+1).padStart(2,'0')+'-10',medio:r.medio}); });
  return {cli:cli,mov:mov};
}
function honRows(){var q=honQ.toLowerCase();return Store.all('honCli').filter(function(r){return !!r.archivado===honArch&&(!q||cliNameOr(r.clienteId).toLowerCase().includes(q));}).sort(function(a,b){return cliNameOr(a.clienteId).localeCompare(cliNameOr(b.clienteId));});}
function honMovOf(rowId,y,m){return Store.all('honMov').find(function(x){return x.rowId===rowId&&x.anio===y&&x.mes===m;});}
// Cálculo de un mes para una fila: importe, IVA, total y estado.
function honCalc(r,y,m){
  var mv=honMovOf(r.id,y,m)||{};
  var imp=honNum(mv.importe!=null&&mv.importe!==''?mv.importe:r.importe);
  if(imp===null)return {mv:mv,imp:null};
  var iva=mv.factura?Math.round(imp*IVA*100)/100:0, now=new Date();
  var mesTerminado=y<now.getFullYear()||(y===now.getFullYear()&&m<now.getMonth());
  return {mv:mv,imp:imp,iva:iva,tot:imp+iva,est:mv.fecha?'pag':mesTerminado?'atr':'pen'};
}
// Guarda un dato del mes y actualiza solo los números (sin redibujar la tabla, para no cortar lo que se está escribiendo).
function honSet(rowId,f,v){var y=honYear(),m=honMes,mv=honMovOf(rowId,y,m);if(!mv){mv={id:'hm'+Date.now()+Math.floor(Math.random()*999),rowId:rowId,anio:y,mes:m};Store.data.honMov.push(mv);}mv[f]=v;Store.save();honRefresh();}
function honRefresh(){
  var y=honYear(), m=honMes, list=[];
  honRows().forEach(function(r){
    var c=honCalc(r,y,m); list.push(c);
    var tr=document.querySelector('#hon-body tr[data-row="'+r.id+'"]'); if(!tr)return;
    tr.querySelector('.h-iva').textContent=c.iva?money(c.iva):'—';
    tr.querySelector('.h-tot').innerHTML='<b>'+(c.imp===null?'—':money(c.tot))+'</b>';
    tr.querySelector('.h-est').innerHTML=honEstHtml(c);
  });
  var k=document.getElementById('hon-kpis'); if(k)k.innerHTML=honKpis(list);
  var t=document.getElementById('hon-totrow'); if(t)t.outerHTML=honTotRow(list,m);
}
function renderHon(){
  var y=honYear();
  var h='<div class="view-head"><div><h2>Honorarios <span style="color:var(--muted);font-weight:400">'+y+'</span></h2></div><span class="sld-top">'+yearSelect(y,'setHonAnio')
    +'<span class="gseg"><button class="gv'+(honVista==='mensual'?' active':'')+'" onclick="setHonVista(\'mensual\')">▦ Mensual</button><button class="gv'+(honVista==='anual'?' active':'')+'" onclick="setHonVista(\'anual\')">▤ Anual</button></span>'
    +'<span class="glegend"><span class="lg"><i style="background:var(--green)"></i>Pagado</span><span class="lg"><i style="background:var(--amber)"></i>Pendiente</span><span class="lg"><i style="background:var(--red)"></i>Atrasado</span></span>'
    +expBtns('hon')+'<button class="btn btn-sm btn-primary" onclick="honCliForm()">+ Cliente</button></span></div>';
  h+='<div class="toolbar"><div class="search"><input placeholder="Buscar cliente…" value="'+esc(honQ)+'" oninput="honQ=this.value;renderHonBody()"></div><label class="chkline"><input type="checkbox" '+(honArch?'checked':'')+' onchange="honArch=this.checked;renderHonBody()"> Ver archivados</label></div>';
  if(honVista==='mensual') h+='<div class="months">'+MESES.map(function(m,i){return '<button class="mbtn'+(i===honMes?' active':'')+'" onclick="setHonMes('+i+')">'+m.toUpperCase()+'</button>';}).join('')+'</div>';
  h+='<div id="hon-body"></div><div class="hon-foot">💡 El IVA 22% se calcula solo cuando la fila tiene N° de factura; sin factura, el importe queda tal cual. El estado pasa a <b>Atrasado</b> solo si el mes terminó sin fecha de pago. Tocá el nombre para ver la ficha del cliente, y ✎ para cambiar su honorario mensual o archivarlo.</div>';
  $('#view-hon').innerHTML=h; renderHonBody();
}
function kpiM(l,n,f,c){return '<div class="kpi '+c+'"><div class="k-label">'+l+'</div><div class="k-num money">'+n+'</div>'+(f?'<div class="k-foot">'+f+'</div>':'')+'</div>';}
function honKpis(list){
  var total=0,cob=0,nc=0,atr=0,na=0,pend=0;
  list.forEach(function(c){if(c.imp===null)return;total+=c.tot;if(c.est==='pag'){cob+=c.tot;nc++;}else{pend++;if(c.est==='atr'){atr+=c.tot;na++;}}});
  return '<div class="kpis">'+kpiM('Total a cobrar',money(total),'','')+kpiM('Cobrado · '+nc,money(cob),'','k-green')+kpiM('Atrasado · '+na,money(atr),'','k-alerta')+kpiM('Cobrado',(total?Math.round(cob/total*100):0)+'%',pend+' pendiente'+(pend===1?'':'s'),'k-amber')+'</div>';
}
function honEstHtml(c){return c.imp===null?'<span class="muted-cell">—</span>':'<span class="hon-est '+c.est+'">'+HON_EST[c.est]+'</span>';}
function honTotRow(list,m){var t={imp:0,iva:0,tot:0};list.forEach(function(c){if(c.imp!==null){t.imp+=c.imp;t.iva+=c.iva;t.tot+=c.tot;}});return '<tr class="hon-tot" id="hon-totrow"><td>TOTAL · '+MESES_L[m].toUpperCase()+'</td><td class="hon-num">'+money(t.imp)+'</td><td class="hon-num">'+(t.iva?money(t.iva):'—')+'</td><td class="hon-num">'+money(t.tot)+'</td><td colspan="5"></td></tr>';}
function honName(r){return '<div class="name-cell">'+cliLink(r.clienteId,'(cliente borrado)')+'<button class="go-cli" title="Honorario mensual, medio de pago y archivar" onclick="honCliForm(\''+r.id+'\')">✎</button></div>';}
function honIn(rowId,f,v,o){o=o||{};var d=o.type==='date';return '<input class="cell-in'+(o.cls?' '+o.cls:'')+'"'+(o.type?' type="'+o.type+'"':'')+(d?DR:'')+(o.list?' list="'+o.list+'" autocomplete="off"':'')+' value="'+esc(v==null?'':v)+'" placeholder="'+(o.ph||'')+'" onchange="'+(d?'if(dateOk(this))':'')+'honSet(\''+rowId+'\',\''+f+'\',this.value)">';}
function renderHonBody(){
  var el=$('#hon-body'); if(!el)return;
  var y=honYear(), rows=honRows();
  if(honVista==='anual'){
    var all=[];
    var body=rows.length?rows.map(function(r){return '<tr class="hon-a"><td>'+honName(r)+'</td>'+[...Array(12).keys()].map(function(m){var c=honCalc(r,y,m);all.push(c);if(c.imp===null)return '<td class="muted-cell" style="text-align:center">·</td>';return '<td class="m '+c.est+'" style="cursor:pointer" data-tip="'+esc(MESES_L[m]+': '+money(c.tot)+' · '+HON_EST[c.est]+(c.mv.fecha?' ('+fDate(c.mv.fecha)+')':''))+'" onclick="honMes='+m+';setHonVista(\'mensual\')">'+numTxt(Math.round(c.tot))+'</td>';}).join('')+'</tr>';}).join(''):emptyRow(13,honQ?'Ningún cliente coincide con la búsqueda.':'Sin clientes en Honorarios. Usá "+ Cliente".');
    el.innerHTML='<div id="hon-kpis">'+honKpis(all)+'</div><div class="table-wrap"><table style="min-width:1100px"><thead><tr><th>Cliente</th>'+MESES.map(function(m){return '<th style="text-align:right">'+m.toUpperCase()+'</th>';}).join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
    return;
  }
  var m=honMes, calcs=rows.map(function(r){return honCalc(r,y,m);});
  var body=rows.length?rows.map(function(r,i){var c=calcs[i],mv=c.mv,sin=c.imp===null;
    return '<tr data-row="'+r.id+'"><td>'+honName(r)+'</td>'
      +'<td>'+honIn(r.id,'importe',sin?'':numTxt(c.imp),{cls:'num',ph:'$'})+'</td>'
      +'<td class="hon-num muted-cell h-iva">'+(c.iva?money(c.iva):'—')+'</td>'
      +'<td class="hon-num h-tot"><b>'+(sin?'—':money(c.tot))+'</b></td>'
      +'<td>'+honIn(r.id,'factura',mv.factura,{ph:'+ N°'})+'</td>'
      +'<td>'+honIn(r.id,'recibo',mv.recibo,{ph:'+ recibo'})+'</td>'
      +'<td>'+honIn(r.id,'fecha',mv.fecha,{type:'date'})+'</td>'
      +'<td>'+honIn(r.id,'medio',mv.medio||r.medio,{list:'dl-medio',ph:'—'})+'</td>'
      +'<td class="h-est">'+honEstHtml(c)+'</td></tr>';}).join(''):emptyRow(9,honQ?'Ningún cliente coincide con la búsqueda.':'Sin clientes en Honorarios. Usá "+ Cliente".');
  el.innerHTML='<div id="hon-kpis">'+honKpis(calcs)+'</div><div class="table-wrap"><table style="min-width:1050px"><thead><tr><th>Cliente</th><th style="text-align:right">Honorarios</th><th style="text-align:right">IVA 22%</th><th style="text-align:right">Total</th><th>N° factura</th><th>Recibo</th><th>Fecha pago</th><th>Medio</th><th>Estado</th></tr></thead><tbody>'+body+(rows.length?honTotRow(calcs,m):'')+'</tbody></table></div>';
}
/* Alta / edición de un cliente en Honorarios (ventana modal) */
function honCliForm(id){
  var r=id?Store.get('honCli',id):{}; curForm={form:'honcli',id:id||null};
  $('#modal-title').textContent=id?'Honorarios · '+cliNameOr(r.clienteId):'Nuevo cliente en Honorarios'; $('#modal-del').style.display=id?'inline-flex':'none';
  $('#modal-body').innerHTML='<div class="field"><label>Cliente <span class="req">*</span></label><input data-k="nombre" list="dl-clientes" autocomplete="off" value="'+esc(cliNameOr(r.clienteId))+'" placeholder="Empezá a escribir y elegí de la lista…"><div class="muted-cell" style="font-size:11px;margin-top:4px">Si no está en Info. Clientes, se agrega automáticamente.</div></div>'
    +'<div class="field-2"><div class="field"><label>Honorario mensual (sin IVA)</label><input data-k="importe" value="'+esc(numTxt(r.importe))+'" placeholder="Ej: 2.500"></div><div class="field"><label>Medio de pago habitual</label><input data-k="medio" list="dl-medio" autocomplete="off" value="'+esc(r.medio||'')+'"></div></div>'
    +(id?'<label class="chkline"><input type="checkbox" data-k="archivado" '+(r.archivado?'checked':'')+'> Archivado (deja de aparecer en la lista)</label>':'');
  $('#modal').classList.add('open');
}
function honCliSave(){
  var o={}; $('#modal-body').querySelectorAll('[data-k]').forEach(function(el){o[el.dataset.k]=el.type==='checkbox'?el.checked:el.value;});
  if(!(o.nombre||'').trim()){toast('Falta el cliente');return;}
  var cid=ensureCli(o.nombre);
  if(!curForm.id&&Store.all('honCli').some(function(x){return x.clienteId===cid;})){toast('Ese cliente ya está en Honorarios');return;}
  var r=curForm.id?Store.get('honCli',curForm.id):{};
  r.clienteId=cid; r.importe=honNum(o.importe); r.medio=o.medio||''; r.archivado=!!o.archivado;
  Store.upsert('honCli',r); closeModal(); renderHon(); toast('Guardado');
}
function honCliDel(){ if(!confirm('¿Quitar este cliente de Honorarios? También se borran sus cobros registrados.'))return; var id=curForm.id; Store.data.honCli=Store.all('honCli').filter(function(x){return x.id!==id;}); Store.data.honMov=Store.all('honMov').filter(function(x){return x.rowId!==id;}); Store.save(); closeModal(); renderHon(); toast('Eliminado'); }
function honExpRows(){
  var y=honYear(), rows=honRows();
  if(honVista==='anual') return {title:'Honorarios '+y+' · Anual',cols:['Cliente'].concat(MESES),data:rows.map(function(r){return [cliNameOr(r.clienteId)].concat([...Array(12).keys()].map(function(m){var c=honCalc(r,y,m);return c.imp===null?'':numTxt(c.tot)+' ('+HON_EST[c.est]+')';}));})};
  var m=honMes;
  return {title:'Honorarios · '+MESES_L[m]+' '+y,cols:['Cliente','Honorarios','IVA 22%','Total','N° factura','Recibo','Fecha pago','Medio','Estado'],data:rows.map(function(r){var c=honCalc(r,y,m),mv=c.mv,sin=c.imp===null;return [cliNameOr(r.clienteId),sin?'':numTxt(c.imp),c.iva?numTxt(c.iva):'',sin?'':numTxt(c.tot),mv.factura||'',mv.recibo||'',mv.fecha?fDate(mv.fecha):'',mv.medio||r.medio||'',sin?'':HON_EST[c.est]];})};
}
