/* wallet.js - TSDGEMS wallet orchestrator (WAX Cloud, Anchor, Wombat) */

/* ----------------- Config ----------------- */
const WAX_RPC = 'https://wax.greymass.com';
const WAX_CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';

const TSDM = {
  contract: 'lucas3333555',
  symbol: 'TSDM',
  decimals: 4,
  table: 'accounts'
};

const LS_LAST_PROVIDER = 'tsd:lastProvider'; // 'cloud' | 'anchor' | 'wombat'

/* ----------------- DOM helpers ----------------- */
const $ = (s, r = document) => r.querySelector(s);
const nav = {
  address: $('#wallet-address'),
  navBalance: $('#wallet-balance'),   // top-right balance text
  dashBalance: $('#tsd-balance'),     // big dashboard stat
  connectBtn: $('#connect-wallet'),
  disconnectBtn: $('#disconnect-wallet'),
  modal: $('#wallet-modal'),
  err: $('#wallet-error')
};

function show(el){ el && el.classList.remove('hidden'); }
function hide(el){ el && el.classList.add('hidden'); }
function setText(el, t){ el && (el.textContent = t); }

/* Hide sensitive stuff until authenticated */
hide(nav.navBalance);
hide(nav.dashBalance);

/* ----------------- Lib detection ----------------- */
function libsAvailable(){
  const hasWax   = !!(window.waxjs && window.waxjs.WaxJS);
  const hasAL    = !!(window.AnchorLink && window.AnchorLinkBrowserTransport);
  const hasTransitScatter =
    !!(window.transit && typeof window.transit.initAccessContext === 'function' && window.scatter);
  console.log('[wallet] libs:', { hasWax, hasAnchor: hasAL, hasWombat: hasTransitScatter });
  return { hasWax, hasAnchor: hasAL, hasWombat: hasTransitScatter };
}

/* ----------------- State ----------------- */
const state = {
  provider: null,          // 'cloud' | 'anchor' | 'wombat'
  account: null,           // wax account name
  wax: null,               // WaxJS instance
  anchor: { link: null, session: null },
  wombat: { access: null, wallet: null }
};

/* ----------------- Balance fetch ----------------- */
async function fetchTsdmBalance(account, rpc){
  // rpc = eosjs JsonRpc (must have .get_table_rows)
  try{
    const rows = await rpc.get_table_rows({
      code: TSDM.contract,
      scope: account,
      table: TSDM.table,
      limit: 10,
      json: true
    });
    // look for "X.XXXX TSDM"
    const row = rows.rows?.find(r => (r.balance || '').endsWith(' ' + TSDM.symbol));
    if(!row){ return 0; }
    const [amount] = row.balance.split(' ');
    return Number(amount); // already scaled to decimals
  }catch(err){
    console.error('[wallet] balance error', err);
    return 0;
  }
}

/* ----------------- UI updates ----------------- */
async function onAuthenticated(provider){
  localStorage.setItem(LS_LAST_PROVIDER, provider);
  state.provider = provider;

  setText(nav.address, state.account);
  nav.address?.setAttribute('title', state.account);
  show(nav.address);
  hide(nav.connectBtn);
  show(nav.disconnectBtn);

  // pick an rpc
  let rpc = null;
  if(provider === 'cloud'){
    rpc = state.wax?.rpc; // WaxJS carries a JsonRpc
  }else{
    // fall back to eosjs JsonRpc global
    const JR = window.eosjs_jsonrpc?.JsonRpc;
    rpc = new JR(WAX_RPC);
  }
  const bal = await fetchTsdmBalance(state.account, rpc);
  const fmt = (n) => n.toFixed(TSDM.decimals) + ' ' + TSDM.symbol;
  setText(nav.navBalance, fmt(bal));
  setText(nav.dashBalance, String(bal.toFixed(2)));
  show(nav.navBalance);
  show(nav.dashBalance);

  // close modal if open
  if(nav.modal){ nav.modal.classList.add('hidden'); nav.modal.setAttribute('aria-hidden','true'); }
}

function onSignedOut(){
  state.provider = null;
  state.account = null;
  hide(nav.address);
  hide(nav.navBalance);
  hide(nav.dashBalance);
  show(nav.connectBtn);
  hide(nav.disconnectBtn);
  setText(nav.address, '');
  setText(nav.navBalance, '0.0000 ' + TSDM.symbol);
  setText(nav.dashBalance, '0.00');
  localStorage.removeItem(LS_LAST_PROVIDER);
}

/* ----------------- WAX Cloud Wallet ----------------- */
async function loginWithCloud(){
  const { hasWax } = libsAvailable();
  if(!hasWax){ throw new Error('WAX library not loaded'); }
  state.wax = new window.waxjs.WaxJS({ rpcEndpoint: WAX_RPC });

  // Try auto first; if not available, login() will prompt
  try{
    const user = await state.wax.login();
    state.account = user; // user is the account name
    await onAuthenticated('cloud');
  }catch(err){
    console.error('[wallet] cloud login failed', err);
    throw err;
  }
}

async function tryCloudAuto(){
  const { hasWax } = libsAvailable();
  if(!hasWax) return false;
  state.wax = new window.waxjs.WaxJS({ rpcEndpoint: WAX_RPC });
  try{
    if(await state.wax.isAutoLoginAvailable()){
      const user = await state.wax.login();
      state.account = user;
      await onAuthenticated('cloud');
      return true;
    }
  }catch(e){/* ignore */}
  return false;
}

/* ----------------- Anchor (Anchor-Link) ----------------- */
function ensureAnchorLink(){
  if(!state.anchor.link){
    const transport = new window.AnchorLinkBrowserTransport();
    state.anchor.link = new window.AnchorLink({
      transport,
      chains: [{ chainId: WAX_CHAIN_ID, nodeUrl: WAX_RPC }]
    });
  }
}

async function loginWithAnchor(){
  const { hasAnchor } = libsAvailable();
  if(!hasAnchor){ throw new Error('Anchor-Link not loaded'); }
  ensureAnchorLink();
  try{
    const identity = await state.anchor.link.login('TSDGEMS');
    state.anchor.session = identity.session;
    state.account = state.anchor.session.auth.actor.toString();
    await onAuthenticated('anchor');
  }catch(err){
    console.error('[wallet] anchor login failed', err);
    throw err;
  }
}

async function tryAnchorRestore(){
  const { hasAnchor } = libsAvailable();
  if(!hasAnchor) return false;
  ensureAnchorLink();
  try{
    const s = await state.anchor.link.restoreSession('TSDGEMS');
    if(s){
      state.anchor.session = s;
      state.account = s.auth.actor.toString();
      await onAuthenticated('anchor');
      return true;
    }
  }catch(e){/* ignore */}
  return false;
}

/* ----------------- Wombat (Scatter via eos-transit) ----------------- */
async function loginWithWombat(){
  const { hasWombat } = libsAvailable();
  if(!hasWombat){ throw new Error('eos-transit Scatter provider not loaded'); }

  const { initAccessContext } = window.transit;
  state.wombat.access = initAccessContext({
    appName: 'TSDGEMS',
    network: { host: 'wax.greymass.com', port: 443, protocol: 'https', chainId: WAX_CHAIN_ID },
    walletProviders: [ window.scatter() ]
  });

  const provider = state.wombat.access.getWalletProviders().find(p => p.id === 'scatter');
  const wallet = state.wombat.access.initWallet(provider);
  state.wombat.wallet = wallet;

  await wallet.connect();           // triggers Wombat/Scatter
  await wallet.login();             // resolves with account info
  state.account = wallet.auth.accountName;
  await onAuthenticated('wombat');
}

/* ----------------- Disconnect ----------------- */
async function disconnect(){
  try{
    if(state.provider === 'anchor' && state.anchor.session){
      await state.anchor.session.remove();
      state.anchor.session = null;
    }
    if(state.provider === 'wombat' && state.wombat.wallet){
      try{ await state.wombat.wallet.logout(); }catch(_){}
      try{ await state.wombat.wallet.disconnect(); }catch(_){}
      state.wombat.wallet = null;
    }
  }finally{
    onSignedOut();
  }
}

/* ----------------- Wire up UI events ----------------- */
// From your index inline bootstrap: chooser buttons dispatch tsd:wallet:connect
window.addEventListener('tsd:wallet:connect', async (ev) => {
  const provider = ev.detail?.provider;
  hide(nav.err);
  try{
    if(provider === 'cloud')  return await loginWithCloud();
    if(provider === 'anchor') return await loginWithAnchor();
    if(provider === 'wombat') return await loginWithWombat();
    throw new Error('Unknown provider');
  }catch(err){
    setText(nav.err, err.message || String(err));
    show(nav.err);
  }
});

window.addEventListener('tsd:wallet:disconnect', () => disconnect());

/* ----------------- Auto-restore on load ----------------- */
document.addEventListener('DOMContentLoaded', async () => {
  const last = localStorage.getItem(LS_LAST_PROVIDER);
  // Try specific last-used first; fall back to provider-native auto
  try{
    if(last === 'anchor' && await tryAnchorRestore()) return;
    if(last === 'cloud'  && await tryCloudAuto())     return;

    // If no last or it failed, still try a silent restore in this order:
    if(await tryAnchorRestore()) return;
    if(await tryCloudAuto())     return;

    // else stay signed out; buttons remain visible
  }catch(e){
    console.warn('[wallet] auto-restore failed', e);
  }
});
