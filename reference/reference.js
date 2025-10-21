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
                }
            },
        };

        this.miningInterval = null;
        this.gameLoop = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeGameData();

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
                navMenu.classList.remove('active');
                const toggleIcon = document.querySelector('#mobile-menu-toggle i');
                toggleIcon.className = 'fas fa-bars';
            }
        });






        // Wallet connection
        document.querySelector('.connect-wallet-btn').addEventListener('click', () => {
            this.connectWallet();
        });
    }

    initializeGameData() {
        // Initialize mining slots
        this.initializeMiningSlots();
        // Initialize polishing gems
        this.initializePolishingGems();
        // Initialize trading system
        this.initializeTrading();
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
        
        // Update wallet balance
        document.querySelector('.wallet-balance').textContent = `${this.gameState.player.tsdBalance.toFixed(2)} TSDM`;
        
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
                                    <i class="fas fa-plus"></i> Add Worker (50 TSDM)
                                </button>
                                <button onclick="game.startMiningTrip(${slot.id})" class="action-btn success" ${slot.workers === 0 ? 'disabled' : ''}>
                                    <i class="fas fa-play"></i> Start Mining Trip
                                </button>
                            `}
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

    // Add worker to staked mine
    addWorker(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || !slot.staked) return;

        if (slot.workers >= slot.maxWorkers) {
            this.showNotification(`Maximum workers (${slot.maxWorkers}) already reached for ${slot.stakeType}!`, 'error');
            return;
        }

        const workerCost = 50; // Cost per worker
        if (this.gameState.player.tsdBalance >= workerCost) {
            this.gameState.player.tsdBalance -= workerCost;
            slot.workers++;
            slot.miningTrip.miningPower = slot.workers * 50; // 50 MP per worker
            this.showNotification(`Worker added! Workers: ${slot.workers}/${slot.maxWorkers}`, 'success');
            this.updateUI();
        } else {
            this.showNotification(`Insufficient TSDM balance to hire worker!`, 'error');
        }
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
        
        slot.miningTrip.completed = false;
        slot.miningTrip.rewards = 0;
        
        this.showNotification(`Claimed ${rewards.toFixed(2)} TSDM from mining trip!`, 'success');
        this.updateUI();
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
                                <i class="fas fa-trophy"></i> Max
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

        // Add gems from inventory
        if (this.canReduceInventory(actualAmount)) {
            this.reduceFromInventory(actualAmount);
            slot.currentGems = Math.min(slot.maxGems, slot.currentGems + actualAmount);
            this.showNotification(`Added ${actualAmount} gems to slot ${slotId} (max capacity)`, 'success');
            
            // Update the input field
            const amountInput = document.getElementById(`gem-amount-${slotId}`);
            if (amountInput) amountInput.value = actualAmount;
            this.updateUI();
        } else {
            this.showNotification('Not enough gems in inventory!', 'error');
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

        // Add gems to inventory
        Object.keys(slot.processedGems).forEach(gemType => {
            this.gameState.polishing.inventory[gemType] += slot.processedGems[gemType];
        });

        const totalClaimed = Object.values(slot.processedGems).reduce((sum, count) => sum + count, 0);
        this.gameState.polishing.polishedGems += totalClaimed;

        // Add TSDM reward for completing process
        const rewardAmount = slot.currentGems * 2; // 2x gem amount as TSD reward
        this.gameState.player.tsdBalance += rewardAmount;
        this.gameState.polishing.totalRewards += rewardAmount;

        // Reset slot
        slot.processState = 'staked';
        slot.processStartTime = null;
        slot.processEndTime = null;
        slot.processedGems = {};
        slot.currentGems = 0;

        this.showNotification(`Claimed ${totalClaimed} gems from slot ${slotId}! (+${rewardAmount.toFixed(2)} TSDM)`, 'success');
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
                <td><span class="rarity-cell rarity-${gemType.rarity}">${gemType.rarity}</span></td>
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
        const gemSellingGrid = document.getElementById('gem-selling-grid');
        if (!gemSellingGrid) return;

        const gemSellingHTML = Object.keys(this.gameState.trading.gemPrices).map(gemType => {
            // Check for staking bonuses
            const stakingSlot = this.gameState.trading.stakingSlots.find(s => s.gemType === gemType && s.staked);
            const baseGameDollarEarnings = stakingSlot ?
                Math.round(100 * stakingSlot.benefit.gameDollarMultiplier) : 10;
            
            return `
                <div class="gem-selling-card">
                    <div class="gem-selling-info">
                        <i class="gem-icon ${gemType.toLowerCase()}">💎</i>
                        <div class="gem-selling-details">
                            <div class="gem-selling-name">${gemType}</div>
                            <div class="gem-selling-price">${baseGameDollarEarnings} Game $ per NFT</div>
                        </div>
                    </div>
                    <div class="gem-selling-actions">
                        <input type="number" id="sell-amount-${gemType.toLowerCase()}" 
                               min="1"
                               placeholder="Amount" class="sell-input">
                        <button onclick="game.sellGems('${gemType.toLowerCase()}', 0)" 
                                class="sell-btn">
                            Sell
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        gemSellingGrid.innerHTML = gemSellingHTML;
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
        const tradingBonusElement = document.getElementById('trading-bonus');
        
        if (activeCityElement) {
            const currentCity = this.gameState.trading.cities.find(c => c.id === this.gameState.trading.activeCity);
            activeCityElement.textContent = currentCity ? currentCity.name : 'Select City';
        }
        
        if (tradingBonusElement) {
            const currentCity = this.gameState.trading.cities.find(c => c.id === this.gameState.trading.activeCity);
            const bonus = currentCity ? currentCity.bonus : 0;
            tradingBonusElement.textContent = `+${bonus}%`;
        }
        
        // Re-render gem selling grid with new prices
        this.updateGemSellingGrid();
    }

    updateTradingStats() {
        const gameDollarsElement = document.getElementById('game-dollars');
        if (gameDollarsElement) {
            gameDollarsElement.textContent = `${this.gameState.trading.totalGameDollars.toFixed(0)} Game $`;
        }
    }

    changeTradingCity() {
        const citySelect = document.getElementById('city-select');
        this.gameState.trading.activeCity = citySelect.value;
        this.updateTradingCity();
        this.showNotification(`Trading city changed to ${citySelect.options[citySelect.selectedIndex].text}`, 'success');
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

    sellGems(gemType, pricePerGem) {
        const amountInput = document.getElementById(`sell-amount-${gemType}`);
        if (!amountInput) return;
        
        const amount = Math.max(1, parseInt(amountInput.value) || 1);
        
        const stakingSlot = this.gameState.trading.stakingSlots.find(s => s.gemType.toLowerCase() === gemType && s.staked);
        let gameDollarsEarned = 0;
        
        if (stakingSlot) {
            const gameDollarMultiplier = stakingSlot.benefit.gameDollarMultiplier || 0;
            gameDollarsEarned = 100 * gameDollarMultiplier * amount;
            this.gameState.trading.totalGameDollars += gameDollarsEarned;
        } else {
            gameDollarsEarned = 10 * amount;
            this.gameState.trading.totalGameDollars += gameDollarsEarned;
        }

        amountInput.value = '';

        const nameCapitalized = gemType.charAt(0).toUpperCase() + gemType.slice(1);
        this.showNotification(`Sold ${amount} ${nameCapitalized} NFTs for ${gameDollarsEarned.toFixed(0)} Game $!`, 'success');
        
        this.updateGemSellingGrid();
        this.updateTradingStats();
        this.updateUI();
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


// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new TSDGEMSGame();
});
