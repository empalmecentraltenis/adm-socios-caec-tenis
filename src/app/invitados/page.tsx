'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import InvitadosPanel from '@/components/invitados/InvitadosPanel';

export default function InvitadosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-sidebar/50 backdrop-blur px-4 lg:px-8 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg bg-surface border border-border"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al Panel</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-caec.png" alt="CAEC Tenis" className="h-7 w-7 object-contain" />
            <h1 className="text-sm font-bold text-foreground">CAEC Tenis · Módulo de Invitados</h1>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 lg:p-6">
        <InvitadosPanel />
      </main>
    </div>
  );
}
