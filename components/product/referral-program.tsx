'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Copy, Gift, Wallet } from 'lucide-react';
import { api, Blank, Busy } from './common';
import { copyText } from './customer-operations';

const demo = {
  referral_enabled: false,
  referral_allowed: true,
  referral_reward: 20000,
  referral_points: 200,
  referral_code: 'NETADEMO',
  referrals: [],
  balance: 0,
  ledger: [],
};

function points(value: unknown) {
  return Math.round(Number(value || 0) / 100);
}

export function ReferralProgram({ w }: any) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(location.origin);
    if (w.preview) {
      setData(demo);
      return;
    }
    setData(null);
    setError('');
    api('referral?tenant=' + encodeURIComponent(w.business.id))
      .then(setData)
      .catch((e: any) => setError(e.message || 'Neta kredi bilgileri yüklenemedi.'));
  }, [w.business.id, w.preview]);

  if (error) return <p className="error-message">{error}</p>;
  if (!data) return <div className="loading-row"><Busy />Neta kredi yükleniyor…</div>;

  const link = origin + '/kayit?rol=business&ref=' + encodeURIComponent(data.referral_code || '');
  const earned = data.referrals.filter((r: any) => r.status === 'earned').length;
  const pending = data.referrals.filter((r: any) => r.status === 'pending').length;

  return (
    <div className="operations-stack">
      <div className="operations-metrics">
        <div className="panel operation-metric">
          <Wallet size={20} />
          <span>Kullanılabilir Neta Puanı</span>
          <strong>{points(data.balance)}</strong>
        </div>
        <div className="panel operation-metric">
          <CheckCircle2 size={20} />
          <span>Onaylanan davet</span>
          <strong>{earned}</strong>
        </div>
        <div className="panel operation-metric">
          <Clock3 size={20} />
          <span>Onay bekleyen davet</span>
          <strong>{pending}</strong>
        </div>
      </div>

      <section className="panel form-stack">
        <div className="section-heading">
          <div>
            <h2><Gift size={20} />Neta kredi</h2>
            <p className="muted">Bağlantınızı paylaşın, Neta kullanan yeni işletmelerden puan kazanın.</p>
          </div>
          <span className="badge confirmed">Tüm paketlerde</span>
        </div>

        <div className="credit-offer">
          <b>{data.referral_points || points(data.referral_reward)} Neta Puanı</b>
          <span>onaylanan farklı işletme başına<br /><small>{data.referral_enabled ? 'Davet programı açık' : 'Davet programı henüz açılmadı'}</small></span>
        </div>

        <label className="form-stack">
          <span>Davet kodunuz</span>
          <div className="share-link-row">
            <input readOnly value={data.referral_code || ''} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="button" onClick={() => copyText(data.referral_code || '')}><Copy size={16} />Kopyala</button>
          </div>
        </label>

        <label className="form-stack">
          <span>Davet bağlantınız</span>
          <div className="share-link-row">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="button primary" disabled={!origin} onClick={() => copyText(link)}><Copy size={16} />Bağlantıyı kopyala</button>
          </div>
        </label>

        <p className="helper">
          Davet ettiğiniz işletme bağlantınızdan kayıt olmalı ve işletme onayı tamamlanmalıdır. Onaylandığı anda 200 Neta Puanı hesabınıza tek seferlik eklenir. Aynı işletme yalnız bir kez ödül kazandırır. Neta Puanı nakde çevrilmez; uygun Neta hizmetlerinde kullanılır.
        </p>
      </section>

      <section className="panel">
        <h2>Kredi hareketleri</h2>
        {data.ledger.length ? (
          <div className="collection-list margin-top">
            {data.ledger.map((row: any, index: number) => (
              <div className="collection-row" key={index}>
                <div>
                  <strong>{row.description}</strong>
                  <small>{new Date(row.created_at).toLocaleDateString('tr-TR')}</small>
                </div>
                <b>{row.amount > 0 ? '+' : ''}{points(row.amount)} Puan</b>
              </div>
            ))}
          </div>
        ) : (
          <Blank title="Henüz Neta Puanı hareketi yok" description="Onaylanan davetleriniz ve kredi kullanımlarınız burada görünür." />
        )}
      </section>
    </div>
  );
}
