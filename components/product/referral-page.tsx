'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Gift } from 'lucide-react';
import { api, Brand, Busy, ThemeToggle } from './common';
import { ReferralProgram } from './referral-program';

export default function ReferralPage() {
  const [workspace, setWorkspace] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('workspace')
      .then((data: any) => {
        if (data.subscription_required) {
          location.replace('/abonelik?tenant=' + encodeURIComponent(data.business.id) + '&gerekli=1');
          return;
        }
        setWorkspace(data);
      })
      .catch((e: any) => setError(e.message || 'İşletme bilgileri yüklenemedi.'));
  }, []);

  return (
    <main className="billing-page">
      <div className="page-heading">
        <div>
          <Brand />
          <span className="eyebrow"><Gift size={14} /> NETA KREDİ</span>
          <h1>Davet et, Neta Puanı kazan.</h1>
          <p>İşletme davet bağlantınızı paylaşın. Onaylanan her yeni işletme için 200 Neta Puanı kazanın.</p>
        </div>
        <div className="button-group">
          <a className="button" href="/panel"><ArrowLeft size={16} />Panele dön</a>
          <ThemeToggle />
        </div>
      </div>
      {error ? <p className="error-message">{error}</p> : !workspace ? <div className="loading-row"><Busy />Neta kredi hazırlanıyor…</div> : <ReferralProgram w={workspace} />}
    </main>
  );
}
