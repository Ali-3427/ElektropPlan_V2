# IEC 60364-5-52 — Hesap Motoru Veri Referansı

> Bu döküman `calculation-data` paketinin `data.json` dosyalarını doldurmak için kullanılacak otoritatif kaynak verilerdir.  
> Kaynak: IEC 60364-5-52 (Tablo B.52.2, B.52.3, B.52.4, B.52.5, B.52.10, B.52.12, B.52.14, B.52.15, B.52.17, Ek E Tablo E.52.1)

---

## 1. Kurulum Metodu Seti (Frozen)

```
{A1, A2, B1, B2, C, D, E}
```

| Kod | Açıklama |
|-----|----------|
| A1 | Isı yalıtımlı duvar, boru içi (tek damarlı) |
| A2 | Isı yalıtımlı duvar, boru içi (çok damarlı) |
| B1 | Ahşap/Tuğla duvar, boru içi (tek damarlı) |
| B2 | Ahşap duvar, çok damarlı kablo |
| C  | Yüzeyde, sıva üstü |
| D  | Toprak altı, künk/boru içi |
| E  | Havada, delikli kablo tavasında |

---

## 2. Bakır (Cu) İletken Akım Taşıma Kapasiteleri (A)

**Koşullar:** XLPE/EPR yalıtım (90°C), 3 yüklü iletken, trifaze.  
**Referans sıcaklık:** Havada 30°C, toprakta 20°C.  
**PVC (70°C) tahmini:** Bu değerlerin yaklaşık %15–20 altında.

Kaynak: Tablo B.52.3 (1.5–10 mm²) + Tablo B.52.5 / B.52.10 / B.52.12 (16–120 mm²)

| Kesit (mm²) | A1  | A2   | B1  | B2  | C   | D   | E   |
|-------------|-----|------|-----|-----|-----|-----|-----|
| 1.5         | 17  | 16.5 | 21  | 20  | 24  | 26  | 23  |
| 2.5         | 23  | 22   | 28  | 26  | 32  | 34  | 32  |
| 4           | 30  | 29   | 37  | 35  | 42  | 44  | 42  |
| 6           | 39  | 37   | 47  | 44  | 54  | 56  | 54  |
| 10          | 52  | 51   | 64  | 60  | 75  | 75  | 75  |
| 16          | 61  | 58   | 73  | 68  | 80  | 74  | 100 |
| 25          | 80  | 77   | 95  | 89  | 105 | 95  | 127 |
| 35          | 99  | 96   | 117 | 109 | 130 | 113 | 158 |
| 50          | 119 | 117  | 141 | 130 | 158 | 134 | 192 |
| 70          | 151 | 149  | 179 | 164 | 200 | 163 | 246 |
| 95          | 182 | 180  | 216 | 197 | 241 | 193 | 298 |
| 120         | 210 | 208  | 249 | 227 | 278 | 220 | 346 |

---

## 3. Alüminyum (Al) İletken Akım Taşıma Kapasiteleri (A)

**Koşullar:** XLPE/EPR yalıtım (90°C), 3 yüklü iletken, trifaze.  
**Minimum standart kesit:** 16 mm² (mekanik nedenlerle). 10 mm² özel uygulamalar için tanımlanmıştır.  
**1.5–6 mm² Al:** Standart tablolarda bulunmaz — bu aralıkta bakır kullanılmalıdır (UI uyarısı gerekli).  
**Referans sıcaklık:** Havada 30°C, toprakta 20°C.

Kaynak: Tablo B.52.3 / B.52.5 (10 mm²) + B.52.10 / B.52.12 (16–120 mm²)

| Kesit (mm²) | A1  | A2  | B1  | B2  | C   | D   | E   |
|-------------|-----|-----|-----|-----|-----|-----|-----|
| 10          | 40  | 39  | 49  | 46  | 58  | 57  | —   |
| 16          | 47  | 45  | 56  | 53  | 62  | 57  | 78  |
| 25          | 62  | 59  | 73  | 69  | 82  | 73  | 99  |
| 35          | 77  | 73  | 89  | 83  | 101 | 87  | 122 |
| 50          | 93  | 89  | 108 | 99  | 122 | 104 | 148 |
| 70          | 118 | 113 | 137 | 125 | 155 | 126 | 191 |
| 95          | 142 | 137 | 165 | 150 | 187 | 150 | 232 |
| 120         | 164 | 159 | 191 | 174 | 216 | 171 | 270 |

**UI kuralı:** Kullanıcı 1.5–6 mm² + Alüminyum seçerse → `"Standart dışı kombinasyon: Bu kesit aralığında alüminyum iletken IEC 60364-5-52 tablolarında tanımlı değildir. Bakır iletken veya ≥16 mm² alüminyum kullanınız."` uyarısı gösterilmeli.

---

## 4. Sıcaklık Düzeltme Faktörleri

### 4a. Havada Kurulum — Tablo B.52.14 (Referans: 30°C)

| Ortam Sıcaklığı (°C) | PVC 70°C (kT) | XLPE/EPR 90°C (kT) |
|-----------------------|---------------|---------------------|
| 20                    | 1.12          | 1.08                |
| 30                    | 1.00          | 1.00                |
| 40                    | 0.87          | 0.91                |
| 50                    | 0.71          | 0.82                |

### 4b. Toprak Altı Kurulum — Tablo B.52.15 (Referans: 20°C)

| Toprak Sıcaklığı (°C) | PVC 70°C (kT) | XLPE/EPR 90°C (kT) |
|------------------------|---------------|---------------------|
| 10                     | 1.10          | 1.07                |
| 15                     | 1.05          | 1.04                |
| 20                     | 1.00          | 1.00                |
| 25                     | 0.95          | 0.96                |
| 30                     | 0.89          | 0.93                |
| 35                     | 0.84          | 0.89                |
| 40                     | 0.77          | 0.85                |
| 45                     | 0.71          | 0.80                |
| 50                     | 0.63          | 0.76                |
| 55                     | 0.55          | 0.71                |

> **Uygulama kuralı:** Metot D → Tablo B.52.15. Diğer tüm metotlar → Tablo B.52.14.

---

## 5. Gruplama Düzeltme Faktörleri (kG) — Tablo B.52.17

Tek katmanlı, delikli kablo tavasında birden fazla devre.

| Kablo / Devre Sayısı | kG   |
|----------------------|------|
| 1                    | 1.00 |
| 2                    | 0.88 |
| 3                    | 0.82 |
| 4                    | 0.77 |
| 6                    | 0.73 |

> **Not:** 6'dan fazla devre için ek faktörler tam IEC tablosundan alınmalıdır.

---

## 6. Harmonik Düzeltme Faktörleri (kH) — Ek E, Tablo E.52.1

Trifaze 4/5 damarlı sistemlerde 3. harmonik ve tek katları (9, 15, ...) nötr akımını artırır.

| 3. Harmonik Oranı (%) | Faz Akımına Göre kH | Nötr Akımına Göre kH |
|-----------------------|---------------------|----------------------|
| 0 – 15                | 1.00                | — (dikkate alınmaz)  |
| 15 – 33               | 0.86                | — (dikkate alınmaz)  |
| 33 – 45               | — (dikkate alınmaz) | 0.86                 |
| > 45                  | — (dikkate alınmaz) | 1.00                 |

**Algoritma notu:**

- Harmonik oranı **≤ 33%** → kablo kesiti **faz akımı (Ib)** üzerinden seçilir, `kH` faz tarafına uygulanır.
- Harmonik oranı **> 33%** → nötr iletken faz iletkenlerinden daha fazla akım taşır. Hesapta kullanılacak akım:

```
I_N = Ib × (harmonik_oran / 100) × 3
```

Kablo kesiti `I_N` üzerinden seçilir; `kH` nötr tarafına uygulanır. Faz katsayısı (`kH` faz) dikkate alınmaz.

---

## 7. Gerilim Düşümü Referans Değerleri

**IEC 60364-5-52 Ek G formülü:**

```
u = b × (ρ₁ × L/S × cosφ + λ × L × sinφ) × Ib
```

| Parametre | Değer |
|-----------|-------|
| b (3 faz) | √3 |
| b (1 faz) | 2 |
| ρ₁ — bakır 70°C PVC tam yük | ≈ 0.0225 Ω·mm²/m |
| ρ₁ — bakır 90°C XLPE tam yük | ≈ 0.0230 Ω·mm²/m |
| λ (AC reaktans fallback) | 0.08 mΩ/m = 0.00008 Ω/m |
| sinφ | √(1 − cos²φ) ile hesaplanır; max(0, …) guard zorunlu |

**Yüzde gerilim düşümü:**

```
ΔU% = 100 × u / U₀
```

- Trifaze 400V sistemde: `U₀ = 230V` (faz-nötr)
- İzin verilen limitler: Aydınlatma %3, Güç devreleri %5 (default)

---

## 8. Kablo Kesit Seçim Mantığı (Özet)

```
Iz_req = Ib / (kT × kG × kH)
```

Tablodaki Iz değeri `Iz_req`'yi karşılayana kadar kesit artar (ascending scan).  
Ayrıca her adayda VD% limiti de kontrol edilir — her iki koşul sağlanana kadar bir üst kesite geçilir.

**`S = Ib / J` (J_ref = Cu: 4 A/mm², Al: 2.5 A/mm²):** sadece ön tahmin (preliminary hint), asla final seçim değildir.

---

## 9. Uygulama Notları

**PVC (70°C) dönüşümü:** XLPE değerleri `× 0.78–0.82` ile tahmin edilebilir. Tercih: ilgili PVC tablosundan doğrudan okunmalı (B.52.2, B.52.4).

**Metot D — toprak tipi farkı:** Tablodaki D değerleri künk/boru içi varsayımıyla verilmiştir. Doğrudan toprağa gömülü kablo ~%10 daha yüksek taşıyabilir; ancak endüstriyel uygulamalarda tablo değeri (künk) baz alınır.

---

## 10. JSON Dosya Yapısı Şablonu

Her `data.json` dosyası şu metadata yapısını taşımalıdır:

```json
{
  "metadata": {
    "id": "<unique-id>",
    "standard": "IEC 60364-5-52",
    "revision": "v1",
    "source": "<tablo referansı, örn. Table B.52.14>",
    "validFrom": "2026-04-19",
    "notes": "<varsa ek not>"
  },
  "entries": [ ... ]
}
```

Loader eksik `id` veya `standard` alanında throws.
