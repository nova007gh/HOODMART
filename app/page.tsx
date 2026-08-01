'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { PLAN_PRICE_GHS } from '@/lib/subscription'
import {
  Store,
  ShoppingCart,
  BarChart3,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  Clock,
  Zap,
} from 'lucide-react'

const BASIC_FEATURES = [
  'Point of Sale',
  'Inventory management',
  'Sales reports',
  'Up to 2 employees',
  'Email support',
]

const PRO_FEATURES = [
  'Everything in Basic',
  'Unlimited employees',
  'Advanced PDF reports',
  'Multi-branch support',
  'Expense tracking',
  'Priority support',
]

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    if (getSession()) router.replace('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 gold-gradient rounded-lg flex items-center justify-center">
              <Store className="h-5 w-5 text-black" />
            </div>
            <span className="text-xl font-bold gold-text">EMDPOS</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#pricing" className="text-sm text-zinc-400 hover:text-white hidden sm:block">Pricing</a>
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
                  <Link href="/login?register=1">Start 14-Day Free Trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <a href="#pricing">See Pricing</a>
                </Button>
              </div>
              <p className="text-xs text-zinc-600 mt-4">No credit card required. 14-day free trial on all plans.</p>
            </div>
          </div>
        </section>

        <section className="py-16 border-t border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: ShoppingCart, title: 'Fast Checkout', desc: 'One-click product grid, cart, discounts, and receipt printing.' },
                { icon: BarChart3, title: 'Sales Reports', desc: 'Detailed PDF reports to track and monitor business performance.' },
                { icon: Store, title: 'Inventory', desc: 'Never run out of stock with real-time low-stock alerts.' },
                { icon: Shield, title: 'Secure', desc: 'Role-based employee logins with full activity logging.' },
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

        <section id="pricing" className="py-20 border-t border-zinc-800 bg-zinc-900/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">Simple, transparent pricing</h2>
              <p className="text-zinc-400 text-lg">Choose the plan that fits your business. Start free for 14 days.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 flex flex-col">
                <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Basic</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-white">GHS {PLAN_PRICE_GHS.basic}</span>
                  <span className="text-zinc-500 text-sm">/month</span>
                </div>
                <p className="text-xs text-zinc-500 mb-6">Perfect for single-store retailers</p>
                <ul className="space-y-3 flex-1 mb-8">
                  {BASIC_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <CheckCircle2 className="h-4 w-4 text-yellow-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800" variant="outline">
                  <Link href="/login?register=1">Start Free Trial</Link>
                </Button>
              </div>

              <div className="rounded-2xl border-2 border-yellow-500/50 bg-zinc-950 p-8 flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full gold-gradient text-black text-xs font-bold">
                  Most Popular
                </div>
                <p className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-2">Pro</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold gold-text">GHS {PLAN_PRICE_GHS.pro}</span>
                  <span className="text-zinc-500 text-sm">/month</span>
                </div>
                <p className="text-xs text-zinc-500 mb-6">For growing and multi-branch businesses</p>
                <ul className="space-y-3 flex-1 mb-8">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <CheckCircle2 className="h-4 w-4 text-yellow-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full gold-gradient text-black font-bold">
                  <Link href="/login?register=1">Start Free Trial</Link>
                </Button>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" /> 14-day free trial
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-yellow-500" /> Pay via Mobile Money
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" /> Instant activation
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 border-t border-zinc-800 bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to power up your retail?</h2>
            <p className="text-zinc-400 mb-8">Create your account, try free for 14 days, then subscribe to keep going.</p>
            <Button asChild size="lg" className="gold-gradient text-black font-bold px-8">
              <Link href="/login?register=1">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} EMDPOS Retail OS. All rights reserved.
      </footer>
    </div>
  )
}
