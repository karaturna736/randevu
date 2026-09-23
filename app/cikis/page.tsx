'use client';
import {useEffect,useState} from 'react';
export default function SignOut(){const [error,setError]=useState('');useEffect(()=>{fetch('/api/auth/signout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(async r=>{if(!r.ok)throw Error();const data=await r.json() as {redirect:string};location.assign(data.redirect)}).catch(()=>setError('Çıkış tamamlanamadı. Sayfayı yenileyerek tekrar deneyin.'))},[]);return <main className="legal-page"><h1>{error||'Güvenli çıkış yapılıyor…'}</h1></main>}
