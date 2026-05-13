import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { BRAND } from "@/lib/brand";
import "../styles/globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cancerianas.com.ar";
const TITLE = `${BRAND.name} — ${BRAND.tagline}`;
const DESCRIPTION =
  "Tienda de oportunidades con drops exclusivos. Cápsulas, sobres y bolsitas en LIVE shopping. Para mujeres libres.";
const OG_IMAGE = BRAND.logoUrl;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s · ${BRAND.name}`,
  },
  description: DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  applicationName: BRAND.name,
  authors: [{ name: BRAND.name }],
  keywords: ["cancerianas", "tienda", "ofertas", "drop", "oportunidades", "live shopping", "tiktok"],
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: BRAND.name,
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${BRAND.name} — ${BRAND.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#FFE5EC",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // No bloqueamos zoom para accesibilidad (gente que necesita acercar el texto)
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300..900;1,300..900&display=swap"
          rel="stylesheet"
        />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-RYLFCEE138" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-RYLFCEE138');
            `,
          }}
        />
      </head>
      <body className="petal-bg">
        {children}
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
