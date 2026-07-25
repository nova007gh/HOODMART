export const metadata = {
  title: 'Login | EMDPOS',
  description: 'Sign in to EMDPOS',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
