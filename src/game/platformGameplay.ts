import type { GameState } from './state';

interface PlatformGameplayState {
  phase: GameState['phase'];
  userPaused: boolean;
  tutorialVisible: boolean;
  revivePaused: boolean;
  transitionPending: boolean;
}

export function shouldReportGameplayActive(state: PlatformGameplayState): boolean {
  return state.phase === 'wave'
    && !state.userPaused
    && !state.tutorialVisible
    && !state.revivePaused
    && !state.transitionPending;
}
