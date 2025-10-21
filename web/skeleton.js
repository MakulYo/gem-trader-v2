// TSDGEMS - Skeleton Loader
// Skeleton Screen Component für bessere UX während Ladezeiten

class SkeletonLoader {
    static create(type, count = 1) {
        const skeletons = {
            card: `
                <div class="skeleton-card">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-value"></div>
                </div>
            `,
            table: `
                <div class="skeleton-table">
                    <div class="skeleton-row">
                        <div class="skeleton-cell"></div>
                        <div class="skeleton-cell"></div>
                        <div class="skeleton-cell"></div>
                    </div>
                </div>
            `,
            slot: `
                <div class="skeleton-slot">
                    <div class="skeleton-header"></div>
                    <div class="skeleton-content"></div>
                    <div class="skeleton-button"></div>
                </div>
            `,
            grid: `
                <div class="skeleton-grid-item">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-text"></div>
                </div>
            `,
            list: `
                <div class="skeleton-list-item">
                    <div class="skeleton-cell"></div>
                    <div class="skeleton-cell short"></div>
                </div>
            `
        };

        const template = skeletons[type] || skeletons.card;
        return Array(count).fill(template).join('');
    }

    static show(elementId, type, count = 1) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="skeleton-container">${this.create(type, count)}</div>`;
            console.log(`[Skeleton] Showing ${count}x ${type} skeleton in #${elementId}`);
        } else {
            console.warn(`[Skeleton] Element #${elementId} not found`);
        }
    }

    static hide(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const skeleton = element.querySelector('.skeleton-container');
            if (skeleton) {
                skeleton.remove();
                console.log(`[Skeleton] Removed skeleton from #${elementId}`);
            }
        }
    }

    static replace(elementId, content) {
        const element = document.getElementById(elementId);
        if (element) {
            const skeleton = element.querySelector('.skeleton-container');
            if (skeleton) {
                skeleton.remove();
            }
            element.innerHTML = content;
            console.log(`[Skeleton] Replaced skeleton with content in #${elementId}`);
        }
    }
}

window.SkeletonLoader = SkeletonLoader;
console.log('[Skeleton] Skeleton Loader ready');

