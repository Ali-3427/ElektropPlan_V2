# Materials Feature — Design

Tarih: 2026-05-19
Durum: Onaylandı (tasarım), uygulama planı ayrı dosyada

## 1. Amaç

ElektroPlan projelerinde kullanılan elektrik malzemelerinin (kaçak akım koruma, sigorta, kontaktör, MS şalter, soft starter, frekans inverteri, kablo, pano vb.) merkezi katalogu + projedeki kayıtlara atanması.

Beş ana kullanıcı senaryosu:

1. Sol menüden "Malzemeler" sayfasına gir, kategorize listeyi gör.
2. Malzemeler sayfasında yeni malzeme ekle / mevcut düzenle / sil.
3. Excel kaynak dosyasını yeniden içe aktar (merge mantığı).
4. Hızlı panelden bir kayda (örn. motor) malzeme ata; adet belirle.
5. Atanan malzemeler ilgili kaydın kartında rozet/satır olarak hızlı panelde görünür.

## 2. Kapsam Kararları (Frozen)

- **Veri modeli**: Geniş — id, kategori, ad, sıra, marka, model kodu, birim (adet/m/kg), birim fiyat, stok adedi, notlar, custom `attributes` JSON. Boş alanlara izin var.
- **Seed**: Build-time JSON (`packages/calculation-data/src/datasets/materials.json`) + runtime "Excel'den içe aktar" (merge default).
- **Atama**: Çok malzeme + adet per record. Snapshot pattern (atama anında ad/kategori/attribute snapshot'ı kopyalanır + katalog id referansı tutulur).
- **Kapsam**: Atama record'a bağlı (record kopyalanırsa atamalar da kopyalanır, silinirse atamalar silinir — FK CASCADE).
- **Re-import**: Merge — Excel'deki upsert, DB'de olup Excel'de olmayanlar (kullanıcı eklemeleri, eski kalanlar) korunur. UI'da "Üzerine yaz (replace)" advanced seçeneği opsiyonel ileri faz.

## 3. Mimari

Mevcut monorepo katmanlarına uyar: `contracts → calculation-data → storage → main bridge → renderer features`.

```
packages/contracts/src/schemas.ts
  + materialSchema, materialCategorySchema
  + materialAssignmentSchema (snapshot kolonlarıyla)
  + materialsExportSchema (calculationsExport ile birleşik)

packages/calculation-data/src/datasets/materials.json
  + DatasetMetadata + categories[] + materials[]
packages/calculation-data/scripts/build-materials-seed.mjs
  + Excel'i parse eder, deterministik id üretir, JSON yazar

packages/storage/src/migrations.ts
  + p3_materials_schema: materials, material_categories,
                          material_assignments tabloları
packages/storage/src/repositories.ts
  + materialCategoriesRepo, materialsRepo, materialAssignmentsRepo
packages/storage/src/serialization.ts
  + materialAssignment <-> row dönüşümleri

apps/desktop/main + preload
  + bridge ipc kanalları:
      materials:list, materials:upsert, materials:delete,
      categories:list, categories:upsert, categories:delete,
      assignments:listByRecord, assignments:upsert, assignments:delete,
      materials:importExcel (file path, mode='merge'|'replace')
      materials:seedIfEmpty (boot'ta)

apps/desktop/renderer/src/features/materials/
  + MaterialsPage.tsx (sol kategori ağacı + sağ tablo)
  + CategoryTree.tsx
  + MaterialsTable.tsx
  + MaterialEditDialog.tsx
  + ImportExcelDialog.tsx
  + useMaterialsData.ts (TanStack Query)
  + materialMutations.ts

apps/desktop/renderer/src/features/projects/
  + ProjectQuickPanel.tsx — record kartına "+ Malzeme" buton + atama liste
  + AssignMaterialPopover.tsx (yeni)
  + useRecordAssignments.ts (yeni)

apps/desktop/renderer/src/router.tsx
  + /materials route
apps/desktop/renderer/src/ui/Layout.tsx
  + NAV array'e "Malzemeler" eklenir
```

## 4. Veri Modeli

### 4.1 `material_categories`

| kolon | tip | not |
|---|---|---|
| id | TEXT PK | slug — `kacak-akim-koruma-roleleri` |
| title | TEXT NOT NULL | "KAÇAK AKIM KORUMA RÖLELERİ" |
| order_value | INTEGER NULL | listelemede sıra |
| icon_key | TEXT NULL | ileride özel ikon |
| created_at, updated_at | TEXT NOT NULL | |

### 4.2 `materials`

| kolon | tip | not |
|---|---|---|
| id | TEXT PK | `mat_<ulid>` veya slug |
| category_id | TEXT NOT NULL FK→material_categories(id) ON DELETE RESTRICT | |
| name | TEXT NOT NULL | "C40 3X40A" |
| order_value | INTEGER NULL | kategori içi Excel SIRA NO |
| brand | TEXT NULL | |
| model_code | TEXT NULL | |
| unit | TEXT NULL | "adet" \| "m" \| "kg" |
| unit_price | REAL NULL | TL — local cents değil; basit |
| stock_qty | INTEGER NULL | |
| notes | TEXT NULL | |
| attributes_json | TEXT NULL | serbest JSON |
| source | TEXT NOT NULL DEFAULT 'user' | 'seed' \| 'user' — re-import merge davranışı için |
| seed_data_version | TEXT NULL | seed kayıtlarda hangi data versiyonundan geldiği |
| created_at, updated_at | TEXT NOT NULL | |

İndeks: `idx_materials_category`, `idx_materials_name`.

### 4.3 `material_assignments`

| kolon | tip | not |
|---|---|---|
| id | TEXT PK | |
| record_id | TEXT NOT NULL FK→records(id) ON DELETE CASCADE | |
| material_id | TEXT NULL FK→materials(id) ON DELETE SET NULL | snapshot olduğu için NULL kalmasına izin |
| quantity | REAL NOT NULL DEFAULT 1 | |
| unit | TEXT NULL | snapshot anındaki birim |
| snapshot_name | TEXT NOT NULL | atama anındaki ad |
| snapshot_category_id | TEXT NOT NULL | atama anındaki kategori id |
| snapshot_category_title | TEXT NOT NULL | atama anındaki kategori ad |
| snapshot_brand | TEXT NULL | |
| snapshot_model_code | TEXT NULL | |
| snapshot_unit_price | REAL NULL | |
| snapshot_attributes_json | TEXT NULL | |
| order_value | INTEGER NULL | kayda ekleme sırası |
| created_at, updated_at | TEXT NOT NULL | |

İndeks: `idx_assignments_record`, `idx_assignments_material`.

Kural: katalog malzemesi silinirse `material_id` NULL olur, snapshot alanları kayd'a bağlı atamada UI'da görünmeye devam eder. Yeniden ekle butonu (re-link) ileride.

## 5. Zod Şemaları (contracts)

```ts
export const materialCategorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  orderValue: z.number().int().optional(),
  iconKey: z.string().optional(),
}).strict();

export const materialUnitSchema = z.enum(["adet", "m", "kg", "set", "paket"]);

export const materialSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().min(1),
  orderValue: z.number().int().optional(),
  brand: z.string().optional(),
  modelCode: z.string().optional(),
  unit: materialUnitSchema.optional(),
  unitPrice: z.number().nonnegative().optional(),
  stockQty: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  source: z.enum(["seed", "user"]).default("user"),
  seedDataVersion: z.string().optional(),
}).strict();

export const materialAssignmentSchema = z.object({
  id: z.string().min(1),
  recordId: z.string().min(1),
  materialId: z.string().nullable(),
  quantity: z.number().positive(),
  unit: materialUnitSchema.optional(),
  snapshotName: z.string().min(1),
  snapshotCategoryId: z.string().min(1),
  snapshotCategoryTitle: z.string().min(1),
  snapshotBrand: z.string().optional(),
  snapshotModelCode: z.string().optional(),
  snapshotUnitPrice: z.number().nonnegative().optional(),
  snapshotAttributes: z.record(z.string(), z.unknown()).optional(),
  orderValue: z.number().int().optional(),
}).strict();
```

`calculationsExportSchema` genişletilir: `materialCategories: MaterialCategory[]`, `materials: Material[]`, `materialAssignments: MaterialAssignment[]`.

## 6. Seed Pipeline

`packages/calculation-data/scripts/build-materials-seed.mjs`:

1. `docs/MST malzeme listesi.xlsx` oku (xlsx paketi). Yoksa script hata.
2. Sheet 1, col A=kategori başlık (lone), col B=sira, col C=ad.
3. State machine: A dolu satır → aktif kategori; sonraki C dolu satırlar bu kategoriye.
4. Kategori id: Türkçe başlık → ascii slug.
5. Material id: `<categorySlug>--<adSlug>` (deterministik, re-import için kritik).
6. `dataVersion`: `materials-2026-05-19`. DatasetMetadata yaz.
7. Çıktı: `packages/calculation-data/src/datasets/materials.json` + typed accessor `getMaterialSeed()`.

Script `package.json`'da `scripts/build-materials-seed`. CI veya manuel çalıştırılır. JSON commit'lenir (tekrar-deterministik için).

Boot davranışı: `main` proses ilk açılışta `materials` tablosu boşsa seed import eder (`source='seed'`, `seed_data_version` set). Sonraki açılışlarda dokunmaz.

## 7. Excel Re-Import (Runtime)

- Materials page'de "İçe Aktar" butonu → file picker (`.xlsx`).
- Default mod: **merge**.
- Algoritma:
  1. Excel'i seed pipeline ile aynı parser fonksiyonundan geçir.
  2. Kategori upsert (id eşleşmesi, eşleşme yoksa ekle).
  3. Malzeme upsert (id eşleşmesi). `source='seed'`, `seed_data_version` güncellenir.
  4. DB'de olup Excel'de olmayan `source='seed'` kayıtlar **dokunulmaz** (önceki bir seed'den kalmış olabilir, kullanıcı silmek isterse manuel yapar).
  5. `source='user'` kayıtlar **hiç dokunulmaz**.
- İşlem sonu: özet diyalog ("12 yeni kategori, 47 yeni malzeme, 13 güncellenen").
- Tek transaction. Hata olursa rollback.

Replace modu ileri faz — şimdilik UI'da yok.

## 8. UI — Materials Page

Layout: sol kategori ağacı (sticky, ~260px) + sağ malzeme tablosu.

**Sol panel:**
- "Tüm Kategoriler (280)" en üstte.
- Kategori listesi: ad + yanında count rozet.
- Kategori sağ tık menüsü: yeniden adlandır / sil (boşsa).
- En altta "+ Kategori" butonu.

**Sağ panel — header:**
- Arama input (ad+marka+model_code'da contains).
- Birim filtre dropdown (opsiyonel).
- "İçe Aktar" + "+ Yeni Malzeme" butonları.

**Sağ panel — tablo:**
- Kolonlar: SIRA \| AD \| MARKA \| MODEL \| BİRİM \| FİYAT \| STOK \| KAYNAK \| (aksiyonlar)
- Satır tıklama → MaterialEditDialog modal.
- Satır içi sil ikonu (confirm).
- Boş state: "Bu kategoride malzeme yok — '+ Yeni Malzeme' ile ekle veya 'İçe Aktar' ile Excel yükle".

**MaterialEditDialog:**
- Tüm alanlar form. `attributes` için key-value ekleyici (basit).
- Save → upsert.

Yeni route: `/materials`. Sidebar NAV array'e `{ to: "/materials", label: "Malzemeler" }` eklenir (Projeler ile Ayarlar arası).

## 9. UI — Quick Panel Entegrasyonu

`ProjectQuickPanel.tsx` mevcut record kartı (`recordCard`) yapısı bozulmadan genişletilir:

```
[badge: MOTOR]                              [3.20 A]
Pompa motoru 4kW
Birim 3.20 A / 4.00 kW         Adet: [1]
─── Malzemeler (3) ─── (+ Malzeme)
• 1x  Kontaktör AF38         [×]
• 1x  MS Şalter 6.3-10A      [×]
• 2.5x Kablo NYY 5x4         [×]
```

**+ Malzeme tıklama** → `AssignMaterialPopover` (Floating UI veya basit absolute):
- Üstte arama input (ad + kategori).
- Liste: ad — kategori (rozet) — marka.
- Klavye: ↑↓ navigasyon, Enter seç.
- Seçimden sonra adet input + Ekle butonu.
- Ekle → mutation.

**Atama kaldır** → `×` butonu confirm sormadan siler (undo toast ileride).

**Atama düzenle** → satıra tıkla → inline adet edit (mevcut quantity input pattern ile uyumlu).

Atamalar `useProjectsData` ile birlikte tek query'de gelir (record_id IN (...) ile tek select). Bellek + senkron.

## 10. IPC Bridge

`apps/desktop/preload` ve `main` arası kanal listesi (preload Promise wrapper):

```
materials.listCategories() → MaterialCategory[]
materials.upsertCategory(MaterialCategory) → MaterialCategory
materials.deleteCategory(id) → boolean

materials.list(filter?: { categoryId?, search? }) → Material[]
materials.upsert(Material) → Material
materials.delete(id) → boolean

materials.importExcel(filePath: string, mode: 'merge'='merge')
  → { categoriesAdded, materialsAdded, materialsUpdated, untouched }

assignments.listForRecords(recordIds: string[]) → MaterialAssignment[]
assignments.upsert(MaterialAssignment) → MaterialAssignment
assignments.delete(id) → boolean
```

Tüm cevaplar zod schema ile main proseste validate edilir.

## 11. Hata Durumları

- Excel parse hatası → kullanıcıya hata mesajı, transaction yok.
- Kategori silme: içinde malzeme varsa engelle ("X malzeme bu kategoride, önce taşı/sil").
- Malzeme silme: atamalardaki `material_id` NULL'a düşer (snapshot kalır), uyarı: "5 kayda atanmış — atamalar 'kataloga bağsız' olarak kalacak. Devam et?".
- Record silme → CASCADE assignment silme (storage zaten test edilen pattern).
- Boot'ta seed JSON yoksa: `materials:seedIfEmpty` hata logla, UI bilgilendir, uygulama açılmaya devam.

## 12. Test Stratejisi

**Storage (`packages/storage`):**
- migration p3 idempotent.
- materials repo upsert + list + delete + cascade.
- assignment repo: record silme → cascade assignment silme.
- snapshot kolonları upsert sırasında doğru kopyalanıyor.

**Seed pipeline:**
- Excel parse: bilinen örnek girdi (test fixture) → beklenen kategori+material sayısı.
- Slug deterministik: aynı girdi → aynı id'ler.
- Re-import merge: önce N, sonra M girdiyle çağrı → user kayıtlar bozulmuyor.

**Contracts:**
- zod parse fixture'ları (positive + negative).
- export schema genişlemesi: eski export'lar geriye uyumlu (`materials` opsiyonel okuma).

**Renderer:**
- MaterialsPage smoke test (mock bridge ile).
- AssignMaterialPopover klavye navigasyonu (ufak ünite testi).
- Mevcut e2e proje senaryosuna: bir motor oluştur → quick panelden malzeme ata → quick panel yeniden render edilince atama görünüyor.

## 13. Migration Sırası (Plan'da detaylanır)

1. contracts schema
2. calculation-data seed pipeline + JSON
3. storage migration + repositories + testler
4. main/preload IPC kanalları
5. router + sidebar
6. MaterialsPage skeleton
7. CRUD diyaloglar
8. Import dialog
9. Quick panel atama UI
10. End-to-end test

## 14. Açık Sorular / Sonraya

- Birim dönüşüm (kablo m vs cm vs paket) — şimdilik string, ileride normalize.
- Çoklu dil — şimdilik TR sabit, mevcut pattern korunur.
- BOM raporu (proje çapı malzeme toplamı) — ayrı feature, sonra.
- Replace re-import modu.
- Atama undo toast.
- Atanmış ama kataloglatan silinmiş malzeme için "Yeniden bağla" UX.
- Kategori sürükle-bırak sıralama.

— son.
