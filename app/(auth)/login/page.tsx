'use client'

import dynamic from 'next/dynamic'

const LoginForm = dynamic(() => import('./login-form'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
      <p className="text-zinc-400">Loading HOODMART...</p>
    </div>
  ),
})

export default function LoginPage() {
  return <LoginForm />
}
