import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }: any) {
  return (
    <>
      <Head>
        <title>Hero Meet - AI-Powered Meetings</title>
        <meta name="description" content="AI-powered meetings with your personal Hero assistant" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
