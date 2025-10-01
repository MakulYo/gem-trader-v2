import Head from 'next/head';
import WalletConnect from '../components/WalletConnect';

/**
 * Home page for the TSDGEMS Next.js rewrite. For now this page simply
 * renders the wallet connection component. The original site included
 * navigation, a gallery of gems and a leaderboard – those can be
 * progressively migrated into React components under the `components/`
 * folder and imported here. Using Next.js pages allows server-side
 * rendering and client-side routing if additional pages are needed.
 */
export default function Home() {
  return (
    <>
      <Head>
        <title>TSDGEMS – Diamond Trading Simulator</title>
        <meta name="description" content="TSDGEMS - Diamond Trading Simulator built with Next.js" />
      </Head>
      <main>
        <WalletConnect />
      </main>
    </>
  );
}