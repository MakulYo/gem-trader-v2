// TSDGEMS - Leaderboard Page Script (Backend-Connected)

class LeaderboardGame extends TSDGEMSGame {
    constructor() {
        super();
        this.backendService = window.backendService;
        this.currentActor = null;
        this.leaderboardData = null;
        this.pageSize = 15;
        this.currentPage = 1;
        this.init();
    }

    init() {
        this.setupActorListener();
        this.setupPagination();
        
        // Wait for backendService to be ready
        if (window.backendService) {
            this.loadLeaderboard();
        } else {
            console.log('[Leaderboard] Waiting for backend service...');
            setTimeout(() => this.loadLeaderboard(), 1000);
        }
    }

    setupActorListener() {
        // Listen for wallet events
        window.addEventListener('wallet-session-restored', (e) => {
            this.currentActor = e.detail.actor;
            console.log('[Leaderboard] Wallet session restored:', this.currentActor);
            this.loadLeaderboard();
        });
        
        window.addEventListener('walletConnected', (e) => {
            this.currentActor = e.detail.actor;
            console.log('[Leaderboard] Wallet connected:', this.currentActor);
            this.loadLeaderboard();
        });

        window.addEventListener('walletDisconnected', (e) => {
            this.currentActor = null;
            console.log('[Leaderboard] Wallet disconnected');
            this.loadLeaderboard();
        });
        
        // Check if already connected
        if (window.walletSessionInfo?.actor) {
            this.currentActor = window.walletSessionInfo.actor;
            console.log('[Leaderboard] Actor already set:', this.currentActor);
        }
    }

    async loadLeaderboard() {
        try {
            this.showNotification('Loading leaderboard...', 'info');
            
            const data = await this.backendService.getLeaderboard(this.currentActor, 100);
            this.leaderboardData = data;
            
            console.log('[Leaderboard] Data loaded:', data);
            
            this.renderLeaderboard();
            this.renderCurrentPlayer();
            
            const updateTime = data.lastUpdated 
                ? new Date(data.lastUpdated._seconds * 1000).toLocaleString()
                : 'Never';
            this.showNotification(`Leaderboard loaded (Last updated: ${updateTime})`, 'success');
            
        } catch (error) {
            console.error('[Leaderboard] Failed to load:', error);
            this.showNotification('Failed to load leaderboard: ' + error.message, 'error');
        }
    }

    renderLeaderboard() {
        if (!this.leaderboardData || !this.leaderboardData.topPlayers) {
            console.log('[Leaderboard] No data to render');
            return;
        }
        
        const totalPages = Math.ceil(this.leaderboardData.topPlayers.length / this.pageSize);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, this.leaderboardData.topPlayers.length);
        const pageEntries = this.leaderboardData.topPlayers.slice(startIndex, endIndex);
        
        const leaderboardBody = document.getElementById('leaderboard-body');
        if (!leaderboardBody) return;
        
        if (pageEntries.length === 0) {
            leaderboardBody.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #888;">
                    <i class="fas fa-users" style="font-size: 3em; margin-bottom: 15px;"></i>
                    <p>No players yet. Be the first!</p>
                </div>
            `;
            return;
        }
        
        leaderboardBody.innerHTML = pageEntries.map(entry => {
            const isCurrentPlayer = this.currentActor && entry.actor === this.currentActor;
            const trophy = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
            
            return `
                <div class="table-row ${isCurrentPlayer ? 'current-player' : ''}">
                    <div class="table-cell rank-cell">
                        ${trophy} #${entry.rank}
                    </div>
                    <div class="table-cell">
                        ${entry.actor}
                        ${isCurrentPlayer ? '<span class="you-badge">YOU</span>' : ''}
                    </div>
                    <div class="table-cell">${entry.ingameCurrency.toLocaleString()} Game $</div>
                </div>
            `;
        }).join('');
        
        // Update pagination
        const pageInfo = document.getElementById('leaderboard-page-info');
        const pageSummary = document.getElementById('leaderboard-page-summary');
        const prevBtn = document.getElementById('leaderboard-prev');
        const nextBtn = document.getElementById('leaderboard-next');
        
        if (pageInfo) {
            pageInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${this.leaderboardData.topPlayers.length} entries`;
        }
        
        if (pageSummary) {
            pageSummary.textContent = `Page ${this.currentPage} of ${Math.max(1, totalPages)}`;
        }
        
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    }

    renderCurrentPlayer() {
        const currentPlayer = this.leaderboardData?.currentPlayer;
        
        // Add current player highlight section above table if not in top 100
        const container = document.querySelector('.leaderboard-container');
        const existingHighlight = container?.querySelector('.current-player-highlight');
        
        if (existingHighlight) {
            existingHighlight.remove();
        }
        
        if (currentPlayer && !currentPlayer.isInTop) {
            const highlight = document.createElement('div');
            highlight.className = 'current-player-highlight';
            highlight.innerHTML = `
                <div class="highlight-content">
                    <h3><i class="fas fa-user"></i> Your Rank</h3>
                    <div class="player-stats">
                        <div class="stat">
                            <span class="label">Rank</span>
                            <span class="value">#${currentPlayer.rank}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Player</span>
                            <span class="value">${currentPlayer.actor}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Game $</span>
                            <span class="value">${currentPlayer.ingameCurrency.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            `;
            container.insertBefore(highlight, container.firstChild);
        }
    }

    setupPagination() {
        const prevBtn = document.getElementById('leaderboard-prev');
        const nextBtn = document.getElementById('leaderboard-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderLeaderboard();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (!this.leaderboardData) return;
                const totalPages = Math.ceil(this.leaderboardData.topPlayers.length / this.pageSize);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderLeaderboard();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }
    }
}

// Initialize leaderboard when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new LeaderboardGame();
    window.tsdgemsGame = game;
    window.game = game;
});
