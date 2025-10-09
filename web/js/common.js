// TSDGEMS - Common JavaScript Functions
// Shared across all pages

console.log('[Common] Loading common.js...');

// Backend event listener
window.addEventListener('backend:ready', (e) => {
  console.log('[Common] Backend ready event received:', e.detail);
  if (window.tsdgemsGame && typeof window.tsdgemsGame.applyBackendData === 'function') {
    window.tsdgemsGame.applyBackendData(e.detail);
  }
});

// Base Game State (shared across all pages)
class TSDGEMSGame {
    applyBackendData(detail = {}) {
        const { player = {}, cities = [] } = detail;

        // Button label with actor
        const actor = player.account || player.id || '';
        const btn = document.querySelector('.connect-wallet-btn');
        if (btn && actor) {
            btn.textContent = `Connected: ${actor}`;
            btn.classList.add('connected');
        }

        // ---- Update header + dashboard cards ----
        const dollars = Number(player.ingameCurrency ?? 0);
        const tsdm    = Number(player.balances?.TSDM ?? 0);

        // Header chip
        const header = document.getElementById('header-game-dollars');
        if (header) header.textContent = `Game $: ${dollars.toLocaleString()}`;

        // Dashboard "Ingame $"
        const tsdEl = document.getElementById('tsd-balance');
        if (tsdEl) tsdEl.textContent = dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Dashboard "TSDM Balance"
        const tsdmEl = document.getElementById('tsdm-balance');
        if (tsdmEl) tsdmEl.textContent = tsdm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // (Optional) Keep cities for later
        this.gameState.trading.citiesFromBackend = cities;
    }

    constructor() {
        this.gameState = this.getInitialGameState();
        this.backendData = {
            player: null,
            cities: [],
            boosts: {}
        };
        this.setupMobileNavigation();
        console.log('[Game] TSDGEMSGame instance created');
    }

    getInitialGameState() {
        return {
            player: {
                name: 'Player',
                tsdBalance: 1000000.00,
                totalGems: 0,
                miningPower: 0,
                activeWorkers: 0,
                stakedTSDM: 0,
                stakedGems: 0,
                level: 1,
                experience: 0,
                experienceToNext: 1000,
                roughGems: {
                    diamond: 0, ruby: 0, sapphire: 0, emerald: 0, amethyst: 0,
                    topaz: 0, jade: 0, opal: 0, aquamarin: 0, tanzanite: 0
                },
                polishedGems: {
                    diamond: 0, ruby: 0, sapphire: 0, emerald: 0, amethyst: 0,
                    topaz: 0, jade: 0, opal: 0, aquamarin: 0, tanzanite: 0
                }
            },
            mining: {
                isActive: false,
                hashRate: 0,
                difficulty: 1.0
            },
            miningSlots: {
                available: 3,
                rented: 0,
                maxSlots: 10,
                slots: []
            },
            polishing: {
                polishedGems: 0,
                totalRewards: 0,
                slots: []
            },
            trading: {
                cities: [],
                activeCity: 'newyork',
                totalSales: 0,
                totalGameDollars: 0,
                stakingSlots: []
            }
        };
    }

    setupMobileNavigation() {
        // Mobile menu toggle
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                const navMenu = document.getElementById('nav-menu');
                navMenu.classList.toggle('active');
                
                // Update toggle button icon
                const toggleIcon = document.querySelector('#mobile-menu-toggle i');
                if (navMenu.classList.contains('active')) {
                    toggleIcon.className = 'fas fa-times';
                } else {
                    toggleIcon.className = 'fas fa-bars';
                }
            });
        }

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const navMenu = document.getElementById('nav-menu');
            const mobileToggle = document.getElementById('mobile-menu-toggle');
            
            if (navMenu && mobileToggle && !navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
                this.closeMobileNavigation();
            }
        });
    }

    closeMobileNavigation() {
        const navMenu = document.getElementById('nav-menu');
        const toggleIcon = document.querySelector('#mobile-menu-toggle i');
        
        if (navMenu) navMenu.classList.remove('active');
        if (toggleIcon) toggleIcon.className = 'fas fa-bars';
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        if (!notifications) {
            console.log('[Notification]', type, ':', message);
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    updateHeaderStats() {
        // Update header game dollars
        const header = document.getElementById('header-game-dollars');
        if (header) {
            header.textContent = `Game $: ${this.gameState.trading.totalGameDollars.toFixed(0)}`;
        }
    }
}

// Modal functions (global)
function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('active');
}

function closeRepairModal() {
    const modal = document.getElementById('repair-modal');
    if (modal) modal.classList.remove('active');
}

function closeMotivationModal() {
    const modal = document.getElementById('motivation-modal');
    if (modal) modal.classList.remove('active');
}

function closeWorkerGalleryModal() {
    const modal = document.getElementById('worker-gallery-modal');
    if (modal) modal.classList.remove('active');
}

// Set active navigation link based on current page
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Common] DOM loaded, setting active nav link');
    setActiveNavLink();
});

console.log('[Common] common.js loaded successfully');
