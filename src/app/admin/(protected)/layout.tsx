import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser()
  if (!admin) redirect('/admin/login')

  return (
    <div className="fixed inset-0 z-[100] flex bg-brand-bg overflow-hidden">
      <AdminSidebar adminName={admin.full_name} adminInitials={admin.avatar_initials} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="h-14 flex-shrink-0 flex items-center px-6 border-b border-brand-border bg-brand-card">
          <span className="text-brand-gold-muted text-xs font-medium uppercase tracking-widest">Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-[10px] font-bold">
              {admin.avatar_initials}
            </div>
            <span className="text-brand-body text-sm hidden sm:block">{admin.full_name}</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
