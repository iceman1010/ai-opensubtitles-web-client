/**
 * Activity Tracker - Tracks API request activity for status bar animation
 */

interface ActivityListener {
  onActivityStart: (context?: string) => void;
  onActivityEnd: () => void;
  onContextUpdate?: (contexts: string[]) => void;
}

class ActivityTracker {
  private listeners: Set<ActivityListener> = new Set();
  private activeRequests: Map<string, string> = new Map(); // requestId -> context
  private activityTimeout: ReturnType<typeof setTimeout> | null = null;

  addListener(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  startActivity(requestId: string, context?: string): void {
    const wasInactive = this.activeRequests.size === 0;
    this.activeRequests.set(requestId, context || 'API Request');

    if (wasInactive) {
      if (this.activityTimeout) {
        clearTimeout(this.activityTimeout);
        this.activityTimeout = null;
      }
      this.listeners.forEach(listener => {
        try { listener.onActivityStart(context); } catch (error) { console.error('Error in activity listener:', error); }
      });
    }
    this.notifyContextUpdate();
  }

  endActivity(requestId: string): void {
    this.activeRequests.delete(requestId);
    this.notifyContextUpdate();

    if (this.activeRequests.size === 0) {
      this.activityTimeout = setTimeout(() => {
        if (this.activeRequests.size === 0) {
          this.listeners.forEach(listener => {
            try { listener.onActivityEnd(); } catch (error) { console.error('Error in activity listener:', error); }
          });
        }
        this.activityTimeout = null;
      }, 300);
    }
  }

  isActive(): boolean { return this.activeRequests.size > 0; }
  getActiveCount(): number { return this.activeRequests.size; }

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getActiveContexts(): string[] { return Array.from(this.activeRequests.values()); }

  getCurrentContext(): string | null {
    if (this.activeRequests.size === 0) return null;
    const contexts = Array.from(this.activeRequests.values());
    return contexts[contexts.length - 1];
  }

  private notifyContextUpdate(): void {
    const contexts = this.getActiveContexts();
    this.listeners.forEach(listener => {
      if (listener.onContextUpdate) {
        try { listener.onContextUpdate(contexts); } catch (error) { console.error('Error in context update listener:', error); }
      }
    });
  }
}

export const activityTracker = new ActivityTracker();
