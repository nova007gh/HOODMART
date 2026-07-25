'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Store, ShoppingCart, BarChart3, Shield, Sparkles, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    if (getSession()) router.replace('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 gold-gradient rounded-lg flex items-center justify-center">
              <Store className="h-5 w-5 text-black" />
            </div>
            <span className="text-xl font-bold gold-text">EMDPOS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white">Log in</Link>
            <Button asChild className="gold-gradient text-black text-sm font-semibold">
              <Link href="/login?register=1">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="absolute inset-0 gold-gradient opacity-5" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs mb-6">
                <Sparkles className="h-3 w-3" /> The Golden Retail OS
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6">
                Run your store with <span className="gold-text">EMDPOS</span>
              </h1>
              <p className="text-lg text-zinc-400 mb-8">
                The all-in-one point of sale, inventory, and sales system built for modern retailers. Fast, offline-ready, and styled in gold.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="gold-gradient text-black font-bold px-8">
                  <Link href="/login">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Link href="/login">Register Now</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 border-t border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: ShoppingCart, title: 'Fast Checkout', desc: 'One-click product grid, cart, discounts, and receipt.' },
                { icon: BarChart3, title: 'Sales Reports', desc: 'Track every sale and monitor business performance.' },
                { icon: Store, title: 'Inventory', desc: 'Never run out of stock with low-stock alerts.' },
                { icon: Shield, title: 'Secure', desc: 'Role-based logins and local encrypted session.' },
              ].map((f) => (
                <div key={f.title} className="card-gold p-6 rounded-xl">
                  <f.icon className="h-8 w-8 text-yellow-500 mb-4" />
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-sm text-zinc-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 border-t border-zinc-800 bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to power up your retail?</h2>
            <p className="text-zinc-400 mb-8">Create your admin account and start selling in seconds.</p>
            <Button asChild size="lg" className="gold-gradient text-black font-bold px-8">
              <Link href="/login">Open EMDPOS</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
