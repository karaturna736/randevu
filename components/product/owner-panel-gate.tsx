'use client';
import { useEffect, useState } from 'react';
import Dashboard from './dashboard';
import { api, Busy } from './common';

export default function OwnerPanelGate() {
  const [state, setState] = useState<'loading'|'owner'|'blocked'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    api('account').then((x:any) => {
      if (x.businesses?.length) { setState('owner'); return; }
      if (x.staff_memberships?.length) { location.replace('/ekibim'); return; }
      setMessage('Bu hesap işletme sahibi hesabı değil.');
      setState('blocked');
    }).catch((e:any) => { setMessage(e.message); setState('blocked'); });
  }, []);
  if (state === 'loading') return <main className="billing-page"><div className="loading-row"><Busy/>Panel yetkisi kontrol ediliyor…</div></main>;
  if (state === 'blocked') return <main className="billing-page"><section className="panel"><h1>İşletme paneline erişiminiz yok</h1><p>{message}</p><a className="button primary" href="/giris">Giriş ekranına dön</a></section></main>;
  return <Dashboard/>;
}
