import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { BRAND } from "@/lib/brand";
import { getBrandInfo, getSeo, getAnalytics } from "@/lib/site-settings";
import WhatsAppButton from "@/components/WhatsAppButton";
import "../styles/globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cancerianas.com.ar";

const DEFAULT_DESCRIPTION =
  "Tienda de oportunidades con drops exclusivos. Cápsulas, sobres y bolsitas en LIVE shopping. Para mujeres libres.";

export async function generateMetadata(): Promise<Metadata> {
  const [brand, seo] = await Promise.all([getBrandInfo(), getSeo()]);
  const TITLE = seo.meta_title || `${brand.name} — ${brand.tagline}`;
  const DESCRIPTION = seo.meta_description || DEFAULT_DESCRIPTION;
  const OG = seo.og_image_url || brand.logo_url;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: TITLE, template: `%s · ${brand.name}` },
    description: DESCRIPTION,
    manifest: "/manifest.json",
    icons: { icon: "/icon.png", apple: "/apple-icon.png" },
    applicationName: brand.name,
    authors: [{ name: brand.name }],
    keywords: seo.keywords
      ? seo.keywords.split(",").map(k => k.trim()).filter(Boolean)
      : ["cancerianas", "tienda", "ofertas", "drop", "oportunidades", "live shopping", "tiktok"],
    formatDetection: { telephone: false },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: SITE_URL,
      siteName: brand.name,
      locale: "es_AR",
      type: "website",
      images: [{ url: OG, width: 1200, height: 630, alt: `${brand.name} — ${brand.tagline}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: [OG],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#FFE5EC",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const analytics = await getAnalytics();

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300..900;1,300..900&display=swap"
          rel="stylesheet"
        />

        {/* Google Analytics: el hardcoded sigue activo, además se inyecta el que config el admin */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-RYLFCEE138" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-RYLFCEE138');
              ${analytics.ga4_id ? `gtag('config', '${analytics.ga4_id}');` : ""}
            `,
          }}
        />

        {/* Facebook Pixel */}
        {analytics.fb_pixel_id && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${analytics.fb_pixel_id}');
                fbq('track', 'PageView');
              `,
            }}
          />
        )}

        {/* TikTok Pixel */}
        {analytics.tiktok_pixel_id && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                !function (w, d, t) {
                  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                  ttq.load('${analytics.tiktok_pixel_id}');
                  ttq.page();
                }(window, document, 'ttq');
              `,
            }}
          />
        )}
      </head>
      <body className="petal-bg">
        {children}
        <WhatsAppButton />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "white",
              color: "#3D2A33",
              border: "1px solid #FFE5EC",
              borderRadius: "16px",
            },
          }}
        />
      </body>
    </html>
  );
}

