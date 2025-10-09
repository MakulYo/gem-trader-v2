// TSDGEMS - Trading Page Script

class TradingGame extends TSDGEMSGame {
    constructor() {
        super();
        this.gemPriceChart = null;
        this.cities = [
            { id: 'mumbai', name: 'Mumbai' },
            { id: 'zhecheng', name: 'Zhecheng' },
            { id: 'hongkong', name: 'Hong Kong' },
            { id: 'newyork', name: 'New York' },
            { id: 'dubai', name: 'Dubai' },
            { id: 'telaviv', name: 'Tel Aviv' },
            { id: 'panama', name: 'Panama' },
            { id: 'antwerpen', name: 'Antwerpen' },
            { id: 'london', name: 'London' },
            { id: 'moscow', name: 'Moscow' }
        ];
        this.gems = [
            { id: 'amethyst', name: 'Amethyst' },
            { id: 'topaz', name: 'Topaz' },
            { id: 'aquamarine', name: 'Aquamarine' },
            { id: 'opal', name: 'Opal' },
            { id: 'tanzanite', name: 'Tanzanite' },
            { id: 'jade', name: 'Jade' },
            { id: 'emerald', name: 'Emerald' },
            { id: 'sapphire', name: 'Sapphire' },
            { id: 'ruby', name: 'Ruby' },
            { id: 'diamond', name: 'Diamond' }
        ];
        this.init();
    }

    init() {
        this.setupTradingSubpages();
        this.populateDropdowns();
        this.initializeGemPriceChart();
        this.renderStakingGrid();
        this.showNotification('Trading markets ready', 'info');
    }

    setupTradingSubpages() {
        const subpageToggle = document.getElementById('trading-subpage-toggle');
        if (!subpageToggle) return;

        subpageToggle.addEventListener('click', (event) => {
            const button = event.target.closest('.toggle-btn');
            if (!button) return;
            const target = button.getAttribute('data-target');
            if (!target) return;

            document.querySelectorAll('#trading-subpage-toggle .toggle-btn').forEach(btn => {
                btn.classList.toggle('active', btn === button);
            });

            document.querySelectorAll('.trading-subpage').forEach(section => {
                section.classList.toggle('active', section.id === `trading-subpage-${target}`);
            });
        });
    }

    populateDropdowns() {
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');

        if (citySelect) {
            citySelect.innerHTML = this.cities.map(city => 
                `<option value="${city.id}">${city.name}</option>`
            ).join('');
        }

        if (gemSelect) {
            gemSelect.innerHTML = this.gems.map(gem => 
                `<option value="${gem.id}">${gem.name}</option>`
            ).join('');
        }
    }

    initializeGemPriceChart() {
        const chartCanvas = document.getElementById('gem-price-chart');
        const status = document.getElementById('pricing-status');
        if (!chartCanvas || !status) return;

        // Destroy existing chart if it exists
        if (this.gemPriceChart) {
            this.gemPriceChart.destroy();
        }

        const ctx = chartCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, chartCanvas.offsetHeight || 320);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.35)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');

        this.gemPriceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Gem Base Price (BTC / 100)',
                    data: [],
                    borderColor: '#00d4ff',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: '#a0a0a0' },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: '#a0a0a0' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });

        status.textContent = 'Chart initialized';
    }

    renderStakingGrid() {
        const stakingGrid = document.getElementById('staking-grid');
        if (!stakingGrid) return;

        const stakingSlots = Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            staked: false,
            gemType: null,
            bonus: 0
        }));

        stakingGrid.innerHTML = stakingSlots.map(slot => `
            <div class="staking-slot ${slot.staked ? 'active' : 'empty'}">
                <div class="slot-header">
                    <h4>Slot ${slot.id}</h4>
                    ${slot.staked ? `<span class="bonus">+${slot.bonus}%</span>` : ''}
                </div>
                ${slot.staked ? `
                    <p>Gem: ${slot.gemType}</p>
                ` : `
                    <p>Stake a gem to activate</p>
                `}
            </div>
        `).join('');
    }
}

// Initialize trading when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new TradingGame();
    window.tsdgemsGame = game;
});

