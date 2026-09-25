# Neta yük testi

Bu dosya production kodunu değiştirmez. GitHub Actions'taki kontrollü yük testi adımını tetiklemek ve kapsamını belgelemek için tutulur.

Güncel ağır senaryo: 250 ayrı oturum / istemci; eşzamanlı panel okuma, 250 benzersiz randevu oluşturma ve iptal, aynı saate 250 eşzamanlı rezervasyon çakışması, 250 borç kaydı ve tahsilat, aynı borca 250 eşzamanlı tahsilat çakışması ve tüm oturumlarda veri görünürlüğü.

Test, canlı veritabanına yazmak yerine SQLite backup API ile alınan geçici bir kopyada ve ayrı bir localhost Node sürecinde çalışır. Gerçek ödeme sağlayıcısına istek göndermez.
