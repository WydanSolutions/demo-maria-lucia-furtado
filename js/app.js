/*
 * Arranque de la aplicación. Tiene que ser el ÚLTIMO script de index.html.
 * Carga los datos guardados en el navegador y deja la página lista detrás de la pantalla de ingreso.
 */
function renderAll(){ buildNav(); renderView(CUR); updateBadges(); }
// Deja la página lista para mostrarse (con los datos ya cargados).
function prepararApp(){
  sldAnio=anioActivo(); syncCliList(); buildNav(); applyBrand(); applyAvatar(); aplicarAcento();
  CUR='panel'; switchView('panel'); updateBadges();
  gcalProgramar(); if(Store.data.gcal&&Store.data.gcal.url&&Store.data.gcal.auto!==false)gcalSync(false);
}
(function(){
  Store.load();
  prepararApp();
  if(!MODO_DEMO)document.querySelectorAll('.demo-only').forEach(function(e){e.remove();}); // el aviso de la demostración
  mostrarBienvenida(); // lo primero que se ve: la presentación de la demostración
})();
