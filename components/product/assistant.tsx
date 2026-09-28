'use client';

import { useState } from 'react';
import { Sparkles, Send, MessageSquare, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api, Modal, Busy } from './common';
import { today, addDays, dateLabel, time } from '@/lib/types';

const normalize = (value: unknown) =>
  String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function serviceFromMessage(message: string, services: any[]) {
  const text = normalize(message);
  const tokens = text.split(/\s+/).filter((token) => token.length >= 3);
  let best: any = null;
  let bestScore = 0;
  for (const service of services || []) {
    const serviceText = normalize(service.name);
    const serviceTokens = serviceText.split(/\s+/).filter((token) => token.length >= 3);
    let score = 0;
    for (const serviceToken of serviceTokens) {
      if (
        tokens.some(
          (token) =>
            token === serviceToken ||
            token.startsWith(serviceToken) ||
            serviceToken.startsWith(token),
        )
      )
        score++;
    }
    if (text.includes(serviceText)) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = service;
    }
  }
  return bestScore > 0 ? best : null;
}

function requestedMinute(message: string) {
  const text = message.toLocaleLowerCase('tr-TR');
  const patterns = [
    /\bsaat\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?/i,
    /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i,
    /\b([01]?\d|2[0-3])\s*(?:'?(?:de|da)|gibi|civarı|civarında)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)
      return hour * 60 + minute;
  }
  return null;
}

function requestedDate(message: string) {
  const text = message.toLocaleLowerCase('tr-TR');
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (iso) return { date: iso, explicit: true };
  if (text.includes('bugün')) return { date: today(), explicit: true };
  if (text.includes('yarın')) return { date: addDays(today(), 1), explicit: true };

  const days = [
    'pazar',
    'pazartesi',
    'salı',
    'çarşamba',
    'perşembe',
    'cuma',
    'cumartesi',
  ];
  const dayIndex = days.findIndex((day) => text.includes(day));
  if (dayIndex >= 0) {
    const base = today();
    const current = new Date(base + 'T12:00:00Z').getUTCDay();
    const diff = (dayIndex - current + 7) % 7;
    return { date: addDays(base, diff), explicit: true };
  }
  return { date: today(), explicit: false };
}

function filterByWords(message: string, slots: any[]) {
  const text = message.toLocaleLowerCase('tr-TR');
  if (text.includes('öğleden sonra')) return slots.filter((slot) => slot.minute >= 720);
  if (text.includes('sabah')) return slots.filter((slot) => slot.minute < 720);
  if (text.includes('akşam')) return slots.filter((slot) => slot.minute >= 1020);
  if (text.includes('öğlen')) return slots.filter((slot) => slot.minute >= 660 && slot.minute <= 840);
  return slots;
}

async function publicAssistant(message: string, w: any, publicSlug: string) {
  const service = serviceFromMessage(message, w.services || []);
  if (!service)
    return {
      message: `Hangi hizmet için saat arıyorsunuz? ${(w.services || []).map((s: any) => s.name).join(', ')}`,
      slots: [],
    };

  const wantedMinute = requestedMinute(message);
  const requested = requestedDate(message);
  const dates = requested.explicit
    ? [requested.date]
    : Array.from({ length: 14 }, (_, index) => addDays(requested.date, index));

  for (const date of dates) {
    const response = await api(
      `availability?slug=${encodeURIComponent(publicSlug)}&service=${encodeURIComponent(service.id)}&date=${encodeURIComponent(date)}&staff=any`,
    );
    let slots = Array.isArray(response?.slots) ? response.slots : [];
    slots = filterByWords(message, slots);

    if (wantedMinute != null) {
      const exact = slots.filter((slot: any) => slot.minute === wantedMinute);
      if (exact.length) {
        return {
          message: `${date} · ${service.name}: ${time(wantedMinute)} müsait.`,
          date,
          service_id: service.id,
          slots: exact.slice(0, 6),
          mode: 'availability',
        };
      }

      const near = slots
        .filter((slot: any) => Math.abs(slot.minute - wantedMinute) <= 60)
        .sort(
          (a: any, b: any) =>
            Math.abs(a.minute - wantedMinute) - Math.abs(b.minute - wantedMinute) ||
            a.minute - b.minute,
        )
        .filter(
          (slot: any, index: number, all: any[]) =>
            index === all.findIndex((item: any) => item.minute === slot.minute),
        )
        .slice(0, 6);
      if (near.length) {
        return {
          message: `${date} · ${service.name}: ${time(wantedMinute)} tam olarak boş değil; en yakın müsait saatler aşağıda.`,
          date,
          service_id: service.id,
          slots: near,
          mode: 'availability',
        };
      }
      continue;
    }

    const unique = slots
      .filter(
        (slot: any, index: number, all: any[]) =>
          index === all.findIndex((item: any) => item.minute === slot.minute),
      )
      .slice(0, 6);
    if (unique.length) {
      return {
        message: `${date} · ${service.name}: ${unique.map((slot: any) => slot.time).join(', ')} müsait.`,
        date,
        service_id: service.id,
        slots: unique,
        mode: 'availability',
      };
    }
  }

  return {
    message: requested.explicit
      ? 'Bu gün ve saat aralığında boş yer bulunamadı. Başka bir saat deneyin.'
      : 'Önümüzdeki 14 gün içinde uygun saat bulunamadı.',
    date: requested.date,
    service_id: service.id,
    slots: [],
    mode: 'availability',
  };
}

export function Assistant({ open, onClose, w, onBook, publicSlug }: any) {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function ask(e: any) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (w.preview) {
        let d = today();
        while (new Date(d + 'T12:00:00Z').getUTCDay() !== 6) d = addDays(d, 1);
        setAnswer({
          message: 'Örnek sonuç: Cumartesi öğleden sonra aşağıdaki saatleri seçebilirsiniz.',
          date: d,
          service_id: w.services[0].id,
          slots: [870, 960, 1050].map((m) => ({
            minute: m,
            time: time(m),
            staff_id: w.staff[0].id,
            staff_name: w.staff[0].name,
          })),
        });
      } else if (publicSlug) {
        setAnswer(await publicAssistant(message, w, publicSlug));
      } else {
        setAnswer(await api('assistant', { message, tenant_id: w.business.id }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bir cümleyle, uygun saati bulun"
      description="Türkçe gün, hizmet ve saat araması"
    >
      <div className="assistant-welcome">
        <span className="assistant-orb">
          <Sparkles size={28} />
        </span>
        <p>Nasıl bir randevu arıyorsunuz?</p>
        <small>Örneğin: “Cuma saat 17:00 kaş bakımı”</small>
      </div>
      <form onSubmit={ask} className="assistant-input">
        <Input
          aria-label="Asistana sor"
          required
          minLength={3}
          maxLength={500}
          placeholder="Cuma saat 17:00 kaş bakımı için yer var mı?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="button primary" disabled={busy} aria-label="Uygun saatleri bul">
          {busy ? <Busy /> : <Send size={17} />}
        </button>
      </form>
      {answer && (
        <div className="assistant-result">
          <div className="assistant-answer">
            <MessageSquare size={18} />
            <p>{answer.message}</p>
          </div>
          {answer.slots?.length > 0 && (
            <>
              <p className="helper">
                {dateLabel(answer.date)} · {w.services.find((s: any) => s.id === answer.service_id)?.name}
              </p>
              <div className="assistant-slots">
                {answer.slots.map((s: any) => (
                  <button
                    className="button"
                    key={s.time + s.staff_id}
                    onClick={() => onBook({ service_id: answer.service_id, date: answer.date, slot: s })}
                  >
                    <span>
                      {s.time}
                      <small>{s.staff_name}</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
      <p className="helper">
        {w.preview
          ? 'Örnek sonuçlar gösterilir.'
          : 'Saatler gerçek müsaitlikten bulunur; seçimden sonra bilgilerinizi onaylamanız gerekir.'}
      </p>
    </Modal>
  );
}
