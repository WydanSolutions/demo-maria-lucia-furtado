/*
 * Capa de datos. Es el ÚNICO archivo que sabe dónde se guardan los datos: el resto de la página
 * solo usa Store.data.
 * ETAPA DEMO: todo se guarda en el navegador de esta computadora (localStorage, con la clave que
 * está en constantes.js). Los datos son inventados. Cuando la clienta contrate el servicio, este
 * archivo pasa a guardar cada registro como un documento en Firestore.
 * Las contraseñas de los clientes NUNCA se guardan en claro: se cifran antes (ver boveda.js).
 */
const CLI_TIPOS_DEF=['Persona física','Empresa','Otro'];
const EMP_TIPOS_DEF=['Ind. y Comercio','Pequeña empresa','Unipersonal'];
// Listas de registros (cada elemento tiene su propio id).
const COLS_LISTA=['clientes','dj','tareas','notes','cal','sueldos','honCli','honMov','gastos','cuotas'];
// Datos sensibles: se guardan solo cifrados, nunca en claro.
const CREDS=['passBps','passGub','codGub'];
// La nota adhesiva con la que arranca la demostración (la recibe la clienta al entrar).
const NOTA_BIENVENIDA='🌿 ¡Bienvenida, Lucía!\n\nEsta página está hecha para vos. Probá todo con confianza: los datos son de ejemplo.\n\n— Equipo Wydan';
const PANEL_DEF=()=>({venc:true,tareas:true,estado:false,vistas:true,gastos:false,notas:true,calendario:true,kpis:['tareasPend','tareasVenc'],order:PANEL_ORDER_DEF.slice(),widths:Object.assign({},PANEL_WIDTHS_DEF)});

// Texto estable de un objeto (claves ordenadas): sirve para saber si algo cambió.
function canon(v){
  if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
  return JSON.stringify(v===undefined?null:v);
}

const Store={
  data:null,

  load(){
    // Si hay algo guardado en este navegador, se usa. Pero si quedó vacío (o ilegible), se rehacen
    // los datos de ejemplo: una demostración siempre tiene que tener información para mostrar.
    try{
      const r=localStorage.getItem(KEY);
      if(r){
        const d=JSON.parse(r);
        const tieneAlgo=['clientes','dj','tareas','gastos','sueldos','honCli'].some(function(k){ return Array.isArray(d[k])&&d[k].length; });
        if(tieneAlgo){ this.data=d; this._fix(); Boveda.setConfig(this.data.boveda||null); return; }
      }
    }catch(e){ console.error('No se pudieron leer los datos guardados en este navegador',e); }
    try{ this.data=seed(); }
    catch(e){ console.error('No se pudieron armar los datos de ejemplo',e); this.data={}; }
    this._fix(); Boveda.setConfig(null);
  },

  // Guarda en el navegador. Las credenciales se sacan del texto guardado: solo quedan cifradas, en "_sec".
  _escribir(){
    try{ localStorage.setItem(KEY,JSON.stringify(this.data,function(k,v){ return CREDS.indexOf(k)>=0?undefined:v; })); }
    catch(e){ console.error('No se pudo guardar',e); }
  },
  save(){
    if(this.data&&typeof syncCliList==='function')syncCliList(); // la lista para autocompletar clientes, siempre al día
    this._escribir();
    if(Boveda.clave)this._flush();
  },
  // Cifra las credenciales que hayan cambiado y vuelve a guardar.
  async _flush(){
    try{ await Boveda.cifrarPendientes(this.data.clientes); }catch(e){ console.error(e); }
    this._escribir();
  },

  // Completa lo que falte (datos guardados por una versión anterior, o una base recién creada).
  _fix(){
    const d=this.data;
    COLS_LISTA.forEach(k=>{ if(!Array.isArray(d[k]))d[k]=[]; });
    if(!d.grids)d.grids=emptyGrids();
    ['empresas','sprof'].forEach(g=>{ if(!d.grids[g])d.grids[g]={rows:[]}; });
    if(!Array.isArray(d.sldSubs)||!d.sldSubs.length)d.sldSubs=defaultSubs();
    if(!Array.isArray(d.sldHidden))d.sldHidden=[];
    if(!d.sldColsCfg||typeof d.sldColsCfg!=='object')d.sldColsCfg={};
    if(!Array.isArray(d.empTipos))d.empTipos=EMP_TIPOS_DEF.slice();
    if(!Array.isArray(d.gastoCats)||!d.gastoCats.length)d.gastoCats=GASTO_CATS_DEF.slice();
    if(!Array.isArray(d.cliTipos)){ d.cliTipos=CLI_TIPOS_DEF.slice(); d.clientes.forEach(c=>{ if(c.tipo&&d.cliTipos.indexOf(c.tipo)<0)d.cliTipos.push(c.tipo); }); }
    if(!d.panel)d.panel=PANEL_DEF();
    if(!d.gcal)d.gcal={url:'',auto:true,last:0};
    // DEMOSTRACIÓN: si una sección quedó sin ejemplos (por ejemplo, porque esta persona abrió el demo
    // con una versión anterior, cuando Gastos todavía no existía), se vuelven a cargar.
    d.gastos.forEach(function(g){ if(g.conIva){ if(!g.ivaModo)g.ivaModo='incluido'; if(!g.ivaDed)g.ivaDed=100; } });
    if(MODO_DEMO&&!d.gastos.length&&typeof seedGastos==='function'){ d.gastos=seedGastos(); d.cuotas=seedCuotas(d.gastos); }
    // La nota de bienvenida se fue mejorando: si en este navegador quedó una versión anterior, se
    // actualiza sola. Solo toca esa nota, nunca una escrita por la clienta.
    var bv=d.notes.find(function(n){ return n.id==='n1'; });
    var esNuestra=bv&&(/^Esta es una demostración/.test(bv.text||'')||/—\s*Equipo Wydan\s*$/.test(bv.text||''));
    if(esNuestra&&bv.text!==NOTA_BIENVENIDA)bv.text=NOTA_BIENVENIDA;
    // Cada declaración pertenece a un año y puede tener un tipo.
    d.dj.forEach(x=>{ if(!x.anio)x.anio=x.venc?+x.venc.slice(0,4):new Date().getFullYear(); if(x.tipoDj===undefined)x.tipoDj=''; });
    // Vincular por nombre las filas de Empresas / Serv. Profesionales / Sueldos con la ficha del cliente.
    ['empresas','sprof'].forEach(g=>{ (d.grids[g]&&d.grids[g].rows||[]).forEach(r=>{ if(!r.clienteId){ const c=d.clientes.find(x=>(x.nombre||'').trim().toLowerCase()===(r.nombre||'').trim().toLowerCase()); if(c)r.clienteId=c.id; } }); });
    (d.sueldos||[]).forEach(r=>{ if(!r.clienteId&&r.empresa){ const c=d.clientes.find(x=>(x.nombre||'').trim().toLowerCase()===r.empresa.trim().toLowerCase()); if(c)r.clienteId=c.id; } });
  },

  all(c){ return this.data[c]||[]; },
  get(c,id){ return this.all(c).find(x=>x.id===id); },
  upsert(c,o){ if(!o.id){ o.id=c[0]+Date.now()+Math.floor(Math.random()*999); o._t=Date.now(); this.data[c].push(o); } else { const i=this.data[c].findIndex(x=>x.id===o.id); if(i>=0)this.data[c][i]=o; } this.save(); return o; },
  remove(c,id){ this.data[c]=this.all(c).filter(x=>x.id!==id); this.save(); }
};

function emptyGrids(){ return {empresas:{rows:[]},sprof:{rows:[]},sueldos:{rows:[]}}; }

/* ===== DATOS DE EJEMPLO PARA LA DEMOSTRACIÓN — TODOS INVENTADOS ===== */
function seed(){
  const yy=new Date().getFullYear(), mm=new Date().getMonth()+1;
  const d=(m,day)=>yy+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const cl=[
    {id:'c1',nombre:'Silveira, Valentina',tipo:'Persona física',rut:'',ci:'4.987.321-5',bps:'',fnac:'1988-07-04',whatsapp:'099445566',correo:'valentina@ejemplo.com',direccion:'',fosmetal:'',otros:'',notas:''},
    {id:'c2',nombre:'Panadería La Espiga SRL',tipo:'Empresa',rut:'21 777888 0013',ci:'',bps:'8451207',fnac:'',whatsapp:'092334455',correo:'laespiga@ejemplo.com',direccion:'Sarandí 742',fosmetal:'',otros:'',notas:''},
    {id:'c3',nombre:'Transportes del Norte SA',tipo:'Empresa',rut:'21 334455 0017',bps:'7719044',notas:''},
    {id:'c4',nombre:'Estancia Los Ceibos',tipo:'Empresa',rut:'',bps:'',notas:''},
    {id:'c5',nombre:'Almacén Doña Nelly',tipo:'Empresa',rut:'',bps:'',notas:''},
    {id:'c6',nombre:'Techera, Rodrigo',tipo:'Persona física',ci:'3.112.998-0',notas:''},
  ];
  const dj=[
    {id:'d1',folder:'sp',anio:yy,tipoDj:'',clienteId:'c1',hecho:false,presentada:'',importe:'',medio:'',fechaPago:'',estado:'Pendiente',venc:d(mm,26),notas:''},
    {id:'d2',folder:'iyc_cede',anio:yy,tipoDj:'',clienteId:'c2',hecho:false,presentada:'',importe:'',medio:'',fechaPago:'',estado:'En proceso',venc:d(mm,20),notas:''},
    {id:'d3',folder:'iyc_nocede',anio:yy,tipoDj:'',clienteId:'c3',hecho:false,presentada:'',importe:'',medio:'',fechaPago:'',estado:'Pendiente',venc:d(mm,15),notas:''},
    {id:'d4',folder:'rural',anio:yy,tipoDj:'',clienteId:'c4',hecho:true,presentada:d(mm,8),importe:'',medio:'',fechaPago:'',estado:'Presentada',venc:d(mm,10),notas:''},
    {id:'d5',folder:'iass',anio:yy,tipoDj:'',clienteId:'c6',hecho:false,presentada:'',importe:'',medio:'',fechaPago:'',estado:'Pendiente',venc:d(mm+1,5),notas:''},
  ];
  const tareas=[
    {id:'t1',tarea:'Certificado único DGI',clienteId:'c2',etiqueta:'DGI',urgencia:'Alta',plazo:d(mm,12),estado:'Pendiente',info:'Lo piden para una licitación.',hecho:false},
    {id:'t2',tarea:'Flujo de fondos',clienteId:'c1',etiqueta:'Banco',urgencia:'Media',plazo:d(mm,18),estado:'En proceso',info:'Para el préstamo.',hecho:false},
  ];
  const grids={
    empresas:{rows:[{id:'e1',nombre:'Panadería La Espiga SRL',clienteId:'c2',tipo:'CEDE',cells:{}},{id:'e2',nombre:'Almacén Doña Nelly',clienteId:'c5',tipo:'No CEDE',cells:{}}]},
    sprof:{rows:[{id:'s1',nombre:'Techera, Rodrigo',clienteId:'c6',tipo:'',cells:{}}]},
    sueldos:{rows:[]},
  };
  const gastos=seedGastos();
  const notes=[{id:'n1',text:NOTA_BIENVENIDA,color:'#fff3bf',date:''}];
  const h=seedHon();
  return {clientes:cl,dj,tareas,grids,cal:[],notes:notes,gastos:gastos,cuotas:seedCuotas(gastos),gastoCats:GASTO_CATS_DEF.slice(),sueldos:seedSueldos(),sldSubs:defaultSubs(),sldHidden:[],empTipos:EMP_TIPOS_DEF.slice(),cliTipos:CLI_TIPOS_DEF.slice(),honCli:h.cli,honMov:h.mov,gcal:{url:'',auto:true,last:0},panel:PANEL_DEF()};
}
