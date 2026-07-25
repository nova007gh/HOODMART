import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-4xl font-bold gold-text">404</h1>
        <p className="text-zinc-400">Page not found</p>
        <Button asChild className="gold-gradient text-black font-bold">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
