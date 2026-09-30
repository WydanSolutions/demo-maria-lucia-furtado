/*
 * Ficha de un gasto: alta, edición y borrado (se abre desde la pestaña Gastos).
 * Está separada de gastos.js porque tiene bastante lógica propia: la forma de pago
 * (contado o crédito), el plan de cuotas con su resumen en vivo, y el IVA de la factura.
 */
/* ===== FICHA DE GASTO ===== */
var _gstForm=null;

function gastoForm(id){
  var g=id?Object.assign({},Store.get('gastos',id))
          :{fecha:today(),forma:'contado',cuotas:6,primera:gstSumarMeses(today(),1),pagado:false,conIva:false};
  if(!g.forma)g.forma='contado';
  if(!g.cuotas)g.cuotas=6;
  if(!g.primera)g.primera=gstSumarMeses(g.fecha||today(),1);
  _gstForm=g; curForm={form:'gasto',id:id||null};
  $('#modal-title').textContent=id?'Gasto · '+(g.concepto||''):'Nuevo gasto';
  $('#modal-del').style.display=id?'inline-flex':'none';
  gstFormPintar();
  $('#modal').classList.add('open');
  setTimeout(function(){ var i=$('#modal-body [data-k="concepto"]'); if(i&&!id)i.focus(); },60);
}
// Vuelca a memoria lo que hay escrito en pantalla (para no perder nada al cambiar de forma de pago).
function gstFormLeer(){
  $('#modal-body').querySelectorAll('[data-k]').forEach(function(el){ _gstForm[el.dataset.k]=el.type==='checkbox'?el.checked:el.value; });
}
function gstFormSetForma(v){ gstFormLeer(); _gstForm.forma=v; gstFormPintar(); }
function gstFormSetIva(el){ gstFormLeer(); _gstForm.conIva=el.checked; gstFormPintar(); }

function gstFormPintar(){
  var g=_gstForm, credito=(g.forma==='credito');
  var pagas=curForm.id?gstCuotasDe(curForm.id).filter(function(c){return c.pagado;}).length:0;
  var h='<div class="field"><label>¿Qué se pagó? <span class="req">*</span></label>'
      +'<input data-k="concepto" list="dl-gastos" autocomplete="off" value="'+esc(g.concepto||'')+'" placeholder="Ej: Alquiler de la oficina, UTE, resma de hojas…"></div>'
    +'<div class="field-2"><div class="field"><label>Categoría</label>'
      +'<input data-k="cat" list="dl-gastocats" autocomplete="off" value="'+esc(g.cat||'')+'" placeholder="Elegí una o escribí la tuya"></div>'
      +'<div class="field"><label>Proveedor <span class="opt">(opcional)</span></label>'
      +'<input data-k="proveedor" list="dl-proveedores" autocomplete="off" value="'+esc(g.proveedor||'')+'"></div></div>'
    +'<div class="field-2"><div class="field"><label>Fecha de la compra</label>'
      +'<input type="date" data-k="fecha"'+DR+' value="'+esc(g.fecha||'')+'" onchange="gstFormResumen()"></div>'
      +'<div class="field"><label>'+(credito?'Total a pagar':'Importe')+' <span class="req">*</span></label>'
      +'<input data-k="importe" value="'+esc(numTxt(honNum(g.importe)))+'" placeholder="Ej: 12.600" oninput="gstFormResumen()"></div></div>';

  // IVA de la factura (le sirve para el crédito fiscal)
  h+='<div class="gst-box"><label class="chkline"><input type="checkbox" data-k="conIva" '+(g.conIva?'checked':'')+' onchange="gstFormSetIva(this)"> La factura incluye IVA (22%)</label>';
  if(g.conIva){
    var ivaSug=(g.iva!==undefined&&g.iva!==''&&g.iva!==null)?honNum(g.iva):gstIvaSugerido(honNum(g.importe));
    h+='<div class="field" style="margin:10px 0 0"><label>IVA incluido</label>'
      +'<input data-k="iva" value="'+esc(numTxt(ivaSug))+'" placeholder="0">'
      +'<div class="gst-ayuda">Se calcula solo sobre el total; si la factura dice otra cosa, corregilo.</div></div>';
  }
  h+='</div>';

  // Forma de pago
  h+='<div class="field"><label>Forma de pago</label>'
    +'<div class="gseg gst-forma"><button type="button" class="gv'+(credito?'':' active')+'" onclick="gstFormSetForma(\'contado\')">Contado</button>'
    +'<button type="button" class="gv'+(credito?' active':'')+'" onclick="gstFormSetForma(\'credito\')">Crédito / cuotas</button></div></div>';

  if(!credito){
    h+='<label class="chkline"><input type="checkbox" data-k="pagado" '+(g.pagado?'checked':'')+'> Ya está pagado</label>'
      +'<div class="field-2"><div class="field"><label>Fecha de pago</label><input type="date" data-k="fechaPago"'+DR+' value="'+esc(g.fechaPago||'')+'"></div>'
      +'<div class="field"><label>Medio de pago</label><input data-k="medio" list="dl-medio" autocomplete="off" value="'+esc(g.medio||'')+'"></div></div>';
  }else{
    h+='<div class="gst-box"><div class="field-2" style="margin:0">'
      +'<div class="field"><label>Cantidad de cuotas</label><input type="number" min="1" max="60" data-k="cuotas" value="'+esc(g.cuotas||6)+'" oninput="gstFormResumen()"></div>'
      +'<div class="field"><label>Primera cuota</label><input type="date" data-k="primera"'+DR+' value="'+esc(g.primera||'')+'" onchange="gstFormResumen()"></div></div>'
      +'<div class="field" style="margin-bottom:0"><label>Tarjeta o financiera</label><input data-k="medio" list="dl-plat" autocomplete="off" value="'+esc(g.medio||'')+'" placeholder="Ej: Visa, OCA, Creditel…"></div>'
      +'<div class="gst-plan" id="gst-resumen"></div>'
      +(pagas?'<div class="gst-ayuda">🔒 '+pagas+(pagas===1?' cuota ya está paga: no se modifica':' cuotas ya están pagas: no se modifican')+'. Lo que cambies se reparte entre las que faltan.</div>':'')
      +'</div>';
  }

  h+='<div class="field"><label>N° de factura <span class="opt">(opcional)</span></label><input data-k="factura" value="'+esc(g.factura||'')+'"></div>'
    +'<label class="chkline"><input type="checkbox" data-k="fijo" '+(g.fijo?'checked':'')+'> Es un gasto fijo (se repite todos los meses)</label>'
    +'<div class="field"><label>Notas</label><textarea data-k="notas">'+esc(g.notas||'')+'</textarea></div>';
  $('#modal-body').innerHTML=h;
  gstFormResumen();
}
function gstIvaSugerido(total){ return total?Math.round(total*IVA_GASTO/(1+IVA_GASTO)):0; }

// Resumen en vivo del plan de cuotas: se actualiza mientras escribe, sin repintar el formulario.
function gstFormResumen(){
  var box=document.getElementById('gst-resumen'); if(!box)return;
  var v=function(k){ var e=$('#modal-body [data-k="'+k+'"]'); return e?e.value:''; };
  var total=honNum(v('importe'))||0, N=Math.max(1,parseInt(v('cuotas'),10)||0), primera=v('primera');
  if(!total||!primera){ box.innerHTML='<span class="gst-ayuda">Poné el total y la fecha de la primera cuota y te muestro el plan.</span>'; return; }
  var base=Math.floor(total/N*100)/100, ultima=Math.round((total-base*(N-1))*100)/100;
  var fin=gstSumarMeses(primera,N-1);
  var mes=function(iso){ return MESES_L[+iso.slice(5,7)-1]+' '+iso.slice(0,4); };
  box.innerHTML='<b>'+N+(N===1?' cuota de ':' cuotas de ')+money(base)+'</b>'
    +(Math.abs(ultima-base)>0.009?' <span class="gst-ayuda2">(la última, '+money(ultima)+')</span>':'')
    +'<span class="gst-plan-d">de '+mes(primera)+' a '+mes(fin)+'</span>';
}

/* ===== guardar y borrar ===== */
function gastoSave(){
  gstFormLeer();
  var g=_gstForm;
  if(!(g.concepto||'').trim()){ toast('Falta escribir qué se pagó'); return; }
  var total=honNum(g.importe);
  if(!total||total<=0){ toast('Falta el importe'); return; }
  if(!modalDatesOk())return;
  var credito=(g.forma==='credito');
  var pagas=curForm.id?gstCuotasDe(curForm.id).filter(function(c){return c.pagado;}).length:0;
  var N=Math.max(1,parseInt(g.cuotas,10)||1);
  if(credito){
    if(!g.primera){ toast('Falta la fecha de la primera cuota'); return; }
    if(N<pagas){ toast('Ya hay '+pagas+' cuotas pagas: no se puede bajar de esa cantidad'); return; }
  }
  var o=curForm.id?Store.get('gastos',curForm.id):{};
  o.concepto=(g.concepto||'').trim(); o.cat=(g.cat||'').trim(); o.proveedor=(g.proveedor||'').trim();
  o.fecha=g.fecha||today(); o.importe=total; o.factura=(g.factura||'').trim(); o.notas=g.notas||'';
  o.fijo=!!g.fijo; o.medio=(g.medio||'').trim();
  o.conIva=!!g.conIva; o.iva=o.conIva?(honNum(g.iva)||gstIvaSugerido(total)):0;
  o.forma=credito?'credito':'contado';
  if(credito){
    o.cuotas=N; o.primera=g.primera; o.pagado=false; o.fechaPago='';
  }else{
    o.cuotas=null; o.primera=''; o.pagado=!!g.pagado; o.fechaPago=o.pagado?(g.fechaPago||o.fecha):'';
  }
  gstCatAddName(o.cat);
  var guardado=Store.upsert('gastos',o);
  gstSincronizarCuotas(guardado);
  closeModal(); renderGastos();
  toast(curForm.id?'Cambios guardados':(credito?'✓ Gasto y cuotas creados':'✓ Gasto creado'));
}
function gastoDel(){ var id=curForm.id; closeModal(); gstBorrar('gasto',id); }
