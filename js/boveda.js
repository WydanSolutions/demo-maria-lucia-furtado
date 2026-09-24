/*
 * Bóveda: cifra las credenciales de los clientes (contraseña BPS, contraseña gub.uy y códigos gub.uy)
 * en la computadora ANTES de guardarlas. Quedan ilegibles para cualquiera que abra el archivo guardado.
 * - Clave de seguridad: la elige la usuaria (distinta de la de ingreso). Se pide solo para ver o editar
 *   credenciales.
 * - Clave de recuperación: se muestra UNA vez al crear la bóveda. Sirve si se olvida la clave de seguridad.
 *   Si se pierden las dos, las credenciales no se pueden recuperar (el resto de los datos no se afecta).
 * - Técnica: AES-GCM 256 con una clave de datos aleatoria, envuelta con claves derivadas por PBKDF2-SHA256.
 * En esta etapa la bóveda se guarda en el navegador; cuando la página se conecte, va a Firestore.
 */
const b64=buf=>btoa(String.fromCharCode.apply(null,new Uint8Array(buf)));
const deb64=s=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));
const REC_ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normRec=s=>(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');

const Boveda={
  cfg:null, clave:null, cache:new Map(), _despues:null,
  setConfig(o){ this.cfg=o; },
  existe(){ return !!this.cfg; },
  abierta(){ return !!this.clave; },
  bloqueado(c){ return !this.abierta()&&!!(c&&c._sec); },
  necesitaPara(clientes){ return !this.abierta()&&(clientes||[]).some(c=>c._sec); },
  cerrar(){
    this.clave=null; this.cache.clear();
    if(Store.data&&Store.data.clientes)Store.data.clientes.forEach(c=>{ if(c._sec)CREDS.forEach(k=>delete c[k]); });
  },
  async bloquear(){ await Store._flush(); this.cerrar(); closeModal(); renderView(CUR); toast('🔒 Credenciales bloqueadas'); },

  /* ----- criptografía ----- */
  async _kek(secreto,sal,iter){
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(secreto),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:deb64(sal),iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  },
  async _enc(key,bytes){ const iv=crypto.getRandomValues(new Uint8Array(12)); return {iv:b64(iv),ct:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes))}; },
  async _dec(key,blob){ return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:deb64(blob.iv)},key,deb64(blob.ct))); },
  async _importar(raw){ return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},true,['encrypt','decrypt']); },
  async _cifrar(texto){ return this._enc(this.clave,new TextEncoder().encode(texto)); },
  async _descifrar(blob){ return JSON.parse(new TextDecoder().decode(await this._dec(this.clave,blob))); },
  _sal(){ return b64(crypto.getRandomValues(new Uint8Array(16))); },
  _codigoRec(){ const r=crypto.getRandomValues(new Uint8Array(24)); let s=''; r.forEach((b,i)=>{ s+=REC_ABC[b%32]; if(i%4===3&&i<23)s+='-'; }); return s; },

  /* ----- operaciones ----- */
  async crear(clave){
    const iter=310000, sal=this._sal(), salRec=this._sal();
    const datos=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    const raw=new Uint8Array(await crypto.subtle.exportKey('raw',datos)), rec=this._codigoRec();
    const cfg={v:1,iter,sal,salRec,creada:Date.now(),
      envClave:await this._enc(await this._kek(clave,sal,iter),raw),
      envRec:await this._enc(await this._kek(normRec(rec),salRec,iter),raw)};
    if(Store.data.boveda)throw new Error('ya-existe');
    this.cfg=cfg; this.clave=datos; this.cache.clear(); this._guardarCfg({});
    return rec;
  },
  async abrir(clave){
    let raw; try{ raw=await this._dec(await this._kek(clave,this.cfg.sal,this.cfg.iter),this.cfg.envClave); }catch(e){ throw new Error('clave-incorrecta'); }
    this.clave=await this._importar(raw); await this.descifrarTodos();
  },
  async recuperar(rec,nueva){
    let raw; try{ raw=await this._dec(await this._kek(normRec(rec),this.cfg.salRec,this.cfg.iter),this.cfg.envRec); }catch(e){ throw new Error('rec-incorrecta'); }
    const sal=this._sal(), envClave=await this._enc(await this._kek(nueva,sal,this.cfg.iter),raw);
    this._guardarCfg({sal,envClave}); this.clave=await this._importar(raw); await this.descifrarTodos();
  },
  async cambiarClave(nueva){
    const raw=new Uint8Array(await crypto.subtle.exportKey('raw',this.clave)), sal=this._sal();
    const envClave=await this._enc(await this._kek(nueva,sal,this.cfg.iter),raw);
    this._guardarCfg({sal,envClave});
  },
  async nuevaRecuperacion(){
    const raw=new Uint8Array(await crypto.subtle.exportKey('raw',this.clave)), salRec=this._sal(), rec=this._codigoRec();
    const envRec=await this._enc(await this._kek(normRec(rec),salRec,this.cfg.iter),raw);
    this._guardarCfg({salRec,envRec});
    return rec;
  },
  async descifrarTodos(){
    for(const c of Store.all('clientes')){ if(!c._sec)continue; try{ this._aplicar(c,await this._descifrar(c._sec)); }catch(e){ console.error('No se pudo descifrar',c.id,e); } }
  },
  _aplicar(c,pl){ CREDS.forEach(k=>{ if(pl[k])c[k]=pl[k]; else delete c[k]; }); this.cache.set(c.id,{plano:canon(this._plano(c))}); },
  _plano(c){ const o={}; CREDS.forEach(k=>o[k]=c[k]||''); return o; },
  // Guarda la configuración de la bóveda junto con el resto de los datos.
  _guardarCfg(campos){ this.cfg=Object.assign({},this.cfg,campos); Store.data.boveda=this.cfg; Store._escribir(); },
  // Antes de guardar: cifra las credenciales que cambiaron (datos.js nunca sube las credenciales en claro).
  async cifrarPendientes(clientes){
    if(!this.clave)return;
    for(const c of clientes||[]){
      if(c._sec&&!this.cache.has(c.id))continue; // todavía no se descifró: no tocar
      const pl=canon(this._plano(c)), vacio=CREDS.every(k=>!c[k]), prev=this.cache.get(c.id);
      if(prev?prev.plano===pl:vacio)continue;
      if(vacio)delete c._sec; else c._sec=await this._cifrar(pl);
      this.cache.set(c.id,{plano:pl});
    }
  },

  /* ----- ventanas ----- */
  // Pide la clave (o la crea la primera vez) y después ejecuta "despues".
  pedir(despues){
    if(this.abierta()){ if(despues)despues(); return; }
    this._despues=despues||null;
    if(this.existe())this._modalAbrir(); else this._modalCrear();
  },
  _modal(titulo,html,form,boton){
    curForm={form}; $('#modal-title').textContent=titulo; $('#modal-del').style.display='none';
    $('#modal-body').innerHTML=html+'<div class="login-err" id="b-msg" style="text-align:left"></div>';
    const b=$('#modal .modal-foot .btn-primary'); if(b)b.textContent=boton;
    $('#modal').classList.add('open'); setTimeout(()=>{ const i=$('#modal-body input'); if(i)i.focus(); },60);
  },
  _enter:' onkeydown="if(event.key===\'Enter\')saveForm()"',
  _campoClave(id,label){ return '<div class="field"><label>'+label+'</label><div class="pf-in-wrap"><input type="password" id="'+id+'" autocomplete="new-password"'+this._enter+'><button class="eye" type="button" onclick="pfEye(this,\''+id+'\')">👁</button></div></div>'; },
  _modalCrear(){
    this._modal('🔐 Crear clave de seguridad',
      '<p class="muted-cell" style="font-size:13px;margin-bottom:14px">Las contraseñas de tus clientes (BPS, gub.uy) se guardan <b>cifradas</b>: nadie más puede leerlas. Elegí una <b>clave de seguridad</b>, distinta de la que usás para entrar. Te la vamos a pedir solo cuando quieras ver o editar credenciales.</p>'
      +this._campoClave('b-c1','Clave de seguridad (mínimo 8 caracteres)')+this._campoClave('b-c2','Repetí la clave'),'boveda-crear','Crear clave');
  },
  _modalAbrir(){
    this._modal('🔒 Credenciales protegidas',
      '<p class="muted-cell" style="font-size:13px;margin-bottom:14px">Escribí tu <b>clave de seguridad</b> para ver y editar las contraseñas de tus clientes.</p>'
      +this._campoClave('b-c1','Clave de seguridad')
      +'<a class="login-forgot" style="display:inline-block;margin-top:2px" onclick="Boveda._modalRec()">¿Olvidaste la clave de seguridad?</a>','boveda-abrir','Desbloquear');
  },
  _modalRec(){
    this._modal('🔑 Recuperar con la clave de recuperación',
      '<p class="muted-cell" style="font-size:13px;margin-bottom:14px">Usá la <b>clave de recuperación</b> que guardaste cuando creaste la clave de seguridad, y elegí una clave de seguridad nueva.</p>'
      +'<div class="field"><label>Clave de recuperación</label><input id="b-rec" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" style="font-family:monospace;text-transform:uppercase"></div>'
      +this._campoClave('b-c1','Nueva clave de seguridad (mínimo 8)')+this._campoClave('b-c2','Repetí la nueva clave'),'boveda-rec','Recuperar');
  },
  modalCambiar(){
    this._modal('🔑 Cambiar clave de seguridad',this._campoClave('b-c1','Nueva clave de seguridad (mínimo 8)')+this._campoClave('b-c2','Repetí la nueva clave'),'boveda-cambiar','Cambiar');
  },
  _modalCodigo(rec){
    this._modal('📝 Guardá tu clave de recuperación',
      '<p style="font-size:13.5px;margin-bottom:12px">Si algún día olvidás la clave de seguridad, esta es la <b>única forma</b> de volver a ver las credenciales. <b>Se muestra una sola vez.</b></p>'
      +'<div class="rec-code" id="b-code">'+esc(rec)+'</div>'
      +'<div style="text-align:center;margin:10px 0 14px"><button class="btn btn-sm" type="button" onclick="cliCopy(document.getElementById(\'b-code\').textContent)">⧉ Copiar</button></div>'
      +'<p class="muted-cell" style="font-size:12px;margin-bottom:12px">Anotala en papel o en un gestor de contraseñas. No la guardes en esta página ni la mandes por mail o WhatsApp.</p>'
      +'<label class="chkline"><input type="checkbox" id="b-ok"> Ya la guardé en un lugar seguro</label>','boveda-codigo','Listo');
  },
  async guardarModal(){
    const form=curForm.form, v=id=>{ const e=document.getElementById(id); return e?e.value:''; }, msg=t=>{ const e=$('#b-msg'); if(e)e.textContent=t; };
    const dos=()=>{ const a=v('b-c1'),b=v('b-c2'); if(a.length<8){msg('La clave tiene que tener al menos 8 caracteres');return null;} if(a!==b){msg('Las dos claves no coinciden');return null;} return a; };
    if(form==='boveda-codigo'){ if(!$('#b-ok').checked){msg('Marcá la casilla cuando la hayas guardado');return;} return this._terminar(); }
    const btn=$('#modal .modal-foot .btn-primary'), txt=btn.textContent;
    try{
      btn.disabled=true; btn.textContent='Procesando…'; msg('');
      if(form==='boveda-crear'){ const c=dos(); if(!c)return; const rec=await this.crear(c); await Store._flush(); this._modalCodigo(rec); return; }
      if(form==='boveda-abrir'){ await this.abrir(v('b-c1')); toast('🔓 Credenciales desbloqueadas'); return this._terminar(); }
      if(form==='boveda-rec'){ if(normRec(v('b-rec')).length!==24){msg('La clave de recuperación tiene 24 letras y números');return;} const c=dos(); if(!c)return; await this.recuperar(v('b-rec'),c); toast('✓ Clave de seguridad nueva guardada'); return this._terminar(); }
      if(form==='boveda-cambiar'){ const c=dos(); if(!c)return; await this.cambiarClave(c); closeModal(); toast('✓ Clave de seguridad cambiada'); return; }
    }catch(e){
      const m={'clave-incorrecta':'Clave de seguridad incorrecta','rec-incorrecta':'La clave de recuperación no es correcta','ya-existe':'La clave de seguridad ya fue creada en otro dispositivo. Cerrá y volvé a intentar.'}[e.message];
      msg(m||'No se pudo completar ('+(e.code||e.message)+'). Revisá la conexión.'); if(!m)console.error(e);
    }finally{ btn.disabled=false; if(btn.textContent==='Procesando…')btn.textContent=txt; }
  },
  _terminar(){ closeModal(); const f=this._despues; this._despues=null; renderView(CUR); if(f)f(); },
  async generarRecuperacion(){ try{ this._modalCodigo(await this.nuevaRecuperacion()); }catch(e){ console.error(e); toast('No se pudo generar la clave de recuperación'); } }
};
