import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import Navbar from '@/components/Navbar'
import MobileNavbar from '@/components/MobileNavbar'
import Footer from '@/components/Footer'
import { isLive } from '@/lib/launch'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'Krishnamargam – Your Spiritual Journey',
  description: 'Bilingual Vedic & spiritual learning platform. Learn Bhagavad Gita, Mantras, Upanishads, and more in Telugu and English.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <MobileNavbar />
          <div className="hidden md:block">
            <Navbar isLive={isLive()} />
          </div>
          <main className="min-h-screen">{children}</main>
          <Footer />
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
