/* wallet.js — WAX Cloud Wallet + Anchor, auto-login, TSDM balance display
   Token: contract 'lucas3333555', symbol 'TSDM', precision 4
*/

(function () {
  // --- Config ---
  const RPC_ENDPOINT = 'https://wax.greymass.com';
  const CHAIN_ID     = '1064487b3cd1a897...a8c6e5d' // WAX mainnet
    .replace('...', ''); // keep as single string
  const TOKEN = {
    contract: 'lucas3333555',
    symbol:   'TSDM',
    precision: 4
  };

  // --- UI helpers ---
  const $ = (s, r=document) => r.querySelector(s);
  const els = {
    wrap: $('#nav-wallet'),
    addr: $('#wallet-address'),
    bal:  $('#wallet-balance'),
    connect: $('#connect-wallet'),
    disconnect: $('#disconnect-wallet'),
    modal: $('#wallet-modal'),
    error: $('#wallet-error')
  };
  const show  = el => el?.classList.remove('hidden');
  const hide  = el => el?.classList.add('hidden');
  const setText = (el, t) => { if (el) el.textContent = t; };

  function setAuthUI(signedIn, account = '') {
    if (signedIn) {
      els.wrap?.setAttribute('data-auth', 'signed-in');
      setText(els.addr, account);
      show(els.addr);
      show(els.bal);
      hide(els.connect);
      show(els.disconnect);
    } else {
      els.wrap?.setAttribute('data-auth', 'signed-out');
      setText(els.addr, '');
      setText(els.bal, `0.0000 ${TOKEN.symbol}`);
      hide(els.addr);
      hide(els.bal);
      show(els.connect);
      hide(els.disconnect);
    }
  }

  // --- Lib detection (from local /libs) ---
  const hasWax    = !!(window.waxjs && window.waxjs.WaxJS);
  const hasAnchor = !!(window.AnchorLink && window.AnchorLinkBrowserTransport);
  console.log('[wallet] libs:', { hasWax, hasAnchor, hasWombat:false });

  // --- State ---
  let provider = null;      // 'cloud' | 'anchor'
  let account  = null;      // string (wax account)
  let session  = null;      // anchor session
  let wax      = null;      // waxjs instance

  // --- Balance ---
  async function fetchTSDMBalance(acct) {
    try {
      const res = await fetch(`${RPC_ENDPOINT}/v1/chain/get_table_rows`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          code: TOKEN.contract,
          table: 'accounts',
          scope: acct,
          json: true,
          limit: 1
        })
      });
      const data = await res.json();
      const row = data.rows?.[0]?.balance || `0.0000 ${TOKEN.symbol}`;
      // Format to desired precision (defensive if symbol casing differs)
      const [num, sym] = row.split(' ');
      const value = Number(num).toFixed(TOKEN.precision);
      setText(els.bal, `${value} ${TOKEN.symbol}`);
    } catch (e) {
      console.warn('[wallet] balance fetch failed', e);
      setText(els.bal, `0.0000 ${TOKEN.symbol}`);
    }
  }

  // --- Providers ---
  async function connectCloud() {
    if (!hasWax) throw new Error('WAX library missing');
    wax = new window.waxjs.WaxJS({ rpcEndpoint: RPC_ENDPOINT, tryAutoLogin: false });
    const user = await wax.login();         // opens Cloud Wallet popup
    account = user || wax.userAccount;
    provider = 'cloud';
    session  = null;
    return account;
  }

  async function restoreCloud() {
    if (!hasWax) return null;
    wax = new window.waxjs.WaxJS({ rpcEndpoint: RPC_ENDPOINT, tryAutoLogin: true });
    const ok = await wax.isAutoLoginAvailable();
    if (!ok) return null;
    account = wax.userAccount;
    provider = 'cloud';
    session  = null;
    return account;
  }

  async function connectAnchor() {
    if (!hasAnchor) throw new Error('Anchor libraries missing');
    const transport = new window.AnchorLinkBrowserTransport();
    const link = new window.AnchorLink({
      chainId: CHAIN_ID,
      transport,
      rpc: RPC_ENDPOINT
    });
    const result = await link.login('tsdgems'); // app identifier (arbitrary)
    session = result.session;
    account = session.auth.actor.toString();
    provider = 'anchor';
    // persist session
    window.localStorage.setItem('tsd_anchor_session', JSON.stringify(session.serialize()));
    return account;
  }

  async function restoreAnchor() {
    if (!hasAnchor) return null;
    const raw = window.localStorage.getItem('tsd_anchor_session');
    if (!raw) return null;
    try {
      const transport = new window.AnchorLinkBrowserTransport();
      const link = new window.AnchorLink({
        chainId: CHAIN_ID,
        transport,
        rpc: RPC_ENDPOINT
      });
      session = await link.restoreSession('tsdgems', JSON.parse(raw));
      if (!session) return null;
      account = session.auth.actor.toString();
      provider = 'anchor';
      return account;
    } catch {
      return null;
    }
  }

  async function disconnect() {
    try {
      if (provider === 'anchor' && session?.remove) {
        await session.remove();
      }
    } catch {}
    window.localStorage.removeItem('tsd_anchor_session');
    provider = null; account = null; session = null; wax = null;
    setAuthUI(false);
  }

  // --- Event wiring from the HTML bootstrap ---
  window.addEventListener('tsd:wallet:connect', async (ev) => {
    const choice = ev.detail?.provider; // 'cloud' | 'anchor'
    if (!choice) return;
    // close modal if open
    els.modal?.classList.add('hidden');
    els.modal?.setAttribute('aria-hidden','true');
    try {
      if (choice === 'cloud') await connectCloud();
      else if (choice === 'anchor') await connectAnchor();
      else throw new Error('Provider not ready');

      setAuthUI(true, account);
      await fetchTSDMBalance(account);
    } catch (err) {
      console.error('[wallet] connect failed', err);
      if (els.error) {
        els.error.textContent = err.message || 'Connection failed';
        els.error.classList.remove('hidden');
      }
      setAuthUI(false);
    }
  });

  window.addEventListener('tsd:wallet:disconnect', () => { disconnect(); });

  // --- Auto-login on load ---
  (async function boot() {
    setAuthUI(false);
    // Try Anchor session first, then WAX Cloud
    const a = await restoreAnchor();
    if (a) {
      setAuthUI(true, a);
      await fetchTSDMBalance(a);
      return;
    }
    const c = await restoreCloud();
    if (c) {
      setAuthUI(true, c);
      await fetchTSDMBalance(c);
      return;
    }
  })();
})();
