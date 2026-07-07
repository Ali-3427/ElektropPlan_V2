# Eski Programdan Cikarilan Hesap Mantigi

Kaynak dosya: `gerilim_dusumu_V-2.05 - Kopya.exe`

Paket: PyInstaller, Python 3.13.7.

Ana hesap metodu: `GerilimDusumuApp.hesapla`, eski kaynak satirlari yaklasik 519-584.

## Girdi Anahtarlari

- `conductor`: `copper` veya `aluminum`
- `installation`: `overhead` veya `underground`
- `voltage_type`: `three` veya `single`
- `power_kw`: aktif guc, kW
- `distance_m`: kablo uzunlugu, metre
- `voltage_v`: gerilim, V
- `cosphi`: guc katsayisi
- `section`: kesit
- `temperature`: sicaklik; eski programda `30°C` gibi tutuluyor
- `cable_count`: grup katsayisi anahtari; `1`, `2`, `3`, `4-6` vb.

## Formuller

Ortak:

```text
P = power_kw * 1000
k = 56  if conductor == "copper"
k = 35  otherwise
allowed_current = table_ampacity(section, conductor, installation) * kt(temperature) * kg(cable_count)
```

Trifaze:

```text
voltage_drop_percent = (100 * P * distance_m) / (k * section * voltage_v^2)
current_a = P / (sqrt(3) * voltage_v * cosphi)
```

Monofaze:

```text
voltage_drop_percent = (200 * P * distance_m) / (k * section * voltage_v^2)
current_a = P / (voltage_v * cosphi)
```

Durum kontrolleri:

```text
voltage_drop_ok = voltage_drop_percent <= segment_voltage_drop_limit
thermal_ok = current_a <= allowed_current
section_suitable = voltage_drop_ok and thermal_ok
total_voltage_drop = sum(segment voltage_drop_percent)
total_voltage_drop_ok = total_voltage_drop <= total_limit
highest_current = max(segment current_a)
```

## Kesit Uygunluk Algoritmasi

Eski program otomatik kesit secmiyor; kullanicinin sectigi kesiti iki ayri kural ile dogruluyor.

1. Akim kapasitesi tablosu secilir:

```text
if conductor == "copper" and installation == "overhead":
    table = COPPER_OVERHEAD
if conductor == "copper" and installation == "underground":
    table = COPPER_UNDERGROUND
if conductor == "aluminum" and installation == "overhead":
    table = ALUMINUM_OVERHEAD
if conductor == "aluminum" and installation == "underground":
    table = ALUMINUM_UNDERGROUND
```

2. Secilen kesit tabloda bulunur. Bulunamazsa eski program hata verir.

3. Isil uygunluk hesabi:

```text
base_ampacity = table[section]
kt = temperature_factor[temperature] default 1.0
kg = group_factor[cable_count] default 1.0
allowed_current = base_ampacity * kt * kg
thermal_ok = current_a <= allowed_current
```

4. Gerilim dusumu uygunlugu:

```text
voltage_drop_ok = voltage_drop_percent <= segment_voltage_drop_limit
```

5. Kesit genel uygunlugu:

```text
section_suitable = voltage_drop_ok and thermal_ok
```

Eski ekrandaki mesajlar:

```text
voltage_drop_ok       -> "Gerilim dusumu UYGUN"
voltage_drop_exceeded -> "Gerilim dusumu SINIRI ASILDI"
thermal_ok            -> "Isil hesap UYGUN"
thermal_failed        -> "Kablo kesiti isil olarak YETERSIZ"
```

`legacy_calculations.py` icinde bu algoritma `evaluate_segment()` ve `evaluate_project()` fonksiyonlari ile aktarildi.

## Notlar

- Eski program gerilim dusumu hesabinda `cosphi` kullanmiyor; `cosphi` sadece akim hesabinda var.
- `underground` secilince `_UNDERGROUND` akim kapasitesi tablolari kullaniliyor; `overhead` secilince `_OVERHEAD`.
- Tablolar ve tasinabilir hesap fonksiyonu `legacy_calculations.py` dosyasina aktarildi.
