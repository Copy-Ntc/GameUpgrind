'use strict';
(function boot() {
  Render.init();
  Store.test();
  Game.migrateLegacySave();
  Game.loadProfile();
  UI.showTitle('new');
  Online.init();
  const unlock = () => { Sfx.init(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
})();
