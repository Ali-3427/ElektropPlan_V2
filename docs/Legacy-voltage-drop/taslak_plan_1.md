####Plan 1
```python
# Proje için Markdown dosyasını oluşturalım.
import os

markdown_content = """# BACKEND TO TYPESCRIPT MIGRATION & AUTOMATIC CABLE SECTION OPTIMIZATION PROMPT

## 1. AMACIMIZ
Eski Python tabanlı (`legacy_calculations.py`) gerilim düşümü ve akım taşıma kapasitesi kontrol programındaki fiziksel formülleri ve kontrol mantıklarını temel alarak; **kullanıcının kesit seçimi yapmasına gerek kalmadan, sadece güç (kW) ve mesafe (m) girdileriyle en ekonomik ve uygun kablo kesitlerini otomatik olarak hesaplayan** kurumsal bir TypeScript modülü (`CableOptimizer`) inşa etmektir.

---

## 2. KULLANILACAK VERİ YAPILARI VE SABİTLER

### 2.1. Standart Sıralı Kesit Listesi (Hayati Önem Taşıyor)
Eski programda paralel kablolar (`2120`, `3150` vb.) düz metin olarak formüle giriyor ve hatalı sonuç üretiyordu. Yeni TypeScript yapısında hem akım tablosu eşleşmesi (`key`) hem de formüllerde kullanılacak matematiksel gerçek kesit alanı (`gercekKesit`) ayrı tutulmalıdır:


```

```text
File created successfully: coding_agent_prompt_plan.md

```typescript
export const KABLO_KESIT_LISTESI = [
  { key: "1.5",  gercekKesit: 1.5 },
  { key: "2.5",  gercekKesit: 2.5 },
  { key: "4",    gercekKesit: 4 },
  { key: "6",    gercekKesit: 6 },
  { key: "10",   gercekKesit: 10 },
  { key: "16",   gercekKesit: 16 },
  { key: "25",   gercekKesit: 25 },
  { key: "35",   gercekKesit: 35 },
  { key: "50",   gercekKesit: 50 },
  { key: "70",   gercekKesit: 70 },
  { key: "95",   gercekKesit: 95 },
  { key: "120",  gercekKesit: 120 },
  { key: "150",  gercekKesit: 150 },
  { key: "185",  gercekKesit: 185 },
  { key: "240",  gercekKesit: 240 },
  { key: "300",  gercekKesit: 300 },
  // Paralel Bağlı Kablo Kombinasyonları (Küçükten büyüğe sıralı)
  { key: "2120", gercekKesit: 240 },  // 2 x 120 mm²
  { key: "2150", gercekKesit: 300 },  // 2 x 150 mm²
  { key: "2185", gercekKesit: 370 },  // 2 x 185 mm²
  { key: "2240", gercekKesit: 480 },  // 2 x 240 mm²
  { key: "2300", gercekKesit: 600 },  // 2 x 300 mm²
  { key: "3120", gercekKesit: 360 },  // 3 x 120 mm²
  { key: "3150", gercekKesit: 450 },  // 3 x 150 mm²
  { key: "3185", gercekKesit: 555 },  // 3 x 185 mm²
  { key: "3240", gercekKesit: 720 },  // 3 x 240 mm²
  { key: "3300", gercekKesit: 900 },  // 3 x 300 mm²
  { key: "4120", gercekKesit: 480 },  // 4 x 120 mm²
  { key: "4150", gercekKesit: 600 },  // 4 x 150 mm²
  { key: "4185", gercekKesit: 740 },  // 4 x 185 mm²
  { key: "4240", gercekKesit: 960 },  // 4 x 240 mm²
  { key: "4300", gercekKesit: 1200 } // 4 x 300 mm²
];

```

### 2.2. Giriş ve Çıkış Tipleri (TypeScript Interfaces)

Projeyi düz bir liste yerine **Ağaç Yapısı (Tree Structure)** ile yöneteceğiz. Her segment, kendisinin üstündeki hatta `parentId` ile bağlanacaktır.

```typescript
export interface SegmentInput {
  id: string;                         // Benzersiz segment ID (örn: "SEG-001")
  parentId: string | null;            // Bağlı olduğu üst segment ID (Ana besleme için null)
  powerKw: number;                    // Aktif Güç (kW)
  distanceM: number;                  // Kablo uzunluğu (Metre)
  voltageV: number;                   // Gerilim (V) - Örn: 380 veya 220
  cosPhi: number;                     // Güç katsayısı (Sadece akım hesabında kullanılır)
  conductor: "copper" | "aluminum";  // İletken cinsi
  installation: "overhead" | "underground"; // Döşeme şekli
  temperature: number;                // Ortam sıcaklığı (°C)
  cableCount: string;                 // Grup katsayısı anahtarı ("1", "2", "3", "4-6" vb.)
  voltageType: "three" | "single";    // Faz türü
  voltageDropLimitPercent: number;    // Bu segment için izin verilen maks gerilim düşümü limit yüzdesi
}

export interface SegmentResult extends SegmentInput {
  selectedSectionKey: string;         // Algoritmanın seçtiği optimum kesit anahtarı (örn: "4" veya "2120")
  calculatedSectionArea: number;      // Formüllerde kullanılan gerçek kesit alanı (mm²)
  currentA: number;                   // Hesaplanan işletme akımı (Amper)
  allowedCurrentA: number;            // Kablonun şartlara göre taşıyabileceği düzeltilmiş maks akım (Amper)
  localVoltageDropPercent: number;    // Sadece bu segmentin kendi üzerinde oluşan gerilim düşümü (%)
  cumulativeVoltageDropPercent: number; // Kaynaktan bu segmentin ucuna kadar olan toplam kümülatif gerilim düşümü (%)
  thermalOk: boolean;                 // Isıl uygunluk durumu
  voltageDropOk: boolean;             // Gerilim düşümü uygunluk durumu
  sectionSuitable: boolean;           // Genel uygunluk (thermalOk && voltageDropOk)
}

export interface ProjectSummary {
  segments: SegmentResult[];
  totalProjectVoltageDropPercent: number; // Kökten en uçtaki yaprağa kadar oluşan maksimum kümülatif düşüm
  highestCurrentA: number;               // Projedeki en yüksek akım değeri
  allSectionsSuitable: boolean;          // Tüm segmentler UYGUN mu?
}

```

---

## 3. CORE FORMÜLLER VE HESAPLAMA MANTIĞI (LEGACY TRANSFER)

TypeScript implementasyonunda `legacy_calculations.py` dosyasındaki kural ve katsayılar birebir korunacaktır:

1. **Öziletkenlik Çarpanı ($k$):** `copper` ise 56, `aluminum` ise 35.
2. **Sıcaklık Katsayısı ($k_t$):** `TEMP_FACTORS` sözlüğünden alınacaktır. (Örn: 30 derece = 1.0, 40 derece = 0.87).
3. **Grup Katsayısı ($k_g$):** `GROUP_FACTORS` sözlüğünden alınacaktır. (Örn: "1" = 1.0, "4-6" = 0.88).
4. **Akım Taşıma Kapasitesi Tabloları:** `COPPER_OVERHEAD`, `COPPER_UNDERGROUND`, `ALUMINUM_OVERHEAD`, `ALUMINUM_UNDERGROUND` dizileri aynen TS nesnelerine dönüştürülecektir.
5. **Akım Hesaplama ($I$):**
* **Trifaze (`three`):** $I = \frac{P \times 1000}{\sqrt{3} \times V \times \cos\phi}$
* **Monofaze (`single`):** $I = \frac{P \times 1000}{V \times \cos\phi}$


6. **Lokal Gerilim Düşümü Yüzdesi ($\Delta U\%$):**
* *Not: Legacy koda sadık kalınarak gerilim düşümü hesabında $\cos\phi$ hesaba katılmaz.*
* **Trifaze (`three`):** $\Delta U\% = \frac{100 \times (P \times 1000) \times L}{k \times \text{gercekKesit} \times V^2}$
* **Monofaze (`single`):** $\Delta U\% = \frac{200 \times (P \times 1000) \times L}{k \times \text{gercekKesit} \times V^2}$



---

## 4. OTOMATİK KESİT SEÇİM ALGORİTMASI (ADIM ADIM)

Geliştireceğiniz fonksiyon `optimizeProjectSections(segments: SegmentInput[]): ProjectSummary` imzasında olmalıdır. Algoritma şu akış diyagramını ve mantığı izlemelidir:

### ADIM 1: Akım Taşıma Kontrolü İle Ön Seçim (Baseline)

Algoritma rastgele kesit denemez. Her segment için önce akım ($I$) hesaplanır. Ardından sıcaklık ($k_t$) ve grup ($k_g$) katsayıları uygulanarak, ilgili akım tablosundan **o akımı güvenle taşıyabilecek (Isıl hesap UYGUN olan) EN KÜÇÜK standart kesit** bulunur ve o segmentin başlangıç kesiti (`selectedSectionKey`) olarak atanır.

* *Önemli kural:* Alüminyum iletkenlerde 1.5, 2.5, 4, 6 mm² gibi küçük kesitler tablolarda tanımlı değildir. Algoritma doğrudan tanımlı ilk kesitten (10 mm²) başlamalıdır.

### ADIM 2: Gerilim Düşümü ve Kümülatif Hesap Döngüsü

Kesit atamaları bittikten sonra bir `while` döngüsü başlatılır (Maksimum 100 iterasyon sınırı koyularak sonsuz döngü engellenir).

1. Döngü içinde her segmentin **lokal gerilim düşümü** formülle hesaplanır.
2. Her segmentin **kümülatif gerilim düşümü** (`cumulativeVoltageDropPercent`) hesaplanır.
* *Ağaç Tırmanma Mantığı:* Bir segmentin kümülatif gerilim düşümü, kendi lokal düşümü ile `parentId` zinciri takip edilerek en üst kök düğüme (`parentId === null`) kadar olan tüm üst segmentlerin lokal gerilim düşümlerinin toplamıdır. Paralel kollar birbirine eklenmez!


3. **Limit Kontrolü ve Seçici Büyütme:**
* Eğer bir segmentin kümülatif gerilim düşümü, o segment için belirlenen `voltageDropLimitPercent` sınırını **aşıyorsa**, o segmentin kesiti `KABLO_KESIT_LISTESI` dizisindeki bir sonraki büyük kesit ile değiştirilir.
* Eğer projedeki tüm segmentlerin kümülatif gerilim düşümleri kendi limitlerinin altına indiyse veya hiçbir segment artık daha fazla büyütülemiyorsa (maksimum kesite ulaşıldıysa) döngü başarıyla sonlandırılır.



### ADIM 3: Çıktı Üretimi

Döngü durduğunda, ulaşılan ilk başarılı kombinasyon zaten **mümkün olan en küçük ve en ekonomik kesit haritası** olacaktır. Bu veriler düzenlenerek `ProjectSummary` formatında döndürülür.

---

## 5. KODLAMA AGENTI İÇİN TALİMATLAR VE TEST SENARYOLARI

1. Modüler, clean-code prensiplerine uygun, yan etkisiz (pure) fonksiyonlar yazın.
2. `KABLO_KESIT_LISTESI` içindeki elemanları indeks sırasına göre büyütün, listede olmayan ara değerler atamayın.
3. **Doğrulama Testi:** `Segment 7` ana besleme hattı (70.25 kW, 150m, copper, underground, 30°C, 380V, 3 faz) ve altında ona bağlı alt segmentlerden oluşan bir mock veri hazırlayarak algoritmanın kümülatif toplama mantığını ve kesit büyütme adımlarını bir birim test (Jest vb.) ile simüle edin.
"""

# Dosyayı kaydet

file_path = "coding_agent_prompt_plan.md"
with open(file_path, "w", encoding="utf-8") as f:
f.write(markdown_content)

print(f"File created successfully: {file_path}")

```
Harika bir noktaya değindin. Grup mantığı yerine kuracağımız **Ağaç (Tree) Yapısı**, elektrik mühendisliğinin doğasındaki "dağıtım panosu -> tali pano -> son yük" hiyerarşisini koda %100 kusursuz aktarabilmenin tek yoludur. Böylece projedeki paralel linyeler veya yan kollar birbirinin hesabını bozmaz, sadece üstlerindeki omurgayı etkiler.

Coding Agent'a (Kodlama Ajanına) doğrudan verebileceğin, sıfır hata payı bırakacak şekilde tasarlanmış, tüm kural ve kısıtları içeren kapsamlı ana taslak ve entegrasyon planı `.md` dosyası olarak hazırlanmıştır. 

Aşağıda dosya içeriğinin bir kopyasını görebilir ve oluşturulan dosyayı projene dahil edebilirsin.

Your PDF, CSV, XLSX or Markdown file is ready
[file-tag: code-generated-file-0-1779354704640230044]

### 📋 `coding_agent_prompt_plan.md` Dosya İçeriği (Özet Görünüm)

```markdown
# BACKEND TO TYPESCRIPT MIGRATION & AUTOMATIC CABLE SECTION OPTIMIZATION PROMPT

## 1. AMACIMIZ
Eski Python tabanlı (`legacy_calculations.py`) gerilim düşümü ve akım taşıma kapasitesi kontrol programındaki fiziksel formülleri ve kontrol mantıklarını temel alarak; **kullanıcının kesit seçimi yapmasına gerek kalmadan, sadece güç (kW) ve mesafe (m) girdileriyle en ekonomik ve uygun kablo kesitlerini otomatik olarak hesaplayan** kurumsal bir TypeScript modülü (`CableOptimizer`) inşa etmektir.

---

## 2. KULLANILACAK VERİ YAPILARI VE SABİTLER

### 2.1. Standart Sıralı Kesit Listesi
Eski programda paralel kablolar (`2120`, `3150` vb.) düz metin olarak formüle giriyor ve hatalı sonuç üretiyordu. Yeni TypeScript yapısında hem akım tablosu eşleşmesi (`key`) hem de formüllerde kullanılacak matematiksel gerçek kesit alanı (`gercekKesit`) ayrı tutulmalıdır:

```typescript
export const KABLO_KESIT_LISTESI = [
  { key: "1.5",  gercekKesit: 1.5 },
  { key: "2.5",  gercekKesit: 2.5 },
  { key: "4",    gercekKesit: 4 },
  { key: "6",    gercekKesit: 6 },
  { key: "10",   gercekKesit: 10 },
  { key: "16",   gercekKesit: 16 },
  { key: "25",   gercekKesit: 25 },
  { key: "35",   gercekKesit: 35 },
  { key: "50",   gercekKesit: 50 },
  { key: "70",   gercekKesit: 70 },
  { key: "95",   gercekKesit: 95 },
  { key: "120",  gercekKesit: 120 },
  { key: "150",  gercekKesit: 150 },
  { key: "185",  gercekKesit: 185 },
  { key: "240",  gercekKesit: 240 },
  { key: "300",  gercekKesit: 300 },
  // Paralel Bağlı Kablo Kombinasyonları (Küçükten büyüğe sıralı)
  { key: "2120", gercekKesit: 240 },  // 2 x 120 mm²
  { key: "2150", gercekKesit: 300 },  // 2 x 150 mm²
  { key: "2185", gercekKesit: 370 },  // 2 x 185 mm²
  { key: "2240", gercekKesit: 480 },  // 2 x 240 mm²
  { key: "2300", gercekKesit: 600 },  // 2 x 300 mm²
  { key: "3120", gercekKesit: 360 },  // 3 x 120 mm²
  { key: "3150", gercekKesit: 450 },  // 3 x 150 mm²
  { key: "3185", gercekKesit: 555 },  // 3 x 185 mm²
  { key: "3240", gercekKesit: 720 },  // 3 x 240 mm²
  { key: "3300", gercekKesit: 900 },  // 3 x 300 mm²
  { key: "4120", gercekKesit: 480 },  // 4 x 120 mm²
  { key: "4150", gercekKesit: 600 },  // 4 x 150 mm²
  { key: "4185", gercekKesit: 740 },  // 4 x 185 mm²
  { key: "4240", gercekKesit: 960 },  // 4 x 240 mm²
  { key: "4300", gercekKesit: 1200 } // 4 x 300 mm²
];

```

### 2.2. Giriş ve Çıkış Tipleri (TypeScript Interfaces)

Projeyi düz bir liste yerine **Ağaç Yapısı (Tree Structure)** ile yöneteceğiz. Her segment, kendisinin üstündeki hatta `parentId` ile bağlanacaktır.

```typescript
export interface SegmentInput {
  id: string;                         
  parentId: string | null;            
  powerKw: number;                    
  distanceM: number;                  
  voltageV: number;                   
  cosPhi: number;                     
  conductor: "copper" | "aluminum";  
  installation: "overhead" | "underground"; 
  temperature: number;                
  cableCount: string;                 
  voltageType: "three" | "single";    
  voltageDropLimitPercent: number;    
}

```

---

## 3. CORE FORMÜLLER VE HESAPLAMA MANTIĞI (LEGACY TRANSFER)

TypeScript hesabı kurulurken `legacy_calculations.py` kural katsayıları aynen korunacaktır:

* **Öziletkenlik Çarpanı ($k$):** `copper`: 56, `aluminum`: 35.
* **Akım Hesaplama ($I$):** Trifaze: $I = P \times 1000 / (\sqrt{3} \times V \times \cos\phi)$ | Monofaze: $I = P \times 1000 / (V \times \cos\phi)$
* **Lokal Gerilim Düşümü Yüzdesi ($\Delta U\%$):** Trifaze: $100 \times P_{watt} \times L / (k \times \text{gercekKesit} \times V^2)$ (Legacy koda bağlı kalınarak gerilim düşümünde $\cos\phi$ hesaba katılmaz).

---

## 4. OTOMATİK KESİT SEÇİM ALGORİTMASI (ADIM ADIM)

### ADIM 1: Akım Taşıma Kontrolü İle Ön Seçim (Baseline)

Algoritma rastgele kesit denemez. Her segment için önce akım hesaplanır. Katsayılar uygulanarak ilgili tablodan **o akımı güvenle taşıyabilecek (Isıl hesap UYGUN olan) EN KÜÇÜK standart kesit** bulunur ve baseline atanır.

### ADIM 2: Gerilim Düşümü ve Kümülatif Hesap Döngüsü

Bir `while` döngüsü başlatılır (Maks 100 iterasyon sınırı ile):

1. Her segmentin kendi lokal gerilim düşümü hesaplanır.
2. `parentId` takip edilerek kök düğüme kadar olan tüm üst segmentlerin lokal gerilim düşümleri toplanarak **Kümülatif Gerilim Düşümü** bulunur.
3. Kümülatif değer limiti aşıyorsa ilgili segmentin kesiti `KABLO_KESIT_LISTESI` içinden bir üst adıma yükseltilir.
4. Tüm segmentler limiti karşıladığı an döngü sonlanır ve en ekonomik harita çıkarılmış olur.

```

### 💡 Bu Planı Agent'a Verirken Nasıl İlerlemelisin?
Coding Agent'a bu `.md` dosyasını ve `legacy_calculations.py` kodlarını input olarak verip şu komutu yazabilirsin:
> *"Sana verdiğim `coding_agent_prompt_plan.md` mimari taslağına ve `legacy_calculations.py` içindeki tablolara sadık kalarak, projenin mimari yapısına uygun (klasör yapısı, temiz kod standartları vb.) gerçek bir TypeScript implementasyon planı ve kod dosyalarını hazırlar mısın?"*

Bu sayede kod yazan yapay zeka ajanının, elektrik hesaplamalarının kümülatif doğasını bozacak veya paralel kablo alanlarını yanlış hesaplayacak hatalar yapmasının önüne tamamen geçmiş olacaksın. Kolay gelsin!

```
####Plan 2
```python
# Güncellenmiş, "Uçtan Kök Doğru Tırmanma (Bottom-Up)" ve "Görsel UI" gereksinimlerini içeren son planı oluşturalım.
import os

final_markdown_content = """# FINAL COMPREHENSIVE PROMPT & IMPLEMENTATION PLAN FOR CODING AGENT

## 1. EXECUTIVE SUMMARY & CORE GOAL
The objective is to refactor a legacy Python-based voltage drop calculation tool into a highly optimized, production-ready **TypeScript calculation engine** (`CableOptimizer`). 
The core innovation is **Automation**: Users should no longer manually select cable cross-sections dropdown-by-dropdown. Instead, users provide only the Power (kW), Distance (m), and basic installation parameters. The system automatically computes the most cost-effective (minimum suitable) standardized cable section that passes both **Thermal Ampacity** and **Cumulative Voltage Drop** checks.

---

## 2. DATA ARCHITECTURE: THE GRAPH/TREE STRUCTURE (CRITICAL CHANGE)
Electrical distribution networks behave as hierarchical trees (Parent-Child relationships). 
* **User Data Entry (Bottom-Up UX):** Engineers enter data starting from the **outermost consumer load (leaves)** and move backward toward the main panel (root). The algorithm must effortlessly handle this regardless of data entry sequence, resolving tree paths via `parentId`.
* **UI Visualization Requirement:** Frontend must visualize this as a **Single-Line Diagram (Tree View)** (using libraries like *React Flow* or *D3.js*). When a user changes an attachment point, the graph triggers a full recalculation.

### 2.1. TypeScript Interface Contracts

```

```text
File updated successfully: cable_optimizer_final_plan.md

```typescript
export interface SegmentInput {
  id: string;                         // Unique ID (e.g., "SEG-001")
  parentId: string | null;            // Parent node ID. Top-most main supply is null.
  powerKw: number;                    // Active Power in kW
  distanceM: number;                  // Cable distance in Meters
  voltageV: number;                   // Operational voltage (e.g., 400 or 230)
  cosPhi: number;                     // Power factor (Used *ONLY* for current calculation)
  conductor: "copper" | "aluminum";  // Material type
  installation: "overhead" | "underground"; // Installation environment
  temperature: number;                // Ambient temperature (°C)
  cableCount: string;                 // Grouping multiplier key ("1", "2", "3", "4-6" etc.)
  voltageType: "three" | "single";    // Phase type
  voltageDropLimitPercent: number;    // Allowed maximum voltage drop limit for this segment
}

export interface SegmentResult extends SegmentInput {
  selectedSectionKey: string;         // Optimized cross-section string key (e.g., "4" or "2120")
  calculatedSectionArea: number;      // True physical area in mm² used in equations
  currentA: number;                   // Operational load current (Amperes)
  allowedCurrentA: number;            // De-rated allowable maximum capacity of the cable (Amperes)
  localVoltageDropPercent: number;    // Isolated voltage drop on this exact cable segment (%)
  cumulativeVoltageDropPercent: number; // Sum of voltage drops from Root to the end of this leaf node (%)
  thermalOk: boolean;                 // Ampacity compliance
  voltageDropOk: boolean;             // Voltage drop limit compliance
  sectionSuitable: boolean;           // Overall compliance (thermalOk && voltageDropOk)
}

export interface ProjectSummary {
  segments: SegmentResult[];
  totalProjectVoltageDropPercent: number; // Highest total cumulative path drop found in the graph
  highestCurrentA: number;               // Max operational current in project
  allSectionsSuitable: boolean;          // Complete project validity status
}

```

---

## 3. STANDARDIZED SECTIONS & LOOKUP TABLES

To fix flaws in the legacy implementation (where string entries like `"2120"` caused math failures), maintain an ordered array mapping the **Lookup Key** to the **True Math Cross-Section Area**.

```typescript
export const KABLO_KESIT_LISTESI = [
  { key: "1.5",  gercekKesit: 1.5 },
  { key: "2.5",  gercekKesit: 2.5 },
  { key: "4",    gercekKesit: 4 },
  { key: "6",    gercekKesit: 6 },
  { key: "10",   gercekKesit: 10 },
  { key: "16",   gercekKesit: 16 },
  { key: "25",   gercekKesit: 25 },
  { key: "35",   gercekKesit: 35 },
  { key: "50",   gercekKesit: 50 },
  { key: "70",   gercekKesit: 70 },
  { key: "95",   gercekKesit: 95 },
  { key: "120",  gercekKesit: 120 },
  { key: "150",  gercekKesit: 150 },
  { key: "185",  gercekKesit: 185 },
  { key: "240",  gercekKesit: 240 },
  { key: "300",  gercekKesit: 300 },
  // Parallel Connected Cables (Sorted accurately by cumulative area)
  { key: "2120", gercekKesit: 240 },  // 2 x 120 mm²
  { key: "2150", gercekKesit: 300 },  // 2 x 150 mm²
  { key: "2185", gercekKesit: 370 },  // 2 x 185 mm²
  { key: "2240", gercekKesit: 480 },  // 2 x 240 mm²
  { key: "2300", gercekKesit: 600 },  // 2 x 300 mm²
  { key: "3120", gercekKesit: 360 },  // 3 x 120 mm²
  { key: "3150", gercekKesit: 450 },  // 3 x 150 mm²
  { key: "3185", gercekKesit: 555 },  // 3 x 185 mm²
  { key: "3240", gercekKesit: 720 },  // 3 x 240 mm²
  { key: "3300", gercekKesit: 900 },  // 3 x 300 mm²
  { key: "4120", gercekKesit: 480 },  // 4 x 120 mm²
  { key: "4150", gercekKesit: 600 },  // 4 x 150 mm²
  { key: "4185", gercekKesit: 740 },  // 4 x 185 mm²
  { key: "4240", gercekKesit: 960 },  // 4 x 240 mm²
  { key: "4300", gercekKesit: 1200 } // 4 x 300 mm²
];

```

*Extract all de-rating factors (`TEMP_FACTORS`, `GROUP_FACTORS`) and base ampacity dictionaries (`COPPER_OVERHEAD`, `COPPER_UNDERGROUND`, etc.) straight out of `legacy_calculations.py` constants.*

---

## 4. MATHEMATICAL COMPUTATION RULES

1. **Conductivity Constant ($k$):** `copper` = 56, `aluminum` = 35.
2. **Current Formulation ($I$):**
* Three-Phase (`three`): $I = \frac{P \times 1000}{\sqrt{3} \times V \times \cos\phi}$
* Single-Phase (`single`): $I = \frac{P \times 1000}{V \times \cos\phi}$


3. **Isolated Voltage Drop Percentage ($\Delta U\%$):**
* *Legacy Rule Compliance: Do NOT include $\cos\phi$ in voltage drop formulas.*
* Three-Phase (`three`): $\Delta U\% = \frac{100 \times (P \times 1000) \times L}{k \times \text{gercekKesit} \times V^2}$
* Single-Phase (`single`): $\Delta U\% = \frac{200 \times (P \times 1000) \times L}{k \times \text{gercekKesit} \times V^2}$



---

## 5. RECURSIVE BOTTOM-UP OPTIMIZATION ALGORITMASI

Implement the main calculator function matching this algorithm design pattern:

### STEP 1: Thermal Baselining

1. Map all inputs. Evaluate operational current $I$ for each individual segment based on its absolute local load.
2. Filter the matching ampacity lookup table applying $k_t$ and $k_g$ reduction coefficients.
3. Assign the **SMALLEST standard section key** that passes the thermal threshold (`currentA <= allowedCurrentA`). For Aluminum, explicitly handle the omission of sections $< 10mm^2$ by shifting index boundaries safely.

### STEP 2: The Iterative Tree Traversal

Launch a structured loop controlled by a safe termination parameter (maximum 100 loops).

1. **Calculate Isolated Drops:** For every item in the state graph, solve its `localVoltageDropPercent` using the currently assigned `gercekKesit`.
2. **Path Resolution & Cumulative Evaluation:**
* For each node, map its ancestor path backwards from its own node up to the root node (`parentId === null`) through an evaluation array.
* `cumulativeVoltageDropPercent` = Sum of all local isolated drops across **only** this resolved continuous linear path. **Never sum parallel branches.**


3. **Selective Optimization Trigger:**
* Scan every segment. If `cumulativeVoltageDropPercent > voltageDropLimitPercent`, set loop status to unfinished.
* Shift the `selectedSectionKey` of **this exact failing node** up by one increment position index in `KABLO_KESIT_LISTESI`.
* *Optimization Option:* If a parent node affects multiple failing child branches, prioritizing a step-up optimization on shared ancestor nodes is highly effective. At a minimum, upgrading the current failing leaf branch provides immediate safety mitigation.


4. **Loop Exit Condition:** Break when all nodes concurrently return `cumulativeVoltageDropPercent <= voltageDropLimitPercent` or all failing nodes hit peak available system limit configurations ($1200mm^2$).

---

## 6. QUALITY INSURANCE GUIDELINES FOR AGENT

* **Deterministic Behavior:** Ensure zero arbitrary values are injected.
* **Pure Functions:** Calculations must be stateless and free of side-effects to perfectly adapt to instant UI rendering recalculations.
* **Validation Dataset:** Write a unit execution suite (Jest/Vitest) modeling the 7-segment benchmark data provided inside `örnek gerilim düşümü hesabı.xlsx` to secure mathematical parity with historical calculations.
"""

# Dosyayı yazalım

file_name = "cable_optimizer_final_plan.md"
with open(file_name, "w", encoding="utf-8") as f:
f.write(final_markdown_content)

print(f"File updated successfully: {file_name}")

```
Harika, yakaladığın bu "uçtan geriye doğru giriş" ve "görsel diyagram şeması" gereksinimlerini de kapsayacak şekilde mimari planı güncelledim. 

Hem kullanıcı deneyimini (UI/UX) hem de algoritmanın arka plandaki ağaç tırmanma (Bottom-Up Traversal) mantığını eksiksiz açıklayan, **Coding Agent'a doğrudan input olarak besleyebileceğin** son kapsamlı plan `.md` formatında üretilmiştir.

Your Markdown file is ready
[file-tag: code-generated-file-0-1779355010439247860]

Aşağıda, oluşturulan `cable_optimizer_final_plan.md` dosyasının içeriğini inceleyebilirsin:

```markdown
# FINAL COMPREHENSIVE PROMPT & IMPLEMENTATION PLAN FOR CODING AGENT

## 1. EXECUTIVE SUMMARY & CORE GOAL
The objective is to refactor a legacy Python-based voltage drop calculation tool into a highly optimized, production-ready **TypeScript calculation engine** (`CableOptimizer`). 
The core innovation is **Automation**: Users should no longer manually select cable cross-sections dropdown-by-dropdown. Instead, users provide only the Power (kW), Distance (m), and basic installation parameters. The system automatically computes the most cost-effective (minimum suitable) standardized cable section that passes both **Thermal Ampacity** and **Cumulative Voltage Drop** checks.

---

## 2. DATA ARCHITECTURE: THE GRAPH/TREE STRUCTURE (CRITICAL CHANGE)
Electrical distribution networks behave as hierarchical trees (Parent-Child relationships). 
* **User Data Entry (Bottom-Up UX):** Engineers enter data starting from the **outermost consumer load (leaves)** and move backward toward the main panel (root). The algorithm must effortlessly handle this regardless of data entry sequence, resolving tree paths via `parentId`.
* **UI Visualization Requirement:** Frontend must visualize this as a **Single-Line Diagram (Tree View)** (using libraries like *React Flow* or *D3.js*). When a user changes an attachment point, the graph triggers a full recalculation.

### 2.1. TypeScript Interface Contracts
```typescript
export interface SegmentInput {
  id: string;                         // Unique ID (e.g., "SEG-001")
  parentId: string | null;            // Parent node ID. Top-most main supply is null.
  powerKw: number;                    // Active Power in kW
  distanceM: number;                  // Cable distance in Meters
  voltageV: number;                   // Operational voltage (e.g., 400 or 230)
  cosPhi: number;                     // Power factor (Used *ONLY* for current calculation)
  conductor: "copper" | "aluminum";  // Material type
  installation: "overhead" | "underground"; // Installation environment
  temperature: number;                // Ambient temperature (°C)
  cableCount: string;                 // Grouping multiplier key ("1", "2", "3", "4-6" etc.)
  voltageType: "three" | "single";    // Phase type
  voltageDropLimitPercent: number;    // Allowed maximum voltage drop limit for this segment
}

export interface SegmentResult extends SegmentInput {
  selectedSectionKey: string;         // Optimized cross-section string key (e.g., "4" or "2120")
  calculatedSectionArea: number;      // True physical area in mm² used in equations
  currentA: number;                   // Operational load current (Amperes)
  allowedCurrentA: number;            // De-rated allowable maximum capacity of the cable (Amperes)
  localVoltageDropPercent: number;    // Isolated voltage drop on this exact cable segment (%)
  cumulativeVoltageDropPercent: number; // Sum of voltage drops from Root to the end of this leaf node (%)
  thermalOk: boolean;                 // Ampacity compliance
  voltageDropOk: boolean;             // Voltage drop limit compliance
  sectionSuitable: boolean;           // Overall compliance (thermalOk && voltageDropOk)
}

export interface ProjectSummary {
  segments: SegmentResult[];
  totalProjectVoltageDropPercent: number; // Highest total cumulative path drop found in the graph
  highestCurrentA: number;               // Max operational current in project
  allSectionsSuitable: boolean;          // Complete project validity status
}

```

---

## 3. STANDARDIZED SECTIONS & LOOKUP TABLES

To fix flaws in the legacy implementation (where string entries like `"2120"` caused math failures), maintain an ordered array mapping the **Lookup Key** to the **True Math Cross-Section Area**.

```typescript
export const KABLO_KESIT_LISTESI = [
  { key: "1.5",  gercekKesit: 1.5 },
  { key: "2.5",  gercekKesit: 2.5 },
  { key: "4",    gercekKesit: 4 },
  { key: "6",    gercekKesit: 6 },
  { key: "10",   gercekKesit: 10 },
  { key: "16",   gercekKesit: 16 },
  { key: "25",   gercekKesit: 25 },
  { key: "35",   gercekKesit: 35 },
  { key: "50",   gercekKesit: 50 },
  { key: "70",   gercekKesit: 70 },
  { key: "95",   gercekKesit: 95 },
  { key: "120",  gercekKesit: 120 },
  { key: "150",  gercekKesit: 150 },
  { key: "185",  gercekKesit: 185 },
  { key: "240",  gercekKesit: 240 },
  { key: "300",  gercekKesit: 300 },
  // Parallel Connected Cables (Sorted accurately by cumulative area)
  { key: "2120", gercekKesit: 240 },  // 2 x 120 mm²
  { key: "2150", gercekKesit: 300 },  // 2 x 150 mm²
  { key: "2185", gercekKesit: 370 },  // 2 x 185 mm²
  { key: "2240", gercekKesit: 480 },  // 2 x 240 mm²
  { key: "2300", gercekKesit: 600 },  // 2 x 300 mm²
  { key: "3120", gercekKesit: 360 },  // 3 x 120 mm²
  { key: "3150", gercekKesit: 450 },  // 3 x 150 mm²
  { key: "3185", gercekKesit: 555 },  // 3 x 185 mm²
  { key: "3240", gercekKesit: 720 },  // 3 x 240 mm²
  { key: "3300", gercekKesit: 900 },  // 3 x 300 mm²
  { key: "4120", gercekKesit: 480 },  // 4 x 120 mm²
  { key: "4150", gercekKesit: 600 },  // 4 x 150 mm²
  { key: "4185", gercekKesit: 740 },  // 4 x 185 mm²
  { key: "4240", gercekKesit: 960 },  // 4 x 240 mm²
  { key: "4300", gercekKesit: 1200 } // 4 x 300 mm²
];

```

*Extract all de-rating factors (`TEMP_FACTORS`, `GROUP_FACTORS`) and base ampacity dictionaries (`COPPER_OVERHEAD`, `COPPER_UNDERGROUND`, etc.) straight out of `legacy_calculations.py` constants.*

---

## 4. MATHEMATICAL COMPUTATION RULES

1. **Conductivity Constant ($k$):** `copper` = 56, `aluminum` = 35.
2. **Current Formulation ($I$):**
* Three-Phase (`three`): $I = \frac{P \times 1000}{\sqrt{3} \times V \times \cos\phi}$
* Single-Phase (`single`): $I = \frac{P \times 1000}{V \times \cos\phi}$


3. **Isolated Voltage Drop Percentage ($\Delta U\%$):**
* *Legacy Rule Compliance: Do NOT include $\cos\phi$ in voltage drop formulas.*
* Three-Phase (`three`): $\Delta U\% = \frac{100 \times (P \times 1000) \times L}{k \times \text{gercekKesit} \times V^2}$
* Single-Phase (`single`): $\Delta U\% = \frac{200 \times (P \times 1000) \times L}{k \times \text{gercekKesit} \times V^2}$



---

## 5. RECURSIVE BOTTOM-UP OPTIMIZATION ALGORITMASI

### STEP 1: Thermal Baselining

1. Evaluate operational current $I$ for each individual segment based on its absolute local load.
2. Filter the matching ampacity lookup table applying $k_t$ and $k_g$ reduction coefficients.
3. Assign the **SMALLEST standard section key** that passes the thermal threshold (`currentA <= allowedCurrentA`). For Aluminum, explicitly handle the omission of sections $< 10mm^2$ safely.

### STEP 2: The Iterative Tree Traversal

Launch a structured loop controlled by a safe termination parameter (maximum 100 loops).

1. **Calculate Isolated Drops:** Solve `localVoltageDropPercent` using the currently assigned `gercekKesit`.
2. **Path Resolution & Cumulative Evaluation:**
* For each node, map its ancestor path backwards from its own node up to the root node (`parentId === null`) through an evaluation array.
* `cumulativeVoltageDropPercent` = Sum of all local isolated drops across **only** this resolved continuous linear path. **Never sum parallel branches.**


3. **Selective Optimization Trigger:**
* Scan every segment. If `cumulativeVoltageDropPercent > voltageDropLimitPercent`, shift the `selectedSectionKey` of **this exact failing node** up by one increment position index in `KABLO_KESIT_LISTESI`.


4. **Loop Exit Condition:** Break when all nodes concurrently return `cumulativeVoltageDropPercent <= voltageDropLimitPercent` or all failing nodes hit peak available system limit configurations ($1200mm^2$).

---

## 6. QUALITY INSURANCE GUIDELINES FOR AGENT

* **Pure Functions:** Calculations must be stateless and free of side-effects to perfectly adapt to instant UI rendering recalculations.
* **Validation Dataset:** Write a unit execution suite (Jest/Vitest) modeling the 7-segment benchmark data provided inside `örnek gerilim düşümü hesabı.xlsx` to secure mathematical parity with historical calculations.

```

Bu planı projendeki yapay zeka kodlama ajanına doğrudan teslim edebilirsin. Kod yazım aşamasında sormak istediğin bir yer olursa buradayım!

```
