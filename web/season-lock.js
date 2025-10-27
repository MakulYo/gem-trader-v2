// Season Lock Handler
// Displays a lock overlay when season is in "lock" phase with countdown timer

class SeasonLockHandler {
    constructor() {
        this.seasonState = null;
        this.lockTimer = null;
        this.updateInterval = 1000; // Update every second
        this.checkInterval = null;
        this.fastCheckInterval = null;
        this.timerEnded = false; // Flag to track if local timer has ended
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
            
            // If timer has already ended locally, don't show the overlay again
            if (this.timerEnded) {
                console.log('[SeasonLock] Timer already ended locally, keeping overlay hidden');
                this.seasonState = { ...state, phase: 'active' };
                this.hideLockOverlay();
                return;
            }
            
            // If lockEndsAt has passed, don't show the lock even if phase is still 'lock'
            // This handles cases where the backend hasn't updated yet
            const now = Date.now();
            if (state.phase === 'lock' && state.lockEndsAt && now >= state.lockEndsAt) {
                console.log('[SeasonLock] Lock timer has expired, hiding overlay despite backend phase');
                this.seasonState = { ...state, phase: 'active' };
                this.hideLockOverlay();
                this.stopLockTimer();
                this.timerEnded = true;
                return;
            }
            
            this.seasonState = state;
            
            // Show/hide lock overlay based on phase
            if (state.phase === 'lock') {
                this.timerEnded = false; // Reset flag for new lock
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
        // Show on ALL pages when season is locked
        const currentPage = this.getCurrentPage();
        console.log('[SeasonLock] Showing overlay on page:', currentPage);
        
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
            <div class="particles-container">
                <div class="sparkle-particles" id="sparkle-particles"></div>
                <div class="diamond-rain" id="diamond-rain"></div>
            </div>
            <div class="season-lock-content">
                <div class="season-lock-icon">
                    <i class="fas fa-gem"></i>
                </div>
                <h2 class="season-lock-title">🎉 Season Ended 🎉</h2>
                <p class="season-lock-message">
                    Congratulations! The fabulous season has come to an end. Get ready for the next exciting adventure!
                </p>
                <div class="season-lock-timer">
                    <span class="timer-label">New season starts in:</span>
                    <span class="timer-value" id="season-lock-countdown">--:--:--</span>
                </div>
                <div class="season-lock-buttons">
                    <a href="index.html" class="season-nav-btn">
                        <i class="fas fa-chart-line"></i>
                        View Stats
                    </a>
                    <a href="leaderboard.html" class="season-nav-btn">
                        <i class="fas fa-trophy"></i>
                        View Rankings
                    </a>
                    <a href="shop.html" class="season-nav-btn">
                        <i class="fas fa-shopping-cart"></i>
                        Buy More NFTs
                    </a>
                </div>
            </div>
        `;
        
        overlay.innerHTML = content;
        
        // Start particle effects
        setTimeout(() => this.startParticleEffects(), 100);
        
        return overlay;
    }
    
    /**
     * Start particle effects
     */
    startParticleEffects() {
        this.createSparkles();
        this.createDiamondRain();
    }
    
    /**
     * Create sparkling particles
     */
    createSparkles() {
        const container = document.getElementById('sparkle-particles');
        if (!container) return;
        
        const colors = ['#00d4ff', '#ffffff', '#00a8ff'];
        
        for (let i = 0; i < 50; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle-particle';
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.top = Math.random() * 100 + '%';
            sparkle.style.animationDelay = Math.random() * 3 + 's';
            sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
            container.appendChild(sparkle);
        }
    }
    
    /**
     * Create diamond emoji rain
     */
    createDiamondRain() {
        const container = document.getElementById('diamond-rain');
        if (!container) return;
        
        const interval = setInterval(() => {
            if (!container.parentElement || container.parentElement.style.display === 'none') {
                clearInterval(interval);
                return;
            }
            
            const diamond = document.createElement('div');
            diamond.className = 'falling-diamond';
            diamond.textContent = '💎';
            diamond.style.left = Math.random() * 100 + '%';
            diamond.style.animationDuration = (Math.random() * 3 + 2) + 's';
            diamond.style.opacity = Math.random() * 0.5 + 0.5;
            container.appendChild(diamond);
            
            // Remove after animation
            setTimeout(() => diamond.remove(), 5000);
        }, 300);
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
            
            // Mark that timer has ended
            this.timerEnded = true;
            
            // Update state to reflect timer has ended
            this.seasonState = { ...this.seasonState, phase: 'active' };
            
            // Hide overlay immediately when countdown reaches zero
            this.stopLockTimer();
            this.hideLockOverlay();
            
            // Keep checking until backend confirms the state change
            // Check more frequently for the next minute to catch backend updates
            let checkCount = 0;
            this.fastCheckInterval = setInterval(() => {
                checkCount++;
                if (checkCount >= 6) { // Stop after 6 fast checks (about 30 seconds)
                    clearInterval(this.fastCheckInterval);
                    this.fastCheckInterval = null;
                }
                this.checkSeasonState();
            }, 5000); // Every 5 seconds for 30 seconds
            
            console.log('[SeasonLock] Timer ended, overlay hidden. Starting fast state checks.');
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
        if (this.fastCheckInterval) {
            clearInterval(this.fastCheckInterval);
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

