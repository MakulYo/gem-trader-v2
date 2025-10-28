// Season Lock Handler
// Displays a lock overlay when season is in "lock" phase with countdown timer

class SeasonLockHandler {
    constructor() {
        this.seasonState = null;
        this.lockTimer = null;
        this.updateInterval = 1000; // Update every second
        this.checkInterval = null;
    }

    /**
     * Initialize the season lock handler
     */
    async init() {
        console.log('[SeasonLock] Initializing season lock handler');
        try {
            await this.checkSeasonState();
            
            // Set up periodic check (every 30 seconds)
            this.checkInterval = setInterval(() => {
                this.checkSeasonState();
            }, 30000);
            
            // Start timer if in lock phase
            if (this.isLocked()) {
                this.startLockTimer();
            }
        } catch (error) {
            console.error('[SeasonLock] Failed to initialize:', error);
        }
    }

    /**
     * Check current season state from backend
     */
    async checkSeasonState() {
        try {
            const state = await window.backendService.getSeasonState();
            this.seasonState = state;
            
            // Show/hide lock overlay based on phase
            if (state.phase === 'lock') {
                this.showLockOverlay();
                this.startLockTimer();
            } else {
                this.hideLockOverlay();
                this.stopLockTimer();
            }
            
            console.log('[SeasonLock] Season state updated:', state);
        } catch (error) {
            console.error('[SeasonLock] Error checking season state:', error);
        }
    }

    /**
     * Check if season is locked
     */
    isLocked() {
        return this.seasonState && this.seasonState.phase === 'lock';
    }

    /**
     * Show lock overlay
     */
    showLockOverlay() {
        // Only show on pages that should be locked (not dashboard, leaderboard, shop)
        const currentPage = this.getCurrentPage();
        if (this.isAllowedPage(currentPage)) {
            console.log('[SeasonLock] Page is allowed, not showing overlay');
            return;
        }
        
        // Create overlay if it doesn't exist
        let overlay = document.getElementById('season-lock-overlay');
        if (!overlay) {
            overlay = this.createLockOverlay();
            document.body.appendChild(overlay);
        }
        
        overlay.style.display = 'flex';
        console.log('[SeasonLock] Lock overlay shown');
    }
    
    /**
     * Get current page name
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        return filename || 'index.html';
    }
    
    /**
     * Check if current page is allowed during lock
     */
    isAllowedPage(page) {
        const allowedPages = ['index.html', 'leaderboard.html', 'shop.html', ''];
        return allowedPages.includes(page);
    }

    /**
     * Hide lock overlay
     */
    hideLockOverlay() {
        const overlay = document.getElementById('season-lock-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            console.log('[SeasonLock] Lock overlay hidden');
        }
    }

    /**
     * Create lock overlay HTML
     */
    createLockOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'season-lock-overlay';
        overlay.className = 'season-lock-overlay';
        
        const content = `
            <div class="season-lock-content">
                <div class="season-lock-icon">
                    <i class="fas fa-lock"></i>
                </div>
                <h2 class="season-lock-title">Season Locked</h2>
                <p class="season-lock-message">
                    The current season is locked for maintenance and preparation for the next season.
                </p>
                <div class="season-lock-timer">
                    <span class="timer-label">Season starts again in:</span>
                    <span class="timer-value" id="season-lock-countdown">--:--:--</span>
                </div>
                <div class="season-lock-info">
                    <i class="fas fa-info-circle"></i>
                    <span>You can still view your progress and prepare for the next season!</span>
                </div>
            </div>
        `;
        
        overlay.innerHTML = content;
        return overlay;
    }

    /**
     * Start countdown timer
     */
    startLockTimer() {
        if (this.lockTimer) {
            clearInterval(this.lockTimer);
        }
        
        this.lockTimer = setInterval(() => {
            this.updateCountdown();
        }, this.updateInterval);
        
        // Update immediately
        this.updateCountdown();
    }

    /**
     * Stop countdown timer
     */
    stopLockTimer() {
        if (this.lockTimer) {
            clearInterval(this.lockTimer);
            this.lockTimer = null;
        }
    }

    /**
     * Update countdown display
     */
    updateCountdown() {
        const countdownEl = document.getElementById('season-lock-countdown');
        if (!countdownEl || !this.seasonState || !this.seasonState.lockEndsAt) {
            return;
        }
        
        const now = Date.now();
        const endsAt = this.seasonState.lockEndsAt;
        const remaining = endsAt - now;
        
        if (remaining <= 0) {
            countdownEl.textContent = '00:00:00';
            // Force check for new state
            this.checkSeasonState();
            return;
        }
        
        const seconds = Math.floor(remaining / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        countdownEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.stopLockTimer();
        this.hideLockOverlay();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.seasonLockHandler = new SeasonLockHandler();
        window.seasonLockHandler.init();
    });
} else {
    window.seasonLockHandler = new SeasonLockHandler();
    window.seasonLockHandler.init();
}

