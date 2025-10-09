// TSDGEMS Diamond Trading Simulator - Game Logic

class TSDGEMSGame {
    constructor() {
        this.gameState = {
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
                prestige: 0,
                prestigeMultiplier: 1.0,
                roughGems: {
                    diamond: 0,
                    ruby: 0,
                    sapphire: 0,
                    emerald: 0,
                    amethyst: 0,
                    topaz: 0,
                    jade: 0,
                    opal: 0,
                    aquamarin: 0,
                    tanzanite: 0
                },
                polishedGems: {
                    diamond: 0,
                    ruby: 0,
                    sapphire: 0,
                    emerald: 0,
                    amethyst: 0,
                    topaz: 0,
                    jade: 0,
                    opal: 0,
                    aquamarin: 0,
                    tanzanite: 0
                },
                inventory: {
                    gems: [],
                    equipment: [],
                    workers: [],
                    materials: [],
                    potions: [],
                    scrolls: [],
                    keys: []
                },
                stats: {
                    totalMined: 0,
                    totalSold: 0,
                    totalBought: 0,
                    totalCrafted: 0,
                    totalFused: 0,
                    playTime: 0,
                    loginStreak: 0,
                    lastLogin: Date.now()
                }
            },
            mining: {
                isActive: false,
                hashRate: 0,
                difficulty: 1.0,
                blockReward: 0.01,
                lastBlockTime: Date.now(),
                totalBlocksMined: 0,
                activeSlots: 0,
                autoMining: false,
                autoMiningCost: 100,
                miningEfficiency: 1.0,
                gemBreakChance: 0.05,
                criticalMiningChance: 0.02,
                criticalMiningMultiplier: 2.0,
            },
            miningSlots: {
                available: 3,
                rented: 0,
                totalCost: 0,
                maxSlots: 10,
                slots: [],
                unlockedSlots: [],
            },
            polishing: {
                polishedGems: 0,
                totalRewards: 0,
                slots: [],
                inventory: {
                    diamond: 0,
                    ruby: 0,
                    sapphire: 0,
                    emerald: 0,
                    jade: 0,
                    tanzanite: 0,
                    opal: 0,
                    aquamarine: 0,
                    topaz: 0,
                    amethyst: 0
                },
                gemTypes: [
                    { name: 'Diamond', chance: 3, icon: '💎', color: '#c0c0c0', rarity: 'legendary' },
                    { name: 'Ruby', chance: 5, icon: '🔴', color: '#e74c3c', rarity: 'epic' },
                    { name: 'Sapphire', chance: 7, icon: '🔵', color: '#3498db', rarity: 'rare' },
                    { name: 'Emerald', chance: 10, icon: '🟢', color: '#27ae60', rarity: 'rare' },
                    { name: 'Jade', chance: 11.66, icon: '💚', color: '#95c5f7', rarity: 'uncommon' },
                    { name: 'Tanzanite', chance: 11.66, icon: '💜', color: '#9353d9', rarity: 'uncommon' },
                    { name: 'Opal', chance: 11.66, icon: '⚪', color: '#f39c12', rarity: 'uncommon' },
                    { name: 'Aquamarine', chance: 11.66, icon: '🔷', color: '#17a2b8', rarity: 'uncommon' },
                    { name: 'Topaz', chance: 11.66, icon: '🟡', color: '#ffc107', rarity: 'uncommon' },
                    { name: 'Amethyst', chance: 11.66, icon: '🟣', color: '#8e44ad', rarity: 'uncommon' }
                ]
            },
            blockchain: {
                currentBlock: 1,
                totalSupply: 1000000,
                circulatingSupply: 0,
                miningDifficulty: 1.0,
                blockTime: 10000, // 10 seconds
                halvingInterval: 210000, // Every 210k blocks
                networkHashRate: 1000000,
                nextDifficultyAdjustment: 2016
            },
            settings: {
                sound: true,
                music: true,
                notifications: true,
                autoSave: true,
                language: 'en',
                theme: 'dark',
                quality: 'high'
            },
            trading: {
                cities: [
                    { id: 'newyork', name: 'New York', bonus: 5 },
                    { id: 'london', name: 'London', bonus: 8 },
                    { id: 'tokyo', name: 'Tokyo', bonus: 10 },
                    { id: 'dubai', name: 'Dubai', bonus: 15 },
                    { id: 'geneva', name: 'Geneva', bonus: 20 }
                ],
                activeCity: 'newyork',
                totalSales: 0,
                totalGameDollars: 0,
                stakingSlots: [],
                gemPrices: {},
                unlockedBenefits: [],
                gemBonusMultipliers: {
                    'Amethyst': { polished: 0.05, unpolished: 0.025 },
                    'Topaz': { polished: 0.10, unpolished: 0.05 },
                    'Aquamarine': { polished: 0.15, unpolished: 0.075 },
                    'Opal': { polished: 0.20, unpolished: 0.10 },
                    'Tanzanite': { polished: 0.25, unpolished: 0.125 },
                    'Jade': { polished: 0.30, unpolished: 0.15 },
                    'Emerald': { polished: 0.35, unpolished: 0.175 },
                    'Sapphire': { polished: 0.40, unpolished: 0.20 },
                    'Ruby': { polished: 0.50, unpolished: 0.25 },
                    'Diamond': { polished: 1.00, unpolished: 0.50 }
                },
                priceMatrix: {}
            },
        };

        this.tradingMatrixConfig = {
            gems: [
                { id: 'amethyst', name: 'Amethyst', amount: 112 },
                { id: 'topaz', name: 'Topaz', amount: 500 },
                { id: 'aquamarine', name: 'Aquamarine', amount: 1152 },
                { id: 'opal', name: 'Opal', amount: 600 },
                { id: 'tanzanite', name: 'Tanzanite', amount: 712 },
                { id: 'jade', name: 'Jade', amount: 33 },
                { id: 'emerald', name: 'Emerald', amount: 60 },
                { id: 'sapphire', name: 'Sapphire', amount: 40 },
                { id: 'ruby', name: 'Ruby', amount: 45 },
                { id: 'diamond', name: 'Diamond', amount: 10 }
            ],
            cities: [
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
            ]
        };

        this.leaderboard = {
            entries: [],
            pageSize: 20,
            currentPage: 1
        };

        this.tradingTableCells = new Map();
        this.tradingTableHeaders = new Map();
        this.tradingTableCellData = new Map();
        this.tradingPriceInterval = null;
        this.miningInterval = null;
        this.gameLoop = null;
        this.gemPriceChart = null;
        this.priceRefreshInterval = null;
        this.latestGemBasePrice = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeGameData();
        this.initializeLeaderboard();

        this.startGameLoop();
        this.updateUI();
        this.showNotification('Welcome to TSDGEMS! Start mining to earn rewards.', 'info');
    }

    setupEventListeners() {
        // Navigation - Handle both regular nav links and dropdown items
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                if (href && href !== '#') {
                    this.navigateToSection(href.substring(1));
                    // Close mobile navigation after selection
                    this.closeMobileNavigation();
                }
            });
        });

        // Handle dropdown items
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                if (href) {
                    this.navigateToSection(href.substring(1));
                    // Close mobile navigation after selection
                    this.closeMobileNavigation();
                }
            });
        });

        // Mobile menu toggle
        document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
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

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const navMenu = document.getElementById('nav-menu');
            const mobileToggle = document.getElementById('mobile-menu-toggle');
            
            if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
                this.closeMobileNavigation();
            }
        });






        // Wallet connection
        document.querySelector('.connect-wallet-btn').addEventListener('click', () => {
            this.connectWallet();
        });

        // Trading subpage toggle
        const subpageToggle = document.getElementById('trading-subpage-toggle');
        subpageToggle?.addEventListener('click', (event) => {
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

    // Close mobile navigation
    closeMobileNavigation() {
        const navMenu = document.getElementById('nav-menu');
        const toggleIcon = document.querySelector('#mobile-menu-toggle i');
        
        navMenu.classList.remove('active');
        if (toggleIcon) {
            toggleIcon.className = 'fas fa-bars';
        }
    }

    initializeGameData() {
        // Initialize mining slots
        this.initializeMiningSlots();
        // Initialize polishing gems
        this.initializePolishingGems();
        // Initialize trading system
        this.initializeTrading();
        window.addEventListener('beforeunload', () => {
            if (this.priceRefreshInterval) {
                clearInterval(this.priceRefreshInterval);
            }
        });
    }












    initializeMiningSlots() {
        this.gameState.miningSlots.slots = [
            {
                id: 1,
                name: '',
                description: 'Basic surface mining location',
                cost: 125,
                benefits: [],
                rented: false,
                active: false,
                unlocked: true,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 2,
                name: '',
                description: 'Deep underground mining shaft',
                cost: 250,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 3,
                name: '',
                description: 'Ancient crystal cave system',
                cost: 500,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 4,
                name: '',
                description: 'Advanced crystal mining operation',
                cost: 1000,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 5,
                name: '',
                description: 'Quantum-powered mining facility',
                cost: 2000,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 6,
                name: '',
                description: 'The ultimate mining operation',
                cost: 4000,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 7,
                name: '',
                description: 'Mining operation powered by cosmic energy',
                cost: 8000,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 8,
                name: '',
                description: 'Mining across multiple dimensions',
                cost: 16000,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 9,
                name: '',
                description: 'Mining the fabric of reality itself',
                cost: 20000,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            },
            {
                id: 10,
                name: '',
                description: 'The infinite mining operation',
                cost: 25000,
                benefits: [],
                rented: false,
                active: false,
                unlocked: false,
                staked: false,
                stakeType: null,
                workers: 0,
                maxWorkers: 0,
                miningTrip: {
                    active: false,
                    startTime: null,
                    duration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
                    miningPower: 0,
                    completed: false,
                    rewards: 0
                }
            }
        ];
    }

















    startGameLoop() {
        this.gameLoop = setInterval(() => {
            this.updateGame();
        }, 1000); // Update every second

    }

    initializeLeaderboard() {
        const defaultEntries = [
            { player: 'DiamondDynasty', amount: 1250000 },
            { player: 'RubyRush', amount: 975500 },
            { player: 'EmeraldEmpire', amount: 812300 },
            { player: 'SapphireSage', amount: 640000 },
            { player: 'TopazTrader', amount: 515250 },
            { player: 'ObsidianOne', amount: 458900 },
            { player: 'QuartzQuest', amount: 389000 },
            { player: 'CrystalCrew', amount: 305500 },
            { player: 'NexusMiner', amount: 250750 },
            { player: 'StarterSpark', amount: 198400 },
            { player: 'GoldenGale', amount: 176500 },
            { player: 'PlatinumPulse', amount: 165000 },
            { player: 'SilverStorm', amount: 152300 },
            { player: 'BronzeBlaze', amount: 140000 },
            { player: 'CobaltCore', amount: 132500 },
            { player: 'IronIcon', amount: 118000 },
            { player: 'SteelSpirit', amount: 105600 },
            { player: 'CopperCraze', amount: 99600 },
            { player: 'NickelNight', amount: 90500 },
            { player: 'TinTitan', amount: 84500 }
        ];

        this.leaderboard.entries = defaultEntries;

        const prevButton = document.getElementById('leaderboard-prev');
        const nextButton = document.getElementById('leaderboard-next');

        prevButton?.addEventListener('click', () => {
            this.changeLeaderboardPage(this.leaderboard.currentPage - 1);
        });

        nextButton?.addEventListener('click', () => {
            this.changeLeaderboardPage(this.leaderboard.currentPage + 1);
        });

        this.renderLeaderboardPage(1);
    }

    changeLeaderboardPage(page) {
        const totalPages = Math.max(1, Math.ceil(this.leaderboard.entries.length / this.leaderboard.pageSize));
        if (page < 1 || page > totalPages) return;
        this.leaderboard.currentPage = page;
        this.renderLeaderboardPage(page);
    }

    renderLeaderboardPage(page) {
        const tbody = document.getElementById('leaderboard-body');
        const pageInfo = document.getElementById('leaderboard-page-info');
        const pageSummary = document.getElementById('leaderboard-page-summary');
        const prevButton = document.getElementById('leaderboard-prev');
        const nextButton = document.getElementById('leaderboard-next');

        if (!tbody || !pageInfo || !pageSummary || !prevButton || !nextButton) return;

        const totalEntries = this.leaderboard.entries.length;
        const totalPages = Math.max(1, Math.ceil(totalEntries / this.leaderboard.pageSize));
        const startIndex = (page - 1) * this.leaderboard.pageSize;
        const endIndex = Math.min(startIndex + this.leaderboard.pageSize, totalEntries);
        const visibleEntries = this.leaderboard.entries.slice(startIndex, endIndex);

        tbody.innerHTML = visibleEntries.map((entry, index) => `
            <div class="table-row">
                <div class="table-cell">${startIndex + index + 1}</div>
                <div class="table-cell">
                    <div class="player-info">
                        <i class="fas ${startIndex + index === 0 ? 'fa-crown' : 'fa-gem'}"></i>
                        <span>${entry.player}</span>
                    </div>
                </div>
                <div class="table-cell">${entry.amount.toLocaleString()}</div>
            </div>
        `).join('');

        pageInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalEntries} entries`;
        pageSummary.textContent = `Page ${page} of ${totalPages}`;

        prevButton.disabled = page <= 1;
        nextButton.disabled = page >= totalPages;
    }


    updateGame() {
        if (this.gameState.mining.isActive) {
            this.processMining();
        }
        
        // Update mining trip timers
        this.updateMiningTrips();
        
        // Check polishing progress
        this.checkPolishingProgress();
        
        this.updateUI();
    }

    processMining() {
        const now = Date.now();
        const timeSinceLastBlock = now - this.gameState.mining.lastBlockTime;
        
        // Calculate mining progress
        const miningProgress = timeSinceLastBlock / this.gameState.blockchain.blockTime;
        
        if (miningProgress >= 1) {
            this.mineBlock();
        }

        // Update mining rate display
        this.gameState.mining.hashRate = this.calculateMiningRate();
    }

    mineBlock() {
        this.gameState.mining.lastBlockTime = Date.now();
        this.gameState.mining.totalBlocksMined++;
        this.gameState.blockchain.currentBlock++;
        
        // Calculate block reward
        const blockReward = this.calculateBlockReward();
        this.gameState.player.tsdBalance += blockReward;
        this.gameState.blockchain.circulatingSupply += blockReward;
        
        // Mine gems
        this.mineGems();
        
        
        // Update difficulty
        this.updateMiningDifficulty();
        
        this.showNotification(`Block #${this.gameState.blockchain.currentBlock} mined! Reward: ${blockReward.toFixed(3)} TSDM`, 'success');
    }


    mineGems() {
        const baseGemChance = 0.3; // 30% chance per block
        
        if (Math.random() < baseGemChance) {
            const gem = this.selectRandomGem();
            this.gameState.player.inventory.gems.push(gem);
            this.gameState.player.totalGems++;
            
            this.showNotification(`Found ${gem.name}!`, 'success');
        }
    }



    selectRandomGem() {
        const gems = [
            { name: 'Ruby', rarity: 'common', value: 10, color: '#ff0000' },
            { name: 'Sapphire', rarity: 'uncommon', value: 25, color: '#0000ff' },
            { name: 'Emerald', rarity: 'rare', value: 50, color: '#00ff00' },
            { name: 'Diamond', rarity: 'epic', value: 100, color: '#ffffff' },
            { name: 'Amethyst', rarity: 'legendary', value: 200, color: '#800080' }
        ];
        const random = Math.random();
        
        if (random < 0.5) return gems[0]; // Quartz - 50%
        if (random < 0.8) return gems[1]; // Amethyst - 30%
        if (random < 0.95) return gems[2]; // Emerald - 15%
        if (random < 0.99) return gems[3]; // Ruby - 4%
        return gems[4]; // Diamond - 1%
    }

    calculateBlockReward() {
        const halvings = Math.floor(this.gameState.blockchain.currentBlock / this.gameState.blockchain.halvingInterval);
        return this.gameState.mining.blockReward / Math.pow(2, halvings);
    }

    calculateMiningRate() {
        let baseMiningRate = 0;
        
        // Add equipment mining rate
        this.gameState.player.inventory.equipment.forEach(item => {
            baseMiningRate += item.hashRate;
        });
        
        
        // Apply staking boost (simplified)
        const stakingBoost = 1.0;
        baseMiningRate *= stakingBoost;
        
        return Math.floor(baseMiningRate);
    }




    updateMiningDifficulty() {
        // Increase difficulty every 100 blocks
        if (this.gameState.blockchain.currentBlock % 100 === 0) {
            this.gameState.blockchain.miningDifficulty *= 1.1;
            this.gameState.mining.difficulty = this.gameState.blockchain.miningDifficulty;
            this.showNotification('Mining difficulty increased!', 'info');
        }
    }


    startMiningAnimations() {
        this.miningAnimationInterval = setInterval(() => {
            this.createMiningParticle();
            this.createMiningSpark();
            this.createMiningDust();
        }, 200);
    }

    stopMiningAnimations() {
        if (this.miningAnimationInterval) {
            clearInterval(this.miningAnimationInterval);
        }
    }

    createMiningParticle() {
        const particle = document.createElement('div');
        particle.className = 'mining-particle';
        particle.style.left = Math.random() * window.innerWidth + 'px';
        particle.style.animationDuration = (Math.random() * 2 + 2) + 's';
        
        document.getElementById('mining-animations').appendChild(particle);
        
        setTimeout(() => particle.remove(), 5000);
    }

    createMiningSpark() {
        const spark = document.createElement('div');
        spark.className = 'mining-spark';
        spark.style.left = Math.random() * window.innerWidth + 'px';
        spark.style.top = Math.random() * window.innerHeight + 'px';
        
        document.getElementById('mining-animations').appendChild(spark);
        
        setTimeout(() => spark.remove(), 3000);
    }

    createMiningDust() {
        const dust = document.createElement('div');
        dust.className = 'mining-dust';
        dust.style.left = Math.random() * window.innerWidth + 'px';
        dust.style.animationDuration = (Math.random() * 3 + 3) + 's';
        
        document.getElementById('mining-animations').appendChild(dust);
        
        setTimeout(() => dust.remove(), 6000);
    }















    rentMiningSlot(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        
        if (!slot) return;
        
        if (slot.rented) {
            this.showNotification('This slot is already rented!', 'error');
            return;
        }
        
        if (this.gameState.player.tsdBalance >= slot.cost) {
            this.gameState.player.tsdBalance -= slot.cost;
            slot.rented = true;
            slot.active = true;
            
            this.gameState.miningSlots.rented++;
            this.gameState.miningSlots.totalCost += slot.cost;
            this.gameState.mining.activeSlots++;
            
            this.showNotification(`Mining slot rented successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient TSDM balance!', 'error');
        }
    }





    updatePlayerStats() {
        // Calculate total mining power
        this.gameState.player.miningPower = this.calculateTotalMiningPower();
        
        // Count active workers
        this.gameState.player.activeWorkers = this.gameState.player.inventory.workers.length;
    }

    calculateTotalMiningPower() {
        let totalPower = 0;
        
        this.gameState.player.inventory.equipment.forEach(item => {
            totalPower += item.miningPower;
        });
        
        this.gameState.player.inventory.workers.forEach(worker => {
            totalPower += worker.miningBoost * 10;
        });
        
        return Math.floor(totalPower);
    }

    updateUI() {
        // Update dashboard stats
        document.getElementById('tsd-balance').textContent = this.gameState.player.tsdBalance.toFixed(2);
        document.getElementById('active-workers').textContent = this.gameState.player.activeWorkers;
        const totalSlots = this.gameState.miningSlots.slots.filter(slot => slot.unlocked).length;
        document.getElementById('mining-slots-count').textContent = `${this.gameState.miningSlots.rented}/${this.gameState.miningSlots.maxSlots}`;
        document.getElementById('tsdm-balance').textContent = this.gameState.player.tsdBalance.toFixed(2);
        
        // Update gem statistics
        this.updateGemStatistics();
        
        // Update wallet balance
        document.querySelector('.wallet-balance').textContent = `${this.gameState.player.tsdBalance.toFixed(2)} TSDM`;

        const headerGameDollars = document.getElementById('header-game-dollars');
        if (headerGameDollars) {
            headerGameDollars.textContent = `Game $: ${this.gameState.trading.totalGameDollars.toFixed(0)}`;
        }
        
        // Update new mining stats
        const activeMiners = this.gameState.miningSlots.slots.filter(slot => slot.rented && slot.staked).length;
        const totalWorkforce = this.gameState.miningSlots.slots.reduce((total, slot) => total + slot.workers, 0);
        
        // Ensure the HTML elements exist before trying to update them
        const activeMiningElement = document.getElementById('active-mining-sites');
        const totalWorkforceElement = document.getElementById('total-workforce');
        
        if (activeMiningElement) activeMiningElement.textContent = activeMiners.toString();
        if (totalWorkforceElement) totalWorkforceElement.textContent = totalWorkforce.toString();
        
        // Update dashboard workers with actual working force count
        document.getElementById('active-workers').textContent = totalWorkforce.toString();
        
        // Update mining slots display
        this.updateMiningSlotsDisplay();
        
        // Update polishing display and stats
        this.updatePolishingSlotsDisplay();
        this.updateGemInventory();
        
        // Check polishing progress also during regular UI updates
        this.checkPolishingProgress();
        
        // Update trading display and stats
        this.updateTradingDisplay();
        this.updateTradingStats();
        this.updateTradingMatrixHeaders();
        this.renderLeaderboardPage(this.leaderboard.currentPage);
    }

    // Update gem statistics for dashboard and polishing tabs
    updateGemStatistics() {
        // Calculate rough gems (from mining trips)
        const roughGems = this.gameState.player.roughGems || {};
        const totalRoughGems = Object.values(roughGems).reduce((total, count) => total + count, 0);
        
        // Calculate polished gems (from polishing process)
        const polishedGems = this.gameState.player.polishedGems || {};
        const totalPolishedGems = Object.values(polishedGems).reduce((total, count) => total + count, 0);
        
        // Update dashboard statistics
        const roughGemsElement = document.getElementById('rough-gems-count');
        const polishedGemsElement = document.getElementById('polished-gems-count');
        
        if (roughGemsElement) roughGemsElement.textContent = totalRoughGems.toString();
        if (polishedGemsElement) polishedGemsElement.textContent = totalPolishedGems.toString();
        
        // Update polishing tab statistics
        const roughGemsPolishingElement = document.getElementById('rough-gems-polishing-count');
        const polishedGemsPolishingElement = document.getElementById('polished-gems-polishing-count');
        const totalInventoryElement = document.getElementById('total-inventory-gems');
        
        if (roughGemsPolishingElement) roughGemsPolishingElement.textContent = totalRoughGems.toString();
        if (polishedGemsPolishingElement) polishedGemsPolishingElement.textContent = totalPolishedGems.toString();
        if (totalInventoryElement) totalInventoryElement.textContent = (totalRoughGems + totalPolishedGems).toString();
    }
    


    updateMiningSlotsDisplay() {
        const slotsGrid = document.getElementById('slots-grid');
        if (!slotsGrid) return;
        
        slotsGrid.innerHTML = '';
        
        this.gameState.miningSlots.slots.forEach(slot => {
            const slotElement = document.createElement('div');
            const isGreyedOut = slot.unlocked && slot.rented && !slot.staked;
            slotElement.className = `mining-slot ${slot.rented ? 'rented' : ''} ${slot.active ? 'active' : ''} ${!slot.unlocked ? 'locked' : ''} ${isGreyedOut ? 'greyed-out' : ''}`;
            slotElement.setAttribute('data-slot-id', slot.id);
            
            // Get appropriate mine image
            const getMineImage = () => {
                if (!slot.staked) return 'small_mine.png'; // Default grey available mine
                
                const stakeTypeImage = {
                    'Small Mine': 'small_mine.png',
                    'Medium Mine': 'medium_mine.png', 
                    'Large Mine': 'large_mine.png'
                };
                return stakeTypeImage[slot.stakeType] || 'small_mine.png';
            };

            const mineImagePath = getMineImage();
            const canStake = slot.unlocked && slot.rented && !slot.staked;
            const isGreyedImage = canStake || !slot.staked;
            
            let slotContent = `
                <div class="slot-header">
                    ${!slot.unlocked ? `<span class="slot-cost">${slot.cost} TSDM</span>` : ''}
                    ${!slot.unlocked ? '<span class="slot-locked">🔒 LOCKED</span>' : ''}
                    ${slot.staked ? `<span class="slot-staked">⛏️ ${slot.stakeType}</span>` : ''}
                </div>
                <div class="slot-content-layout">
                <p class="slot-description">${slot.description}</p>
                    ${slot.unlocked && (slot.rented || slot.staked) ? `
                        <div class="slot-mine-image-container">
                            <img src="images/${mineImagePath}" 
                                 class="slot-mine-image ${isGreyedImage ? 'greyed' : ''}" 
                                 alt="${slot.staked ? slot.stakeType : 'Mine placeholder'}" 
                                 style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px;">
                        </div>
                    ` : ''}
                </div>
                <div class="slot-benefits">
                    ${slot.benefits.map(benefit => `
                        <div class="slot-benefit">
                            <i class="fas fa-check"></i>
                            <span>${benefit}</span>
                        </div>
                    `).join('')}
                </div>`;
            
            if (!slot.unlocked) {
                slotContent += `
                    <div class="slot-unlock-requirements">
                        <h4>Unlock Requirements:</h4>
                        <div class="unlock-req">
                            <span>Cost: ${slot.cost} TSDM</span>
                        </div>
                        <button onclick="game.unlockMiningSlot(${slot.id})" class="action-btn primary">Unlock Slot</button>
                    </div>`;
            } else if (!slot.rented) {
                slotContent += `
                    <div class="slot-actions">
                        <button onclick="game.rentMiningSlot(${slot.id})" class="action-btn primary">Rent Slot</button>
                    </div>`;
            } else if (!slot.staked) {
                slotContent += `
                    <div class="slot-staking">
                        <h4>Stake Mine:</h4>
                        <div class="stake-options">
                            <button onclick="game.stakeMine(${slot.id}, 'Small Mine')" class="action-btn secondary">Small Mine (100 TSDM)</button>
                            <button onclick="game.stakeMine(${slot.id}, 'Medium Mine')" class="action-btn secondary">Medium Mine (500 TSDM)</button>
                            <button onclick="game.stakeMine(${slot.id}, 'Large Mine')" class="action-btn secondary">Large Mine (1000 TSDM)</button>
                </div>
                    </div>`;
            } else {
                const miningPower = slot.workers * 50;
                const remainingTime = this.getMiningTripRemainingTime(slot.id);
                
                slotContent += `
                    <div class="slot-workers">
                        <div class="worker-info">
                            <span>Workers: ${slot.workers}/${slot.maxWorkers}</span>
                            <span class="mining-power">MP: ${miningPower}</span>
                        </div>
                        ${slot.miningTrip.active ? `
                            <div class="mining-trip-timer">
                                <span class="timer-label">Mining Trip:</span>
                                <span class="timer-value">${remainingTime || '00:00:00'}</span>
                            </div>
                        ` : ''}
                        ${slot.miningTrip.completed ? `
                            <div class="rewards-ready">
                                <span class="rewards-label">Rewards Ready:</span>
                                <span class="rewards-amount">${slot.miningTrip.rewards.toFixed(2)} TSDM</span>
                            </div>
                        ` : ''}
                        <div class="slot-actions">
                            ${slot.miningTrip.completed ? `
                                <button onclick="game.claimMiningTripRewards(${slot.id})" class="action-btn success">
                                    <i class="fas fa-coins"></i> Claim Rewards
                                </button>
                            ` : slot.miningTrip.active ? `
                                <div class="mining-in-progress">
                                    <span>Mining trip in progress...</span>
                                </div>
                            ` : `
                                <button onclick="game.addWorker(${slot.id})" class="action-btn primary" ${slot.workers >= slot.maxWorkers ? 'disabled' : ''}>
                                    <i class="fas fa-plus"></i> Add Worker (100 TSDM)
                                </button>
                                <button onclick="game.startMiningTrip(${slot.id})" class="action-btn success" ${slot.workers === 0 ? 'disabled' : ''}>
                                    <i class="fas fa-play"></i> Start Mining Trip
                                </button>
                            `}
                            ${!slot.miningTrip.active ? `
                                <button onclick="game.unstakeMine(${slot.id})" class="action-btn danger">
                                    <i class="fas fa-times"></i> Unstake Mine
                                </button>
                            ` : ''}
                        </div>
                    </div>`;
            }
            
            slotElement.innerHTML = slotContent;
            slotsGrid.appendChild(slotElement);
        });
    }

    









    navigateToSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        document.getElementById(sectionId).classList.add('active');
        
        // Update navigation - Remove active from all nav links and dropdown items
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Find and activate the correct navigation item
        const navItem = document.querySelector(`[href="#${sectionId}"]`);
        if (navItem) {
            navItem.classList.add('active');
            
            // If it's a dropdown item, also highlight the parent dropdown
            const parentDropdown = navItem.closest('.nav-dropdown');
            if (parentDropdown) {
                const dropdownToggle = parentDropdown.querySelector('.dropdown-toggle');
                if (dropdownToggle) {
                    dropdownToggle.classList.add('active');
                }
            }
        }
    }


    connectWallet() {
        // Simulate wallet connection
        this.showNotification('Wallet connected successfully!', 'success');
        document.querySelector('.connect-wallet-btn').textContent = 'Connected';
        document.querySelector('.connect-wallet-btn').disabled = true;
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Public methods for HTML onclick handlers


    toggleSlot(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (slot) {
            slot.active = !slot.active;
            this.gameState.mining.activeSlots += slot.active ? 1 : -1;
            this.updateUI();
        }
    }





    // Unlock Mining Slots sequentially
    unlockMiningSlot(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || slot.unlocked) return;

        // Check if previous slot is unlocked (except for first slot)
        if (slotId > 1) {
            const previousSlot = this.gameState.miningSlots.slots.find(s => s.id === slotId - 1);
            if (!previousSlot || !previousSlot.unlocked) {
                this.showNotification(`You must unlock the previous slot first!`, 'error');
                return;
            }
        }

        if (this.gameState.player.tsdBalance >= slot.cost) {
            this.gameState.player.tsdBalance -= slot.cost;
            slot.unlocked = true;
            this.showNotification(`Mining slot unlocked successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification(`Insufficient TSDM balance to unlock mining slot!`, 'error');
        }
    }

    // Stake mine in slot
    stakeMine(slotId, stakeType) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.unlocked || !slot.rented) return;

        const stakeCosts = {
            'Small Mine': 100,
            'Medium Mine': 500,
            'Large Mine': 1000
        };

        const maxWorkers = {
            'Small Mine': 10,
            'Medium Mine': 20,
            'Large Mine': 30
        };

        const cost = stakeCosts[stakeType];
        if (!cost) return;

        if (this.gameState.player.tsdBalance >= cost) {
            this.gameState.player.tsdBalance -= cost;
            slot.staked = true;
            slot.stakeType = stakeType;
            slot.maxWorkers = maxWorkers[stakeType];
            slot.workers = 0;
            this.showNotification(`${stakeType} staked! Max workers: ${slot.maxWorkers}`, 'success');
            this.updateUI();
        } else {
            this.showNotification(`Insufficient TSDM balance to stake ${stakeType}!`, 'error');
        }
    }

    // Open worker selection gallery
    addWorker(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.staked) return;

        if (slot.workers >= slot.maxWorkers) {
            this.showNotification(`Maximum workers (${slot.maxWorkers}) already reached for ${slot.stakeType}!`, 'error');
            return;
        }

        this.openWorkerGallery(slotId);
    }

    // Open worker selection gallery modal
    openWorkerGallery(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot) return;

        const availableSlots = slot.maxWorkers - slot.workers;
        const maxSelectable = Math.min(availableSlots, Math.floor(this.gameState.player.tsdBalance / 100));

        // Store current slot ID for later use
        this.currentWorkerSelectionSlotId = slotId;

        // Update modal info
        document.getElementById('selected-workers-count').textContent = '0';
        document.getElementById('max-workers-count').textContent = maxSelectable.toString();

        // Generate worker gallery
        this.generateWorkerGallery(maxSelectable);

        // Show modal
        const workerModal = document.getElementById('worker-gallery-modal');
        workerModal.classList.add('active');
        
        // Scroll to top of page to show the modal
        setTimeout(() => {
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: 'smooth'
            });
        }, 100);
    }

    // Generate worker gallery with 50 images cycling through 41-45.png
    generateWorkerGallery(maxSelectable) {
        const galleryGrid = document.getElementById('worker-gallery-grid');
        galleryGrid.innerHTML = '';

        const baseImages = ['41.png', '42.png', '43.jpg', '44.png', '45.png'];
        
        for (let i = 0; i < 50; i++) {
            const imageIndex = i % baseImages.length;
            const imageName = baseImages[imageIndex];
            
            const workerItem = document.createElement('div');
            workerItem.className = 'worker-gallery-item';
            workerItem.dataset.workerId = i;
            
            workerItem.innerHTML = `
                <img src="gallery_images/${imageName}" alt="Worker ${i + 1}" loading="lazy">
                <div class="selection-indicator"></div>
            `;

            // Add click handler
            workerItem.addEventListener('click', () => {
                this.toggleWorkerSelection(workerItem, maxSelectable);
            });

            galleryGrid.appendChild(workerItem);
        }

        // Reset selection state
        this.selectedWorkers = [];
        this.updateWorkerSelectionUI();
    }

    // Toggle worker selection
    toggleWorkerSelection(workerItem, maxSelectable) {
        const workerId = parseInt(workerItem.dataset.workerId);
        const isSelected = workerItem.classList.contains('selected');

        if (isSelected) {
            // Deselect worker
            workerItem.classList.remove('selected');
            this.selectedWorkers = this.selectedWorkers.filter(id => id !== workerId);
        } else {
            // Select worker if under limit
            if (this.selectedWorkers.length < maxSelectable) {
                workerItem.classList.add('selected');
                this.selectedWorkers.push(workerId);
            } else {
                this.showNotification(`Maximum ${maxSelectable} workers can be selected!`, 'error');
                return;
            }
        }

        this.updateWorkerSelectionUI();
    }

    // Update worker selection UI
    updateWorkerSelectionUI() {
        const selectedCount = this.selectedWorkers.length;
        document.getElementById('selected-workers-count').textContent = selectedCount.toString();
        
        const confirmBtn = document.getElementById('confirm-worker-selection');
        confirmBtn.disabled = selectedCount === 0;

        // Update selection indicators
        document.querySelectorAll('.worker-gallery-item').forEach((item, index) => {
            const indicator = item.querySelector('.selection-indicator');
            if (this.selectedWorkers.includes(index)) {
                const position = this.selectedWorkers.indexOf(index) + 1;
                indicator.textContent = position.toString();
            }
        });
    }

    // Confirm worker selection
    confirmWorkerSelection() {
        if (!this.currentWorkerSelectionSlotId || this.selectedWorkers.length === 0) return;

        const slot = this.gameState.miningSlots.slots.find(s => s.id === this.currentWorkerSelectionSlotId);
        if (!slot) return;

        const workerCost = 100;
        const totalCost = this.selectedWorkers.length * workerCost;

        if (this.gameState.player.tsdBalance >= totalCost) {
            this.gameState.player.tsdBalance -= totalCost;
            slot.workers += this.selectedWorkers.length;
            slot.miningTrip.miningPower = slot.workers * 50; // 50 MP per worker
            
            this.showNotification(`${this.selectedWorkers.length} workers added! Workers: ${slot.workers}/${slot.maxWorkers}`, 'success');
            this.updateUI();
            closeWorkerGalleryModal();
        } else {
            this.showNotification(`Insufficient TSDM balance! Need ${totalCost} TSDM for ${this.selectedWorkers.length} workers.`, 'error');
        }
    }

    // Unstake mine
    unstakeMine(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.staked) return;

        // Check if mining trip is active
        if (slot.miningTrip.active) {
            this.showNotification(`Cannot unstake mine while mining trip is active!`, 'error');
            return;
        }

        // Show confirmation modal
        this.showUnstakeConfirmation(slotId, slot);
    }

    // Show unstake confirmation modal
    showUnstakeConfirmation(slotId, slot) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');

        modalTitle.textContent = 'Confirm Mine Unstaking';
        modalBody.innerHTML = `
            <div class="unstake-confirmation">
                <div class="warning-box">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Warning: TSDM Not Refunded</h4>
                    <p>The TSDM paid to stake this mine will <strong>NOT</strong> be returned to your balance.</p>
                </div>
                
                <div class="mine-info">
                    <h4>Mine Details:</h4>
                    <ul>
                        <li><strong>Type:</strong> ${slot.stakeType}</li>
                        <li><strong>Workers:</strong> ${slot.workers}/${slot.maxWorkers}</li>
                        <li><strong>Status:</strong> ${slot.miningTrip.active ? 'Mining Trip Active' : 'Idle'}</li>
                    </ul>
                </div>

                <div class="unstake-actions">
                    <button onclick="game.confirmUnstakeMine(${slotId})" class="action-btn danger">
                        <i class="fas fa-times"></i> Yes, Unstake Mine
                    </button>
                    <button onclick="closeModal()" class="action-btn secondary">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;

        document.getElementById('modal-overlay').classList.add('active');
    }

    // Confirm unstake mine
    confirmUnstakeMine(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.staked) return;

        // Reset slot to unstaked state
        slot.staked = false;
        slot.stakeType = null;
        slot.maxWorkers = 0;
        slot.workers = 0;
        slot.miningTrip = {
            active: false,
            startTime: null,
            duration: 0,
            miningPower: 0,
            rewards: 0,
            completed: false
        };

        this.showNotification(`Mine unstaked successfully! Note: TSDM was not refunded.`, 'success');
        this.updateUI();
        closeModal();
    }

    // Start mining trip
    startMiningTrip(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.staked || slot.workers === 0) return;

        if (slot.miningTrip.active) {
            this.showNotification(`Mining trip already active!`, 'error');
            return;
        }

        slot.miningTrip.active = true;
        slot.miningTrip.startTime = Date.now();
        slot.miningTrip.miningPower = slot.workers * 50; // 50 MP per worker
        
        this.showNotification(`Mining trip started! Duration: 3 hours`, 'success');
        this.updateUI();
    }


    // Complete mining trip (automatic when timer runs out)
    completeMiningTrip(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.miningTrip.active) return;

        const earnings = slot.miningTrip.miningPower * 0.1; // 0.1 TSDM per MP
        
        slot.miningTrip.active = false;
        slot.miningTrip.startTime = null;
        slot.miningTrip.completed = true;
        slot.miningTrip.rewards = earnings;
        
        this.showNotification(`Mining trip completed! Claim your rewards: ${earnings.toFixed(2)} TSDM`, 'success');
        this.updateUI();
    }

    // Claim mining trip rewards
    claimMiningTripRewards(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.miningTrip.completed) return;

        const rewards = slot.miningTrip.rewards;
        this.gameState.player.tsdBalance += rewards;
        
        // Generate rough gems from mining trip
        this.generateRoughGemsFromMining(slot.miningTrip.miningPower);
        
        slot.miningTrip.completed = false;
        slot.miningTrip.rewards = 0;
        
        this.showNotification(`Claimed ${rewards.toFixed(2)} TSDM and rough gems from mining trip!`, 'success');
        this.updateUI();
    }

    // Generate rough gems from mining trip
    generateRoughGemsFromMining(miningPower) {
        const gemTypes = ['diamond', 'ruby', 'sapphire', 'emerald', 'amethyst', 'topaz', 'jade', 'opal', 'aquamarin', 'tanzanite'];
        const baseGemCount = Math.floor(miningPower / 100); // 1 gem per 100 mining power
        
        for (let i = 0; i < baseGemCount; i++) {
            const randomGem = gemTypes[Math.floor(Math.random() * gemTypes.length)];
            this.gameState.player.roughGems[randomGem]++;
        }
    }

    // Update mining trip timers
    updateMiningTrips() {
        this.gameState.miningSlots.slots.forEach(slot => {
            if (slot.miningTrip.active && slot.miningTrip.startTime) {
                const elapsed = Date.now() - slot.miningTrip.startTime;
                if (elapsed >= slot.miningTrip.duration) {
                    this.completeMiningTrip(slot.id);
                }
            }
        });
    }

    // Get remaining time for mining trip
    getMiningTripRemainingTime(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.miningTrip.active || !slot.miningTrip.startTime) return null;

        const elapsed = Date.now() - slot.miningTrip.startTime;
        const remaining = slot.miningTrip.duration - elapsed;
        
        if (remaining <= 0) return null;
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Polishing Functions
    initializePolishingGems() {
        // Initialize 10 empty polishing slots
        this.gameState.polishing.slots = [];
        for (let i = 1; i <= 10; i++) {
            this.gameState.polishing.slots.push({
                id: i,
                nftStaked: false,
                isStaked: false,
                processState: 'empty', // 'empty', 'staked', 'processing', 'ready'
                capacity: 500,
                currentGems: 0,
                maxGems: 500,
                polishingDuration: 60 * 60 * 1000, // 1 hour in milliseconds
                processStartTime: null,
                processEndTime: null,
                processedGems: {},
                nftType: 'PolishingTable'
            });
        }
        
        // Add testing gems for development
        this.addTestingGems();
    }

    addTestingGems() {
        // Add 10000 rough gems for testing - distribute evenly across all gem types
        const gemsPerType = Math.floor(10000 / this.gameState.polishing.gemTypes.length);
        
        this.gameState.polishing.gemTypes.forEach(gemType => {
            const lowercaseName = gemType.name.toLowerCase();
            this.gameState.polishing.inventory[lowercaseName] = gemsPerType;
        });
        
        // Add any remaining gems to amethyst
        const totalAdded = gemsPerType * this.gameState.polishing.gemTypes.length;
        const remaining = 10000 - totalAdded;
        if (remaining > 0) {
            this.gameState.polishing.inventory.amethyst += remaining;
        }
        
        this.showNotification(`Added ${10000} testing gems to inventory!`, 'info');
    }

    updatePolishingSlotsDisplay() {
        const slotsGrid = document.getElementById('polishing-slots-grid');
        if (!slotsGrid) return;
        
        // Save current input values before recreating display
        const inputValues = {};
        const inputElements = slotsGrid.querySelectorAll('input[type="number"]');
        inputElements.forEach(input => {
            const slotId = input.id.replace('gem-amount-', '');
            inputValues[slotId] = input.value;
        });
        
        slotsGrid.innerHTML = '';
        
        this.updatePolishingStats();
        
        this.gameState.polishing.slots.forEach(slot => {
            const slotId = slot.id;
            const savedInputValue = inputValues[slotId];
            const slotCard = document.createElement('div');
            let slotContent = '';
            
            // Determine current state
            const hasNFT = slot.isStaked;
            const canStartProcess = hasNFT && slot.processState === 'staked' && slot.currentGems > 0;
            const isProcessing = slot.processState === 'processing';
            const isReady = slot.processState === 'ready';
            
            slotCard.className = `polishing-slot ${!hasNFT ? 'empty' : slot.processState}`;
            
            // Status text
            let statusText = 'Empty Slot';
            let statusClass = 'empty';
            if (hasNFT && slot.processState === 'staked') {
                statusText = 'NFT Staked - Ready';
                statusClass = 'staked';
            } else if (isProcessing) {
                const timeRemaining = slot.processEndTime - Date.now();
                const progressPercent = 100 - ((timeRemaining / slot.polishingDuration) * 100);
                const totalSeconds = Math.max(0, Math.floor(timeRemaining / 1000));
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                statusText = `Processing... ${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
                slotContent += `
                    <div class="slot-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.max(0, progressPercent)}%"></div>
                        </div>
                        <div class="progress-text">${minutes}:${seconds.toString().padStart(2, '0')} remaining</div>
                    </div>`;
            } else if (isReady) {
                statusText = 'Ready to Claim!';
                statusClass = 'ready';
            }
            
            statusText = `<div class="slot-status ${statusClass}">${statusText}</div>`;
            
            // Gem counter
            const gemCount = `${slot.currentGems}/${slot.maxGems}`;
            const gemCountDisplay = hasNFT ? 
                `<div class="gem-count">Gems: ${gemCount}</div>` : '';
            
            // Add polishing table image
            // Show image for all slots, grey if not staked
            const isStakedShader = hasNFT;
            const tableImageHtml = `
                <div class="slot-polishing-image-container">
                    <img src="images/polishing_table.jpg" 
                         class="slot-polishing-image ${!isStakedShader ? 'greyed' : ''}" 
                         alt="Polishing Table" 
                         style="width: 120px; height: 120px; object-fit: cover; margin: 0 auto 1rem; display: block; border-radius: 8px;">
                </div>
            `;

            // Main content  
            slotContent = `
                ${statusText}
                ${tableImageHtml}
                ${gemCountDisplay}
                ${slotContent}
                <div class="slot-actions">`;
            
            // Different button states
            if (!hasNFT) {
                slotContent += `
                    <button class="stake-button" onclick="game.stakePolishingTable(${slotId})">
                        <i class="fas fa-plus"></i>
                        Stake Polishing Table NFT
                    </button>`;
            } else if (isReady) {
                slotContent += `
                    <button class="claim-btn" onclick="game.claimPolishedGems(${slotId})">
                        <i class="fas fa-gift"></i>
                        Claim Gems
                    </button>`;
            } else if (isProcessing) {
                slotContent += `
                    <button class="start-polishing-btn" disabled>
                        <i class="fas fa-cog fa-spin"></i>
                        Processing...
                    </button>`;
            } else {
                // staked state
                const shouldAutoFill = slot.currentGems < slot.maxGems;
                const gemsInInventory = this.getTotalGemsInInventory();
                
                slotContent += `
                    <div class="gem-input-section">
                        <label style="color: #c0c0c0; font-size: 0.9rem;">Add Gems to Slot:</label>
                        <div class="gem-input-controls">
                            <input type="number" 
                                   id="gem-amount-${slotId}" 
                                   min="0" 
                                   max="${slot.maxGems}" 
                                   value="${savedInputValue || '0'}"
                                   placeholder="Amount"
                                   class="gem-amount-input">
                            <button class="add-gems-btn" onclick="game.addManualGemsToSlot(${slotId})">
                                <i class="fas fa-plus"></i> Add
                            </button>
                            <button class="max-gems-btn" onclick="game.addMaxGemsToSlot(${slotId})">
                                <i class="fas fa-gem"></i> Max
                            </button>
                        </div>
                        <div class="gem-input-info">
                            Available gems: ${gemsInInventory} | Max can add: ${Math.min(slot.maxGems-slot.currentGems, gemsInInventory)} | Slot capacity: ${slot.maxGems-slot.currentGems}
                        </div>
                    </div>
                    <button class="start-polishing-btn" onclick="game.startPolishing(${slotId})">
                        <i class="fas fa-play"></i>
                        Start Polishing
                    </button>`;
            }
            
            slotContent += `</div>`;
            slotCard.innerHTML = slotContent;
            slotsGrid.appendChild(slotCard);
        });
    }
    
    updatePolishingStats() {
        const polishedCountElement = document.getElementById('polished-gems-count');
        const totalRewardsElement = document.getElementById('polishing-rewards');
        
        if (polishedCountElement) {
            polishedCountElement.textContent = this.gameState.polishing.polishedGems.toString();
        }
        if (totalRewardsElement) {
            totalRewardsElement.textContent = this.gameState.polishing.totalRewards.toString();
        }
    }

    stakePolishingTable(slotId) {
        const slot = this.gameState.polishing.slots.find(s => s.id === slotId);
        if (!slot || slot.isStaked) return;

        slot.isStaked = true;
        slot.processState = 'staked';
        slot.currentGems = 0;
        
        this.showNotification(`Polishing Table NFT staked in slot ${slotId}! Slot ready for manual gem selection (0/500)`, 'success');
        this.updateUI();
    }

    fillToMaxGems(slotId) {
        const slot = this.gameState.polishing.slots.find(s => s.id === slotId);
        if (!slot || !slot.isStaked) return;
        
        const amountToAdd = Math.min(slot.maxGems - slot.currentGems, this.gameState.player.tsdBalance);
        slot.currentGems = Math.min(slot.maxGems, slot.currentGems + amountToAdd);
        
        this.showNotification(`Slot filled to ${slot.currentGems}/${slot.maxGems} gems`, 'info');
        this.updateUI();
    }

    addGemsToSlot(slotId) {
        this.fillToMaxGems(slotId);
    }

    addManualGemsToSlot(slotId) {
        const slot = this.gameState.polishing.slots.find(s => s.id === slotId);
        if (!slot || !slot.isStaked) return;

        const amountInput = document.getElementById(`gem-amount-${slotId}`);
        const amount = parseInt(amountInput?.value) || 0;
        const maxCanAdd = slot.maxGems - slot.currentGems;
        const actualAmount = Math.min(amount, maxCanAdd);

        if (actualAmount <= 0) {
            this.showNotification('Invalid amount to add!', 'error');
            return;
        }

        // Add gems from inventory
        if (this.canReduceInventory(actualAmount)) {
            this.reduceFromInventory(actualAmount);
            slot.currentGems = Math.min(slot.maxGems, slot.currentGems + actualAmount);
            this.showNotification(`Added ${actualAmount} gems to slot ${slotId}`, 'success');
            amountInput.value = ''; // Reset input
            this.updateUI();
        } else {
            this.showNotification('Not enough gems in inventory!', 'error');
        }
    }

    addMaxGemsToSlot(slotId) {
        const slot = this.gameState.polishing.slots.find(s => s.id === slotId);
        if (!slot || !slot.isStaked) return;

        const maxCanAdd = slot.maxGems - slot.currentGems;
        const gemsInInventory = this.getTotalGemsInInventory();
        const actualAmount = Math.min(maxCanAdd, gemsInInventory);

        if (actualAmount <= 0) {
            this.showNotification('Slot is already at max capacity or no gems available!', 'info');
            return;
        }

        // Only update the input field, don't add gems automatically
        const amountInput = document.getElementById(`gem-amount-${slotId}`);
        if (amountInput) {
            amountInput.value = actualAmount;
            this.showNotification(`Set amount to ${actualAmount} (max available)`, 'success');
        }
    }

    getTotalGemsInInventory() {
        return Object.values(this.gameState.polishing.inventory).reduce((a, b) => a + b, 0);
    }

    canReduceInventory(amount) {
        const totalAvailable = this.getTotalGemsInInventory();
        return totalAvailable >= amount;
    }

    reduceFromInventory(amount) {
        const gemTypes = Object.keys(this.gameState.polishing.inventory).sort((a, b) => 
            this.gameState.polishing.inventory[b] - this.gameState.polishing.inventory[a]
        ); // Start with most abundant

        let remainingAmount = amount;
        
        for (const gemType of gemTypes) {
            const availableInType = this.gameState.polishing.inventory[gemType];
            const toReduce = Math.min(availableInType, remainingAmount);
            
            if (toReduce > 0) {
                this.gameState.polishing.inventory[gemType] -= toReduce;
                remainingAmount -= toReduce;
                
                if (remainingAmount === 0) break;
            }
        }
    }

    startPolishing(slotId) {
        const slot = this.gameState.polishing.slots.find(s => s.id === slotId);
        if (!slot || !slot.isStaked || slot.processState !== 'staked') return;
        
        if (slot.currentGems === 0) {
            this.showNotification('Cannot start polishing: Slot needs gems added manually first!', 'error');
            return;
        }

        slot.processState = 'processing';
        slot.processStartTime = Date.now();
        slot.processEndTime = slot.processStartTime + slot.polishingDuration;
        
        this.showNotification(`Polishing started in slot ${slotId} for 1 hour!`, 'success');
        this.checkPolishingProgress();
        this.updateUI();
    }

    checkPolishingProgress() {
        this.gameState.polishing.slots.forEach(slot => {
            if (slot.processState === 'processing' && Date.now() >= slot.processEndTime) {
                slot.processState = 'ready';
                this.finishPolishing(slot);
            }
        });
    }

    finishPolishing(slot) {
        // Generate gems based on probability
        const processedGems = this.generateRandomGems(500);
        slot.processedGems = processedGems;
        
        this.showNotification(`Polishing finished in slot ${slot.id}! ${Object.values(processedGems).reduce((a, b) => a + b, 0)} gems ready to claim.`, 'success');
        this.updateUI();
    }

    generateRandomGems(totalGems) {
        const generated = {
            diamond: 0,
            ruby: 0,
            sapphire: 0,
            emerald: 0,
            jade: 0,
            tanzanite: 0,
            opal: 0,
            aquamarine: 0,
            topaz: 0,
            amethyst: 0
        };

        for (let i = 0; i < totalGems; i++) {
            const gemType = this.generateSingleRandomGem(this.gameState.polishing.gemTypes);
            generated[gemType]++;
        }

        return generated;
    }

    generateSingleRandomGem(gemTypes) {
        const randomValue = Math.random() * 100;
        let cumulativeChance = 0;
        
        for (const gem of gemTypes) {
            cumulativeChance += gem.chance;
            if (randomValue <= cumulativeChance) {
                return gem.name.toLowerCase();
            }
        }
        
        return 'amethyst'; // Default fallback
    }

    claimPolishedGems(slotId) {
        const slot = this.gameState.polishing.slots.find(s => s.id === slotId);
        if (!slot || slot.processState !== 'ready') return;

        // Add polished gems to player inventory
        Object.keys(slot.processedGems).forEach(gemType => {
            this.gameState.player.polishedGems[gemType] += slot.processedGems[gemType];
        });

        const totalClaimed = Object.values(slot.processedGems).reduce((sum, count) => sum + count, 0);
        const rewardAmount = totalClaimed * 0.1; // 0.1 TSDM per polished gem
        
        this.gameState.player.tsdBalance += rewardAmount;

        // Reset slot
        slot.processState = 'staked';
        slot.processStartTime = null;
        slot.processEndTime = null;
        slot.processedGems = {};
        slot.currentGems = 0;

        this.showNotification(`Claimed ${totalClaimed} polished gems! (+${rewardAmount.toFixed(2)} TSDM)`, 'success');
        this.updateUI();
    }

    updateGemInventory() {
        const tbody = document.getElementById('inventory-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.gameState.polishing.gemTypes.forEach(gemType => {
            const ownedCount = this.gameState.polishing.inventory[gemType.name.toLowerCase()] || 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="gem-type-cell">
                    <span style="color: ${gemType.color}; font-size: 1.2rem;">${gemType.icon}</span>
                    <span>${gemType.name}</span>
                </td>
                <td class="chance-cell">${gemType.chance.toFixed(2)}%</td>
                <td class="owned-cell">${ownedCount}</td>
            `;
            tbody.appendChild(row);
        });

        // Update stats
        const totalInventory = document.getElementById('total-inventory-gems');
        const totalGems = Object.values(this.gameState.polishing.inventory).reduce((a, b) => a + b, 0);
        if (totalInventory) totalInventory.textContent = totalGems;
    }

    // Trading Functions
    
    hasPolishedGem(gemType) {
        // Polished gems always available for staking
        return true;
    }

    initializeTrading() {
        // Initialize 10 staking slots for different gems
        const gemTypes = this.gameState.polishing.gemTypes;
        this.gameState.trading.stakingSlots = [];
        
        gemTypes.forEach((gemType, index) => {
            this.gameState.trading.stakingSlots.push({
                id: index + 1,
                gemType: gemType.name,
                staked: false,
                stakedGem: null,
                stakedGemType: null, // 'polished' or 'unpolished'
                selectedType: 'polished',
                benefit: {
                    priceMultiplier: 1.0,
                    gameDollarMultiplier: 1.0,
                    unlockedTypes: []
                }
            });
        });

        // Initialize gem prices
        this.initializeGemPrices();
        
        // Update trading display
        this.updateTradingDisplay();
        this.updateTradingStats();
        this.initializeTradingMatrix();
        this.populateMatrixSelectors();
        this.syncMatrixSelections();
        this.attachMatrixEvents();
        this.initializeGemPriceChart();
    }

    initializeGemPrices() {
        const gemPrices = {
            'Diamond': { base: 100, influenced: 150 },
            'Ruby': { base: 80, influenced: 120 },
            'Sapphire': { base: 60, influenced: 90 },
            'Emerald': { base: 50, influenced: 75 },
            'Jade': { base: 40, influenced: 60 },
            'Tanzanite': { base: 35, influenced: 52 },
            'Opal': { base: 30, influenced: 45 },
            'Aquamarine': { base: 25, influenced: 37 },
            'Topaz': { base: 20, influenced: 30 },
            'Amethyst': { base: 15, influenced: 22 }
        };
        
        this.gameState.trading.gemPrices = gemPrices;
    }

    initializeTradingMatrix() {
        this.createTradingMatrixDom();
        this.seedTradingMatrixValues();
        this.updateTradingMatrixDom();
        this.setupTradingMatrixTimer();
        this.updateTradingMatrixHeaders();
        this.setupMatrixResizeHandler();
    }

    setupMatrixResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.createTradingMatrixDom();
                this.updateTradingMatrixDom();
                this.highlightMatrixSelection();
            }, 250);
        });
    }

    createTradingMatrixDom() {
        const cityBoostWrapper = document.getElementById('city-boost-matrix-wrapper');
        if (!cityBoostWrapper) return;

        cityBoostWrapper.innerHTML = '';

        const matrixWrapper = document.createElement('div');
        matrixWrapper.id = 'city-boost-matrix';
        matrixWrapper.className = 'trading-matrix-wrapper';
        cityBoostWrapper.appendChild(matrixWrapper);

        const table = this.createTradingMatrixTable();
        matrixWrapper.appendChild(table);
    }

    createTradingMatrixTable() {
        this.tradingTableHeaders.clear();
        this.tradingTableCells.clear();
        this.tradingTableCellData.clear();

        // Check if mobile view
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            return this.createMobileTradingMatrix();
        }

        const table = document.createElement('table');
        table.className = 'matrix-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.appendChild(document.createElement('th'));
        this.tradingMatrixConfig.gems.forEach(gem => {
            const th = document.createElement('th');
            th.textContent = `${gem.name} (${this.getPolishedGemAmount(gem.id)})`;
            this.tradingTableHeaders.set(gem.id, th);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        const tbody = document.createElement('tbody');
        this.tradingMatrixConfig.cities.forEach(city => {
            const row = document.createElement('tr');
            const cityCell = document.createElement('th');
            cityCell.textContent = city.name;
            cityCell.dataset.cityId = city.id;
            row.appendChild(cityCell);

            this.tradingMatrixConfig.gems.forEach(gem => {
                const cell = document.createElement('td');
                const cellId = `${city.id}-${gem.id}`;
                cell.id = `matrix-${cellId}`;
                cell.className = 'matrix-cell';
                cell.dataset.cityId = city.id;
                cell.innerHTML = '<span class="matrix-boost">--</span>';
                this.tradingTableCells.set(cellId, cell);
                this.tradingTableCellData.set(cellId, { previousBoost: null });
                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        return table;
    }

    createMobileTradingMatrix() {
        const table = document.createElement('table');
        table.className = 'mobile-matrix-table';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Empty cell for city names column
        const emptyTh = document.createElement('th');
        emptyTh.className = 'mobile-city-header';
        headerRow.appendChild(emptyTh);
        
        // Gem headers
        this.tradingMatrixConfig.gems.forEach(gem => {
            const th = document.createElement('th');
            th.className = 'mobile-gem-header';
            th.innerHTML = `
                <div class="mobile-gem-name">${gem.name}</div>
                <div class="mobile-gem-count">${this.getPolishedGemAmount(gem.id)}</div>
            `;
            this.tradingTableHeaders.set(gem.id, th);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Create body
        const tbody = document.createElement('tbody');
        this.tradingMatrixConfig.cities.forEach(city => {
            const row = document.createElement('tr');
            
            // City name cell
            const cityCell = document.createElement('td');
            cityCell.className = 'mobile-city-cell';
            cityCell.textContent = city.name;
            cityCell.dataset.cityId = city.id;
            row.appendChild(cityCell);

            // Gem cells
            this.tradingMatrixConfig.gems.forEach(gem => {
                const cell = document.createElement('td');
                const cellId = `${city.id}-${gem.id}`;
                cell.id = `matrix-${cellId}`;
                cell.className = 'mobile-matrix-cell';
                cell.dataset.cityId = city.id;
                cell.dataset.gemId = gem.id;
                cell.innerHTML = '<span class="mobile-matrix-boost">--</span>';
                
                this.tradingTableCells.set(cellId, cell);
                this.tradingTableCellData.set(cellId, { previousBoost: null });
                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        return table;
    }

    populateMatrixSelectors() {
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');
        if (!citySelect || !gemSelect) return;

        citySelect.innerHTML = this.tradingMatrixConfig.cities.map(city => `
            <option value="${city.id}">${city.name}</option>
        `).join('');

        gemSelect.innerHTML = this.tradingMatrixConfig.gems.map(gem => `
            <option value="${gem.id}">${gem.name}</option>
        `).join('');

        citySelect.value = this.gameState.trading.activeCity;
        gemSelect.value = this.tradingMatrixConfig.gems[0]?.id || '';
    }

    attachMatrixEvents() {
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');
        const amountInput = document.getElementById('matrix-sell-amount');
        const sellButton = document.getElementById('matrix-sell-btn');

        citySelect?.addEventListener('change', () => {
            this.gameState.trading.activeCity = citySelect.value;
            this.syncMatrixSelections();
        });

        gemSelect?.addEventListener('change', () => {
            this.syncMatrixSelections();
        });

        amountInput?.addEventListener('input', () => {
            this.updateMatrixSummary();
        });

        sellButton?.addEventListener('click', () => {
            this.sellGems();
        });

        // Add click events for mobile matrix cells
        this.attachMobileMatrixClickEvents();
    }

    attachMobileMatrixClickEvents() {
        // Use event delegation for dynamic content
        document.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) return;

            // Check if clicked element is a mobile matrix cell
            const cell = e.target.closest('.mobile-matrix-cell');
            if (!cell) return;

            const cityId = cell.dataset.cityId;
            const gemId = cell.dataset.gemId;

            if (cityId && gemId) {
                // Update dropdown selections
                const citySelect = document.getElementById('matrix-city-select');
                const gemSelect = document.getElementById('matrix-gem-select');

                if (citySelect) {
                    citySelect.value = cityId;
                    this.gameState.trading.activeCity = cityId;
                }

                if (gemSelect) {
                    gemSelect.value = gemId;
                }

                // Update matrix summary and highlight selection
                this.syncMatrixSelections();
            }
        });
    }

    attachMatrixEvents() {
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');
        const amountInput = document.getElementById('matrix-sell-amount');
        const sellButton = document.getElementById('matrix-sell-btn');

        citySelect?.addEventListener('change', () => {
            this.gameState.trading.activeCity = citySelect.value;
            this.syncMatrixSelections();
        });

        gemSelect?.addEventListener('change', () => {
            this.syncMatrixSelections();
        });

        amountInput?.addEventListener('input', () => {
            this.updateMatrixSummary();
        });

        sellButton?.addEventListener('click', () => {
            this.sellGems();
        });

        // Add click events for mobile matrix cells
        this.attachMobileMatrixClickEvents();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.priceRefreshInterval) {
                    clearInterval(this.priceRefreshInterval);
                    this.priceRefreshInterval = null;
                }
            } else {
                if (!this.priceRefreshInterval) {
                    this.fetchGemPriceData();
                    this.priceRefreshInterval = setInterval(() => this.fetchGemPriceData(), 60 * 1000);
                }
            }
        });
    }

    initializeGemPriceChart() {
        const chartCanvas = document.getElementById('gem-price-chart');
        const status = document.getElementById('pricing-status');
        if (!chartCanvas || !status) return;

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
                        grid: { color: 'rgba(255,255,255,0.08)' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.y.toFixed(2)} Game $`
                        }
                    }
                }
            }
        });

        this.fetchGemPriceData();
        this.priceRefreshInterval = setInterval(() => this.fetchGemPriceData(), 60 * 1000);
    }

    async fetchGemPriceData() {
        const status = document.getElementById('pricing-status');
        if (!this.gemPriceChart || !status) return;

        status.textContent = 'Updating prices…';

        const endpoints = [
            'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1',
            'https://coingecko.jellyfam.io/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1'
        ];

        let data;
        for (const url of endpoints) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const json = await response.json();
                if (json?.prices?.length) {
                    data = json.prices;
                    break;
                }
            } catch (error) {
                continue;
            }
        }

        if (!data) {
            status.textContent = 'Failed to load price data.';
            return;
        }

        const labels = data.map(([timestamp]) => {
            const date = new Date(timestamp);
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        });

        const prices = data.map(([, price]) => Number(price) / 100);
        this.latestGemBasePrice = prices[prices.length - 1] || null;

        this.gemPriceChart.data.labels = labels;
        this.gemPriceChart.data.datasets[0].data = prices;
        this.gemPriceChart.update();

        const latestPrice = this.latestGemBasePrice ?? 0;
        status.textContent = `Latest base price: ${latestPrice.toFixed(2)} Game $`;

        const matrixBasePriceLabel = document.getElementById('matrix-base-price');
        if (matrixBasePriceLabel) {
            // Show the latest base price
            matrixBasePriceLabel.textContent = `Base price: ${latestPrice.toFixed(2)} Game $`;
        }
    }

    syncMatrixSelections() {
        const citySelect = document.getElementById('matrix-city-select');
        if (citySelect) {
            this.gameState.trading.activeCity = citySelect.value;
            this.updateTradingCity();
        }

        this.updateMatrixSummary();
        this.highlightMatrixSelection();
    }

    highlightMatrixSelection() {
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');
        if (!citySelect || !gemSelect) return;

        const selectedCity = citySelect.value;
        const selectedGem = gemSelect.value;
        const isMobile = window.innerWidth <= 768;

        // Remove previous selections
        if (isMobile) {
            document.querySelectorAll('.mobile-matrix-cell').forEach(cell => {
                cell.classList.remove('selected');
            });
        } else {
            document.querySelectorAll('#city-boost-matrix td').forEach(cell => {
                cell.classList.remove('selected');
            });
        }

        // Add selection to target
        const targetCell = document.getElementById(`matrix-${selectedCity}-${selectedGem}`);
        if (targetCell) {
            targetCell.classList.add('selected');
            if (isMobile) {
                targetCell.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } else {
                targetCell.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
            }
        }
    }

    updateMatrixSummary() {
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');
        const amountInput = document.getElementById('matrix-sell-amount');
        const boostLabel = document.getElementById('matrix-summary-boost');
        const stakingLabel = document.getElementById('matrix-summary-staking');
        const priceLabel = document.getElementById('matrix-summary-price');

        if (!citySelect || !gemSelect || !amountInput || !boostLabel || !priceLabel || !stakingLabel) return;

        const matrix = this.gameState.trading.priceMatrix;
        const city = citySelect.value;
        const gem = gemSelect.value;
        const amount = Math.max(1, parseInt(amountInput.value, 10) || 1);

        const entry = matrix?.[city]?.[gem];
        const boost = entry?.boost ?? 0;
        const gemName = this.findGemNameById(gem);
        const basePrice = this.latestGemBasePrice ?? 0;
        // City bonus is not used in the calculation - only boost and staking bonus

        // Get staking bonus only for the specific gem type
        const stakingSlot = this.gameState.trading.stakingSlots.find(s => s.gemType === gemName && s.staked);
        const stakingBonusPercent = stakingSlot ? (stakingSlot.benefit.gameDollarMultiplier || 0) * 100 : 0;

        // Simple calculation: Base Price + City Boost + Staking Bonus
        const cityBoostValue = (basePrice * boost) / 100;
        const stakingBonusValue = (basePrice * stakingBonusPercent) / 100;
        const pricePerGem = Math.round(basePrice + cityBoostValue + stakingBonusValue);
        const payout = pricePerGem * amount;

        boostLabel.textContent = `Boost: +${boost}%`;
        
        // Only show staking bonus if the gem type is actually staked
        if (stakingSlot && stakingBonusPercent > 0) {
            stakingLabel.textContent = `Staking Bonus: +${stakingBonusPercent.toFixed(0)}%`;
        } else {
            stakingLabel.textContent = `Staking Bonus: +0%`;
        }
        
        priceLabel.textContent = `Est. Payout: ${payout} Game $`;
    }

    findGemNameById(id) {
        const gem = this.tradingMatrixConfig.gems.find(g => g.id === id);
        return gem?.name || '';
    }


    seedTradingMatrixValues() {
        const matrix = {};
        this.tradingMatrixConfig.cities.forEach(city => {
            matrix[city.id] = {};
            this.tradingMatrixConfig.gems.forEach(gem => {
                const gemName = gem.name;
                const basePrice = this.gameState.trading.gemPrices[gemName]?.base ?? 0;
                const boost = this.randomBoost();
                matrix[city.id][gem.id] = {
                    base: basePrice,
                    boost
                };
            });
        });
        this.gameState.trading.priceMatrix = matrix;
    }

    setupTradingMatrixTimer() {
        if (this.tradingPriceInterval) {
            clearInterval(this.tradingPriceInterval);
        }
        const hourMs = 60 * 60 * 1000;
        this.tradingPriceInterval = setInterval(() => {
            this.refreshTradingMatrixValues();
        }, hourMs);
    }

    refreshTradingMatrixValues() {
        const matrix = this.gameState.trading.priceMatrix;
        Object.keys(matrix).forEach(cityId => {
            Object.keys(matrix[cityId]).forEach(gemId => {
                const entry = matrix[cityId][gemId];
                const gem = this.tradingMatrixConfig.gems.find(g => g.id === gemId);
                const gemName = gem?.name || '';
                entry.base = this.gameState.trading.gemPrices[gemName]?.base ?? 0;
                const boost = this.randomBoost();
                entry.boost = boost;
                entry.value = this.applyBoost(entry.base ?? 0, boost);
            });
        });
        this.updateTradingMatrixDom();
    }

    randomBoost() {
        return Math.floor(Math.random() * 10) + 1; // 1 - 10 %
    }

    applyBoost(base, boostPercent) {
        return Math.round(base * (1 + boostPercent / 100));
    }

    updateTradingMatrixDom() {
        const matrix = this.gameState.trading.priceMatrix;
        const isMobile = window.innerWidth <= 768;
        
        Object.keys(matrix).forEach(cityId => {
            Object.keys(matrix[cityId]).forEach(gemId => {
                const entry = matrix[cityId][gemId];
                const cellKey = `${cityId}-${gemId}`;
                const cell = this.tradingTableCells.get(cellKey);
                const cellData = this.tradingTableCellData.get(cellKey) || { previousBoost: null };
                if (cell) {
                    const previous = cellData.previousBoost;

                    if (isMobile) {
                        // Mobile table structure
                        const boostElement = cell.querySelector('.mobile-matrix-boost');
                        if (boostElement) {
                            boostElement.textContent = `+${entry.boost}%`;
                            
                            // Update boost styling
                            boostElement.classList.remove('increase', 'decrease', 'neutral');
                            if (previous !== null) {
                                if (entry.boost > previous) {
                                    boostElement.classList.add('increase');
                                } else if (entry.boost < previous) {
                                    boostElement.classList.add('decrease');
                                } else {
                                    boostElement.classList.add('neutral');
                                }
                            } else {
                                boostElement.classList.add('neutral');
                            }
                        }
                    } else {
                        // Desktop table structure
                        const boostSpan = cell.querySelector('.matrix-boost') || document.createElement('span');
                        boostSpan.className = 'matrix-boost';
                        boostSpan.textContent = `+${entry.boost}%`;

                        if (!boostSpan.parentNode) {
                            cell.appendChild(boostSpan);
                        }

                        if (previous !== null) {
                            if (entry.boost > previous) {
                                boostSpan.classList.remove('decrease');
                                boostSpan.classList.add('increase');
                            } else if (entry.boost < previous) {
                                boostSpan.classList.remove('increase');
                                boostSpan.classList.add('decrease');
                            } else {
                                boostSpan.classList.remove('increase');
                                boostSpan.classList.remove('decrease');
                            }
                        } else {
                            boostSpan.classList.remove('increase');
                            boostSpan.classList.remove('decrease');
                        }
                    }

                    cellData.previousBoost = entry.boost;
                    this.tradingTableCellData.set(cellKey, cellData);
                }
            });
        });

        this.updateMatrixSummary();
        this.highlightMatrixSelection();
    }

    updateTradingDisplay() {
        this.updateBenefitsDisplay();
        this.updateGemSellingGrid();
        this.updateStakingGrid();
        this.updateTradingCity();
    }

    updateBenefitsDisplay() {
        const benefitsDisplay = document.getElementById('benefits-display');
        if (!benefitsDisplay) return;

        const activeBenefits = this.gameState.trading.stakingSlots.filter(slot => slot.staked);
        let benefitsHTML = '';

        if (activeBenefits.length > 0) {
            benefitsHTML = `
                <div class="active-benefits-list">
                    ${activeBenefits.map(slot => `
                        <div class="benefit-item">
                            <span class="benefit-gem">${slot.gemType} (${slot.stakedGemType === 'polished' ? 'Polished' : 'Rough'})</span>
                            <span class="benefit-bonus">+${Math.round(slot.benefit.gameDollarMultiplier * 100)}% Game $ on ${slot.gemType}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            benefitsHTML = '<p class="no-benefits">No staking benefits active</p>';
        }

        benefitsDisplay.innerHTML = benefitsHTML;
    }

    updateGemSellingGrid() {
        // Legacy grid removed; keep method for compatibility by syncing matrix summary
        this.updateMatrixSummary();
    }

    updateStakingGrid() {
        const stakingGrid = document.getElementById('staking-grid');
        if (!stakingGrid) return;

        const stakingHTML = this.gameState.trading.stakingSlots.map(slot => {
            const stakingGemType = slot.gemType.toLowerCase();

            if (!slot.selectedType) {
                slot.selectedType = 'polished';
            }

            const polishedSelected = slot.selectedType === 'polished';
            const roughSelected = slot.selectedType === 'unpolished';

            const polishedImageClass = `staking-gem-image ${polishedSelected ? 'colored' : 'greyed'}`;
            const roughImageClass = `staking-gem-image ${roughSelected ? 'colored' : 'greyed'}`;

            // Game Dollar multi-Access for polished/unpolished
            const bonusMultipliers = this.gameState.trading.gemBonusMultipliers[slot.gemType];
            const polishedPerceived = bonusMultipliers.polished || 0;
            const roughPerceived = bonusMultipliers.unpolished || 0;

            // Standard image path logic
            const gemImagePath = stakingGemType;

            return `
                <div class="staking-slot ${slot.staked ? 'active' : 'empty'}">
                    ${slot.staked ? `
                        <div class="staking-active">
                            <img src="images/${gemImagePath}${slot.stakedGemType === 'polished' ? '' : '_rough'}.png" 
                                 alt="${slot.gemType} ${slot.stakedGemType}" 
                                 class="staking-gem-image">
                            <div class="staking-info">
                                <h4>${slot.gemType} ${slot.stakedGemType === 'polished' ? 'Polished' : 'Rough'} Staked</h4>
                                <p>+${Math.round(slot.benefit.gameDollarMultiplier * 100)}% Game $ Bonus</p>
                            </div>
                            <button onclick="game.unstakeGem(${slot.id})" class="unstake-btn">Unstake</button>
                        </div>
                    ` : `
                        <div class="staking-empty">
                            <div class="staking-image-selection">
                                <!-- Polished version always shown for comparison -->
                                <div class="gem-selection-item polished ${polishedSelected ? 'selected' : ''}" 
                                     data-staking="${slot.id}" 
                                     data-type="polished"
                                     onclick="game.selectStakeType(${slot.id}, 'polished')">
                                    <img src="images/${gemImagePath}.png" 
                                         alt="${slot.gemType} polished" 
                                         class="${polishedImageClass}">
                                    <div class="selection-benefit">
                                        <span class="benefit-text">+${Math.round(polishedPerceived * 100)}% Game $</span>
                                    </div>
                                </div>
                                <!-- Rough version always shown -->
                                <div class="gem-selection-item rough ${roughSelected ? 'selected' : ''}" 
                                     data-staking="${slot.id}" 
                                     data-type="unpolished"
                                     onclick="game.selectStakeType(${slot.id}, 'unpolished')">
                                    <img src="images/${gemImagePath}_rough.png" 
                                         alt="${slot.gemType} rough" 
                                         class="${roughImageClass}">
                                    <div class="selection-benefit">
                                        <span class="benefit-text">+${Math.round(roughPerceived * 100)}% Game $</span>
                                    </div>
                                </div>
                            </div>
                            <div class="staking-info">
                                <h4>${slot.gemType} Slot</h4>
                                <p>Select which NFT type to stake</p>
                                <button onclick="game.stakeGem(${slot.id})" class="stake-btn">
                                    Stake ${slot.selectedType === 'polished' ? 'Polished' : 'Rough'}
                                </button>
                            </div>
                        </div>
                    `}
                </div>
            `;
        }).join('');

        stakingGrid.innerHTML = stakingHTML;
    }

    updateTradingCity() {
        const activeCityElement = document.getElementById('active-city');
        const matrixCitySelect = document.getElementById('matrix-city-select');
        
        if (activeCityElement) {
            const currentCity = this.gameState.trading.cities.find(c => c.id === this.gameState.trading.activeCity);
            activeCityElement.textContent = currentCity ? currentCity.name : 'Select City';
        }

        if (matrixCitySelect) {
            matrixCitySelect.value = this.gameState.trading.activeCity;
        }

        this.updateGemSellingGrid();
    }

    updateTradingStats() {
        const gameDollarsElement = document.getElementById('game-dollars');
        if (gameDollarsElement) {
            gameDollarsElement.textContent = `${this.gameState.trading.totalGameDollars.toFixed(0)} Game $`;
        }
    }

    changeTradingCity() {
        const matrixCitySelect = document.getElementById('matrix-city-select');
        if (!matrixCitySelect) return;
        this.gameState.trading.activeCity = matrixCitySelect.value;
        this.updateTradingCity();
        this.showNotification(`Trading city changed to ${matrixCitySelect.options[matrixCitySelect.selectedIndex].text}`, 'success');
    }

    selectStakeType(slotId, type) {
        // Clear previous selections and set the selected item
        const selectionItems = document.querySelectorAll(`[data-staking="${slotId}"]`);
        selectionItems.forEach(item => item.classList.remove('selected'));
        
        const selectedItems = document.querySelectorAll(`[data-staking="${slotId}"][data-type="${type}"]`);
        if (selectedItems.length > 0 && !selectedItems[0].classList.contains('disabled')) {
            selectedItems[0].classList.add('selected');
            const slot = this.gameState.trading.stakingSlots.find(s => s.id === slotId);
            if (slot) {
                slot.selectedType = type;
            }
        }
    }

    stakeGem(slotId) {
        const slot = this.gameState.trading.stakingSlots.find(s => s.id === slotId);
        if (!slot || slot.staked) return;

        const selectedType = slot.selectedType || 'polished';
        const isPolished = selectedType === 'polished';

        slot.staked = true;
        slot.stakedGem = slot.gemType;
        slot.stakedGemType = isPolished ? 'polished' : 'unpolished';

        const bonusMultipliers = this.gameState.trading.gemBonusMultipliers[slot.gemType];
        slot.benefit.priceMultiplier = 1.0;
        slot.benefit.gameDollarMultiplier = isPolished ? bonusMultipliers.polished : bonusMultipliers.unpolished;

        slot.selectedType = isPolished ? 'polished' : 'unpolished';

        this.showNotification(`${slot.gemType} ${isPolished ? 'polished' : 'rough'} staked! +${Math.round(slot.benefit.gameDollarMultiplier * 100)}% Game $ boost`, 'success');
        this.updateStakingGrid();
        this.updateGemSellingGrid();
        this.updateBenefitsDisplay();
    }

    unstakeGem(slotId) {
        const slot = this.gameState.trading.stakingSlots.find(s => s.id === slotId);
        if (!slot || !slot.staked) return;

        const isPolished = slot.stakedGemType === 'polished';

        slot.staked = false;
        slot.stakedGem = null;
        slot.stakedGemType = null;
        slot.benefit.priceMultiplier = 1.0;
        slot.benefit.gameDollarMultiplier = 1.0;
        
        this.showNotification(`${slot.gemType} ${isPolished ? 'polished' : 'rough'} unstaked`, 'info');
        this.updateStakingGrid();
        this.updateGemSellingGrid();
        this.updateBenefitsDisplay();
    }

    sellGems() {
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');
        const amountInput = document.getElementById('matrix-sell-amount');

        if (!citySelect || !gemSelect || !amountInput) return;

        const cityId = citySelect.value;
        const gemId = gemSelect.value;
        const amount = Math.max(1, parseInt(amountInput.value, 10) || 1);

        const matrixEntry = this.gameState.trading.priceMatrix?.[cityId]?.[gemId];
        if (!matrixEntry || this.latestGemBasePrice == null) {
            this.showNotification('Price data unavailable for the selected gem and city.', 'error');
            return;
        }

        const gemName = this.findGemNameById(gemId);
        const basePrice = this.latestGemBasePrice ?? 0;
        const city = this.gameState.trading.cities.find(c => c.id === cityId);
        const cityBonus = city?.bonus ?? 0;

        const stakingSlot = this.gameState.trading.stakingSlots.find(s => s.gemType === gemName && s.staked);
        const stakingBonusPercent = stakingSlot ? (stakingSlot.benefit.gameDollarMultiplier || 0) * 100 : 0;

        // Simple calculation: Base Price + City Boost + Staking Bonus
        const cityBoostValue = (basePrice * matrixEntry.boost) / 100;
        const stakingBonusValue = (basePrice * stakingBonusPercent) / 100;
        const pricePerGem = Math.round(basePrice + cityBoostValue + stakingBonusValue);
        const totalPayout = pricePerGem * amount;

        // Check if player has enough polished gems
        const availablePolishedGems = this.gameState.player.polishedGems[gemId] || 0;
        if (availablePolishedGems < amount) {
            this.showNotification(`Not enough polished ${gemName}! You have ${availablePolishedGems} polished gems.`, 'error');
            return;
        }

        // Deduct polished gems from inventory
        this.gameState.player.polishedGems[gemId] -= amount;

        this.gameState.trading.totalGameDollars += totalPayout;

        this.showNotification(`Sold ${amount} polished ${gemName} for ${totalPayout.toFixed(0)} Game $!`, 'success');
        this.updateTradingStats();
        this.updateMatrixSummary();
    }

    getPolishedGemAmount(gemId) {
        return this.gameState.player.polishedGems[gemId] ?? 0;
    }

    updateTradingMatrixHeaders() {
        if (!this.tradingTableHeaders) return;
        this.tradingMatrixConfig.gems.forEach(gem => {
            const headerCell = this.tradingTableHeaders.get(gem.id);
            if (headerCell) {
                headerCell.textContent = `${gem.name} (${this.getPolishedGemAmount(gem.id)})`;
            }
        });
    }
}

// Global functions for HTML onclick handlers


function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

function closeRepairModal() {
    document.getElementById('repair-modal').classList.remove('active');
}

function closeMotivationModal() {
    document.getElementById('motivation-modal').classList.remove('active');
}

function closeWorkerGalleryModal() {
    document.getElementById('worker-gallery-modal').classList.remove('active');
}


// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new TSDGEMSGame();
    
    // Add event listener for worker selection confirmation
    document.getElementById('confirm-worker-selection').addEventListener('click', () => {
        game.confirmWorkerSelection();
    });
});
