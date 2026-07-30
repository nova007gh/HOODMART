'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login, register, listUsers } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Store, Lock, Mail, UserPlus } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const search = useSearchParams()

  const isRegister = mode === 'register' || search.get('register') === '1'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isRegister) {
      const result = await register(email, password, storeName || name || email, 'admin', ['*'])
      if (result.ok) {
        toast.success('Account created! Welcome to EMDPOS.')
        router.push('/dashboard')
      } else {
        setError(result.error || 'Registration failed')
      }
    } else {
      const session = await login(email, password)
      if (session) {
        toast.success('Welcome back to EMDPOS!')
        router.push('/dashboard')
      } else {
        if (isSupabaseConfigured()) {
          setError('Invalid email or password.')
        } else {
          const users = listUsers()
          const knownEmails = users.map((u) => u.email).join(', ')
          setError(`Invalid email or password. Registered accounts: ${knownEmails || 'none'}`)
        }
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 gold-gradient rounded-2xl mb-4 animate-gold-pulse">
            <Store className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-4xl font-bold gold-text mb-2">EMDPOS</h1>
          <p className="text-zinc-400">Retail OS — Gold Edition</p>
        </div>

        <Card className="glass-card border-zinc-700/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-white">
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-center text-zinc-400">
              {isRegister ? 'Set up your store profile' : 'Sign in to your dashboard'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert className="border-red-500/50 bg-red-500/10 text-red-400">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label className="text-zinc-300">Store Name</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="e.g. HOODMARD Enterprise"
                      className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500"
                      required={isRegister}
                    />
                  </div>
                </div>
              )}
              {isRegister && (
                <div className="space-y-2">
                  <Label className="text-zinc-300">Your Name</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-zinc-300">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@store.com"
                    className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gold-gradient text-black font-bold hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? (isRegister ? 'Creating…' : 'Signing in…') : (isRegister ? 'Create Account' : 'Sign In')}
              </Button>
            </form>

            <div className="text-center space-y-3">
              <p className="text-sm text-zinc-400">
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  type="button"
                  onClick={() => setMode(isRegister ? 'login' : 'register')}
                  className="text-yellow-500 hover:text-yellow-400 font-medium"
                >
                  {isRegister ? 'Log in' : 'Register now'}
                </button>
              </p>
              {!isRegister && !isSupabaseConfigured() && (
                <p className="text-xs text-zinc-600">
                  Default admin: <span className="text-zinc-400 font-mono">nova@gmail.com</span> / <span className="text-zinc-400 font-mono">qwerty123</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (confirm('This will clear all local data and reset the app. Continue?')) {
                    localStorage.clear()
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
                    }
                    window.location.reload()
                  }
                }}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                Reset app data
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
