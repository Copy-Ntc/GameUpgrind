'use strict';
// ============================================================
// Inicialização
// ============================================================
(function boot() {
  Render.init();
  Store.test();
  Game.migrateLegacySave();
  Game.loadProfile();
  UI.showTitle('new');
  Online.init(); // conta, save na nuvem e placar (só se js/online-config.js estiver preenchido)
  // Desbloqueia o áudio no primeiro gesto
  const unlock = () => { Sfx.init(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
})();
