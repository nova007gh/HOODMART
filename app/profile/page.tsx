'use client'

import { useEffect, useRef, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store } from '@/lib/store'
import { getSession, updateSessionUser } from '@/lib/auth'
import { Camera, Loader2, Mail, Phone, Shield, Trash2, User as UserIcon } from 'lucide-react'
import toast from 'react-hot-toast'

const AVATAR_SIZE = 256
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/** Downscale + centre-crop an image file to a square JPEG data URL. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = AVATAR_SIZE
        canvas.height = AVATAR_SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas not supported'))
        const side = Math.min(img.width, img.height)
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          AVATAR_SIZE,
          AVATAR_SIZE
        )
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [avatar, setAvatar] = useState<string | undefined>()
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const session = getSession()
    if (!session) return
    const { user } = session
    setEmail(user.email)
    setRole(user.role)
    // Prefer the synced employee record, fall back to the session
    const emp = store.getEmployees().find((e) => e.email?.toLowerCase() === user.email)
    setName(emp?.name || user.name || '')
    setPhone(emp?.phone || user.phone || '')
    setAvatar(emp?.avatar || user.avatar)
  }, [])

  const pickFile = () => fileRef.current?.click()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file')
    if (file.size > MAX_UPLOAD_BYTES) return toast.error('Image must be smaller than 8MB')

    setUploading(true)
    try {
      const dataUrl = await fileToAvatar(file)
      setAvatar(dataUrl)
      toast.success('Picture ready — press Save to apply')
    } catch (err: any) {
      toast.error(err?.message || 'Could not process that image')
    } finally {
      setUploading(false)
    }
  }

  const removePicture = () => {
    setAvatar(undefined)
    toast('Picture removed — press Save to apply', { icon: '🗑️' })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Please enter your name')
    setSaving(true)
    try {
      const emp = store.getEmployees().find((x) => x.email?.toLowerCase() === email)
      if (emp) {
        store.updateEmployee(emp.id, { name: name.trim(), phone: phone.trim(), avatar })
      }
      updateSessionUser({ name: name.trim(), phone: phone.trim(), avatar })
      toast.success('Profile updated')
      // Let the sidebar/POS pick up the new details
      window.dispatchEvent(new Event('hoodmart:profile'))
    } catch {
      toast.error('Could not save your profile')
    } finally {
      setSaving(false)
    }
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Your picture and details appear on the point of sale screen while you work.
            </p>
          </div>

          <form onSubmit={save} className="space-y-6">
            <Card className="glass-card overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Camera className="h-5 w-5 text-yellow-500" /> Profile Picture
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                  <div className="relative shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        className="h-28 w-28 rounded-full object-cover ring-4 ring-yellow-500/30"
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-zinc-800 text-2xl font-bold text-zinc-500 ring-4 ring-zinc-700">
                        {initials || <UserIcon className="h-10 w-10" />}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={pickFile}
                      disabled={uploading}
                      aria-label="Change picture"
                      className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full gold-gradient text-black shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="text-sm text-zinc-300">
                      Use a clear photo of your face. Images are cropped to a square and resized
                      automatically.
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                      <Button
                        type="button"
                        onClick={pickFile}
                        disabled={uploading}
                        variant="outline"
                        className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                      >
                        <Camera className="mr-2 h-4 w-4" /> Choose Photo
                      </Button>
                      {avatar && (
                        <Button
                          type="button"
                          onClick={removePicture}
                          variant="outline"
                          className="border-red-500/40 text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onFile}
                  className="hidden"
                />
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <UserIcon className="h-5 w-5 text-yellow-500" /> My Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Phone className="h-3 w-3" /> Phone
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Your phone number"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Mail className="h-3 w-3" /> Email (login ID)
                  </label>
                  <input
                    value={email}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-sm text-zinc-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Shield className="h-3 w-3" /> Role
                  </label>
                  <input
                    value={role}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-sm capitalize text-zinc-400"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="gold-gradient font-bold text-black disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </div>
          </form>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
