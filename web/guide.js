(function () {
  const GUIDE_CONTENT = {
    dashboard: {
      title: 'Dashboard Overview',
      intro: 'Use the dashboard to sync your wallet and track core game stats.',
      steps: [
        {
          heading: 'Connect Wallet',
          description: 'Press the connect button in the navigation bar to load your account data and enable actions.'
        },
        {
          heading: 'Review Key Stats',
          description: 'Check the stat cards for balances, workers, rough gems, and polished gems to see your progress.'
        },
        {
          heading: 'Jump to Activity',
          description: 'Open Mining, Polishing, Trading, or Inventory from the top navigation when you are ready to continue.'
        }
      ]
    },
    mining: {
      title: 'Mining Workflow',
      intro: 'Stake mines and workers here to produce rough gems.',
      steps: [
        {
          heading: 'Unlock a Slot',
          description: 'If a slot is locked, spend the TSDM cost to unlock it before staking.'
        },
        {
          heading: 'Stake a Mine',
          description: 'Choose an empty slot and stake a mine NFT to make it ready.'
        },
        {
          heading: 'Assign Workers',
          description: 'Add workers to the slot so their mining power fuels the job.'
        },
        {
          heading: 'Start Mining',
          description: 'Launch the mining job and let the timer run to completion.'
        },
        {
          heading: 'Claim Rough Gems',
          description: 'When the slot is ready, claim rewards to collect the mined rough gems.'
        }
      ]
    },
    polishing: {
      title: 'Polishing Workflow',
      intro: 'Convert rough gems into polished gems using your polishing tables.',
      steps: [
        {
          heading: 'Check Resources',
          description: 'Confirm your rough gem count and available polishing tables in the header cards.'
        },
        {
          heading: 'Stake a Table',
          description: 'Stake a polishing table NFT into an empty slot to get it ready.'
        },
        {
          heading: 'Queue Rough Gems',
          description: 'Choose how many rough gems to polish in the slot and start the job.'
        },
        {
          heading: 'Collect Polished Gems',
          description: 'When the slot finishes, claim the polished gems to add them to your totals.'
        }
      ]
    },
    trading: {
      title: 'Trading Overview',
      intro: 'Use the trading hub to sell gems where the payout is best.',
      steps: [
        {
          heading: 'Review Market Data',
          description: 'Check the base price panel and the gem price chart to learn the current market value.'
        },
        {
          heading: 'Choose the Best City',
          description: 'Use the city boost matrix to pick the hub with the strongest bonus for your gem type.'
        },
        {
          heading: 'Boost with Gem Staking',
          description: 'Stake polished gems in the Gem Staking tab to raise your trading bonus before selling.'
        },
        {
          heading: 'Submit & Confirm',
          description: 'Set city, gem, and amount in the sell form, then approve the wallet prompt to finalise the trade.'
        }
      ]
    },
    inventory: {
      title: 'Inventory Management',
      intro: 'Locate and manage every NFT, worker, and gem you own.',
      steps: [
        {
          heading: 'Filter Collections',
          description: 'Use search and schema filters to jump straight to the assets you need.'
        },
        {
          heading: 'Inspect Assets',
          description: 'Open a card to view its template details, mining power, and staking status.'
        },
        {
          heading: 'Manage Usage',
          description: 'Stake, unstake, or transfer items using the available action buttons.'
        }
      ]
    },
    leaderboard: {
      title: 'Leaderboard Basics',
      intro: 'Check who currently holds the most in-game dollars.',
      steps: [
        {
          heading: 'Browse Rankings',
          description: 'Use the paging controls to move through the ranked list of traders.'
        },
        {
          heading: 'Compare Totals',
          description: 'Look at each player’s in-game dollar total to gauge your position.'
        }
      ]
    },
    shop: {
      title: 'Shop Walkthrough',
      intro: 'Browse featured TSDGEMS drops and jump to their marketplace listing.',
      steps: [
        {
          heading: 'Browse Featured NFTs',
          description: 'Scroll the gallery to see the current collection highlights.'
        },
        {
          heading: 'Open Listing',
          description: 'Select an item to open its detail card with a link to the marketplace.'
        },
        {
          heading: 'Buy on NeftyBlocks',
          description: 'Use the Buy NFTs button to finish the purchase on NeftyBlocks.'
        }
      ]
    }
  };

  const createGuide = () => {
    const body = document.body;
    if (!body || body.dataset.guideReady === 'true') {
      return;
    }

    if (document.getElementById('instructions-trigger')) {
      body.dataset.guideReady = 'true';
      return;
    }

    const pageKey = body.dataset.guideKey || 'dashboard';
    const content = GUIDE_CONTENT[pageKey] || GUIDE_CONTENT.dashboard;

    if (!content || !Array.isArray(content.steps) || content.steps.length === 0) {
      return;
    }

    const trigger = document.createElement('button');
    trigger.id = 'instructions-trigger';
    trigger.className = 'instructions-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Open onboarding guide');
    trigger.setAttribute('aria-controls', 'instructions-overlay');
    trigger.setAttribute('aria-expanded', 'false');

    const icon = document.createElement('span');
    icon.className = 'instructions-icon';
    icon.textContent = '?';

    const label = document.createElement('span');
    label.className = 'instructions-label';
    label.textContent = 'Guide';

    trigger.appendChild(icon);
    trigger.appendChild(label);

    const overlay = document.createElement('div');
    overlay.id = 'instructions-overlay';
    overlay.className = 'instructions-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'instructions-title');

    const panel = document.createElement('div');
    panel.className = 'instructions-panel';

    const closeButton = document.createElement('button');
    closeButton.id = 'instructions-close';
    closeButton.className = 'instructions-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close onboarding guide');
    closeButton.innerHTML = '&times;';

    const title = document.createElement('h2');
    title.id = 'instructions-title';
    title.textContent = content.title;

    const intro = document.createElement('p');
    intro.textContent = content.intro;

    const stepsWrapper = document.createElement('div');
    stepsWrapper.className = 'instructions-steps';

    content.steps.forEach((step) => {
      const stepEl = document.createElement('div');
      stepEl.className = 'instructions-step';

      const heading = document.createElement('h3');
      heading.textContent = step.heading;

      const description = document.createElement('p');
      description.textContent = step.description;

      stepEl.appendChild(heading);
      stepEl.appendChild(description);
      stepsWrapper.appendChild(stepEl);
    });

    panel.appendChild(closeButton);
    panel.appendChild(title);
    panel.appendChild(intro);
    panel.appendChild(stepsWrapper);
    overlay.appendChild(panel);

    body.appendChild(trigger);
    body.appendChild(overlay);

    const centerPanel = () => {
      const target = Math.max((panel.scrollHeight - panel.clientHeight) / 2, 0);
      if (typeof panel.scrollTo === 'function') {
        panel.scrollTo({ top: target, behavior: 'auto' });
      } else {
        panel.scrollTop = target;
      }
    };

    const openOverlay = () => {
      overlay.setAttribute('aria-hidden', 'false');
      body.classList.add('instructions-open');
      trigger.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => {
        centerPanel();
        closeButton.focus();
      });
    };

    const closeOverlay = () => {
      overlay.setAttribute('aria-hidden', 'true');
      body.classList.remove('instructions-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    };

    trigger.addEventListener('click', () => {
      const isOpen = overlay.getAttribute('aria-hidden') === 'false';
      if (isOpen) {
        closeOverlay();
      } else {
        openOverlay();
      }
    });

    closeButton.addEventListener('click', closeOverlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeOverlay();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') {
        closeOverlay();
      }
    });

    body.dataset.guideReady = 'true';
    if (typeof console !== 'undefined') {
      console.info('[Guide] Initialised for page key:', pageKey);
    }
  };

  const init = () => {
    try {
      createGuide();
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error('[Guide] Failed to initialise guide overlay:', error);
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('pageshow', init, { once: true });
})();

