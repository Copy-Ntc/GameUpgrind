'use strict';
// ============================================================
// Inicialização
// ============================================================
(function boot() {
  Render.init();
  Game.migrateLegacySave();
  UI.showTitle('new');
  // Desbloqueia o áudio no primeiro gesto
  const unlock = () => { Sfx.init(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
})();
