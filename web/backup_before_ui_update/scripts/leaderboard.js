// TSDGEMS - Leaderboard Page Script

class LeaderboardGame extends TSDGEMSGame {
    constructor() {
        super();
        this.leaderboard = {
            entries: [],
            pageSize: 15,
            currentPage: 1,
            totalPages: 1
        };
        this.init();
    }

    init() {
        this.loadLeaderboard();
        this.setupPagination();
        this.showNotification('Leaderboard loaded', 'info');
    }

    loadLeaderboard() {
        // Mock leaderboard data - would normally come from backend
        this.leaderboard.entries = Array.from({ length: 50 }, (_, i) => ({
            rank: i + 1,
            player: `Player${i + 1}`,
            gameDollars: Math.floor(Math.random() * 1000000) + 10000
        })).sort((a, b) => b.gameDollars - a.gameDollars);

        // Update ranks after sorting
        this.leaderboard.entries.forEach((entry, index) => {
            entry.rank = index + 1;
        });

        this.leaderboard.totalPages = Math.ceil(this.leaderboard.entries.length / this.leaderboard.pageSize);
        this.renderLeaderboard();
    }

    setupPagination() {
        const prevBtn = document.getElementById('leaderboard-prev');
        const nextBtn = document.getElementById('leaderboard-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.leaderboard.currentPage > 1) {
                    this.leaderboard.currentPage--;
                    this.renderLeaderboard();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.leaderboard.currentPage < this.leaderboard.totalPages) {
                    this.leaderboard.currentPage++;
                    this.renderLeaderboard();
                }
            });
        }
    }

    renderLeaderboard() {
        const leaderboardBody = document.getElementById('leaderboard-body');
        const pageInfo = document.getElementById('leaderboard-page-info');
        const pageSummary = document.getElementById('leaderboard-page-summary');
        const prevBtn = document.getElementById('leaderboard-prev');
        const nextBtn = document.getElementById('leaderboard-next');

        if (!leaderboardBody) return;

        const startIndex = (this.leaderboard.currentPage - 1) * this.leaderboard.pageSize;
        const endIndex = Math.min(startIndex + this.leaderboard.pageSize, this.leaderboard.entries.length);
        const pageEntries = this.leaderboard.entries.slice(startIndex, endIndex);

        leaderboardBody.innerHTML = pageEntries.map(entry => `
            <div class="table-row">
                <div class="table-cell rank-cell">
                    ${entry.rank <= 3 ? `<i class="fas fa-trophy rank-${entry.rank}"></i>` : ''} 
                    #${entry.rank}
                </div>
                <div class="table-cell">${entry.player}</div>
                <div class="table-cell">${entry.gameDollars.toLocaleString()}</div>
            </div>
        `).join('');

        if (pageInfo) {
            pageInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${this.leaderboard.entries.length} entries`;
        }

        if (pageSummary) {
            pageSummary.textContent = `Page ${this.leaderboard.currentPage} of ${this.leaderboard.totalPages}`;
        }

        if (prevBtn) prevBtn.disabled = this.leaderboard.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.leaderboard.currentPage === this.leaderboard.totalPages;
    }
}

// Initialize leaderboard when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new LeaderboardGame();
    window.tsdgemsGame = game;
});

