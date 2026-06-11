// ============================================================
// USER STATE EVENT BUS
// Tiny pub/sub for syncing user stats across components
// Avoids prop drilling and full state management library
// ============================================================

type UserStatsUpdate = {
  money?: number;
  nerve?: number;
  maxNerve?: number;
  life?: number;
  maxLife?: number;
  level?: number;
  points?: number;
  energy?: number;
  maxEnergy?: number;
};

type Listener = (stats: UserStatsUpdate) => void;

class UserEventBus {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(stats: UserStatsUpdate) {
    this.listeners.forEach((listener) => listener(stats));
  }
}

export const userEvents = new UserEventBus();
