'use client';

import { Gift } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function NetaCreditLauncher(){
  const path=usePathname();
  if(path==='/panel/neta-kredi') return null;
  return (
    <a
      href="/panel/neta-kredi"
      className="button primary"
      style={{position:'fixed',right:20,bottom:20,zIndex:70,boxShadow:'0 12px 36px rgba(0,0,0,.28)'}}
      aria-label="Neta kredi sayfasını aç"
    >
      <Gift size={16}/> Neta Kredi · 200 Puan
    </a>
  );
}
