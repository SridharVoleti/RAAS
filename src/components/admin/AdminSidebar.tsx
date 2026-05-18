'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, BookOpen, CreditCard, Users, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Courses',   href: '/admin/courses',  icon: BookOpen },
  { label: 'Payments',  href: '/admin/payments', icon: CreditCard },
  { label: 'Students',  href: '/admin/students', icon: Users },
]

interface Props {
  adminName: string
  adminInitials: string
}

export default function AdminSidebar({ adminName, adminInitials }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  function isActive(item: typeof NAV[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-[#0d0800] border-r border-brand-border">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-brand-border flex-shrink-0">
        <span className="text-brand-gold text-2xl font-serif leading-none">ॐ</span>
        <div>
          <div className="text-brand-gold font-bold text-sm leading-tight">Krishnamargam</div>
          <div className="text-brand-gold-muted text-[10px]">Admin Panel</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-gold text-brand-bg'
                  : 'text-brand-gold-muted hover:text-brand-gold hover:bg-brand-border/40'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + Sign out */}
      <div className="p-3 border-t border-brand-border space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-2">
          <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-[10px] font-bold flex-shrink-0">
            {adminInitials}
          </div>
          <span className="text-brand-body text-xs truncate">{adminName}</span>
        </div>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-gold-muted hover:text-brand-error hover:bg-brand-error/10 transition-colors">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
