import { LayoutDashboard, Users, FileText, Settings, X, Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';

interface SidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

const navItems = [
  { id: 'socios', label: 'Socios / Pagos', icon: Users },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'reportes', label: 'Deudores', icon: FileText },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

export default function Sidebar({ activeTab, onNavigate, isOpen, onClose, onOpen }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile hamburger button */}
      <button
        onClick={() => { if (isOpen) onClose(); else onOpen(); }}
        className={cn(
          'fixed top-4 left-4 z-50 rounded-lg bg-[#1A1A1A] border border-[#333333] p-2 text-[#CCCCCC] lg:hidden hover:bg-[#2A2A2A] transition-colors',
          isOpen && 'hidden'
        )}
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-[260px] bg-[#1A1A1A] border-r border-[#333333] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button (mobile only) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1 text-[#999999] hover:text-white lg:hidden transition-colors"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 pt-8 pb-6 px-4">
          <img
            src="/logo-caec.png"
            alt="Empalme Central Tenis - CAEC"
            className="w-24 h-24 object-contain"
          />
          <div className="text-center">
            <p className="text-[#999999] text-xs">
              CAEC - Administración
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="mx-4 border-t border-[#333333]" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#FFCC00] text-[#121212]'
                    : 'text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-[#121212]' : 'text-[#999999]')} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer with Logout */}
        <div className="px-4 py-4 border-t border-[#333333] space-y-3">
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </button>
          <p className="text-[#666666] text-[10px] text-center uppercase font-bold tracking-wider">
            © 2026 CAEC · V2.0
          </p>
        </div>
      </aside>
    </>
  );
}
