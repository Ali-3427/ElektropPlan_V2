# Gerilim Dusumu Agac UI ve Hesap Motoru Yenileme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sol menuyu acilip kapanabilir hale getirmek, gerilim dusumu ekranini agac tabanli interaktif bir editor olarak yeniden tasarlamak ve mevcut sirali gerilim dusumu hesabini `parentId` tabanli dallanan bir hesap motoruyla degistirmek.

**Architecture:** Mevcut Electron + React + TypeScript mimarisi korunacak. Disaridaki IPC kanali ve calculator kind `voltage-drop-group` olarak kalacak, fakat ic hesap modeli duz segment listesi yerine kokten dallara uzanan agac modeli kullanacak. UI tarafinda `VoltageDropPage.tsx` tek dosya olmaktan cikarilip canvas, inspector, sonuc ve state helper dosyalarina bolunecek.

**Tech Stack:** React 18, Vite, Electron preload bridge, TypeScript, Zod contracts, Vitest, mevcut CSS modules ve custom SVG tree canvas. Ilk uygulamada yeni grafik kutuphanesi eklenmeyecek; pan, zoom ve fit-to-view custom SVG ile cozulerek dependency riski dusuk tutulacak.

---

## Mevcut Durum Ozeti

- `apps/desktop/renderer/src/ui/Layout.tsx` sol menuyu sabit `240px` genislikte tutuyor. Sagda `ProjectQuickPanel` oldugu icin ana icerik alani daraliyor.
- `packages/calculation-core/src/voltage-drop-group/algorithm.ts` segmentleri sirali liste gibi hesapliyor. Kumulatif dusum `runningSum` ile ilerliyor, bu yuzden paralel dallar birbirine ekleniyor.
- `VoltageDropPage.tsx` form, segment satiri, sonuc paneli ve kaydetme akislarini tek dosyada tasiyor. Agac editoru eklenirse dosya kontrolsuz buyur.
- `docs/Legacy-voltage-drop/legacy_calculations.py` legacy katsayilari ve ampacity tablolarini iceriyor. `taslak_plan_1.md` agac mantigi, otomatik kesit secimi ve parallel kesit key/gercek alan ayrimini tarif ediyor.
- Mevcut `@elektroplan/calculation-data` standart kesitleri 240 mm2 civarina kadar tasiyor; legacy paralel kablo keyleri (`2120`, `3150`, `4300`) bu veri setinde yok. Yeni motor bu nedenle kendi section catalog ve legacy table adaptorunu tasimali.

## Hedef UX

Gerilim dusumu ekrani, kullanicinin cizimde tarif ettigi gibi uc bolgeye ayrilacak:

- Ust/orta buyuk bolge: ana hattan dagilan interaktif tek hat agaci.
- Sag inspector: secili segmentin adi, gucu, mesafesi, ebeveyni, kesit modu, iletken ve montaj degerleri.
- Alt sonuc bolgesi: dal bazli ozet kartlari ve detay tablosu.

Segment tiklandiginda inspector o segmenti duzenleyecek. Her dal ayri adlandirilacak. Agac uzerinde segment durumu renk ve etiketle gosterilecek:

- Yesil: termal ve gerilim dusumu uygun.
- Sari: otomatik buyutme yapildi.
- Kirmizi: limit saglanamadi veya validation hatasi.
- Gri: eksik veri.

Canvas olceklenebilir olacak:

- Desktop genislikte canvas minimum `520px` yukseklikte kalacak.
- Sol menu kapaliyken ana grid genisleyecek.
- 1280px altinda inspector alta veya drawer yapisina gececek.
- 720px altinda canvas tek kolon, inspector tam genislik, sonuc tablosu yatay kaydirma ile calisacak.
- SVG `viewBox`, zoom state, fit-to-view ve pan kontrolleri ile uzun dallar kirpilmeyecek.

## Hedef Veri Modeli

Yeni modelde her kayit bir kablo segmentidir. Segmentin upstream ucu `parentId` ile ust segmente baglanir. `parentId: null` kok besleme segmentidir.

Guvenli ve elektriksel olarak tutarli varsayim:

- `loadPowerKW`: segmentin ucundaki yerel yuk.
- `flowPowerKW`: motorun hesapladigi, segmentten gecen toplam yuk. Deger `loadPowerKW + descendants(loadPowerKW)` olarak bulunur.
- Gerilim dusumu o segmentin kendi uzunlugu ve `flowPowerKW` degeriyle hesaplanir.
- Kumulatif dusum sadece kokten secili node'a giden tek path uzerindeki segment dusumlerinin toplamidir. Kardes dallar birbirine eklenmez.

Core type hedefi:

```ts
export interface VoltageDropTreeSegmentInput {
  readonly id: string;
  readonly parentId: string | null;
  readonly title: string;
  readonly loadPowerKW: number;
  readonly lengthM: number;
  readonly fixedSectionKey?: string;
  readonly settings?: VoltageDropTreeSegmentSettingsInput;
}

export interface VoltageDropTreeSegmentOutput {
  readonly id: string;
  readonly parentId: string | null;
  readonly title: string;
  readonly depth: number;
  readonly childIds: readonly string[];
  readonly pathIds: readonly string[];
  readonly loadPowerKW: number;
  readonly flowPowerKW: number;
  readonly lengthM: number;
  readonly currentA: number;
  readonly selectedSectionKey: string;
  readonly selectedSectionAreaMm2: number;
  readonly selectedParallelRuns: number;
  readonly fixedSection: boolean;
  readonly baseAmpacityA: number;
  readonly correctedAmpacityA: number;
  readonly segmentDeltaVPercent: number;
  readonly cumulativeDeltaVPercent: number;
  readonly thermalPass: boolean;
  readonly voltageDropPass: boolean;
  readonly compliant: boolean;
}
```

Legacy parallel section catalog hedefi:

```ts
export interface LegacySectionOption {
  readonly key: string;
  readonly label: string;
  readonly areaMm2: number;
  readonly singleRunAreaMm2: number;
  readonly parallelRuns: number;
}
```

## Dosya Haritasi

Olusturulacak dosyalar:

- `packages/calculation-core/src/voltage-drop-tree/types.ts`: yeni agac input/output kontratlari.
- `packages/calculation-core/src/voltage-drop-tree/legacy-tables.ts`: `legacy_calculations.py` kaynakli sicaklik, grup, ampacity ve section catalog sabitleri.
- `packages/calculation-core/src/voltage-drop-tree/graph.ts`: parent/child haritalari, kok bulma, cycle kontrolu, path ve downstream power hesaplari.
- `packages/calculation-core/src/voltage-drop-tree/optimizer.ts`: termal baseline, gerilim dusumu, kumulatif path hesabı ve kesit buyutme algoritmasi.
- `packages/calculation-core/src/voltage-drop-tree/index.ts`: public `calculateVoltageDropTree` girisi.
- `packages/calculation-core/src/voltage-drop-tree/index.test.ts`: yeni motor birim testleri.
- `apps/desktop/renderer/src/features/voltageDrop/treeModel.ts`: UI draft state, node layout ve bridge submission donusumleri.
- `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.tsx`: SVG tree canvas.
- `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.module.css`: canvas stilleri.
- `apps/desktop/renderer/src/features/voltageDrop/SegmentInspector.tsx`: secili segment formu.
- `apps/desktop/renderer/src/features/voltageDrop/SegmentInspector.module.css`: inspector stilleri.
- `apps/desktop/renderer/src/features/voltageDrop/VoltageDropResults.tsx`: ozet ve dal bazli sonuc.
- `apps/desktop/renderer/src/features/voltageDrop/VoltageDropResults.module.css`: sonuc stilleri.

Degistirilecek dosyalar:

- `apps/desktop/renderer/src/ui/Layout.tsx`
- `apps/desktop/renderer/src/ui/Layout.module.css`
- `packages/contracts/src/schemas.ts`
- `packages/calculation-core/src/index.ts`
- `packages/calculation-core/src/voltage-drop-group/types.ts`
- `packages/calculation-core/src/voltage-drop-group/algorithm.ts`
- `packages/calculation-core/src/voltage-drop-group/index.ts`
- `apps/desktop/main/src/services/calculate-service.ts`
- `apps/desktop/preload/src/index.ts`
- `apps/desktop/renderer/src/bridge/types.ts`
- `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
- `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`
- `tests/e2e/src/voltageDrop.spec.ts`

Silinmeyecek ama sadeleştirilecek:

- `apps/desktop/renderer/src/features/voltageDrop/voltageDropGroup.ts`

Bu dosya eski helper adiyla kalabilir, fakat icindeki draft tipleri tree modeline tasinacak veya wrapper olarak kullanilacak. IPC ve record uyumlulugu icin public isimleri hemen kaldirmamak daha dusuk riskli.

## Task 1: Sol Menuyu Acilip Kapanabilir Yap

**Files:**
- Modify: `apps/desktop/renderer/src/ui/Layout.tsx`
- Modify: `apps/desktop/renderer/src/ui/Layout.module.css`

- [ ] **Step 1: Layout state ekle**

`Layout.tsx` icine kalici state ekle:

```ts
const SIDEBAR_STORAGE_KEY = "elektroplan.sidebar.collapsed";
const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
});
```

- [ ] **Step 2: Storage effect ekle**

```ts
useEffect(() => {
  try {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      sidebarCollapsed ? "true" : "false",
    );
  } catch {
    // localStorage failures should not block layout rendering
  }
}, [sidebarCollapsed]);
```

- [ ] **Step 3: Shell attribute ve menu butonu ekle**

`shell` div'e `data-sidebar-collapsed` ekle. `aside` icindeki brand alaninin ustune ikon karakteri yerine metin kontrollu, erisilebilir bir button koy:

```tsx
<button
  type="button"
  className={styles.sidebarToggle}
  aria-label={sidebarCollapsed ? "Menuyu genislet" : "Menuyu daralt"}
  aria-expanded={!sidebarCollapsed}
  onClick={() => setSidebarCollapsed((current) => !current)}
>
  <span aria-hidden="true" className={styles.toggleBars}>
    <span />
    <span />
    <span />
  </span>
</button>
```

- [ ] **Step 4: CSS grid genisliklerini guncelle**

`Layout.module.css` hedef davranis:

```css
.shell {
  grid-template-columns: 240px minmax(0, 1fr) 340px;
}

.shell[data-sidebar-collapsed="true"] {
  grid-template-columns: 64px minmax(0, 1fr) 340px;
}

.shell[data-sidebar-collapsed="true"] .logoWrapper,
.shell[data-sidebar-collapsed="true"] .sidebarFooter,
.shell[data-sidebar-collapsed="true"] .navItem {
  overflow: hidden;
}
```

Collapsed modda nav item metni gizlenecek, active state icin kucuk dikey vurgu korunacak. Logo tam boy gosterilmeyecek; dar modda yalnizca toggle ve nav hedefleri kalacak.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
pnpm --filter @elektroplan/desktop-renderer build
```

Expected: both commands exit `0`. Browser QA'da sol menu ac/kapa, tema segmentleri, aktif nav ve sag quick panel birlikte kontrol edilir.

## Task 2: Contract ve Bridge Semasini Tree Mode'a Hazirla

**Files:**
- Modify: `packages/contracts/src/schemas.ts`
- Modify: `apps/desktop/preload/src/index.ts`
- Modify: `apps/desktop/renderer/src/bridge/types.ts`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/voltageDropGroup.ts`

- [ ] **Step 1: Segment request'e `parentId` ve `loadPowerKW` ekle**

Yeni request semasi `localPowerKW` alanini gecis sureci icin kabul eder, UI yeni kayitlarda `loadPowerKW` gonderir.

```ts
export const voltageDropGroupSegmentRequestSchema = z
  .object({
    id: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    title: z.string().min(1),
    loadPowerKW: z.number().positive().optional(),
    localPowerKW: z.number().positive().optional(),
    lengthM: z.number().positive(),
    fixedSectionKey: z.string().min(1).optional(),
    sectionMm2: z.number().positive().optional(),
    settings: voltageDropGroupSegmentSettingsRequestSchema.optional(),
  })
  .strict()
  .refine((value) => value.loadPowerKW !== undefined || value.localPowerKW !== undefined, {
    message: "loadPowerKW is required.",
  });
```

- [ ] **Step 2: Output semasina agac alanlarini ekle**

`VoltageDropGroupSegmentOutput` artik `id`, `parentId`, `depth`, `childIds`, `pathIds`, `loadPowerKW`, `flowPowerKW`, `selectedSectionKey`, `selectedSectionAreaMm2`, `selectedParallelRuns` alanlarini tasir. Eski `selectedSectionMm2` alanini ilk geciste koru ve `selectedSectionAreaMm2` ile ayni degeri don.

- [ ] **Step 3: Renderer local type'lari senkronize et**

`bridge/types.ts`, preload type importlari ve `voltageDropGroup.ts` icindeki draft request/response tipleri contract ile ayni alan adlarini kullanacak.

- [ ] **Step 4: Schema testlerini calistir**

Run:

```bash
pnpm --filter @elektroplan/contracts test
```

Expected: existing tests pass. Yeni schema testlerinde `parentId: null` root, child segment ve legacy `localPowerKW` compatibility kabul edilir.

## Task 3: Legacy Section Catalog ve Table Adapter Olustur

**Files:**
- Create: `packages/calculation-core/src/voltage-drop-tree/legacy-tables.ts`
- Create: `packages/calculation-core/src/voltage-drop-tree/types.ts`
- Modify: `packages/calculation-core/src/index.ts`

- [ ] **Step 1: Legacy constants port et**

`docs/Legacy-voltage-drop/legacy_calculations.py` icindeki `TEMP_FACTORS`, `GROUP_FACTORS`, `COPPER_OVERHEAD`, `COPPER_UNDERGROUND`, `ALUMINUM_OVERHEAD`, `ALUMINUM_UNDERGROUND` birebir TypeScript sabitlerine tasinir.

- [ ] **Step 2: Section catalog ekle**

`sectionKey` ve matematiksel alan ayrimi zorunlu:

```ts
export const LEGACY_SECTION_OPTIONS: readonly LegacySectionOption[] = Object.freeze([
  { key: "1.5", label: "1.5 mm2", areaMm2: 1.5, singleRunAreaMm2: 1.5, parallelRuns: 1 },
  { key: "2.5", label: "2.5 mm2", areaMm2: 2.5, singleRunAreaMm2: 2.5, parallelRuns: 1 },
  { key: "4", label: "4 mm2", areaMm2: 4, singleRunAreaMm2: 4, parallelRuns: 1 },
  { key: "6", label: "6 mm2", areaMm2: 6, singleRunAreaMm2: 6, parallelRuns: 1 },
  { key: "10", label: "10 mm2", areaMm2: 10, singleRunAreaMm2: 10, parallelRuns: 1 },
  { key: "16", label: "16 mm2", areaMm2: 16, singleRunAreaMm2: 16, parallelRuns: 1 },
  { key: "25", label: "25 mm2", areaMm2: 25, singleRunAreaMm2: 25, parallelRuns: 1 },
  { key: "35", label: "35 mm2", areaMm2: 35, singleRunAreaMm2: 35, parallelRuns: 1 },
  { key: "50", label: "50 mm2", areaMm2: 50, singleRunAreaMm2: 50, parallelRuns: 1 },
  { key: "70", label: "70 mm2", areaMm2: 70, singleRunAreaMm2: 70, parallelRuns: 1 },
  { key: "95", label: "95 mm2", areaMm2: 95, singleRunAreaMm2: 95, parallelRuns: 1 },
  { key: "120", label: "120 mm2", areaMm2: 120, singleRunAreaMm2: 120, parallelRuns: 1 },
  { key: "150", label: "150 mm2", areaMm2: 150, singleRunAreaMm2: 150, parallelRuns: 1 },
  { key: "185", label: "185 mm2", areaMm2: 185, singleRunAreaMm2: 185, parallelRuns: 1 },
  { key: "240", label: "240 mm2", areaMm2: 240, singleRunAreaMm2: 240, parallelRuns: 1 },
  { key: "300", label: "300 mm2", areaMm2: 300, singleRunAreaMm2: 300, parallelRuns: 1 },
  { key: "2120", label: "2 x 120 mm2", areaMm2: 240, singleRunAreaMm2: 120, parallelRuns: 2 },
  { key: "2150", label: "2 x 150 mm2", areaMm2: 300, singleRunAreaMm2: 150, parallelRuns: 2 },
  { key: "2185", label: "2 x 185 mm2", areaMm2: 370, singleRunAreaMm2: 185, parallelRuns: 2 },
  { key: "2240", label: "2 x 240 mm2", areaMm2: 480, singleRunAreaMm2: 240, parallelRuns: 2 },
  { key: "2300", label: "2 x 300 mm2", areaMm2: 600, singleRunAreaMm2: 300, parallelRuns: 2 },
  { key: "3120", label: "3 x 120 mm2", areaMm2: 360, singleRunAreaMm2: 120, parallelRuns: 3 },
  { key: "3150", label: "3 x 150 mm2", areaMm2: 450, singleRunAreaMm2: 150, parallelRuns: 3 },
  { key: "3185", label: "3 x 185 mm2", areaMm2: 555, singleRunAreaMm2: 185, parallelRuns: 3 },
  { key: "3240", label: "3 x 240 mm2", areaMm2: 720, singleRunAreaMm2: 240, parallelRuns: 3 },
  { key: "3300", label: "3 x 300 mm2", areaMm2: 900, singleRunAreaMm2: 300, parallelRuns: 3 },
  { key: "4120", label: "4 x 120 mm2", areaMm2: 480, singleRunAreaMm2: 120, parallelRuns: 4 },
  { key: "4150", label: "4 x 150 mm2", areaMm2: 600, singleRunAreaMm2: 150, parallelRuns: 4 },
  { key: "4185", label: "4 x 185 mm2", areaMm2: 740, singleRunAreaMm2: 185, parallelRuns: 4 },
  { key: "4240", label: "4 x 240 mm2", areaMm2: 960, singleRunAreaMm2: 240, parallelRuns: 4 },
  { key: "4300", label: "4 x 300 mm2", areaMm2: 1200, singleRunAreaMm2: 300, parallelRuns: 4 },
]);
```

- [ ] **Step 3: Lookup helperlari ekle**

Helperlar:

- `getSectionOption(key: string): LegacySectionOption`
- `getNextSectionOption(key: string, conductor: "copper" | "aluminum"): LegacySectionOption | null`
- `getAmpacityTable(conductor, installation): Readonly<Record<string, number>>`
- `getTemperatureFactor(temperatureC: number): number`
- `getGroupFactor(groupedCircuits: number): number`

`groupedCircuits` sayisi legacy anahtara map edilir: `1`, `2`, `3`, `4-6`, `7-9`, `10-12`, `13-15`, `16-20`. `20` ustu icin `16-20` katsayisi kullanilir ve warning uretilir.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @elektroplan/calculation-core typecheck
```

Expected: no type errors.

## Task 4: Tree Graph Validation ve Power Flow Hesaplarini Yaz

**Files:**
- Create: `packages/calculation-core/src/voltage-drop-tree/graph.ts`
- Test: `packages/calculation-core/src/voltage-drop-tree/index.test.ts`

- [ ] **Step 1: Failing tests yaz**

Test case:

```ts
it("sums downstream loads only through ancestor paths", () => {
  const graph = buildVoltageDropTreeGraph([
    { id: "main", parentId: null, title: "Ana hat", loadPowerKW: 0, lengthM: 25 },
    { id: "a", parentId: "main", title: "Dal A", loadPowerKW: 10, lengthM: 20 },
    { id: "b", parentId: "main", title: "Dal B", loadPowerKW: 5, lengthM: 15 },
    { id: "a1", parentId: "a", title: "Dal A1", loadPowerKW: 2, lengthM: 8 },
  ]);

  expect(graph.flowPowerById.get("main")).toBe(17);
  expect(graph.flowPowerById.get("a")).toBe(12);
  expect(graph.flowPowerById.get("b")).toBe(5);
  expect(graph.pathIdsById.get("a1")).toEqual(["main", "a", "a1"]);
  expect(graph.pathIdsById.get("b")).toEqual(["main", "b"]);
});
```

- [ ] **Step 2: Validation kurallarini uygula**

Kurallar:

- Tam olarak bir root segment olmali.
- Root `parentId` degeri `null` olmali.
- Her non-root `parentId` mevcut bir segment id'sine baglanmali.
- Cycle olursa `RangeError("segments must form an acyclic tree.")`.
- Duplicate id olursa `RangeError("segments must have unique ids.")`.
- Tree disconnected olursa `RangeError("all segments must be reachable from the root segment.")`.

- [ ] **Step 3: Deterministic traversal ekle**

Output sirasi root-first depth-first olacak. Kardesler input siralarini koruyacak. Bu sayede UI ve test snapshotlari stabil kalir.

- [ ] **Step 4: Testi calistir**

Run:

```bash
pnpm --filter @elektroplan/calculation-core test -- src/voltage-drop-tree/index.test.ts
```

Expected: graph tests pass after implementation.

## Task 5: Yeni Hesap Motorunu Yaz ve Eski Sirali Algoritmayi Degistir

**Files:**
- Create: `packages/calculation-core/src/voltage-drop-tree/optimizer.ts`
- Create: `packages/calculation-core/src/voltage-drop-tree/index.ts`
- Modify: `packages/calculation-core/src/voltage-drop-group/algorithm.ts`
- Modify: `packages/calculation-core/src/voltage-drop-group/index.ts`
- Modify: `packages/calculation-core/src/index.ts`
- Test: `packages/calculation-core/src/voltage-drop-tree/index.test.ts`
- Test: `packages/calculation-core/src/voltage-drop-group/index.test.ts`

- [ ] **Step 1: Current formula tests yaz**

Legacy uyumluluk:

```ts
it("uses cosPhi only for current and not for simplified voltage drop", () => {
  const result = calculateVoltageDropTree({
    segments: [
      { id: "root", parentId: null, title: "Ana", loadPowerKW: 10, lengthM: 100 },
    ],
    settings: {
      phaseMode: "three-phase",
      threePhaseVoltageV: 400,
      cosPhi: 0.8,
      conductorMaterial: "copper",
      installationMethod: "underground",
      ambientTemperatureC: 30,
      groupedCircuits: 1,
      limitPercent: 3,
    },
  });

  expect(result.value.segments[0]?.currentA).toBeCloseTo(18.04, 2);
  expect(result.value.segments[0]?.segmentDeltaVPercent).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Thermal baseline implement et**

Her segment icin:

1. `flowPowerKW` ile current hesapla.
2. Legacy ampacity tablosunu sec.
3. `correctedAmpacityA = table[key] * kt * kg`.
4. Current'i tasiyan en kucuk section key'i sec.
5. `fixedSectionKey` varsa otomatik secim yapma, ama termal sonucu yine hesapla.

- [ ] **Step 3: Voltage drop implement et**

Legacy formul:

```ts
function calculateLegacyDropPercent(input: {
  phaseMode: "single-phase" | "three-phase";
  powerKW: number;
  lengthM: number;
  voltageV: number;
  conductivity: 56 | 35;
  areaMm2: number;
}): number {
  const multiplier = input.phaseMode === "three-phase" ? 100 : 200;
  return (
    (multiplier * input.powerKW * 1000 * input.lengthM) /
    (input.conductivity * input.areaMm2 * input.voltageV * input.voltageV)
  );
}
```

- [ ] **Step 4: Cumulative path hesabini implement et**

Her segment icin:

```ts
const cumulative = pathIds.reduce((sum, id) => {
  const drop = segmentDropById.get(id);
  if (drop === undefined) {
    throw new Error(`missing voltage drop for segment '${id}'.`);
  }
  return sum + drop;
}, 0);
```

- [ ] **Step 5: Selective optimization loop yaz**

Loop kurallari:

- Maksimum iterasyon `segments.length * LEGACY_SECTION_OPTIONS.length`.
- Her iterasyonda tum segmentlerin drop degerleri yeniden hesaplanir.
- Limit asan segmentler icinden en yuksek cumulative excess secilir.
- Candidate listesi failing path uzerindeki auto section segmentleridir.
- Parent segment birden fazla failing child'i etkiliyorsa sensitivity skoru daha yuksek olur.
- Candidate yoksa `RangeError("No cable cross-section satisfies the voltage-drop limit for this tree.")`.

Sensitivity:

```ts
const affectedFailingCount = failingSegments.filter((segment) =>
  segment.pathIds.includes(candidate.id),
).length;
const gainPerArea = (currentDropPercent - nextDropPercent) / (next.areaMm2 - current.areaMm2);
const sensitivity = gainPerArea * affectedFailingCount;
```

- [ ] **Step 6: Existing public calculator'i wrapper yap**

`calculateVoltageDropGroup(input)` artik `calculateVoltageDropTree(normalizeGroupInput(input))` cagirir. Legacy sirali input gelirse migration:

```ts
function normalizeLegacyLinearSegments(segments: readonly VoltageDropGroupSegmentInput[]) {
  return segments.map((segment, index) => ({
    id: segment.id ?? `legacy-${index + 1}`,
    title: segment.title,
    parentId: index === 0 ? null : (segments[index - 1]?.id ?? `legacy-${index}`),
    loadPowerKW: segment.loadPowerKW ?? segment.localPowerKW,
    lengthM: segment.lengthM,
    fixedSectionKey: segment.fixedSectionKey,
    sectionMm2: segment.sectionMm2,
    settings: segment.settings,
  }));
}
```

Bu wrapper eski kayitlari acilabilir tutar, yeni UI ise daima explicit id ve parentId gonderir.

- [ ] **Step 7: Verify**

Run:

```bash
pnpm --filter @elektroplan/calculation-core test
pnpm --filter @elektroplan/contracts test
```

Expected: all calculation-core and contracts tests pass.

## Task 6: Gerilim Dusumu UI State Modelini Ayir

**Files:**
- Create: `apps/desktop/renderer/src/features/voltageDrop/treeModel.ts`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`

- [ ] **Step 1: Draft type ekle**

```ts
export interface VoltageDropTreeSegmentDraft {
  id: string;
  parentId: string | null;
  title: string;
  loadPowerKW: number | null;
  lengthM: number | null;
  fixedSectionKey: string | null;
  settings: VoltageDropGroupSettingsDraft;
}
```

- [ ] **Step 2: State helperlari yaz**

Fonksiyonlar:

- `createRootSegment(settings)`
- `createChildSegment(parentId, index, settings)`
- `updateSegmentDraft(segments, id, patch)`
- `removeSegmentDraft(segments, id)` descendant segmentleri de kaldirir.
- `reparentSegmentDraft(segments, id, nextParentId)` cycle olusturacak hamleyi reddeder.
- `buildVoltageDropTreeSubmission({ title, segments, settings })`

- [ ] **Step 3: Unit-level pure helper testleri ekle**

Renderer test altyapisi yoksa bu helperlar basit pure TypeScript oldugu icin `tests/worked-examples` yerine ileride renderer test setup'i eklenene kadar typecheck ile korunacak. Bu asamada en azindan invalid state `buildVoltageDropTreeSubmission` icinde `null` donmeli.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
```

Expected: renderer typecheck passes.

## Task 7: SegmentTreeCanvas Bilesenini Olustur

**Files:**
- Create: `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.tsx`
- Create: `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.module.css`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`

- [ ] **Step 1: Layout algorithm yaz**

Pure function:

```ts
export interface TreeLayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Kurallar:

- Root sol/ust baslangicta.
- Depth x ekseninde ilerler.
- Leaf sirasi y ekseninde esit aralikla dagilir.
- Parent y pozisyonu child y ortalamasidir.
- Node width `180`, height `72`, horizontal gap `96`, vertical gap `34`.
- `viewBox` tum node ve edge sinirlarindan `48px` padding alir.

- [ ] **Step 2: SVG edge ve node render et**

Edge path:

```tsx
<path
  d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
  className={edgeClassName}
/>
```

Node content:

- Segment adi.
- kW ve metre.
- Sonuc varsa selected section ve cumulative drop.
- Durum rengi.

- [ ] **Step 3: Interactions ekle**

Canvas props:

```ts
interface SegmentTreeCanvasProps {
  segments: readonly VoltageDropTreeSegmentDraft[];
  resultSegments: readonly VoltageDropGroupSegmentOutput[];
  selectedSegmentId: string | null;
  onSelectSegment(id: string): void;
  onAddChild(parentId: string): void;
  onFitView(): void;
}
```

UI kontroller:

- Zoom in.
- Zoom out.
- Fit view.
- Add child.
- Selected node vurgusu.

- [ ] **Step 4: Scale QA kriterlerini uygula**

CSS:

- Canvas root `min-height: 520px`.
- SVG `width: 100%`, `height: 100%`.
- Node text `overflow: hidden`, `text-overflow: ellipsis`.
- Butonlar sabit `36px` hedef alan.
- Mobile'da min-height `420px`, inspector alta iner.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
pnpm --filter @elektroplan/desktop-renderer build
```

Expected: renderer builds. Browser QA'da 1 root, 3 branch ve 2 derin child ile canvas kirpilmeden gorunur.

## Task 8: SegmentInspector ve Sonuc Panelini Bol

**Files:**
- Create: `apps/desktop/renderer/src/features/voltageDrop/SegmentInspector.tsx`
- Create: `apps/desktop/renderer/src/features/voltageDrop/SegmentInspector.module.css`
- Create: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropResults.tsx`
- Create: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropResults.module.css`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`

- [ ] **Step 1: Inspector form alanlarini tasarla**

Alanlar:

- Dal adi.
- Ust dal secimi.
- Yuk kW.
- Mesafe m.
- Kesit modu: otomatik veya manuel.
- Manuel kesit key select.
- Iletken: bakir, aluminyum.
- Montaj: overhead, underground veya mevcut IEC method mapping karari.
- Sicaklik.
- Gruplanan devre.
- cos phi.
- Limit yuzdesi global kalacak.

- [ ] **Step 2: Ust dal seciminde cycle guard uygula**

`reparentSegmentDraft` cycle olusturacak secenekleri inspector select listesinden cikarir. Root segmentte parent select disabled olur.

- [ ] **Step 3: Sonuc panelini dal bazli yap**

`VoltageDropResults` iki gorunum tasir:

- Summary strip: toplam yuk, maksimum kumulatif dusum, limit, uygunluk, otomatik buyutme adimi.
- Branch table: segment adi, parent, path, flow kW, current A, section key, ampacity, segment drop, cumulative drop, status.

- [ ] **Step 4: Empty ve error state ekle**

Eksik veri varken canvas calisir, hesap butonu disabled olur. Error olursa canvas node'lari korunur ve error banner gorunur.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
pnpm --filter @elektroplan/desktop-renderer build
```

Expected: no type or build errors.

## Task 9: VoltageDropPage'i Yeni Layout'a Gecir

**Files:**
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`

- [ ] **Step 1: Page shell gridini kur**

Desktop hedef:

```css
.workspace {
  display: grid;
  grid-template-columns: minmax(520px, 1fr) minmax(320px, 380px);
  grid-template-areas:
    "canvas inspector"
    "results results";
  gap: var(--space-4);
  align-items: start;
}
```

- [ ] **Step 2: Header'i sade tut**

Header:

- H1: `Gerilim Dusumu`
- Sol: grup adi input.
- Sag: hesapla, kaydet, root child ekle.
- Segment sayisi ve uygunluk pill'leri.

- [ ] **Step 3: Submission akisini bagla**

`handleSubmit` ayni bridge kanalini kullanir:

```ts
const response = await bridge.calc.voltageDropGroup(submission.request);
```

Fark: `submission.request.segments` artik explicit `id`, `parentId`, `loadPowerKW` tasir.

- [ ] **Step 4: SaveDialog kayit formatini koru**

`calculator: "voltage-drop-group"` korunur. Title bos ise `Gerilim dusumu agaci` kullanilir.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
pnpm --filter @elektroplan/desktop-renderer build
```

Expected: build passes. Manual QA'da node secimi inspector'i gunceller, inspector degisimi canvas'i gunceller, hesap sonucu node statuslarini gunceller.

## Task 10: IPC, Main Service ve Export Uyumlulugunu Kontrol Et

**Files:**
- Modify: `apps/desktop/main/src/services/calculate-service.ts`
- Modify: `apps/desktop/preload/src/index.ts`
- Modify: `packages/contracts/src/schemas.ts`
- Modify: `packages/exporters/src/json.ts`
- Modify: `packages/exporters/src/excel.ts`
- Modify: `packages/exporters/src/pdf.ts`

- [ ] **Step 1: calculate-service normalization'i dogrula**

`toVoltageDropGroupInput` `stripUndefinedDeep` ile calismaya devam eder. `parentId: null` silinmemeli. `stripUndefinedDeep` null degerleri korudugu icin ek degisiklik beklenmez.

- [ ] **Step 2: Exporter schema etkisini kontrol et**

Exporterlar calculation record'u generic tasiyorsa kod degismeyebilir. Typed kolon veya tablo uretimi varsa yeni alanlar eklenir:

- Parent.
- Flow kW.
- Selected section key.
- Cumulative drop.
- Status.

- [ ] **Step 3: Full typecheck**

Run:

```bash
pnpm typecheck
```

Expected: all packages pass.

## Task 11: E2E ve Visual QA

**Files:**
- Modify: `tests/e2e/src/voltageDrop.spec.ts`
- Modify: `tests/e2e/src/fixtures.ts`

- [ ] **Step 1: E2E fixture olustur**

Fixture:

- Root `Ana besleme`, load 0 kW, length 150 m.
- Child `Dal 1`, load 10 kW, length 40 m.
- Child `Dal 2`, load 8 kW, length 35 m.
- Grandchild `Dal 1.1`, load 3 kW, length 20 m.

Beklenen:

- Root flow 21 kW.
- Dal 1 flow 13 kW.
- Dal 2 flow 8 kW.
- Dal 1.1 flow 3 kW.
- Dal 2 cumulative drop path sadece `Ana besleme + Dal 2`.

- [ ] **Step 2: UI interaction testleri**

Akis:

1. Gerilim dusumu sayfasini ac.
2. Sol menuyu daralt ve ana canvas genisligini dogrula.
3. Root child ekle.
4. Child adini `Dal 1` yap.
5. Child node'a tikla.
6. Inspector'da kW ve metre gir.
7. Hesapla.
8. Sonuc panelinde `Dal 1` ve section key gorundugunu assert et.

- [ ] **Step 3: Responsive QA**

Viewportlar:

- `1440 x 900`
- `1280 x 800`
- `390 x 844`

Kontroller:

- Text tasmasi yok.
- Canvas kirpilmiyor.
- Inspector mobile'da alta iner.
- Sonuc tablosu mobile'da yatay kayar.
- Sol menu collapsed state ana icerigi genisletir.

- [ ] **Step 4: Commands**

Run:

```bash
pnpm build
pnpm --filter @elektroplan/calculation-core test
pnpm --filter @elektroplan/contracts test
pnpm --filter @elektroplan/desktop-renderer typecheck
pnpm --filter @elektroplan/desktop-renderer build
pnpm --filter @elektroplan/e2e test
```

Expected: all commands pass. E2E paketi mevcut ortamda Electron baslatma gerektirirse hata logu saklanir ve Browser plugin ile ayni kritik akis manuel dogrulanir.

## Kabul Kriterleri

- Sol ana menu tek butonla acilip kapanir, state localStorage'da kalir.
- Sol menu kapandiginda gerilim dusumu canvas alani genisler.
- Gerilim dusumu UI'i duz satir listesi yerine interaktif agac canvas'i kullanir.
- Her segment tiklanabilir ve inspector'da duzenlenebilir.
- Her dal ayri adlandirilabilir.
- Segmentler `parentId` ile root/child iliskisi kurar.
- Hesap motoru kardes dallari birbirine eklemez.
- Upstream segment `flowPowerKW` degeri descendant yuklerini icerir.
- Kumulatif gerilim dusumu sadece root-to-node path uzerinden hesaplanir.
- Otomatik kesit secimi termal baseline ile baslar ve gerilim dusumu limitine gore section key buyutur.
- Legacy parallel section keyleri matematikte dogru alanla hesaplanir.
- Manuel kesit secilen segment otomatik buyutulmaz, ancak uygunluk sonucu hesaplanir.
- Eski lineer kayitlar acildiginda wrapper ile root-to-chain formatina normalize edilir.
- Desktop ve mobile viewportlarda text veya kontroller ust uste binmez.

## Riskler ve Kararlar

- **React Flow eklememe karari:** Yeni dependency icin network ve bundle riski var. Ilk surum custom SVG ile ihtiyaci karsilar. Drag/drop reparenting gereksinimi buyurse React Flow ayri bir planla eklenebilir.
- **Legacy formul tercihi:** `legacy_calculations.py` gerilim dusumunde `cosphi` kullanmiyor. Yeni tree motorunda da legacy uyumluluk icin cos phi sadece current hesabinda kullanilacak.
- **IEC data ile legacy table ayrimi:** Mevcut IEC ampacity dataset'i paralel keyleri tasimiyor. Bu plan tree motorunda legacy table adaptorunu kullanir; diger cable calculator modulleri etkilenmez.
- **Saved record uyumlulugu:** Calculator kind ve IPC channel korunur. Yeni result alanlari eklenir, eski alanlardan kritik olan `selectedSectionMm2` gecis icin korunur.

## Implementation Order

1. Sol menu collapse.
2. Contract ve bridge type hazirligi.
3. Legacy table ve tree core types.
4. Graph validation ve flow power.
5. Optimizer.
6. VoltageDropGroup wrapper migration.
7. Renderer tree state helper.
8. SVG canvas.
9. Inspector ve results.
10. Page integration.
11. E2E, responsive ve Browser QA.

Bu siralama ile once veri kontrati ve hesap dogrulugu kilitlenir, sonra UI bu stabil modelin uzerine kurulur.
