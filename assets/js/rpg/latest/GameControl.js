// assets/js/rpg/latest/GameControl.js
// Entry point for the PNEC Emergency Preparedness RPG.
// rpg.md calls GameControl.start(path) via tryStartDefault().

import GameCore from '../../GameEnginev1.1/essentials/Game.js';
import GameControlClass from '../../GameEnginev1.1/essentials/GameControl.js';
import GameLevelPoway from './GameLevelPoway.js';

// Also export gameLevelClasses so the live code runner in rpg.md can pick them up.
export const gameLevelClasses = [GameLevelPoway];

const GameControl = {
  start(path) {
    const environment = {
      path: path || '',
      gameContainer: document.getElementById('gameContainer'),
      gameCanvas:    document.getElementById('gameCanvas'),
      gameLevelClasses,
      pythonURI:  '',
      javaURI:    '',
      fetchOptions: {},
    };
    GameCore.main(environment, GameControlClass);
  }
};

export default GameControl;
