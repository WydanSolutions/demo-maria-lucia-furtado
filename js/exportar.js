/*
 * Exportar tablas a Excel y PDF. Se exporta lo que se ve en pantalla (con los filtros aplicados).
 */
function expRows(kind,arg){
  if(kind==='decl'){var rows=declFiltered();return {title:'Declaraciones · '+folderName(arg)+' · '+declYear(),cols:['Cliente','Tipo de DJ','Vencimiento','Presentada','Importe','Medio de pago','Fecha de pago','Estado','Notas'],data:rows.map(function(d){return [cliName(d.clienteId),d.tipoDj||'',fDate(d.venc),fDate(d.presentada),d.importe||'',d.medio||'',fDate(d.fechaPago),d.estado||'',d.notas||''];})};}
  if(kind==='grid'){var gid=arg,meta=GRID_META[gid],rows=Store.data.grids[gid].rows;var cols=['Nombre'].concat(meta.hasTag?['Tipo']:[]).concat(MESES);return {title:meta.title+' '+anioActivo(),cols:cols,data:rows.map(function(r){var row=[r.nombre];if(meta.hasTag)row.push(r.tipo||'');for(var i=0;i<12;i++){var c=gcell(r,i),st=cellEst(c);row.push(st==='done'?(c.fecha?fDate(c.fecha):'Hecho')+(c.enviado?' (enviado)':''):st==='na'?'N/A':st==='pend'?'Pendiente':'');}return row;})};}
  if(kind==='sueldos'){var rows=sldRows(sldSub),sub=sldSubsList().find(function(s){return s.id===sldSub;}),sc=sldCols();return {title:'Sueldos · '+(sub?sub.name:'')+' · '+MESES_L[sldMes]+' '+sldAnio,cols:['Empresa','Estado'].concat(sc.map(function(c){return c.label;})),data:rows.map(function(r){return [r.empresa,r.estado].concat(sc.map(function(c){return c.type==='check'?(r[c.key]?'Sí':''):(r[c.key]||'');}));})};}
  // Clientes: todas las columnas de la ficha, contraseñas incluidas (pedido del cliente; se avisa antes de exportar).
  if(kind==='clientes'){var rows=_cliFiltered();return {title:'Info. Clientes',cols:['Nombre','Tipo','RUT','BPS','CI','Fecha nac.','Contraseña BPS','Contraseña gub.uy','Códigos gub.uy','WhatsApp','Correo','Dirección','Otros','Observaciones','Notas','Estado'],data:rows.map(function(c){return [c.nombre,c.tipo||'',c.rut||'',c.bps||'',c.ci||'',c.fnac?fDate(c.fnac):'',c.passBps||'',c.passGub||'',c.codGub||'',c.whatsapp||'',c.correo||'',c.direccion||'',c.fosmetal||'',c.otros||'',c.notas||'',c.archivado?'Archivado':'Activo'];})};}
  if(kind==='hon')return honExpRows();
  return {title:'',cols:[],data:[]};
}
function doExport(kind,fmt,arg){if(kind==='clientes'&&Boveda.necesitaPara(Store.all('clientes'))){Boveda.pedir(function(){doExport(kind,fmt,arg);});return;}if(kind==='clientes'&&!confirm('El archivo va a incluir las contraseñas de los clientes, sin cifrar.\n\nGuardalo en un lugar seguro y no lo mandes por mail ni WhatsApp. ¿Exportar igual?'))return;var d=expRows(kind,arg);if(!d.data.length){toast('Nada para exportar');return;}if(fmt==='xls')exportExcel(d.title,d.cols,d.data);else exportPDF(d.title,d.cols,d.data);}
function expBtns(kind,arg){arg=arg||'';return '<button class="btn btn-sm" onclick="doExport(\''+kind+'\',\'xls\',\''+arg+'\')">⬇ Excel</button><button class="btn btn-sm" onclick="doExport(\''+kind+'\',\'pdf\',\''+arg+'\')">⬇ PDF</button>';}
// Excel: solo título y tabla (sin logo).
function exportExcel(title,cols,data){
  var head='<tr style="background:#0f2447;color:#fff">'+cols.map(function(c){return '<th style="padding:6px 10px;border:1px solid #091830;text-align:left">'+esc(c)+'</th>';}).join('')+'</tr>';
  var body=data.map(function(r,i){return '<tr style="background:'+(i%2?'#eef1f7':'#ffffff')+'">'+r.map(function(v){return '<td style="padding:5px 10px;border:1px solid #d8dfea;mso-number-format:\'\@\'">'+(v==null?'':esc(String(v)))+'</td>';}).join('')+'</tr>';}).join('');
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>'
    +'<table><tr><td style="font-family:Georgia;font-size:20px;color:#0f2447"><b>María Lucía Furtado · Contadora Pública</b></td></tr><tr><td style="font-size:13px;color:#6b7585">'+esc(title)+' — '+new Date().toLocaleDateString('es-UY')+'</td></tr></table><br>'
    +'<table style="border-collapse:collapse;font-family:Arial;font-size:12px">'+head+body+'</table></body></html>';
  var blob=new Blob(['﻿'+html],{type:'application/vnd.ms-excel'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=title.replace(/[^\w]+/g,'_')+'.xls';a.click();toast('Excel generado');
}
function exportPDF(title,cols,data){
  var head='<tr>'+cols.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr>';
  var body=data.map(function(r){return '<tr>'+r.map(function(v){return '<td>'+(v==null?'':esc(String(v)))+'</td>';}).join('')+'</tr>';}).join('');
  var w=window.open('','_blank');if(!w){toast('Permití las ventanas emergentes para el PDF');return;}
  w.document.write('<html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial;color:#16202e;padding:26px}.hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #0f2447;padding-bottom:14px;margin-bottom:18px}.hd img{height:66px}.hd h1{font-family:Georgia;color:#0f2447;font-size:22px;margin:0}.hd .s{font-size:11px;letter-spacing:2px;color:#6b7585;text-transform:uppercase}.ti{font-size:15px;color:#091830;margin:0 0 12px;font-weight:bold}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#0f2447;color:#fff;text-align:left;padding:8px 10px}td{border-bottom:1px solid #e2e6ec;padding:6px 10px}tr:nth-child(even) td{background:#f7f9fc}.ft{margin-top:20px;font-size:10px;color:#98a1b0}@media print{.noprint{display:none}}</style></head><body>'
    +'<div class="hd"><img src="'+LOGO+'"><div><h1>María Lucía Furtado</h1><div class="s">Contadora Pública</div></div></div>'
    +'<div class="ti">'+esc(title)+' — '+new Date().toLocaleDateString('es-UY')+'</div><table>'+head+body+'</table>'
    +'<div class="ft">Generado desde el sistema de gestión · '+new Date().toLocaleString('es-UY')+'</div>'
    +'<div class="noprint" style="margin-top:22px"><button onclick="window.print()" style="padding:10px 18px;background:#0f2447;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer">🖨 Imprimir / Guardar PDF</button></div></body></html>');
  w.document.close();setTimeout(function(){try{w.focus();}catch(e){}},250);
}
