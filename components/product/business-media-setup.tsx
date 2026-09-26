"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ImageIcon, ShieldCheck, Trash2, Upload } from "lucide-react";
import PaymentOnboarding from "./payment-onboarding";
import { PublicShell } from "./public";
import { AccountGate } from "./session";
import { Busy } from "./common";
import styles from "./business-media-setup.module.css";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 680_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Görsel hazırlanamadı."))),
      "image/jpeg",
      quality,
    );
  });
}

async function prepareImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("JPG, PNG veya WebP fotoğraf seçin.");
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error("En fazla 8 MB boyutunda bir fotoğraf seçin.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Fotoğraf okunamadı.");

    const maxWidth = 1280;
    const maxHeight = 800;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Fotoğraf hazırlanamadı.");
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    let blob = await canvasBlob(canvas, 0.82);
    if (blob.size > MAX_UPLOAD_BYTES) blob = await canvasBlob(canvas, 0.66);
    if (blob.size > MAX_UPLOAD_BYTES) {
      const reduced = document.createElement("canvas");
      reduced.width = Math.max(1, Math.round(canvas.width * 0.75));
      reduced.height = Math.max(1, Math.round(canvas.height * 0.75));
      const reducedCtx = reduced.getContext("2d", { alpha: false });
      if (!reducedCtx) throw new Error("Fotoğraf hazırlanamadı.");
      reducedCtx.fillStyle = "#0b1020";
      reducedCtx.fillRect(0, 0, reduced.width, reduced.height);
      reducedCtx.drawImage(canvas, 0, 0, reduced.width, reduced.height);
      blob = await canvasBlob(reduced, 0.68);
    }
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("Fotoğraf hâlâ çok büyük. Başka bir fotoğraf seçin.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readError(response: Response) {
  try {
    const data = await response.json();
    return data?.error || "Görsel yüklenemedi.";
  } catch {
    return "Görsel yüklenemedi.";
  }
}

export default function BusinessMediaSetup() {
  const [continueSetup, setContinueSetup] = useState(false);
  const [checking, setChecking] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/v1/business-image/pending", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        setSaved(!!result.has_image);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function chooseFile(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const blob = await prepareImage(file);
      const response = await fetch("/api/v1/business-image/pending", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      if (!response.ok) throw new Error(await readError(response));
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(blob));
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || "Görsel yüklenemedi.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeImage() {
    setUploading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/business-image/pending", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await readError(response));
      if (preview) URL.revokeObjectURL(preview);
      setPreview("");
      setSaved(false);
    } catch (e: any) {
      setError(e?.message || "Görsel kaldırılamadı.");
    } finally {
      setUploading(false);
    }
  }

  if (continueSetup) return <PaymentOnboarding />;

  return (
    <PublicShell>
      <main className={styles.page}>
        <AccountGate returnTo="/odeme">
          <section className={styles.shell}>
            <div className={styles.topline}>
              <span>İŞLETME KURULUMU</span>
              <span className={styles.step}>Görsel</span>
            </div>
            <div className={styles.heading}>
              <span className={styles.icon}><ImageIcon size={25} /></span>
              <div>
                <h1>İşletmenizi ilk bakışta gösterin.</h1>
                <p>Bu fotoğraf Neta Keşfet’te işletmenizin kapak görseli olarak kullanılır. Mekânı net gösteren yatay bir fotoğraf en iyi sonucu verir.</p>
              </div>
            </div>

            <div className={`${styles.uploadCard} ${saved ? styles.saved : ""}`}>
              {preview ? (
                <img className={styles.preview} src={preview} alt="Seçilen işletme görseli önizlemesi" />
              ) : saved ? (
                <div className={styles.savedState}>
                  <span><Check size={28} /></span>
                  <strong>İşletme görseliniz hazır</strong>
                  <p>Daha önce seçtiğiniz fotoğraf ödeme tamamlanınca yeni işletmenize otomatik bağlanacak.</p>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span><Upload size={30} /></span>
                  <strong>Kapak fotoğrafı ekleyin</strong>
                  <p>JPG, PNG veya WebP · sistem fotoğrafı otomatik olarak web için küçültür.</p>
                </div>
              )}
              <input
                ref={fileRef}
                className={styles.fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />
              <div className={styles.actions}>
                <button type="button" className="button primary" disabled={uploading || checking} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Busy /> : <Upload size={17} />}
                  {saved ? "Fotoğrafı değiştir" : "Fotoğraf seç"}
                </button>
                {saved && (
                  <button type="button" className="button" disabled={uploading} onClick={removeImage}>
                    <Trash2 size={16} /> Kaldır
                  </button>
                )}
              </div>
            </div>

            <div className={styles.note}>
              <ShieldCheck size={18} />
              <span>Yüklenen dosya türü ve boyutu sunucuda tekrar doğrulanır. Fotoğraf ödeme tamamlanmadan herkese açık hâle gelmez.</span>
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            <div className={styles.footer}>
              <button type="button" className="text-button" disabled={uploading} onClick={() => setContinueSetup(true)}>
                {saved ? "Kuruluma devam et" : "Şimdilik atla"}
              </button>
              <button type="button" className="button primary" disabled={uploading || checking} onClick={() => setContinueSetup(true)}>
                Devam et <ArrowRight size={17} />
              </button>
            </div>
          </section>
        </AccountGate>
      </main>
    </PublicShell>
  );
}
