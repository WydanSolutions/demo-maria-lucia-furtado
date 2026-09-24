/*
 * Ingreso y salida.
 * ETAPA DEMO: la contraseña es local (1234) y sirve solo para mostrar cómo se ve la pantalla de bloqueo.
 * No es seguridad real: cuando la página se conecte, acá va Firebase Authentication (correo y contraseña,
 * con «¿Olvidaste tu contraseña?» por correo).
 */
const CLAVE_DEMO='1234';
function loginMsg(t,ok){ const e=$('#login-err'); if(!e)return; e.style.color=ok?'var(--green)':''; e.textContent=t||''; }
// "Pedir contraseña al abrir" es una preferencia de cada dispositivo.
function pedirClaveAlAbrir(){ return Store.data&&Store.data.askPass!==false; }
function doLogin(){
  const p=$('#login-pass').value, real=(Store.data&&Store.data.pass)||CLAVE_DEMO;
  if(p!==real){ loginMsg('Contraseña incorrecta (probá '+CLAVE_DEMO+')'); $('#login-pass').value=''; return; }
  loginMsg(''); mostrarApp(); renderPanel();
}
function doLogout(){ closeModal(); Boveda.cerrar(); mostrarLogin(); $('#login-pass').value=''; }
function forgotPass(){ loginMsg('En la página conectada te llega un correo con un enlace para crear una contraseña nueva.',true); }
function mostrarLogin(){ $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
function mostrarApp(){ $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); }
