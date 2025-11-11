// Mining Sub-Page Navigation Handler

document.addEventListener('DOMContentLoaded', function() {
    console.log('[MiningSubPage] Initializing sub-page navigation...');
    
    const toggle = document.getElementById('mining-subpage-toggle');
    if (!toggle) {
        console.log('[MiningSubPage] No toggle found, skipping initialization');
        return;
    }
    
    const buttons = toggle.querySelectorAll('.toggle-btn');
    const subpages = document.querySelectorAll('.mining-subpage');
    
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            console.log('[MiningSubPage] Switching to:', target);
            
            // Update button states
            buttons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update subpage visibility
            subpages.forEach(subpage => {
                const subpageId = 'mining-subpage-' + target;
                if (subpage.id === subpageId) {
                    subpage.classList.add('active');
                    subpage.style.display = 'block';

                    // Initialize speedboost page when switching to speed-boost subpage
                    if (target === 'speed-boost' && window.game && typeof window.game.initSpeedboostPage === 'function') {
                        console.log('[MiningSubPage] Initializing speedboost page...');
                        window.game.initSpeedboostPage();
                    }
                } else {
                    subpage.classList.remove('active');
                    subpage.style.display = 'none';
                }
            });
        });
    });
    
    console.log('[MiningSubPage] Sub-page navigation initialized');
});

