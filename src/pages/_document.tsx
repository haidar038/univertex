// src/pages/_document.tsx
import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
    render() {
        return (
            <Html lang="en">
                <Head>
                    <meta name="apple-mobile-web-app-title" content="UniVertex" />
                    <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png" />
                    <link rel="icon" type="image/png" sizes="32x32" href="/web-app-manifest-512x512.png" />
                    <link rel="icon" type="image/png" sizes="16x16" href="/web-app-manifest-192x192.png" />
                    <link rel="shortcut icon" href="/favicon.ico" />
                    <link rel="manifest" href="/manifest.json" />
                    <meta name="theme-color" content="#ffffff" />
                    {/* paste any other tags from realfavicongenerator */}
                </Head>
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}
