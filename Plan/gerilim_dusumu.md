## formüller 
kW üzerinden gerilim düşümü hesabında doğru akış şu olmalı: kullanıcı güç kW, hat uzunluğu metre, seçilen kablo kesiti mm², faz tipi, gerilim, cosφ, iletken malzemesi, kablo tipi/izolasyon ve kurulum şekli: toprak veya hava seçer; sistem önce kW’dan tasarım akımını bulur, sonra seçilen kablo kesiti için gerilim düşümünü hesaplar. Burada kritik nokta şu: toprak/hava kurulumu gerilim düşümü formülünün ana matematiğini değiştirmez; asıl etkisi kablonun izin verilen akım taşıma kapasitesi, ortam/toprak sıcaklığı, gruplama, döşeme yöntemi ve kablo çalışma sıcaklığı üzerinden seçilen kesitin uygunluğunu değiştirir. Nexans’ın EasyCalc açıklamasında da hesap girişleri arasında kW/kVA veya akım, kablo uzunluğu, voltaj/faz bilgisi ve “above ground / underground” kurulum yöntemi birlikte alınır; yani yazılım mantığında bunlar ayrı ama bağlantılı parametrelerdir.

Hesap adımı	Formül	Açıklama
3 faz kW → akım	I = (P_kW × 1000) / (√3 × U_LL × cosφ × η)	Motor/yük 3 faz ise kullanılır. U_LL faz-faz gerilimidir; Türkiye’de genelde 400 V alınır. η verim bilinmiyorsa 1 alınabilir ama motorlarda doğru sonuç için verim girilmelidir.
1 faz kW → akım	I = (P_kW × 1000) / (U × cosφ × η)	Tek faz yüklerde kullanılır.
3 faz gerilim düşümü, detaylı	ΔV = √3 × I × L × (R × cosφ + X × sinφ)	Dengeli 3 faz AC devre için kullanılır. R ve X kablonun Ω/m değeridir. IEC 60364-5-52 yaklaşımında güç faktörü 0,8’den büyük dengeli devreler için yaklaşık gerilim düşümü hesabı kullanılabilir.
1 faz gerilim düşümü, detaylı	ΔV = 2 × I × L × (R × cosφ + X × sinφ)	Gidiş-dönüş iletkeni hesaba katıldığı için katsayı 2’dir.
mV/A/m katalog yöntemi	ΔV = (mV/A/m × I × L) / 1000	En pratik uygulama budur. Üretici kataloglarında her kesit için verilen mV/A/m değeri kullanılır. Eland Cables bu formülü doğrudan Vd = mV/A/m × length × Ib / 1000 olarak verir.
Yüzde gerilim düşümü	%ΔV = (ΔV / U_nominal) × 100	3 fazda genelde U_nominal = 400 V; tek fazda 230 V.
Kablo direnci, yaklaşık	R20 = ρ / S	ρ bakır için yaklaşık 0.01724 Ω·mm²/m, alüminyum için yaklaşık 0.02825 Ω·mm²/m; S kablo kesiti mm². Bu yöntem katalog yoksa yaklaşık hesap içindir.
Sıcaklık düzeltmeli direnç	R_T = R20 × [1 + α × (T - 20)]	Kablo ısındıkça direnç ve gerilim düşümü artar. Bakır için sıcaklık katsayısı yaklaşık 0.00393 / °C, alüminyum için yaklaşık 0.00403 / °C verilir.
Kabul kontrolü	%ΔV ≤ limit	IEC 60364-5-52 tablosuna göre alçak gerilim tesisatlarında tipik sınır kamu AG beslemede aydınlatma için %3, diğer kullanımlar için %5; özel AG beslemede %6 / %8 olarak verilir.

Kod tarafında en sağlam yöntem şu olur: kullanıcı kW girerse önce akımı hesapla; kullanıcı kablo kesiti seçerse o kesitin katalogdan gelen mV/A/m değerini kullanarak ΔV = mV/A/m × I × L / 1000 ile volt cinsinden düşümü bul; sonra %ΔV hesabıyla sonucu sınırla karşılaştır. Eğer katalog datası yoksa ikinci seviye hesap olarak R = ρ/S ve sıcaklık düzeltmesiyle detaylı formülü kullan. Toprak/hava seçimi ise aynı ekranda mutlaka bulunmalı ama gerilim düşümünden önce akım taşıma kapasitesi validasyonu için kullanılmalı: hava döşemede ortam sıcaklığı ve gruplama, toprak döşemede toprak sıcaklığı, toprak ısıl direnci, gömülme derinliği ve kablolar arası mesafe kesit uygunluğunu değiştirir. Yani uygulama mantığı “kW → akım → seçilen kesitin döşeme tipine göre akım taşıma uygunluğu → gerilim düşümü → yüzde limit kontrolü” şeklinde kurulmalı.

## proje yapısı özeti
Gerilim düşümü sayfası hesapları UI’da değil, çekirdek hesap paketinde yapılıyor. Sayfa apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx içinden bridge’e çağrı atıyor; bu çağrı main process’te apps/desktop/main/src/services/calculate-service.ts üzerinden calculateVoltageDrop(...) fonksiyonuna gidiyor. Asıl hesap motoru packages/calculation-core/src/voltage-drop/index.ts, formüller packages/calculation-core/src/voltage-drop/formulas.ts, kW -> akım dönüşümü de packages/calculation-core/src/voltage-drop/power-to-current.ts içinde.



Kablo kesiti hesabı ayrı modülde. Giriş noktası packages/calculation-core/src/cable/index.ts, ana algoritma packages/calculation-core/src/cable/algorithm.ts. Ama tamamen bağımsız değil; kablo kesiti algoritması aday kesitleri denerken aynı gerilim düşümü motorunu içerden çağırıyor: packages/calculation-core/src/cable/algorithm.ts. Yani gerilim düşümü modülünü değiştirirsek hem gerilim düşümü sayfası hem de kablo kesiti seçimindeki vdPass mantığı etkilenir.



Kısa sonuç: dosyalar farklı, paket aynı, hesap motoru paylaşımlı. Gerilim düşümü modülünü değiştirirken kablo kesiti modülüne etkisini birlikte kontrol etmemiz gerekecek.
