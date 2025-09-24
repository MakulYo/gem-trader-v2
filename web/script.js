// TSDGEMS Diamond Trading Simulator - Game Logic

class TSDGEMSGame {
    constructor() {
        this.gameState = {
            player: {
                name: 'Player',
                tsdBalance: 1000.00,
                totalGems: 0,
                miningPower: 0,
                activeWorkers: 0,
                nftsMined: 0,
                rareNfts: 0,
                nftValue: 0,
                stakedTSD: 0,
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
                    nfts: [],
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
                offlineMining: {
                    isActive: false,
                    startTime: 0,
                    maxDuration: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
                    currentEarnings: 0,
                    lastClaimTime: 0,
                    upgradeLevel: 1,
                    maxUpgradeLevel: 4, // Max 8 hours
                    upgradeCost: {
                        tsd: 1000,
                        gems: 100
                    },
                    warningShown: false,
                    history: []
                }
            },
            miningSlots: {
                available: 3,
                rented: 0,
                totalCost: 0,
                maxSlots: 10,
                slots: [],
                unlockedSlots: [],
                stakingRequirements: {
                    slot1: { tsd: 100, gems: 0 },
                    slot2: { tsd: 200, gems: 0 },
                    slot3: { tsd: 400, gems: 0 },
                    slot4: { tsd: 800, gems: 50 },
                    slot5: { tsd: 1600, gems: 100 },
                    slot6: { tsd: 3200, gems: 200 },
                    slot7: { tsd: 6400, gems: 400 },
                    slot8: { tsd: 12800, gems: 800 },
                    slot9: { tsd: 25600, gems: 1600 },
                    slot10: { tsd: 51200, gems: 3200 }
                }
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
            leaderboard: {
                mining: [],
                lastReset: Date.now(),
                resetInterval: 30 * 24 * 60 * 60 * 1000 // 30 days
            },
            marketplace: {
                equipment: [],
                workers: [],
                gems: [],
                repairs: [],
                materials: [],
                potions: [],
                scrolls: [],
                keys: [],
                marketTrends: {
                    gemDemand: 1.0,
                    gemSupply: 1.0,
                    priceVolatility: 0.1,
                    lastUpdate: Date.now()
                }
            },
            workers: {
                overseers: [],
                trainingCenter: {
                    machineOperator: { cost: 100, duration: 24, boost: 1.2, level: 0, maxLevel: 10 },
                    siteOverseer: { cost: 300, duration: 48, boost: 1.5, level: 0, maxLevel: 10 },
                    gemsPolishing: { cost: 200, duration: 36, boost: 1.3, level: 0, maxLevel: 10 }
                },
                maxWorkers: 10,
                maxWorkersPerMine: 30,
                overseerCost: 500,
                workerMorale: 1.0,
                workerEfficiency: 1.0,
                workerFatigue: 0,
                maxFatigue: 100
            },
            staking: {
                tsdStaked: 0,
                gemsStaked: 0,
                totalBoost: 1.0,
                rewards: 0,
                stakingPeriod: 0,
                maxStakingPeriod: 365,
                stakingBonus: 1.0,
                unstakingCooldown: 0
            },
            // New Systems
            crafting: {
                recipes: [],
                unlockedRecipes: [],
                craftingLevel: 1,
                craftingExperience: 0,
                craftingEfficiency: 1.0,
                criticalCraftChance: 0.05,
                craftingQueue: [],
                maxQueueSize: 5
            },
            fusion: {
                recipes: [],
                unlockedFusions: [],
                fusionLevel: 1,
                fusionExperience: 0,
                fusionSuccessRate: 0.8,
                criticalFusionChance: 0.02,
                fusionBonus: 1.0
            },
            achievements: {
                unlocked: [],
                progress: {},
                rewards: {},
                totalPoints: 0,
                level: 1
            },
            events: {
                active: [],
                upcoming: [],
                completed: [],
                eventPoints: 0,
                eventLevel: 1,
                seasonalEvents: {
                    spring: { active: false, startDate: '2024-03-20', endDate: '2024-06-20' },
                    summer: { active: false, startDate: '2024-06-21', endDate: '2024-09-22' },
                    autumn: { active: false, startDate: '2024-09-23', endDate: '2024-12-20' },
                    winter: { active: false, startDate: '2024-12-21', endDate: '2025-03-19' }
                }
            },
            


            quests: {
                daily: [],
                weekly: [],
                monthly: [],
                story: [],
                completed: [],
                active: [],
                questPoints: 0
            },
            upgrades: {
                mining: {
                    efficiency: { level: 1, maxLevel: 100, cost: 100, effect: 0.1 },
                    speed: { level: 1, maxLevel: 100, cost: 150, effect: 0.05 },
                    luck: { level: 1, maxLevel: 100, cost: 200, effect: 0.02 }
                },
                crafting: {
                    quality: { level: 1, maxLevel: 100, cost: 120, effect: 0.08 },
                    speed: { level: 1, maxLevel: 100, cost: 100, effect: 0.06 },
                    critical: { level: 1, maxLevel: 100, cost: 300, effect: 0.01 }
                },
                fusion: {
                    success: { level: 1, maxLevel: 100, cost: 250, effect: 0.005 },
                    bonus: { level: 1, maxLevel: 100, cost: 400, effect: 0.02 },
                    critical: { level: 1, maxLevel: 100, cost: 500, effect: 0.01 }
                }
            },

            inventory: {
                maxSlots: 100,
                usedSlots: 0,
                autoSort: true,
                filters: [],
                search: '',
                categories: ['gems', 'equipment', 'materials', 'potions', 'scrolls', 'keys', 'nfts']
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
            lastDailyReset: new Date().getDate(),
            lastWeeklyReset: Math.floor(new Date().getDate() / 7)
        };

        this.miningInterval = null;
        this.gameLoop = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeGameData();
        this.initializeCraftingSystem();
        this.initializeFusionSystem();
        this.initializeAchievements();
        this.initializeEvents();



        this.initializeQuests();
        this.initializeUpgrades();

        this.startGameLoop();
        this.checkOfflineMiningEarnings();
        this.updateUI();
        this.checkLeaderboardReset();
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

        // Mining toggle
        document.getElementById('mining-toggle').addEventListener('click', () => {
            this.toggleMining();
        });

        // Offline mining controls
        document.getElementById('start-offline-mining').addEventListener('click', () => {
            this.toggleOfflineMining();
        });

        document.getElementById('claim-offline-earnings').addEventListener('click', () => {
            this.claimOfflineEarnings();
        });

        document.getElementById('upgrade-offline-mining').addEventListener('click', () => {
            this.upgradeOfflineMining();
        });



        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target);
            });
        });

        // Inventory tabs
        document.querySelectorAll('[data-inventory]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchInventoryTab(e.target);
            });
        });

        // Wallet connection
        document.querySelector('.connect-wallet-btn').addEventListener('click', () => {
            this.connectWallet();
        });
    }

    initializeGameData() {
        // Initialize equipment marketplace
        this.gameState.marketplace.equipment = [
            {
                id: 1,
                name: 'Basic Pickaxe',
                type: 'mining_tool',
                miningPower: 10,
                hashRate: 100,
                price: 50,
                description: 'A basic mining tool for beginners'
            },
            {
                id: 2,
                name: 'Steel Drill',
                type: 'mining_tool',
                miningPower: 25,
                hashRate: 250,
                price: 150,
                description: 'Upgraded drilling equipment'
            },
            {
                id: 3,
                name: 'Diamond Laser',
                type: 'mining_tool',
                miningPower: 50,
                hashRate: 500,
                price: 500,
                description: 'Advanced laser mining technology'
            },
            {
                id: 4,
                name: 'Quantum Miner',
                type: 'mining_tool',
                miningPower: 100,
                hashRate: 1000,
                price: 1500,
                description: 'Quantum-powered mining device'
            }
        ];

        // Initialize workers marketplace
        this.gameState.marketplace.workers = [
            {
                id: 1,
                name: 'Novice Miner',
                type: 'worker',
                miningBoost: 1.2,
                efficiency: 0.8,
                salary: 10,
                price: 100,
                description: 'A beginner miner with basic skills'
            },
            {
                id: 2,
                name: 'Experienced Miner',
                type: 'worker',
                miningBoost: 1.5,
                efficiency: 0.9,
                salary: 25,
                price: 300,
                description: 'A skilled miner with years of experience'
            },
            {
                id: 3,
                name: 'Expert Miner',
                type: 'worker',
                miningBoost: 2.0,
                efficiency: 1.0,
                salary: 50,
                price: 800,
                description: 'A master miner with exceptional skills'
            },
            {
                id: 4,
                name: 'Legendary Miner',
                type: 'worker',
                miningBoost: 3.0,
                efficiency: 1.2,
                salary: 100,
                price: 2000,
                description: 'A legendary miner with mythical abilities'
            }
        ];

        // Initialize gems marketplace
        this.gameState.marketplace.gems = [
            {
                id: 1,
                name: 'Quartz',
                rarity: 'common',
                value: 1,
                color: '#ffffff',
                description: 'Common crystalline mineral'
            },
            {
                id: 2,
                name: 'Amethyst',
                rarity: 'uncommon',
                value: 5,
                color: '#9966cc',
                description: 'Purple variety of quartz'
            },
            {
                id: 3,
                name: 'Emerald',
                rarity: 'rare',
                value: 25,
                color: '#00cc66',
                description: 'Precious green gemstone'
            },
            {
                id: 4,
                name: 'Ruby',
                rarity: 'epic',
                value: 100,
                color: '#cc0000',
                description: 'Precious red gemstone'
            },
            {
                id: 5,
                name: 'Diamond',
                rarity: 'legendary',
                value: 500,
                color: '#ffffff',
                description: 'The king of all gemstones'
            }
        ];

        // Initialize repair services marketplace
        this.gameState.marketplace.repairs = [
            {
                id: 1,
                name: 'Basic Repair Kit',
                type: 'repair',
                repairAmount: 25,
                price: 50,
                description: 'Basic repair kit for minor damage'
            },
            {
                id: 2,
                name: 'Advanced Repair Kit',
                type: 'repair',
                repairAmount: 50,
                price: 150,
                description: 'Advanced repair kit for moderate damage'
            },
            {
                id: 3,
                name: 'Professional Repair Kit',
                type: 'repair',
                repairAmount: 100,
                price: 400,
                description: 'Professional repair kit for severe damage'
            }
        ];

        // Initialize leaderboard with sample data
        this.initializeLeaderboard();
        
        // Initialize mining slots
        this.initializeMiningSlots();
        
        // Initialize NFT mining areas
        this.initializeNFTMining();
    }

    initializeCraftingSystem() {
        this.gameState.crafting.recipes = [
            {
                id: 1,
                name: 'Basic Gem Cutter',
                materials: [{ type: 'iron', amount: 5 }, { type: 'wood', amount: 3 }],
                result: { type: 'equipment', id: 'basic_cutter', name: 'Basic Gem Cutter' },
                craftingTime: 30,
                experience: 50,
                level: 1
            },
            {
                id: 2,
                name: 'Advanced Gem Cutter',
                materials: [{ type: 'steel', amount: 8 }, { type: 'diamond', amount: 1 }],
                result: { type: 'equipment', id: 'advanced_cutter', name: 'Advanced Gem Cutter' },
                craftingTime: 60,
                experience: 100,
                level: 5
            },
            {
                id: 3,
                name: 'Gem Polishing Kit',
                materials: [{ type: 'cloth', amount: 2 }, { type: 'polish', amount: 1 }],
                result: { type: 'equipment', id: 'polishing_kit', name: 'Gem Polishing Kit' },
                craftingTime: 45,
                experience: 75,
                level: 3
            }
        ];
        
        this.gameState.crafting.unlockedRecipes = [1]; // Start with basic recipe
    }

    initializeFusionSystem() {
        this.gameState.fusion.recipes = [
            {
                id: 1,
                name: 'Gem Fusion',
                materials: [
                    { type: 'quartz', amount: 10, rarity: 'common' },
                    { type: 'amethyst', amount: 5, rarity: 'uncommon' }
                ],
                result: { type: 'emerald', rarity: 'rare', chance: 0.8 },
                fusionTime: 120,
                experience: 200,
                level: 3
            },
            {
                id: 2,
                name: 'Rare Gem Fusion',
                materials: [
                    { type: 'emerald', amount: 5, rarity: 'rare' },
                    { type: 'ruby', amount: 3, rarity: 'epic' }
                ],
                result: { type: 'diamond', rarity: 'legendary', chance: 0.6 },
                fusionTime: 300,
                experience: 500,
                level: 7
            }
        ];
        
        this.gameState.fusion.unlockedFusions = [1]; // Start with basic fusion
    }

    initializeAchievements() {
        this.gameState.achievements.unlocked = [];
        this.gameState.achievements.progress = {
            gemsMined: 0,
            equipmentCrafted: 0,
            gemsFused: 0,
            workersHired: 0,
            slotsUnlocked: 0,
            nftsMined: 0,
            loginStreak: 0,
            totalPlayTime: 0
        };
        this.gameState.achievements.rewards = {
            firstGem: { tsd: 100, gems: 10, unlocked: false },
            masterMiner: { tsd: 1000, gems: 100, unlocked: false },
            craftMaster: { tsd: 500, gems: 50, unlocked: false },
            fusionExpert: { tsd: 800, gems: 80, unlocked: false }
        };
    }

    initializeEvents() {
        // Daily events
        this.gameState.events.daily = [
            { id: 1, name: 'Mining Marathon', description: 'Mine 100 gems in one day', reward: { tsd: 200, gems: 20 }, completed: false },
            { id: 2, name: 'Crafting Spree', description: 'Craft 5 items in one day', reward: { tsd: 150, gems: 15 }, completed: false },
            { id: 3, name: 'Fusion Master', description: 'Perform 3 fusions in one day', reward: { tsd: 300, gems: 30 }, completed: false }
        ];

        // Weekly events
        this.gameState.events.weekly = [
            { id: 4, name: 'Gem Collector', description: 'Collect 500 gems in one week', reward: { tsd: 1000, gems: 100 }, completed: false },
            { id: 5, name: 'Equipment Master', description: 'Craft 20 items in one week', reward: { tsd: 800, gems: 80 }, completed: false }
        ];

        // Seasonal events
        this.checkSeasonalEvents();
    }







    initializeQuests() {
        // Daily missions
        this.gameState.quests.daily = [
            { 
                id: 'daily_hire_workers', 
                name: 'Hire Workers', 
                description: 'Hire X workers', 
                target: 5, 
                current: 0, 
                reward: { tsd: 200, experience: 300 }, 
                completed: false,
                type: 'hire_workers'
            },
            { 
                id: 'daily_stake_tsd', 
                name: 'Stake TSDM', 
                description: 'Stake X TSDM', 
                target: 1000, 
                current: 0, 
                reward: { tsd: 150, experience: 250 }, 
                completed: false,
                type: 'stake_tsd'
            },
            { 
                id: 'daily_find_gems', 
                name: 'Find Gems', 
                description: 'Find X gems', 
                target: 10, 
                current: 0, 
                reward: { tsd: 300, experience: 400 }, 
                completed: false,
                type: 'find_gems'
            },
            { 
                id: 'daily_claim_rewards', 
                name: 'Claim Rewards', 
                description: 'Claim rewards X times', 
                target: 3, 
                current: 0, 
                reward: { tsd: 250, experience: 350 }, 
                completed: false,
                type: 'claim_rewards'
            }
        ];

        // Weekly missions
        this.gameState.quests.weekly = [
            { 
                id: 'weekly_hire_workers', 
                name: 'Workforce Expansion', 
                description: 'Hire X workers', 
                target: 25, 
                current: 0, 
                reward: { tsd: 1000, experience: 800 }, 
                completed: false,
                type: 'hire_workers'
            },
            { 
                id: 'weekly_stake_tsd', 
                name: 'Major Stake', 
                description: 'Stake X TSDM', 
                target: 5000, 
                current: 0, 
                reward: { tsd: 800, experience: 600 }, 
                completed: false,
                type: 'stake_tsd'
            },
            { 
                id: 'weekly_find_gems', 
                name: 'Gem Collector', 
                description: 'Find X gems', 
                target: 100, 
                current: 0, 
                reward: { tsd: 1500, experience: 1000 }, 
                completed: false,
                type: 'find_gems'
            },
            { 
                id: 'weekly_claim_rewards', 
                name: 'Reward Hunter', 
                description: 'Claim rewards X times', 
                target: 15, 
                current: 0, 
                reward: { tsd: 1200, experience: 900 }, 
                completed: false,
                type: 'claim_rewards'
            }
        ];

        // Story quests
        this.gameState.quests.story = [
            { id: 1, name: 'First Steps', description: 'Mine your first gem', reward: { tsd: 100, experience: 200 }, completed: false },
            { id: 2, name: 'Crafting Journey', description: 'Craft your first item', reward: { tsd: 150, experience: 300 }, completed: false },
            { id: 3, name: 'Fusion Discovery', description: 'Perform your first fusion', reward: { tsd: 200, experience: 400 }, completed: false }
        ];
    }

    initializeUpgrades() {
        // Mining upgrades are already defined in gameState
        // This function can be used for additional upgrade logic
    }



    initializeLeaderboard() {
        const samplePlayers = [
            { name: 'CryptoKing', gemsMined: 15420, miningPower: 8500, rewards: 1542.00 },
            { name: 'GemHunter', gemsMined: 12850, miningPower: 7200, rewards: 1285.00 },
            { name: 'DiamondMiner', gemsMined: 11200, miningPower: 6800, rewards: 1120.00 },
            { name: 'BlockchainPro', gemsMined: 9850, miningPower: 5900, rewards: 985.00 },
            { name: 'MiningMaster', gemsMined: 8750, miningPower: 5200, rewards: 875.00 }
        ];

        this.gameState.leaderboard.mining = samplePlayers.map((player, index) => ({
            ...player,
            rank: index + 1
        }));
    }

    initializeMiningSlots() {
        this.gameState.miningSlots.slots = [
            {
                id: 1,
                name: 'Surface Mine',
                description: 'Basic surface mining location',
                cost: 100,
                benefits: ['+20% Gem Chance', '+15% Mining Speed'],
                rented: false,
                active: false,
                unlocked: true
            },
            {
                id: 2,
                name: 'Underground Mine',
                description: 'Deep underground mining shaft',
                cost: 200,
                benefits: ['+40% Gem Chance', '+30% Mining Speed', '+25% Rare Gem Chance'],
                rented: false,
                active: false,
                unlocked: true
            },
            {
                id: 3,
                name: 'Crystal Cave',
                description: 'Ancient crystal cave system',
                cost: 400,
                benefits: ['+60% Gem Chance', '+50% Mining Speed', '+40% Rare Gem Chance', '+20% NFT Chance'],
                rented: false,
                active: false,
                unlocked: true
            },
            {
                id: 4,
                name: 'Deep Crystal Mine',
                description: 'Advanced crystal mining operation',
                cost: 800,
                benefits: ['+80% Gem Chance', '+70% Mining Speed', '+60% Rare Gem Chance', '+40% NFT Chance'],
                rented: false,
                active: false,
                unlocked: false,
                stakingRequired: { tsd: 800, gems: 50 }
            },
            {
                id: 5,
                name: 'Quantum Mine',
                description: 'Quantum-powered mining facility',
                cost: 1600,
                benefits: ['+100% Gem Chance', '+90% Mining Speed', '+80% Rare Gem Chance', '+60% NFT Chance'],
                rented: false,
                active: false,
                unlocked: false,
                stakingRequired: { tsd: 1600, gems: 100 }
            },
            {
                id: 6,
                name: 'Legendary Mine',
                description: 'The ultimate mining operation',
                cost: 3200,
                benefits: ['+120% Gem Chance', '+110% Mining Speed', '+100% Rare Gem Chance', '+80% NFT Chance'],
                rented: false,
                active: false,
                unlocked: false,
                stakingRequired: { tsd: 3200, gems: 200 }
            },
            {
                id: 7,
                name: 'Cosmic Mine',
                description: 'Mining operation powered by cosmic energy',
                cost: 6400,
                benefits: ['+140% Gem Chance', '+130% Mining Speed', '+120% Rare Gem Chance', '+100% NFT Chance', '+50% Cosmic Boost'],
                rented: false,
                active: false,
                unlocked: false,
                stakingRequired: { tsd: 6400, gems: 400 }
            },
            {
                id: 8,
                name: 'Dimensional Mine',
                description: 'Mining across multiple dimensions',
                cost: 12800,
                benefits: ['+160% Gem Chance', '+150% Mining Speed', '+140% Rare Gem Chance', '+120% NFT Chance', '+100% Dimensional Boost'],
                rented: false,
                active: false,
                unlocked: false,
                stakingRequired: { tsd: 12800, gems: 800 }
            },
            {
                id: 9,
                name: 'Reality Mine',
                description: 'Mining the fabric of reality itself',
                cost: 25600,
                benefits: ['+180% Gem Chance', '+170% Mining Speed', '+160% Rare Gem Chance', '+140% NFT Chance', '+150% Reality Boost'],
                rented: false,
                active: false,
                unlocked: false,
                stakingRequired: { tsd: 25600, gems: 1600 }
            },
            {
                id: 10,
                name: 'Infinity Mine',
                description: 'The infinite mining operation',
                cost: 51200,
                benefits: ['+200% Gem Chance', '+190% Mining Speed', '+180% Rare Gem Chance', '+160% NFT Chance', '+200% Infinity Boost'],
                rented: false,
                active: false,
                unlocked: false,
                stakingRequired: { tsd: 51200, gems: 3200 }
            }
        ];
    }

    initializeNFTMining() {
        this.gameState.nftMining = {
            areas: [
                {
                    id: 1,
                    name: 'Crystal Cave',
                    description: 'High chance of polished gems and rare equipment',
                    cost: 500,
                    nftBoost: 2.0,
                    active: false
                },
                {
                    id: 2,
                    name: 'Deep Mine',
                    description: 'Balanced distribution of all NFT types',
                    cost: 300,
                    nftBoost: 1.5,
                    active: false
                },
                {
                    id: 3,
                    name: 'Surface Deposit',
                    description: 'Common unpolished gems and basic equipment',
                    cost: 100,
                    nftBoost: 1.2,
                    active: false
                }
            ]
        };
    }

    // Crafting System Functions
    craftItem(recipeId) {
        const recipe = this.gameState.crafting.recipes.find(r => r.id === recipeId);
        if (!recipe) return false;

        // Check if player has materials
        if (!this.hasMaterials(recipe.materials)) {
            this.showNotification('Not enough materials!', 'error');
            return false;
        }

        // Check if player meets level requirement
        if (this.gameState.player.level < recipe.level) {
            this.showNotification(`Level ${recipe.level} required!`, 'error');
            return false;
        }

        // Consume materials
        this.consumeMaterials(recipe.materials);

        // Add to crafting queue
        const craftJob = {
            id: Date.now(),
            recipe: recipe,
            startTime: Date.now(),
            endTime: Date.now() + (recipe.craftingTime * 1000),
            completed: false
        };

        this.gameState.crafting.craftingQueue.push(craftJob);
        this.showNotification(`Started crafting ${recipe.name}!`, 'success');
        return true;
    }

    hasMaterials(materials) {
        return materials.every(material => {
            const playerMaterial = this.gameState.player.inventory.materials.find(m => m.type === material.type);
            return playerMaterial && playerMaterial.amount >= material.amount;
        });
    }

    consumeMaterials(materials) {
        materials.forEach(material => {
            const playerMaterial = this.gameState.player.inventory.materials.find(m => m.type === material.type);
            if (playerMaterial) {
                playerMaterial.amount -= material.amount;
                if (playerMaterial.amount <= 0) {
                    this.gameState.player.inventory.materials = this.gameState.player.inventory.materials.filter(m => m.type !== material.type);
                }
            }
        });
    }

    // Fusion System Functions
    fuseGems(material1, material2, fusionRecipe) {
        if (this.gameState.player.level < fusionRecipe.level) {
            this.showNotification(`Level ${fusionRecipe.level} required for fusion!`, 'error');
            return false;
        }

        // Check if player has materials
        if (!this.hasFusionMaterials(material1, material2, fusionRecipe)) {
            this.showNotification('Not enough materials for fusion!', 'error');
            return false;
        }

        // Consume materials
        this.consumeFusionMaterials(material1, material2, fusionRecipe);

        // Calculate success chance
        const successChance = fusionRecipe.chance * this.gameState.fusion.fusionSuccessRate;
        const success = Math.random() < successChance;

        if (success) {
            // Critical fusion chance
            const isCritical = Math.random() < this.gameState.fusion.criticalFusionChance;
            const result = isCritical ? this.createCriticalFusionResult(fusionRecipe.result) : fusionRecipe.result;

            // Add result to inventory
            this.addFusionResult(result);

            // Gain experience
            this.gainExperience(fusionRecipe.experience * (isCritical ? 2 : 1));

            this.showNotification(`Fusion successful! Created ${result.name}!`, 'success');
            if (isCritical) this.showNotification('Critical fusion! Bonus rewards!', 'success');
        } else {
            this.showNotification('Fusion failed! Materials lost.', 'error');
        }

        return success;
    }

    hasFusionMaterials(material1, material2, recipe) {
        const playerGems = this.gameState.player.inventory.gems;
        const gem1 = playerGems.find(g => g.name === material1.name && g.rarity === material1.rarity);
        const gem2 = playerGems.find(g => g.name === material2.name && g.rarity === material2.rarity);

        return gem1 && gem2 && gem1.amount >= material1.amount && gem2.amount >= material2.amount;
    }

    consumeFusionMaterials(material1, material2, recipe) {
        const playerGems = this.gameState.player.inventory.gems;
        const gem1 = playerGems.find(g => g.name === material1.name && g.rarity === material1.rarity);
        const gem2 = playerGems.find(g => g.name === material2.name && g.rarity === material2.rarity);

        if (gem1) gem1.amount -= material1.amount;
        if (gem2) gem2.amount -= material2.amount;

        // Remove empty stacks
        this.gameState.player.inventory.gems = this.gameState.player.inventory.gems.filter(g => g.amount > 0);
    }

    createCriticalFusionResult(baseResult) {
        return {
            ...baseResult,
            name: `Perfect ${baseResult.name}`,
            rarity: this.upgradeRarity(baseResult.rarity),
            value: baseResult.value * 2
        };
    }

    upgradeRarity(rarity) {
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];
        const currentIndex = rarityOrder.indexOf(rarity);
        return currentIndex < rarityOrder.length - 1 ? rarityOrder[currentIndex + 1] : rarity;
    }

    addFusionResult(result) {
        const existingGem = this.gameState.player.inventory.gems.find(g => g.name === result.name && g.rarity === result.rarity);
        if (existingGem) {
            existingGem.amount += 1;
        } else {
            this.gameState.player.inventory.gems.push({
                id: Date.now(),
                name: result.name,
                rarity: result.rarity,
                value: result.value,
                amount: 1
            });
        }
    }

    // Achievement System Functions
    checkAchievements() {
        this.checkMiningAchievements();
        this.checkCraftingAchievements();
        this.checkFusionAchievements();
        this.checkGeneralAchievements();
    }

    checkMiningAchievements() {
        const totalMined = this.gameState.player.stats.totalMined;
        
        if (totalMined >= 1 && !this.gameState.achievements.rewards.firstGem.unlocked) {
            this.unlockAchievement('firstGem');
        }
        
        if (totalMined >= 1000 && !this.gameState.achievements.rewards.masterMiner.unlocked) {
            this.unlockAchievement('masterMiner');
        }
    }

    checkCraftingAchievements() {
        const totalCrafted = this.gameState.player.stats.totalCrafted;
        
        if (totalCrafted >= 10 && !this.gameState.achievements.rewards.craftMaster.unlocked) {
            this.unlockAchievement('craftMaster');
        }
    }

    checkFusionAchievements() {
        const totalFused = this.gameState.player.stats.totalFused;
        
        if (totalFused >= 5 && !this.gameState.achievements.rewards.fusionExpert.unlocked) {
            this.unlockAchievement('fusionExpert');
        }
    }

    checkGeneralAchievements() {
        // Check login streak
        const currentTime = Date.now();
        const lastLogin = this.gameState.player.stats.lastLogin;
        const dayInMs = 24 * 60 * 60 * 1000;
        
        if (currentTime - lastLogin < dayInMs * 2) {
            this.gameState.player.stats.loginStreak++;
        } else {
            this.gameState.player.stats.loginStreak = 1;
        }
        
        this.gameState.player.stats.lastLogin = currentTime;
    }

    unlockAchievement(achievementId) {
        const achievement = this.gameState.achievements.rewards[achievementId];
        if (achievement && !achievement.unlocked) {
            achievement.unlocked = true;
            this.gameState.achievements.unlocked.push(achievementId);
            this.gameState.achievements.totalPoints += 100;
            
            // Give rewards
            this.gameState.player.tsdBalance += achievement.tsd;
            this.addGems(achievement.gems);
            
            this.showNotification(`Achievement unlocked: ${achievementId}!`, 'success');
        }
    }

    // Event System Functions
    checkSeasonalEvents() {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        
        Object.keys(this.gameState.events.seasonalEvents).forEach(season => {
            const event = this.gameState.events.seasonalEvents[season];
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);
            
            if (currentDate >= startDate && currentDate <= endDate) {
                event.active = true;
                this.activateSeasonalEvent(season);
            } else {
                event.active = false;
            }
        });
    }

    activateSeasonalEvent(season) {
        const event = this.gameState.events.seasonalEvents[season];
        if (event.active) {
            this.showNotification(`${season.charAt(0).toUpperCase() + season.slice(1)} event is now active!`, 'info');
            
            // Apply seasonal bonuses
            switch(season) {
                case 'spring':
                    this.gameState.mining.miningEfficiency *= 1.2;
                    break;
                case 'summer':
                    this.gameState.crafting.craftingEfficiency *= 1.15;
                    break;
                case 'autumn':
                    this.gameState.fusion.fusionSuccessRate *= 1.1;
                    break;
                case 'winter':
                    this.gameState.mining.gemBreakChance *= 0.8;
                    break;
            }
        }
    }







    // Quest System Functions
    acceptQuest(questId) {
        const quest = this.gameState.quests.story.find(q => q.id === questId);
        if (!quest) return false;

        if (quest.completed) {
            this.showNotification('Quest already completed!', 'error');
            return false;
        }

        this.gameState.quests.active.push(quest);
        this.showNotification(`Quest accepted: ${quest.name}!`, 'success');
        return true;
    }

    completeQuest(questId) {
        const quest = this.gameState.quests.active.find(q => q.id === questId);
        if (!quest) return false;

        quest.completed = true;
        this.gameState.quests.completed.push(quest);
        this.gameState.quests.active = this.gameState.quests.active.filter(q => q.id !== questId);

        // Give rewards
        this.gameState.player.tsdBalance += quest.reward.tsd;
        this.gainExperience(quest.reward.experience);
        this.gameState.quests.questPoints += 50;

        this.showNotification(`Quest completed: ${quest.name}!`, 'success');
        return true;
    }

    // Upgrade System Functions
    upgradeSkill(category, skillName) {
        const skill = this.gameState.upgrades[category][skillName];
        if (!skill) return false;

        if (skill.level >= skill.maxLevel) {
            this.showNotification('Skill already at maximum level!', 'error');
            return false;
        }

        if (this.gameState.player.tsdBalance < skill.cost) {
            this.showNotification('Not enough TSD!', 'error');
            return false;
        }

        this.gameState.player.tsdBalance -= skill.cost;
        skill.level++;
        skill.cost = Math.floor(skill.cost * 1.5); // Increase cost

        // Apply upgrade effect
        this.applyUpgradeEffect(category, skillName, skill.effect);

        this.showNotification(`${skillName} upgraded to level ${skill.level}!`, 'success');
        return true;
    }

    applyUpgradeEffect(category, skillName, effect) {
        switch(category) {
            case 'mining':
                switch(skillName) {
                    case 'efficiency':
                        this.gameState.mining.miningEfficiency += effect;
                        break;
                    case 'speed':
                        this.gameState.mining.hashRate *= (1 + effect);
                        break;
                    case 'luck':
                        this.gameState.mining.criticalMiningChance += effect;
                        break;
                }
                break;
            case 'crafting':
                switch(skillName) {
                    case 'quality':
                        this.gameState.crafting.criticalCraftChance += effect;
                        break;
                    case 'speed':
                        this.gameState.crafting.craftingEfficiency += effect;
                        break;
                    case 'critical':
                        this.gameState.crafting.criticalCraftChance += effect;
                        break;
                }
                break;
            case 'fusion':
                switch(skillName) {
                    case 'success':
                        this.gameState.fusion.fusionSuccessRate += effect;
                        break;
                    case 'bonus':
                        this.gameState.fusion.fusionBonus += effect;
                        break;
                    case 'critical':
                        this.gameState.fusion.criticalFusionChance += effect;
                        break;
                }
                break;
        }
    }

    // Experience and Leveling System
    gainExperience(amount) {
        this.gameState.player.experience += amount;
        
        while (this.gameState.player.experience >= this.gameState.player.experienceToNext) {
            this.gameState.player.experience -= this.gameState.player.experienceToNext;
            this.levelUp();
        }
    }

    levelUp() {
        this.gameState.player.level++;
        this.gameState.player.experienceToNext = Math.floor(this.gameState.player.experienceToNext * 1.2);
        
        // Unlock new features based on level
        this.unlockLevelFeatures();
        
        this.showNotification(`Level up! You are now level ${this.gameState.player.level}!`, 'success');
    }

    unlockLevelFeatures() {
        const level = this.gameState.player.level;
        
        // Unlock new crafting recipes
        if (level >= 5 && !this.gameState.crafting.unlockedRecipes.includes(2)) {
            this.gameState.crafting.unlockedRecipes.push(2);
            this.showNotification('New crafting recipe unlocked: Advanced Gem Cutter!', 'info');
        }
        
        if (level >= 7 && !this.gameState.fusion.unlockedFusions.includes(2)) {
            this.gameState.fusion.unlockedFusions.push(2);
            this.showNotification('New fusion recipe unlocked: Rare Gem Fusion!', 'info');
        }
        

    }



    startGameLoop() {
        this.gameLoop = setInterval(() => {
            this.updateGame();
        }, 1000); // Update every second

        // Check for daily and weekly mission resets
        this.checkMissionResets();
    }

    checkMissionResets() {
        const now = new Date();
        const currentDay = now.getDate();
        const currentWeek = Math.floor(now.getDate() / 7);
        
        // Check if it's a new day (reset daily missions)
        if (this.gameState.lastDailyReset !== currentDay) {
            this.resetDailyMissions();
            this.gameState.lastDailyReset = currentDay;
            this.showNotification('Daily missions refreshed!', 'info');
        }
        
        // Check if it's a new week (reset weekly missions)
        if (this.gameState.lastWeeklyReset !== currentWeek) {
            this.resetWeeklyMissions();
            this.gameState.lastWeeklyReset = currentWeek;
            this.showNotification('Weekly missions refreshed!', 'info');
        }
    }

    updateGame() {
        if (this.gameState.mining.isActive) {
            this.processMining();
        }
        
        // Process offline mining
        this.processOfflineMining();
        
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
        
        // Check for equipment damage
        this.checkEquipmentDamage();
        
        // Check for worker fatigue
        this.checkWorkerFatigue();
        
        // Update difficulty
        this.updateMiningDifficulty();
        
        this.showNotification(`Block #${this.gameState.blockchain.currentBlock} mined! Reward: ${blockReward.toFixed(3)} TSD`, 'success');
    }

    checkEquipmentDamage() {
        this.gameState.player.inventory.equipment.forEach(item => {
            if (!item.durability) item.durability = 100;
            
            // Equipment gets damaged during mining
            const damageChance = 0.1; // 10% chance per block
            if (Math.random() < damageChance) {
                const damage = Math.floor(Math.random() * 5) + 1; // 1-5 damage
                item.durability = Math.max(0, item.durability - damage);
                
                if (item.durability <= 0) {
                    this.showNotification(`${item.name} is completely damaged!`, 'error');
                } else if (item.durability <= 25) {
                    this.showNotification(`${item.name} is heavily damaged!`, 'warning');
                }
            }
        });
    }

    checkWorkerFatigue() {
        this.gameState.player.inventory.workers.forEach(worker => {
            if (!worker.energy) worker.energy = 100;
            
            // Workers get tired during mining
            const fatigueChance = 0.15; // 15% chance per block
            if (Math.random() < fatigueChance) {
                const fatigue = Math.floor(Math.random() * 8) + 2; // 2-9 fatigue
                worker.energy = Math.max(0, worker.energy - fatigue);
                
                if (worker.energy <= 0) {
                    this.showNotification(`${worker.name} is completely exhausted!`, 'error');
                } else if (worker.energy <= 30) {
                    this.showNotification(`${worker.name} is very tired!`, 'warning');
                }
            }
        });
    }

    mineGems() {
        const baseGemChance = 0.3; // 30% chance per block
        const workerBoost = this.calculateWorkerBoost();
        const equipmentBoost = this.calculateEquipmentBoost();
        const slotBoost = this.calculateSlotBoost();
        const totalBoost = workerBoost * equipmentBoost * slotBoost;
        
        if (Math.random() < baseGemChance * totalBoost) {
            const gem = this.selectRandomGem();
            this.gameState.player.inventory.gems.push(gem);
            this.gameState.player.totalGems++;
            
            // Update mission progress for finding gems
            this.updateMissionProgress('find_gems');
            
            this.showNotification(`Found ${gem.name}!`, 'success');
        }

        // Check for NFT mining
        this.checkNFTMining();
    }

    checkNFTMining() {
        const baseNFTChance = 0.05; // 5% base chance
        const slotNFTBoost = this.calculateSlotNFTBoost();
        
        if (Math.random() < baseNFTChance * slotNFTBoost) {
            const nft = this.generateNFT();
            
            // Apply area-specific bonuses if NFT mining areas are active
            const activeAreas = this.gameState.nftMining.areas.filter(area => area.active);
            if (activeAreas.length > 0) {
                const randomArea = activeAreas[Math.floor(Math.random() * activeAreas.length)];
                
                if (randomArea.name === 'Crystal Cave') {
                    // Higher chance for polished gems and rare equipment
                    if (Math.random() < 0.6) {
                        const polishedGems = ['polished_gem', 'mining_equipment'];
                        nft.type = polishedGems[Math.floor(Math.random() * polishedGems.length)];
                    }
                } else if (randomArea.name === 'Surface Deposit') {
                    // Higher chance for unpolished gems and basic equipment
                    if (Math.random() < 0.7) {
                        const surfaceItems = ['unpolished_gem', 'mining_equipment'];
                        nft.type = surfaceItems[Math.floor(Math.random() * surfaceItems.length)];
                    }
                }
            }
            
            this.gameState.player.inventory.nfts.push(nft);
            this.gameState.player.nftsMined++;
            this.gameState.player.nftValue += nft.value;
            
            if (nft.rarity === 'rare' || nft.rarity === 'epic' || nft.rarity === 'legendary') {
                this.gameState.player.rareNfts++;
            }
            
            this.showNotification(`Mined NFT: ${nft.name}!`, 'success');
            this.createNFTMiningAnimation();
        }
    }

    generateNFT() {
        const nftTypes = [
            // Polished Gems (Common)
            { name: 'Amethyst', rarity: 'common', value: 25, icon: 'fas fa-gem', type: 'polished_gem' },
            { name: 'Topaz', rarity: 'common', value: 50, icon: 'fas fa-gem', type: 'polished_gem' },
            { name: 'Aquamarine', rarity: 'common', value: 100, icon: 'fas fa-gem', type: 'polished_gem' },
            
            // Polished Gems (Uncommon)
            { name: 'Opal', rarity: 'uncommon', value: 200, icon: 'fas fa-gem', type: 'polished_gem' },
            { name: 'Tanzanite', rarity: 'uncommon', value: 400, icon: 'fas fa-gem', type: 'polished_gem' },
            { name: 'Jade', rarity: 'uncommon', value: 800, icon: 'fas fa-gem', type: 'polished_gem' },
            
            // Polished Gems (Rare)
            { name: 'Emerald', rarity: 'rare', value: 1600, icon: 'fas fa-gem', type: 'polished_gem' },
            { name: 'Sapphire', rarity: 'rare', value: 3200, icon: 'fas fa-gem', type: 'polished_gem' },
            { name: 'Ruby', rarity: 'rare', value: 6400, icon: 'fas fa-gem', type: 'polished_gem' },
            
            // Polished Gems (Epic)
            { name: 'Diamond', rarity: 'epic', value: 12800, icon: 'fas fa-gem', type: 'polished_gem' },
            
            // Unpolished Gems
            { name: 'Unpolished Amethyst', rarity: 'common', value: 15, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Topaz', rarity: 'common', value: 30, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Aquamarine', rarity: 'common', value: 60, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Opal', rarity: 'uncommon', value: 120, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Tanzanite', rarity: 'uncommon', value: 240, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Jade', rarity: 'uncommon', value: 480, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Emerald', rarity: 'rare', value: 960, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Sapphire', rarity: 'rare', value: 1920, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Ruby', rarity: 'rare', value: 3840, icon: 'fas fa-gem', type: 'unpolished_gem' },
            { name: 'Unpolished Diamond', rarity: 'epic', value: 7680, icon: 'fas fa-gem', type: 'unpolished_gem' },
            
            // Mining Equipment
            { name: 'Pickaxe Worker', rarity: 'common', value: 100, icon: 'fas fa-hammer', type: 'mining_equipment' },
            { name: 'Hammer Drill Worker', rarity: 'uncommon', value: 250, icon: 'fas fa-drill', type: 'mining_equipment' },
            { name: 'Mini Excavator Worker', rarity: 'rare', value: 500, icon: 'fas fa-truck', type: 'mining_equipment' },
            { name: 'Excavator', rarity: 'rare', value: 1000, icon: 'fas fa-truck-pickup', type: 'mining_equipment' },
            { name: 'Dump Truck', rarity: 'epic', value: 2000, icon: 'fas fa-truck-moving', type: 'mining_equipment' },
            { name: 'Small Mine', rarity: 'epic', value: 4000, icon: 'fas fa-industry', type: 'mining_equipment' },
            { name: 'Medium Mine', rarity: 'legendary', value: 8000, icon: 'fas fa-industry', type: 'mining_equipment' },
            { name: 'Large Mine', rarity: 'legendary', value: 15000, icon: 'fas fa-industry', type: 'mining_equipment' },
            
            // Tools
            { name: 'Polishing Table', rarity: 'rare', value: 800, icon: 'fas fa-tools', type: 'tool' },
            
            // Shards
            { name: 'Pile of Shards', rarity: 'common', value: 10, icon: 'fas fa-gem', type: 'shard' }
        ];

        const random = Math.random();
        let nft;
        
        // Weighted distribution based on rarity
        if (random < 0.45) {
            // Common - 45% chance
            const commonNfts = nftTypes.filter(nft => nft.rarity === 'common');
            nft = commonNfts[Math.floor(Math.random() * commonNfts.length)];
        } else if (random < 0.75) {
            // Uncommon - 30% chance
            const uncommonNfts = nftTypes.filter(nft => nft.rarity === 'uncommon');
            nft = uncommonNfts[Math.floor(Math.random() * uncommonNfts.length)];
        } else if (random < 0.90) {
            // Rare - 15% chance
            const rareNfts = nftTypes.filter(nft => nft.rarity === 'rare');
            nft = rareNfts[Math.floor(Math.random() * rareNfts.length)];
        } else if (random < 0.98) {
            // Epic - 8% chance
            const epicNfts = nftTypes.filter(nft => nft.rarity === 'epic');
            nft = epicNfts[Math.floor(Math.random() * epicNfts.length)];
        } else {
            // Legendary - 2% chance
            const legendaryNfts = nftTypes.filter(nft => nft.rarity === 'legendary');
            nft = legendaryNfts[Math.floor(Math.random() * legendaryNfts.length)];
        }

        return { ...nft, id: Date.now(), mintTime: Date.now() };
    }

    selectRandomGem() {
        const gems = this.gameState.marketplace.gems;
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
        
        // Apply worker boost
        const workerBoost = this.calculateWorkerBoost();
        baseMiningRate *= workerBoost;
        
        // Apply slot boost
        const slotBoost = this.calculateSlotBoost();
        baseMiningRate *= slotBoost;
        
        // Apply staking boost
        const stakingBoost = this.gameState.staking.totalBoost;
        baseMiningRate *= stakingBoost;
        
        return Math.floor(baseMiningRate);
    }

    calculateWorkerBoost() {
        let totalBoost = 1.0;
        
        this.gameState.player.inventory.workers.forEach(worker => {
            totalBoost *= worker.miningBoost;
        });
        
        return totalBoost;
    }

    calculateEquipmentBoost() {
        let totalBoost = 1.0;
        
        this.gameState.player.inventory.equipment.forEach(item => {
            totalBoost *= (1 + item.miningPower / 100);
        });
        
        return totalBoost;
    }

    calculateSlotBoost() {
        let totalBoost = 1.0;
        
        this.gameState.miningSlots.slots.forEach(slot => {
            if (slot.rented && slot.active) {
                if (slot.name === 'Surface Mine') totalBoost *= 1.2;
                else if (slot.name === 'Underground Mine') totalBoost *= 1.4;
                else if (slot.name === 'Crystal Cave') totalBoost *= 1.6;
                else if (slot.name === 'Deep Crystal Mine') totalBoost *= 1.8;
                else if (slot.name === 'Quantum Mine') totalBoost *= 2.0;
                else if (slot.name === 'Legendary Mine') totalBoost *= 2.2;
                else if (slot.name === 'Cosmic Mine') totalBoost *= 2.5;
                else if (slot.name === 'Dimensional Mine') totalBoost *= 2.8;
                else if (slot.name === 'Reality Mine') totalBoost *= 3.2;
                else if (slot.name === 'Infinity Mine') totalBoost *= 3.6;
            }
        });
        
        return totalBoost;
    }

    calculateSlotNFTBoost() {
        let totalBoost = 1.0;
        
        this.gameState.miningSlots.slots.forEach(slot => {
            if (slot.rented && slot.active) {
                if (slot.name === 'Crystal Cave') totalBoost *= 1.2;
            }
        });
        
        return totalBoost;
    }

    calculateStakingBonus() {
        let bonus = 1.0;
        
        // TSD staking bonus
        if (this.gameState.staking.tsdStaked > 0) {
            bonus += (this.gameState.staking.tsdStaked / 1000) * 0.1; // 10% per 1000 TSD staked
        }
        
        // Gems staking bonus
        if (this.gameState.staking.gemsStaked > 0) {
            bonus += (this.gameState.staking.gemsStaked / 100) * 0.05; // 5% per 100 gems staked
        }
        
        // Apply staking period bonus
        if (this.gameState.staking.stakingPeriod > 30) {
            bonus += 0.2; // 20% bonus for long-term staking
        }
        
        return Math.min(bonus, 3.0); // Cap at 300% bonus
    }

    updateMiningDifficulty() {
        // Increase difficulty every 100 blocks
        if (this.gameState.blockchain.currentBlock % 100 === 0) {
            this.gameState.blockchain.miningDifficulty *= 1.1;
            this.gameState.mining.difficulty = this.gameState.blockchain.miningDifficulty;
            this.showNotification('Mining difficulty increased!', 'info');
        }
    }

    toggleMining() {
        this.gameState.mining.isActive = !this.gameState.mining.isActive;
        
        if (this.gameState.mining.isActive) {
            document.getElementById('mining-toggle').textContent = 'Stop Mining';
            document.querySelector('.status-dot').classList.add('active');
            document.querySelector('.status-text').textContent = 'Active';
            this.showNotification('Mining started!', 'success');
            this.startMiningAnimations();
        } else {
            document.getElementById('mining-toggle').textContent = 'Start Mining';
            document.querySelector('.status-dot').classList.remove('active');
            document.querySelector('.status-text').textContent = 'Stopped';
            this.showNotification('Mining stopped!', 'info');
            this.stopMiningAnimations();
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

    createNFTMiningAnimation() {
        // Create special animation for NFT mining
        const nftParticle = document.createElement('div');
        nftParticle.className = 'mining-particle';
        nftParticle.style.background = '#ffd700';
        nftParticle.style.width = '8px';
        nftParticle.style.height = '8px';
        nftParticle.style.left = Math.random() * window.innerWidth + 'px';
        nftParticle.style.animationDuration = '1s';
        
        document.getElementById('mining-animations').appendChild(nftParticle);
        
        setTimeout(() => nftParticle.remove(), 2000);
    }

    // Offline Mining Functions
    toggleOfflineMining() {
        if (!this.gameState.mining.offlineMining.isActive) {
            this.startOfflineMining();
        } else {
            this.stopOfflineMining();
        }
    }

    startOfflineMining() {
        if (this.gameState.mining.offlineMining.isActive) {
            this.showNotification('Offline mining is already active!', 'warning');
            return;
        }

        this.gameState.mining.offlineMining.isActive = true;
        this.gameState.mining.offlineMining.startTime = Date.now();
        this.gameState.mining.offlineMining.currentEarnings = 0;
        this.gameState.mining.offlineMining.warningShown = false;
        
        this.updateOfflineMiningUI();
        this.showNotification('Offline mining started! You can now close the game.', 'success');
    }

    stopOfflineMining() {
        if (!this.gameState.mining.offlineMining.isActive) {
            this.showNotification('Offline mining is not active!', 'warning');
            return;
        }

        this.gameState.mining.offlineMining.isActive = false;
        this.updateOfflineMiningUI();
        this.showNotification('Offline mining stopped!', 'info');
    }

    claimOfflineEarnings() {
        if (!this.gameState.mining.offlineMining.currentEarnings || this.gameState.mining.offlineMining.currentEarnings <= 0) {
            this.showNotification('No earnings to claim!', 'warning');
            return;
        }

        const earnings = this.gameState.mining.offlineMining.currentEarnings;
        this.gameState.player.tsdBalance += earnings;
        
        // Update mission progress for claiming rewards
        this.updateMissionProgress('claim_rewards');
        
        // Record history
        const sessionDuration = Date.now() - this.gameState.mining.offlineMining.startTime;
        const historyEntry = {
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            earnings: earnings,
            duration: sessionDuration,
            timestamp: Date.now()
        };
        
        this.gameState.mining.offlineMining.history.unshift(historyEntry);
        
        // Keep only last 10 entries
        if (this.gameState.mining.offlineMining.history.length > 10) {
            this.gameState.mining.offlineMining.history = this.gameState.mining.offlineMining.history.slice(0, 10);
        }
        
        this.gameState.mining.offlineMining.currentEarnings = 0;
        this.gameState.mining.offlineMining.lastClaimTime = Date.now();
        
        this.updateOfflineMiningUI();
        this.showNotification(`Claimed ${earnings.toFixed(2)} TSD from offline mining!`, 'success');
    }

    upgradeOfflineMining() {
        const offlineMining = this.gameState.mining.offlineMining;
        
        if (offlineMining.upgradeLevel >= offlineMining.maxUpgradeLevel) {
            this.showNotification('Offline mining is already at maximum level!', 'warning');
            return;
        }

        const cost = offlineMining.upgradeCost;
        
        if (this.gameState.player.tsdBalance < cost.tsd || this.gameState.player.inventory.gems.length < cost.gems) {
            this.showNotification('Insufficient TSD or Gems for upgrade!', 'error');
            return;
        }

        // Deduct costs
        this.gameState.player.tsdBalance -= cost.tsd;
        this.gameState.player.inventory.gems.splice(0, cost.gems); // Remove gems from inventory
        
        // Upgrade
        offlineMining.upgradeLevel++;
        offlineMining.maxDuration = (2 + (offlineMining.upgradeLevel - 1) * 2) * 60 * 60 * 1000; // 2, 4, 6, 8 hours
        
        // Increase upgrade cost for next level
        offlineMining.upgradeCost.tsd *= 2;
        offlineMining.upgradeCost.gems *= 1.5;
        
        this.updateOfflineMiningUI();
        this.showNotification(`Offline mining upgraded to level ${offlineMining.upgradeLevel}! Max duration: ${Math.floor(offlineMining.maxDuration / (60 * 60 * 1000))} hours`, 'success');
    }

    processOfflineMining() {
        const offlineMining = this.gameState.mining.offlineMining;
        
        if (!offlineMining.isActive) return;

        const now = Date.now();
        const elapsed = now - offlineMining.startTime;
        
        // Check if max duration reached
        if (elapsed >= offlineMining.maxDuration) {
            offlineMining.isActive = false;
            this.showNotification('Offline mining completed! Claim your earnings.', 'info');
            this.updateOfflineMiningUI();
            return;
        }

        // Show warning when 80% complete
        if (elapsed >= offlineMining.maxDuration * 0.8 && !offlineMining.warningShown) {
            this.showNotification('Offline mining is 80% complete! Consider claiming soon.', 'warning');
            offlineMining.warningShown = true;
        }

        // Calculate earnings based on mining rate and time
        const miningRate = this.calculateMiningRate();
        const earningsPerSecond = miningRate * 0.0001; // Convert mining rate to TSD per second
        
        // Apply staking bonuses
        const stakingBonus = this.calculateStakingBonus();
        const finalEarningsPerSecond = earningsPerSecond * stakingBonus;
        
        const earnings = finalEarningsPerSecond * 1; // 1 second intervals
        
        offlineMining.currentEarnings += earnings;


    }

    updateOfflineMiningUI() {
        const offlineMining = this.gameState.mining.offlineMining;
        const statusDot = document.querySelector('.offline-status-dot');
        const statusText = document.querySelector('.offline-status-text');
        const earningsSpan = document.getElementById('offline-earnings');
        const timeRemainingSpan = document.getElementById('offline-time-remaining');
        const maxDurationSpan = document.getElementById('offline-max-duration');
        const upgradeLevelSpan = document.getElementById('offline-upgrade-level');
        const startButton = document.getElementById('start-offline-mining');
        const claimButton = document.getElementById('claim-offline-earnings');
        const upgradeButton = document.getElementById('upgrade-offline-mining');

        if (!statusDot || !statusText || !earningsSpan || !timeRemainingSpan || !maxDurationSpan || !upgradeLevelSpan || !startButton || !claimButton || !upgradeButton) {
            return;
        }

        // Update status
        if (offlineMining.isActive) {
            statusDot.classList.add('active');
            statusText.textContent = 'Active';
            startButton.textContent = 'Stop Offline Mining';
            startButton.className = 'action-btn secondary';
        } else {
            statusDot.classList.remove('active');
            statusText.textContent = 'Inactive';
            startButton.textContent = 'Start Offline Mining';
            startButton.className = 'action-btn primary';
        }

        // Update earnings
        earningsSpan.textContent = `${offlineMining.currentEarnings.toFixed(2)} TSD`;

        // Update time remaining and progress bar
        if (offlineMining.isActive) {
            const elapsed = Date.now() - offlineMining.startTime;
            const remaining = Math.max(0, offlineMining.maxDuration - elapsed);
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            timeRemainingSpan.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Update progress bar
            const progressFill = document.getElementById('offline-progress-fill');
            const progressText = document.getElementById('offline-progress-text');
            if (progressFill && progressText) {
                const progressPercent = Math.min(100, (elapsed / offlineMining.maxDuration) * 100);
                progressFill.style.width = `${progressPercent}%`;
                progressText.textContent = `${Math.floor(progressPercent)}% Complete`;
            }
        } else {
            timeRemainingSpan.textContent = '0:00:00';
            
            // Reset progress bar
            const progressFill = document.getElementById('offline-progress-fill');
            const progressText = document.getElementById('offline-progress-text');
            if (progressFill && progressText) {
                progressFill.style.width = '0%';
                progressText.textContent = '0% Complete';
            }
        }

        // Update max duration
        const maxHours = Math.floor(offlineMining.maxDuration / (60 * 60 * 1000));
        const maxMinutes = Math.floor((offlineMining.maxDuration % (60 * 60 * 1000)) / (60 * 1000));
        maxDurationSpan.textContent = `${maxHours}:${maxMinutes.toString().padStart(2, '0')}:00`;

        // Update upgrade level
        upgradeLevelSpan.textContent = offlineMining.upgradeLevel.toString();

        // Update claim button
        claimButton.disabled = offlineMining.currentEarnings <= 0;

        // Update upgrade button
        upgradeButton.disabled = offlineMining.upgradeLevel >= offlineMining.maxUpgradeLevel;



        // Update bonus information
        const stakingBonusSpan = document.getElementById('offline-staking-bonus');
        const currentRateSpan = document.getElementById('offline-current-rate');
        
        if (stakingBonusSpan && currentRateSpan) {
            const stakingBonus = this.calculateStakingBonus();
            stakingBonusSpan.textContent = `${stakingBonus.toFixed(1)}x`;
            
            const miningRate = this.calculateMiningRate();
            const earningsPerHour = (miningRate * 0.0001 * 3600 * stakingBonus).toFixed(2);
            currentRateSpan.textContent = `${earningsPerHour} TSD/h`;
        }

        // Update history display
        this.updateOfflineMiningHistory();
    }



    updateOfflineMiningHistory() {
        const historyList = document.getElementById('offline-mining-history-list');
        if (!historyList) return;

        historyList.innerHTML = '';
        
        if (this.gameState.mining.offlineMining.history.length === 0) {
            historyList.innerHTML = '<div class="history-item"><span>No offline mining sessions yet</span></span>';
            return;
        }

        this.gameState.mining.offlineMining.history.forEach(entry => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const durationHours = Math.floor(entry.duration / (60 * 60 * 1000));
            const durationMinutes = Math.floor((entry.duration % (60 * 60 * 1000)) / (60 * 1000));
            
            historyItem.innerHTML = `
                <div class="session-info">
                    <div class="session-date">${entry.date} ${entry.time}</div>
                    <div class="session-earnings">${entry.earnings.toFixed(2)} TSD</div>
                </div>
                <div class="session-duration">${durationHours}h ${durationMinutes}m</div>
            `;
            
            historyList.appendChild(historyItem);
        });
    }

    updateMissionsDisplay() {
        // Update daily missions
        const dailyMissionsList = document.getElementById('daily-missions-list');
        if (dailyMissionsList) {
            dailyMissionsList.innerHTML = '';
            this.gameState.quests.daily.forEach(mission => {
                const missionElement = document.createElement('div');
                missionElement.className = `mission-item ${mission.completed ? 'completed' : ''}`;
                
                const progressPercent = Math.min((mission.current / mission.target) * 100, 100);
                
                missionElement.innerHTML = `
                    <div class="mission-header">
                        <h4>${mission.name}</h4>
                        <span class="mission-reward">${mission.reward.tsd} TSD + ${mission.reward.experience} XP</span>
                    </div>
                    <p class="mission-description">${mission.description.replace('X', mission.target)}</p>
                    <div class="mission-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span class="progress-text">${mission.current}/${mission.target}</span>
                    </div>
                    ${mission.completed ? '<div class="mission-completed">✓ Completed!</div>' : ''}
                `;
                
                dailyMissionsList.appendChild(missionElement);
            });
        }

        // Update weekly missions
        const weeklyMissionsList = document.getElementById('weekly-missions-list');
        if (weeklyMissionsList) {
            weeklyMissionsList.innerHTML = '';
            this.gameState.quests.weekly.forEach(mission => {
                const missionElement = document.createElement('div');
                missionElement.className = `mission-item ${mission.completed ? 'completed' : ''}`;
                
                const progressPercent = Math.min((mission.current / mission.target) * 100, 100);
                
                missionElement.innerHTML = `
                    <div class="mission-header">
                        <h4>${mission.name}</h4>
                        <span class="mission-reward">${mission.reward.tsd} TSD + ${mission.reward.experience} XP</span>
                    </div>
                    <p class="mission-description">${mission.description.replace('X', mission.target)}</p>
                    <div class="mission-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span class="progress-text">${mission.current}/${mission.target}</span>
                    </div>
                    ${mission.completed ? '<div class="mission-completed">✓ Completed!</div>' : ''}
                `;
                
                weeklyMissionsList.appendChild(missionElement);
            });
        }
    }

    checkOfflineMiningEarnings() {
        const offlineMining = this.gameState.mining.offlineMining;
        
        // Check if player was offline mining when they left
        if (offlineMining.isActive && offlineMining.startTime > 0) {
            const now = Date.now();
            const elapsed = now - offlineMining.startTime;
            
            // Calculate earnings for the time they were away
            const miningRate = this.calculateMiningRate();
            const earningsPerSecond = miningRate * 0.0001; // Convert mining rate to TSD per second
            
            // Apply staking bonuses
            const stakingBonus = this.calculateStakingBonus();
            const finalEarningsPerSecond = earningsPerSecond * stakingBonus;
            
            const maxEarnings = finalEarningsPerSecond * (offlineMining.maxDuration / 1000); // Max possible earnings
            
            // Calculate actual earnings (capped by max duration)
            const actualEarnings = Math.min(finalEarningsPerSecond * (elapsed / 1000), maxEarnings);
            
            offlineMining.currentEarnings = actualEarnings;
            
            // Stop offline mining if max duration reached
            if (elapsed >= offlineMining.maxDuration) {
                offlineMining.isActive = false;
                this.showNotification('Offline mining completed! Claim your earnings.', 'info');
            } else {
                this.showNotification(`Welcome back! You earned ${actualEarnings.toFixed(2)} TSD while away.`, 'success');
            }
            
            this.updateOfflineMiningUI();
        }
    }

    buyItem(itemType, itemId) {
        const marketplace = this.gameState.marketplace[itemType];
        const item = marketplace.find(i => i.id === itemId);
        
        if (!item) return;
        
        if (this.gameState.player.tsdBalance >= item.price) {
            this.gameState.player.tsdBalance -= item.price;
            
            if (itemType === 'equipment') {
                this.gameState.player.inventory[itemType].push({
                    ...item, 
                    purchaseTime: Date.now(),
                    durability: 100
                });
            } else if (itemType === 'workers') {
                // Check worker limits before hiring
                const workerCheck = this.canAddWorkerToMine();
                if (!workerCheck.canAdd) {
                    this.showNotification(workerCheck.reason, 'error');
                    // Refund the TSD since we can't hire the worker
                    this.gameState.player.tsdBalance += item.price;
                    return;
                }
                
                this.gameState.player.inventory[itemType].push({
                    ...item, 
                    purchaseTime: Date.now(),
                    energy: 100
                });

                // Update mission progress for hiring workers
                this.updateMissionProgress('hire_workers');
            } else {
                this.gameState.player.inventory[itemType].push({...item, purchaseTime: Date.now()});
            }
            
            // Update player stats
            this.updatePlayerStats();
            
            this.showNotification(`${item.name} purchased successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient TSD balance!', 'error');
        }
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
            
            this.showNotification(`${slot.name} rented successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient TSD balance!', 'error');
        }
    }

    activateNFTMining(areaName) {
        const area = this.gameState.nftMining.areas.find(a => a.name === areaName);
        
        if (!area) return;
        
        if (area.active) {
            // Deactivate mining
            area.active = false;
            this.showNotification(`NFT mining stopped in ${area.name}!`, 'info');
        } else {
            // Activate mining
            if (this.gameState.player.tsdBalance >= area.cost) {
                this.gameState.player.tsdBalance -= area.cost;
                area.active = true;
                this.showNotification(`NFT mining started in ${area.name}!`, 'success');
            } else {
                this.showNotification('Insufficient TSD balance!', 'error');
                return;
            }
        }
        
        this.updateUI();
    }



    sellItem(itemType, itemId) {
        const inventory = this.gameState.player.inventory[itemType];
        const itemIndex = inventory.findIndex(i => i.id === itemId);
        
        if (itemIndex === -1) return;
        
        const item = inventory[itemIndex];
        const sellPrice = item.price * 0.7; // 70% of purchase price
        
        this.gameState.player.tsdBalance += sellPrice;
        inventory.splice(itemIndex, 1);
        
        this.updatePlayerStats();
        this.showNotification(`${item.name} sold for ${sellPrice.toFixed(2)} TSD`, 'success');
        this.updateUI();
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
        document.getElementById('total-gems').textContent = this.gameState.player.totalGems;
        document.getElementById('tsd-balance').textContent = this.gameState.player.tsdBalance.toFixed(2);
        document.getElementById('mining-power').textContent = this.gameState.player.miningPower;
        document.getElementById('active-workers').textContent = this.gameState.player.activeWorkers;
        const totalSlots = this.gameState.miningSlots.slots.filter(slot => slot.unlocked).length;
        document.getElementById('mining-slots-count').textContent = `${this.gameState.miningSlots.rented}/${this.gameState.miningSlots.maxSlots}`;
        document.getElementById('nft-mining-count').textContent = this.gameState.player.nftsMined;
        document.getElementById('dashboard-staked-tsd').textContent = this.gameState.player.stakedTSD;
        document.getElementById('dashboard-staked-gems').textContent = this.gameState.player.stakedGems;
        
        // Update wallet balance
        document.querySelector('.wallet-balance').textContent = `${this.gameState.player.tsdBalance.toFixed(2)} TSD`;
        
        // Update mining stats
        document.getElementById('hash-rate').textContent = `${this.gameState.mining.hashRate} H/s`;
        document.getElementById('difficulty').textContent = this.gameState.mining.difficulty.toFixed(1);
        document.getElementById('block-reward').textContent = `${this.calculateBlockReward().toFixed(3)} TSD`;
        document.getElementById('active-slots').textContent = this.gameState.mining.activeSlots;
        
        // Update equipment and workers displays
        this.updateEquipmentDisplay();
        this.updateWorkersDisplay();
        
        // Update marketplace
        this.updateMarketplaceDisplay();
        
        // Update inventory
        this.updateInventoryDisplay();
        
        // Update leaderboard
        this.updateLeaderboardDisplay();
        
        // Update countdown timer
        this.updateCountdownTimer();
        
        // Update mining slots display
        this.updateMiningSlotsDisplay();
        
        // Update NFT mining display
        this.updateNFTMiningDisplay();
        
        // Update workers management display
        this.updateWorkersManagementDisplay();
        
        // Update staking display
        this.updateStakingDisplay();
        
        // Update mining slots info
        this.updateMiningSlotsInfo();
        
        // Update offline mining UI
        this.updateOfflineMiningUI();
        
        // Update missions display
        this.updateMissionsDisplay();
    }

    updateEquipmentDisplay() {
        const equipmentList = document.getElementById('equipment-list');
        equipmentList.innerHTML = '';
        
        this.gameState.player.inventory.equipment.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'item-card';
            itemElement.innerHTML = `
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <div class="item-stats">
                    <div class="item-stat">
                        <span>Mining Power</span>
                        <span class="stat-value">${item.miningPower}</span>
                    </div>
                    <div class="item-stat">
                        <span>Mining Rate</span>
                        <span class="stat-value">${item.hashRate}</span>
                    </div>
                </div>
            `;
            equipmentList.appendChild(itemElement);
        });
    }

    updateWorkersDisplay() {
        const workersList = document.getElementById('workers-list');
        workersList.innerHTML = '';
        
        this.gameState.player.inventory.workers.forEach(worker => {
            const workerElement = document.createElement('div');
            workerElement.className = `item-card ${worker.energy <= 30 ? 'worker-tired' : ''}`;
            workerElement.innerHTML = `
                ${worker.energy <= 30 ? '<div class="fatigue-indicator">TIRED</div>' : ''}
                <h4>${worker.name}</h4>
                <p>${worker.description}</p>
                <div class="item-stats">
                    <div class="item-stat">
                        <span>Boost</span>
                        <span class="stat-value">${worker.miningBoost}x</span>
                    </div>
                    <div class="item-stat">
                        <span>Efficiency</span>
                        <span class="stat-value">${worker.efficiency}</span>
                    </div>
                    <div class="item-stat">
                        <span>Energy</span>
                        <span class="stat-value">${worker.energy || 100}</span>
                    </div>
                </div>
                <div class="fatigue-bar">
                    <div class="fatigue-fill" style="width: ${(worker.energy || 100)}%"></div>
                </div>
                <button onclick="game.motivateWorker(${worker.id})" class="action-btn secondary">Motivate</button>
            `;
            workersList.appendChild(workerElement);
        });
    }

    updateMiningSlotsDisplay() {
        const slotsGrid = document.getElementById('slots-grid');
        if (!slotsGrid) return;
        
        slotsGrid.innerHTML = '';
        
        this.gameState.miningSlots.slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = `mining-slot ${slot.rented ? 'rented' : ''} ${slot.active ? 'active' : ''} ${!slot.unlocked ? 'locked' : ''}`;
            
            let slotContent = `
                <div class="slot-header">
                    <span class="slot-name">${slot.name}</span>
                    <span class="slot-cost">${slot.cost} TSD</span>
                    ${!slot.unlocked ? '<span class="slot-locked">🔒 LOCKED</span>' : ''}
                </div>
                <p class="slot-description">${slot.description}</p>
                <div class="slot-benefits">
                    ${slot.benefits.map(benefit => `
                        <div class="slot-benefit">
                            <i class="fas fa-check"></i>
                            <span>${benefit}</span>
                        </div>
                    `).join('')}
                </div>`;
            
            if (!slot.unlocked && slot.stakingRequired) {
                slotContent += `
                    <div class="slot-staking-requirements">
                        <h4>Unlock Requirements:</h4>
                        <div class="staking-req">
                            <span>TSD: ${slot.stakingRequired.tsd}</span>
                            <span>Gems: ${slot.stakingRequired.gems}</span>
                        </div>
                        <button onclick="game.unlockMiningSlot(${slot.id})" class="action-btn primary">Unlock via Staking</button>
                    </div>`;
            } else {
                slotContent += `
                    <div class="slot-actions">
                        ${!slot.rented ? 
                            `<button onclick="game.rentMiningSlot(${slot.id})" class="action-btn primary">Rent Slot</button>` :
                            `<button onclick="game.toggleSlot(${slot.id})" class="action-btn secondary">${slot.active ? 'Deactivate' : 'Activate'}</button>`
                        }
                    </div>`;
            }
            
            slotElement.innerHTML = slotContent;
            slotsGrid.appendChild(slotElement);
        });
    }

    updateNFTMiningDisplay() {
        const nftMiningGrid = document.getElementById('nft-mining-grid');
        const nftCollectionGrid = document.getElementById('nft-collection-grid');
        
        if (!nftMiningGrid) return;
        
        // Update NFT mining areas
        nftMiningGrid.innerHTML = '';
        this.gameState.nftMining.areas.forEach(area => {
            const areaElement = document.createElement('div');
            areaElement.className = `nft-mining-area ${area.active ? 'active' : ''}`;
            areaElement.innerHTML = `
                <h3>${area.name}</h3>
                <p>${area.description}</p>
                <div class="nft-area-stats">
                    <span>NFT Boost: ${area.nftBoost}x</span>
                    <span>Cost: ${area.cost} TSD</span>
                </div>
                <button onclick="game.activateNFTMining('${area.name}')" ${area.active ? 'disabled' : ''}>
                    ${area.active ? 'Mining...' : 'Start Mining'}
                </button>
            `;
            nftMiningGrid.appendChild(areaElement);
        });
        
        // Update NFT collection with categorization if collection grid exists
        if (nftCollectionGrid) {
            nftCollectionGrid.innerHTML = '';
            
            // Group NFTs by type
            const nftsByType = {
                polished_gem: [],
                unpolished_gem: [],
                mining_equipment: [],
                tool: [],
                shard: []
            };
            
            this.gameState.player.inventory.nfts.forEach(nft => {
                if (nftsByType[nft.type]) {
                    nftsByType[nft.type].push(nft);
                }
            });
            
            // Display NFTs by category
            Object.entries(nftsByType).forEach(([type, nfts]) => {
                if (nfts.length > 0) {
                    const categoryHeader = document.createElement('div');
                    categoryHeader.className = 'nft-category-header';
                    categoryHeader.innerHTML = `<h4>${this.getCategoryDisplayName(type)}</h4>`;
                    nftCollectionGrid.appendChild(categoryHeader);
                    
                    nfts.forEach(nft => {
                        const nftElement = document.createElement('div');
                        nftElement.className = `nft-item ${nft.rarity} ${nft.type}`;
                        nftElement.innerHTML = `
                            <div class="nft-icon">
                                <i class="${nft.icon}"></i>
                            </div>
                            <div class="nft-info">
                                <h4>${nft.name}</h4>
                                <p class="nft-rarity">${nft.rarity}</p>
                                <p class="nft-value">${nft.value} TSD</p>
                                <p class="nft-type">${this.getCategoryDisplayName(nft.type)}</p>
                            </div>
                        `;
                        nftCollectionGrid.appendChild(nftElement);
                    });
                }
            });
        }
    }
    
    getCategoryDisplayName(type) {
        const categoryNames = {
            'polished_gem': '✨ Polished Gems',
            'unpolished_gem': '🔶 Unpolished Gems',
            'mining_equipment': '⛏️ Mining Equipment',
            'tool': '🔧 Tools',
            'shard': '💎 Shards'
        };
        return categoryNames[type] || type;
    }

    updateWorkersManagementDisplay() {
        const workersList = document.getElementById('workers-management-list');
        if (!workersList) return;
        
        // Update worker stats
        const currentWorkers = document.getElementById('current-workers');
        const maxWorkers = document.getElementById('max-workers');
        const overseersCount = document.getElementById('overseers-count');
        
        if (currentWorkers) currentWorkers.textContent = this.gameState.player.inventory.workers.length;
        if (maxWorkers) maxWorkers.textContent = `${this.gameState.workers.maxWorkers} (Max: ${this.gameState.workers.maxWorkersPerMine})`;
        if (overseersCount) overseersCount.textContent = this.gameState.workers.overseers.length;
        
        // Show worker limit status
        const workerCheck = this.canAddWorkerToMine();
        const workerStatusElement = document.getElementById('worker-status');
        if (workerStatusElement) {
            workerStatusElement.textContent = workerCheck.reason;
            workerStatusElement.className = `worker-status ${workerCheck.canAdd ? 'status-ok' : 'status-warning'}`;
        }
        
        // Update workers list
        workersList.innerHTML = '';
        
        this.gameState.player.inventory.workers.forEach(worker => {
            const workerElement = document.createElement('div');
            workerElement.className = `worker-card ${worker.energy <= 30 ? 'worker-tired' : ''}`;
            
            let skillsDisplay = '';
            if (worker.skills && worker.skills.length > 0) {
                skillsDisplay = `
                    <div class="worker-skills">
                        <h5>Skills:</h5>
                        ${worker.skills.map(skill => `<span class="skill-badge">${skill}</span>`).join('')}
                    </div>`;
            }
            
            workerElement.innerHTML = `
                <div class="worker-header">
                    <h4>${worker.name}</h4>
                    ${worker.energy <= 30 ? '<div class="fatigue-indicator">TIRED</div>' : ''}
                </div>
                <p>${worker.description}</p>
                <div class="worker-stats">
                    <div class="worker-stat">
                        <span>Boost:</span>
                        <span class="stat-value">${worker.miningBoost}x</span>
                    </div>
                    <div class="worker-stat">
                        <span>Efficiency:</span>
                        <span class="stat-value">${worker.efficiency}</span>
                    </div>
                    <div class="worker-stat">
                        <span>Energy:</span>
                        <span class="stat-value">${worker.energy || 100}</span>
                    </div>
                </div>
                <div class="fatigue-bar">
                    <div class="fatigue-fill" style="width: ${(worker.energy || 100)}%"></div>
                </div>
                <div class="worker-actions">
                    <button onclick="game.motivateWorker(${worker.id})" class="action-btn secondary">Motivate</button>
                    <button onclick="game.trainWorker(${worker.id}, 'machineOperator')" class="action-btn primary">Train Machine Op</button>
                    <button onclick="game.trainWorker(${worker.id}, 'gemsPolishing')" class="action-btn primary">Train Polishing</button>
                </div>
                ${skillsDisplay}
            `;
            workersList.appendChild(workerElement);
        });
    }

    updateStakingDisplay() {
        const tsdStaked = document.getElementById('tsd-staked');
        const gemsStaked = document.getElementById('gems-staked');
        const totalStakingBoost = document.getElementById('total-staking-boost');
        
        if (tsdStaked) tsdStaked.textContent = this.gameState.player.stakedTSD;
        if (gemsStaked) gemsStaked.textContent = this.gameState.player.stakedGems;
        if (totalStakingBoost) totalStakingBoost.textContent = `${this.gameState.staking.totalBoost.toFixed(2)}x`;
    }

    updateMiningSlotsInfo() {
        const availableSlots = document.getElementById('available-slots');
        const rentedSlots = document.getElementById('rented-slots');
        const totalSlotCost = document.getElementById('total-slot-cost');
        const maxSlots = document.getElementById('max-slots');
        const slotStatus = document.getElementById('slot-status');
        
        if (availableSlots) {
            const totalSlots = this.gameState.miningSlots.slots.filter(slot => slot.unlocked).length;
            availableSlots.textContent = totalSlots;
        }
        if (rentedSlots) rentedSlots.textContent = this.gameState.miningSlots.rented;
        if (totalSlotCost) totalSlotCost.textContent = `${this.gameState.miningSlots.totalCost} TSD`;
        if (maxSlots) maxSlots.textContent = this.gameState.miningSlots.maxSlots;
        
        // Show slot status
        if (slotStatus) {
            const slotCheck = this.canRentMoreSlots();
            slotStatus.textContent = slotCheck.reason;
            slotStatus.className = `slot-status ${slotCheck.canRent ? 'status-ok' : 'status-warning'}`;
        }
    }

    updateMarketplaceDisplay() {
        // Equipment marketplace
        const equipmentMarket = document.getElementById('equipment-market');
        equipmentMarket.innerHTML = '';
        
        this.gameState.marketplace.equipment.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'item-card';
            itemElement.innerHTML = `
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <div class="item-price">${item.price} TSD</div>
                <div class="item-stats">
                    <div class="item-stat">
                        <span>Mining Power</span>
                        <span class="stat-value">${item.miningPower}</span>
                    </div>
                    <div class="item-stat">
                        <span>Mining Rate</span>
                        <span class="stat-value">${item.hashRate}</span>
                    </div>
                </div>
                <button onclick="game.buyItem('equipment', ${item.id})" class="action-btn primary">Buy</button>
            `;
            equipmentMarket.appendChild(itemElement);
        });

        // Workers marketplace
        const workersMarket = document.getElementById('workers-market');
        workersMarket.innerHTML = '';
        
        this.gameState.marketplace.workers.forEach(worker => {
            const workerElement = document.createElement('div');
            workerElement.className = 'item-card';
            workerElement.innerHTML = `
                <h4>${worker.name}</h4>
                <p>${worker.description}</p>
                <div class="item-price">${worker.price} TSD</div>
                <div class="item-stats">
                    <div class="item-stat">
                        <span>Boost</span>
                        <span class="stat-value">${worker.miningBoost}x</span>
                    </div>
                    <div class="item-stat">
                        <span>Efficiency</span>
                        <span class="stat-value">${worker.efficiency}</span>
                    </div>
                </div>
                <button onclick="game.buyItem('workers', ${worker.id})" class="action-btn primary">Hire</button>
            `;
            workersMarket.appendChild(workerElement);
        });

        // Gems marketplace
        const gemsMarket = document.getElementById('gems-market');
        gemsMarket.innerHTML = '';
        
        this.gameState.marketplace.gems.forEach(gem => {
            const gemElement = document.createElement('div');
            gemElement.className = 'item-card';
            gemElement.innerHTML = `
                <h4 style="color: ${gem.color}">${gem.name}</h4>
                <p>${gem.description}</p>
                <div class="item-price">${gem.value} TSD</div>
                <div class="item-stats">
                    <div class="item-stat">
                        <span>Rarity</span>
                        <span class="stat-value">${gem.rarity}</span>
                    </div>
                    <div class="item-stat">
                        <span>Value</span>
                        <span class="stat-value">${gem.value}</span>
                    </div>
                </div>
            `;
            gemsMarket.appendChild(gemElement);
        });
    }

    updateInventoryDisplay() {
        // Gems inventory
        const gemsInventory = document.getElementById('gems-inventory-grid');
        gemsInventory.innerHTML = '';
        
        const gemCounts = {};
        this.gameState.player.inventory.gems.forEach(gem => {
            gemCounts[gem.name] = (gemCounts[gem.name] || 0) + 1;
        });
        
        Object.entries(gemCounts).forEach(([gemName, count]) => {
            const gem = this.gameState.marketplace.gems.find(g => g.name === gemName);
            const gemElement = document.createElement('div');
            gemElement.className = 'item-card';
            gemElement.innerHTML = `
                <h4 style="color: ${gem.color}">${gem.name}</h4>
                <p>Quantity: ${count}</p>
                <div class="item-price">${gem.value * count} TSD</div>
            `;
            gemsInventory.appendChild(gemElement);
        });

        // Equipment inventory
        const equipmentInventory = document.getElementById('equipment-inventory-grid');
        equipmentInventory.innerHTML = '';
        
        this.gameState.player.inventory.equipment.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'item-card';
            itemElement.innerHTML = `
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <div class="item-stats">
                    <div class="item-stat">
                        <span>Mining Power</span>
                        <span class="stat-value">${item.miningPower}</span>
                    </div>
                    <div class="item-stat">
                        <span>Mining Rate</span>
                        <span class="stat-value">${item.hashRate}</span>
                    </div>
                </div>
                <button onclick="game.sellItem('equipment', ${item.id})" class="action-btn secondary">Sell</button>
            `;
            equipmentInventory.appendChild(itemElement);
        });

        // Workers inventory
        const workersInventory = document.getElementById('workers-inventory-grid');
        workersInventory.innerHTML = '';
        
        this.gameState.player.inventory.workers.forEach(worker => {
            const workerElement = document.createElement('div');
            workerElement.className = 'item-card';
            workerElement.innerHTML = `
                <h4>${worker.name}</h4>
                <p>${worker.description}</p>
                <div class="item-stats">
                    <div class="item-stat">
                        <span>Boost</span>
                        <span class="stat-value">${worker.miningBoost}x</span>
                    </div>
                    <div class="item-stat">
                        <span>Efficiency</span>
                        <span class="stat-value">${worker.efficiency}</span>
                    </div>
                </div>
                <button onclick="game.sellItem('workers', ${worker.id})" class="action-btn secondary">Fire</button>
            `;
            workersInventory.appendChild(workerElement);
        });
    }

    updateLeaderboardDisplay() {
        // Mining leaderboard
        const miningLeaderboard = document.getElementById('mining-leaderboard-body');
        if (miningLeaderboard) {
            miningLeaderboard.innerHTML = '';
            
            this.gameState.leaderboard.mining.forEach(player => {
                const row = document.createElement('div');
                row.className = 'table-row';
                row.innerHTML = `
                    <div class="table-cell">#${player.rank}</div>
                    <div class="table-cell">${player.name}</div>
                    <div class="table-cell">${player.miningPower.toLocaleString()}</div>
                    <div class="table-cell">${player.gemsMined.toLocaleString()}</div>
                    <div class="table-cell">${Math.floor(player.miningPower / 100)}</div>
                `;
                miningLeaderboard.appendChild(row);
            });
        }
    }

    updateCountdownTimer() {
        const now = Date.now();
        const timeUntilReset = this.gameState.leaderboard.lastReset + this.gameState.leaderboard.resetInterval - now;
        
        if (timeUntilReset > 0) {
            const days = Math.floor(timeUntilReset / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeUntilReset % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
            
            document.getElementById('reset-countdown').textContent = `${days}d ${hours}h ${minutes}m`;
        } else {
            this.resetLeaderboard();
        }
        
        // Update current month
        const currentDate = new Date();
        document.getElementById('current-month').textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    resetLeaderboard() {
        this.gameState.leaderboard.lastReset = Date.now();
        this.initializeLeaderboard();
        this.showNotification('Monthly leaderboard has been reset!', 'info');
    }

    checkLeaderboardReset() {
        const now = Date.now();
        if (now - this.gameState.leaderboard.lastReset >= this.gameState.leaderboard.resetInterval) {
            this.resetLeaderboard();
        }
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

    switchTab(button) {
        const tabType = button.getAttribute('data-tab');
        
        // Update tab buttons
        button.parentElement.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        // Update tab content
        button.parentElement.parentElement.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabType}-tab`).classList.add('active');
    }

    switchInventoryTab(button) {
        const inventoryType = button.getAttribute('data-inventory');
        
        // Update tab buttons
        button.parentElement.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        // Update tab content
        button.parentElement.parentElement.querySelectorAll('.inventory-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${inventoryType}-inventory`).classList.add('active');
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
    startMining() {
        this.navigateToSection('mining');
        if (!this.gameState.mining.isActive) {
            this.toggleMining();
        }
    }

    openMarketplace() {
        this.navigateToSection('marketplace');
    }

    hireWorkers() {
        const workerCheck = this.canAddWorkerToMine();
        
        if (!workerCheck.canAdd) {
            this.showNotification(workerCheck.reason, 'error');
            return;
        }
        
        this.navigateToSection('marketplace');
        // Switch to workers tab
        document.querySelector('[data-tab="workers"]').click();
    }

    openMiningSlots() {
        this.navigateToSection('mining-slots');
    }

    rentNewSlot() {
        // Check if player can rent more slots
        const slotCheck = this.canRentMoreSlots();
        if (!slotCheck.canRent) {
            this.showNotification(slotCheck.reason, 'error');
            return;
        }
        
        // Find first available slot
        const availableSlot = this.gameState.miningSlots.slots.find(s => !s.rented);
        if (availableSlot) {
            this.rentMiningSlot(availableSlot.id);
        } else {
            this.showNotification('No available slots to rent!', 'info');
        }
    }

    toggleSlot(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (slot) {
            slot.active = !slot.active;
            this.gameState.mining.activeSlots += slot.active ? 1 : -1;
            this.updateUI();
        }
    }

    repairEquipment(equipmentId) {
        const equipment = this.gameState.player.inventory.equipment.find(e => e.id === equipmentId);
        if (!equipment) return;

        const repairCost = Math.floor((100 - equipment.durability) * 2); // 2 TSD per durability point
        
        if (this.gameState.player.tsdBalance >= repairCost) {
            this.gameState.player.tsdBalance -= repairCost;
            equipment.durability = 100;
            
            // Add repair animation
            const equipmentElement = document.querySelector(`[data-equipment-id="${equipmentId}"]`);
            if (equipmentElement) {
                equipmentElement.classList.add('repair-animation');
                setTimeout(() => equipmentElement.classList.remove('repair-animation'), 1000);
            }
            
            this.showNotification(`${equipment.name} repaired successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient TSD balance for repair!', 'error');
        }
    }

    motivateWorker(workerId) {
        const worker = this.gameState.player.inventory.workers.find(w => w.id === workerId);
        if (!worker) return;

        const motivationCost = Math.floor((100 - worker.energy) * 1.5); // 1.5 TSD per energy point
        
        if (this.gameState.player.tsdBalance >= motivationCost) {
            this.gameState.player.tsdBalance -= motivationCost;
            worker.energy = 100;
            
            this.showNotification(`${worker.name} is now fully motivated!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient TSD balance for motivation!', 'error');
        }
    }

    // Worker Management Functions
    hireOverseer() {
        const overseerCost = this.gameState.workers.overseerCost;
        
        if (this.gameState.player.tsdBalance >= overseerCost) {
            this.gameState.player.tsdBalance -= overseerCost;
            
            const overseer = {
                id: Date.now(),
                name: `Overseer ${this.gameState.workers.overseers.length + 1}`,
                type: 'overseer',
                boost: 1.5,
                maxWorkers: 10,
                activeWorkers: 0
            };
            
            this.gameState.workers.overseers.push(overseer);
            this.gameState.workers.maxWorkers += 10;
            
            this.showNotification('Overseer hired successfully! You can now hire more workers.', 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient TSD balance to hire overseer!', 'error');
        }
    }

    canAddWorkerToMine() {
        // Check if player has enough overseers for the current worker count
        const currentWorkers = this.gameState.player.inventory.workers.length;
        const requiredOverseers = Math.ceil(currentWorkers / 10);
        const availableOverseers = this.gameState.workers.overseers.length;
        
        if (currentWorkers >= this.gameState.workers.maxWorkersPerMine) {
            return { canAdd: false, reason: 'Maximum workers per mine reached (30)' };
        }
        
        if (requiredOverseers > availableOverseers) {
            return { canAdd: false, reason: `Need ${requiredOverseers} overseer(s) for ${currentWorkers} workers` };
        }
        
        return { canAdd: true, reason: 'Can add worker' };
    }

    canRentMoreSlots() {
        // Check if player has reached the maximum mining slots
        if (this.gameState.miningSlots.rented >= this.gameState.miningSlots.maxSlots) {
            return { canRent: false, reason: 'Maximum mining slots reached (10)' };
        }
        
        return { canRent: true, reason: 'Can rent more slots' };
    }

    trainWorker(workerId, trainingType) {
        const worker = this.gameState.player.inventory.workers.find(w => w.id === workerId);
        if (!worker) return;

        const training = this.gameState.workers.trainingCenter[trainingType];
        if (!training) return;

        if (this.gameState.player.tsdBalance >= training.cost) {
            this.gameState.player.tsdBalance -= training.cost;
            
            if (!worker.skills) worker.skills = [];
            worker.skills.push(trainingType);
            
            // Apply training boost
            if (trainingType === 'machineOperator') {
                worker.miningBoost *= training.boost;
            } else if (trainingType === 'gemsPolishing') {
                worker.gemBreakChance = Math.max(0.1, (worker.gemBreakChance || 0.3) * 0.7);
            }
            
            this.showNotification(`${worker.name} completed ${trainingType} training!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient TSD balance for training!', 'error');
        }
    }

    // Staking Functions
    stakeTSD(amount) {
        if (this.gameState.player.tsdBalance >= amount) {
            this.gameState.player.tsdBalance -= amount;
            this.gameState.player.stakedTSD += amount;
            this.gameState.staking.tsdStaked += amount;
            
            this.updateStakingBoost();
            
            // Update mission progress for staking TSD
            this.updateMissionProgress('stake_tsd', amount);
            
            this.showNotification(`${amount} TSD staked successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient TSD balance!', 'error');
        }
    }

    stakeGems(amount) {
        if (this.gameState.player.totalGems >= amount) {
            this.gameState.player.totalGems -= amount;
            this.gameState.player.stakedGems += amount;
            this.gameState.staking.gemsStaked += amount;
            
            this.updateStakingBoost();
            this.showNotification(`${amount} gems staked successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient gems!', 'error');
        }
    }

    unstakeTSD(amount) {
        if (this.gameState.player.stakedTSD >= amount) {
            this.gameState.player.stakedTSD -= amount;
            this.gameState.player.tsdBalance += amount;
            this.gameState.staking.tsdStaked -= amount;
            
            this.updateStakingBoost();
            this.showNotification(`${amount} TSD unstaked successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient staked TSD!', 'error');
        }
    }

    unstakeGems(amount) {
        if (this.gameState.player.stakedGems >= amount) {
            this.gameState.player.stakedGems -= amount;
            this.gameState.player.totalGems += amount;
            this.gameState.staking.gemsStaked -= amount;
            
            this.updateStakingBoost();
            this.showNotification(`${amount} gems unstaked successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification('Insufficient staked gems!', 'error');
        }
    }

    updateStakingBoost() {
        const tsdBoost = 1 + (this.gameState.staking.tsdStaked / 1000) * 0.1;
        const gemsBoost = 1 + (this.gameState.staking.gemsStaked / 100) * 0.05;
        this.gameState.staking.totalBoost = tsdBoost * gemsBoost;
    }

    // Mission tracking functions
    updateMissionProgress(type, amount = 1) {
        // Update daily missions
        this.gameState.quests.daily.forEach(mission => {
            if (mission.type === type && !mission.completed) {
                mission.current += amount;
                if (mission.current >= mission.target) {
                    mission.completed = true;
                    this.completeMission(mission, 'daily');
                }
            }
        });

        // Update weekly missions
        this.gameState.quests.weekly.forEach(mission => {
            if (mission.type === type && !mission.completed) {
                mission.current += amount;
                if (mission.current >= mission.target) {
                    mission.completed = true;
                    this.completeMission(mission, 'weekly');
                }
            }
        });
    }

    completeMission(mission, category) {
        // Give rewards
        this.gameState.player.tsdBalance += mission.reward.tsd;
        this.gameState.player.experience += mission.reward.experience;
        this.gameState.quests.questPoints += 50;

        // Check for level up
        this.checkLevelUp();

        // Show completion notification
        this.showNotification(`Mission completed: ${mission.name}! Earned ${mission.reward.tsd} TSD and ${mission.reward.experience} XP`, 'success');

        // Update UI
        this.updateUI();
        this.saveGameState();
    }

    resetDailyMissions() {
        this.gameState.quests.daily.forEach(mission => {
            mission.current = 0;
            mission.completed = false;
        });
    }

    resetWeeklyMissions() {
        this.gameState.quests.weekly.forEach(mission => {
            mission.current = 0;
            mission.completed = false;
        });
    }

    // Unlock Mining Slots via Staking
    unlockMiningSlot(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot || slot.unlocked) return;

        const requirements = slot.stakingRequired;
        if (this.gameState.player.stakedTSD >= requirements.tsd && 
            this.gameState.player.stakedGems >= requirements.gems) {
            
            slot.unlocked = true;
            this.showNotification(`${slot.name} unlocked successfully!`, 'success');
            this.updateUI();
        } else {
            this.showNotification(`Insufficient staked TSD or gems to unlock ${slot.name}!`, 'error');
        }
    }
}

// Global functions for HTML onclick handlers
function startMining() {
    game.startMining();
}

function openMarketplace() {
    game.openMarketplace();
}

function hireWorkers() {
    game.hireWorkers();
}

function openMiningSlots() {
    game.openMiningSlots();
}

function rentNewSlot() {
    game.rentNewSlot();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

function closeRepairModal() {
    document.getElementById('repair-modal').classList.remove('active');
}

function closeMotivationModal() {
    document.getElementById('motivation-modal').classList.remove('active');
}

// Global functions for new features
function hireOverseer() {
    game.hireOverseer();
}

function trainWorker(workerId, trainingType) {
    game.trainWorker(workerId, trainingType);
}

function stakeTSD() {
    const amount = parseInt(document.getElementById('tsd-stake-amount').value);
    if (amount > 0) {
        game.stakeTSD(amount);
        document.getElementById('tsd-stake-amount').value = '';
    }
}

function stakeGems() {
    const amount = parseInt(document.getElementById('gems-stake-amount').value);
    if (amount > 0) {
        game.stakeGems(amount);
        document.getElementById('gems-stake-amount').value = '';
    }
}

function unstakeTSD() {
    const amount = parseInt(document.getElementById('tsd-unstake-amount').value);
    if (amount > 0) {
        game.unstakeTSD(amount);
        document.getElementById('tsd-unstake-amount').value = '';
    }
}

function unstakeGems() {
    const amount = parseInt(document.getElementById('gems-unstake-amount').value);
    if (amount > 0) {
        game.unstakeGems(amount);
        document.getElementById('gems-unstake-amount').value = '';
    }
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new TSDGEMSGame();
});
