// TSDGEMS - Shop Page Script

class ShopGame extends TSDGEMSGame {
    constructor() {
        super();
        this.categories = [
            {
                title: 'Polished Gems',
                icon: 'fa-star',
                description: 'The final, beautifully polished gemstones ready for collection.',
                items: [
                    { name: 'Diamond', id: '894387', image: '(1).png' },
                    { name: 'Ruby', id: '894388', image: '(2).png' },
                    { name: 'Sapphire', id: '894389', image: '(3).png' },
                    { name: 'Emerald', id: '894390', image: '(4).png' },
                    { name: 'Jade', id: '894391', image: '(5).png' },
                    { name: 'Tanzanite', id: '894392', image: '(6).png' },
                    { name: 'Opal', id: '894393', image: '(7).png' },
                    { name: 'Aquamarine', id: '894394', image: '(8).png' },
                    { name: 'Topaz', id: '894395', image: '(9).png' },
                    { name: 'Amethyst', id: '894396', image: '(10).png' }
                ]
            },
            {
                title: 'Unpolished Gems',
                icon: 'fa-gem',
                description: 'Raw, uncut gemstones ready to be polished into masterpieces.',
                items: [
                    { name: 'Unpolished Diamond', id: '894397', image: '(11).png' },
                    { name: 'Unpolished Ruby', id: '894398', image: '(12).png' },
                    { name: 'Unpolished Sapphire', id: '894399', image: '(13).png' },
                    { name: 'Unpolished Emerald', id: '894400', image: '(14).png' },
                    { name: 'Unpolished Jade', id: '894401', image: '(15).png' },
                    { name: 'Unpolished Tanzanite', id: '894402', image: '(16).png' },
                    { name: 'Unpolished Opal', id: '894403', image: '(17).png' },
                    { name: 'Unpolished Aquamarine', id: '894404', image: '(18).png' },
                    { name: 'Unpolished Topaz', id: '894405', image: '(19).png' },
                    { name: 'Unpolished Amethyst', id: '894406', image: '(20).png' }
                ]
            },
            {
                title: 'Mining Equipment',
                icon: 'fa-industry',
                description: 'Essential tools and machinery for your mining operations.',
                items: [
                    { name: 'Pickaxe Worker', id: '894928', image: '41.png' },
                    { name: 'Hammer Drill Worker', id: '894929', image: '42.png' },
                    { name: 'Mini Excavator Worker', id: '894930', image: '43.jpg' },
                    { name: 'Excavator', id: '894931', image: '44.png' },
                    { name: 'Dump Truck', id: '894932', image: '45.png' },
                    { name: 'Small Mine', id: '894933', image: '46.png' },
                    { name: 'Medium Mine', id: '894934', image: '47.png' },
                    { name: 'Large Mine', id: '894935', image: '48.png' }
                ]
            },
            {
                title: 'Polishing Tools',
                icon: 'fa-tools',
                description: 'The essential tool to transform rough gems into polished masterpieces.',
                items: [
                    { name: 'Polishing Table', id: '896279', image: 'polishingtable.jpg' }
                ]
            },
            {
                title: 'Shards',
                icon: 'fa-shapes',
                description: 'The unfortunate result when gems break during polishing (10% chance).',
                items: [
                    { name: 'Pile of Shards', id: '896283', image: '60f21764-2fe2-461f-8475-47e2ab106c41.png' }
                ]
            }
        ];
        this.init();
    }

    init() {
        this.renderGallery();
        this.showNotification('Shop loaded', 'info');
    }

    renderGallery() {
        const container = document.getElementById('shop-gallery-container');
        if (!container) return;

        container.innerHTML = this.categories.map(category => `
            <div class="gallery-category">
                <div class="section-title">
                    <h3><i class="fas ${category.icon}"></i> ${category.title}</h3>
                    <p>${category.description}</p>
                </div>
                <div class="gallery-grid">
                    ${category.items.map(item => `
                        <div class="gallery-card">
                            <div class="gallery-image">
                                <img src="../assets/gallery_images/${item.image}" alt="TSDMEDIAGEMS ${item.name} NFT">
                            </div>
                            <div class="gallery-content">
                                <h3>${item.name} #${item.id}</h3>
                                <p>${category.title === 'Polishing Tools' ? 'Polishing Equipment' : 
                                    category.title === 'Mining Equipment' ? (item.name.includes('Mine') ? 'Mining Site' : 
                                    item.name.includes('Worker') ? 'Worker Equipment' : 'Machinery') : 
                                    category.title === 'Shards' ? 'Shard Collection' :
                                    category.title === 'Unpolished Gems' ? 'Unpolished Gem' : 'Polished Gem'}</p>
                                <a class="gallery-link" href="https://neftyblocks.com/templates/tsdmediagems/${item.id}" target="_blank" rel="noopener">View on NeftyBlocks</a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
}

// Initialize shop when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new ShopGame();
    window.tsdgemsGame = game;
});

