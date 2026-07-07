import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { VoltageDropProfileSummary } from "../../bridge/types";
import { getBridge, isBridgeAvailable } from "../../bridge/client";
import { queryKeys } from "../../query/keys";
import { Card } from "../../ui/Card";
import { Field } from "../../ui/Field";
import { NumberInput } from "../../ui/NumberInput";
import { Select } from "../../ui/Select";
import { Button } from "../../ui/Button";
import { Spinner } from "../../ui/Spinner";
import { ErrorBanner } from "../../ui/ErrorBanner";
import {
  THEMES,
  useTheme,
  type ThemeMode,
} from "../shared/theme/ThemeContext";
import { usePersistentPageState } from "../shared/usePersistentPageState";
import {
  CONDUCTOR_MATERIAL_OPTIONS,
  createInitialSettings,
  IMPEDANCE_OPTIONS,
  INSULATION_OPTIONS,
  INSTALLATION_METHOD_OPTIONS,
  mergeVoltageDropGroupDefaults,
  PHASE_MODE_OPTIONS,
  VOLTAGE_DROP_GROUP_DEFAULTS_SETTING_KEY,
  type VoltageDropGroupSettingsDraft,
} from "../voltageDrop/voltageDropGroup";
import styles from "./SettingsPage.module.css";

const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Aydınlık (Beyaz + Amber)",
  dark: "Koyu (Siyah + Amber)",
  cream: "Krem (Krem + Turuncu)",
};

const SETTINGS_DRAFT_STORAGE_KEY = "elektroplan.page.settings.draft";

interface SettingsPageDraftState {
  readonly firmName: string;
  readonly defaultVdProfile: string;
  readonly voltageDropGroupDefaults: VoltageDropGroupSettingsDraft;
}

function createDefaultSettingsPageDraftState(): SettingsPageDraftState {
  return {
    firmName: "",
    defaultVdProfile: "",
    voltageDropGroupDefaults: createInitialSettings(),
  };
}

function hasPersistedSettingsDraft(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(SETTINGS_DRAFT_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const hasStoredDraftRef = useRef(hasPersistedSettingsDraft());
  const didHydrateRemoteDefaultsRef = useRef(hasStoredDraftRef.current);
  const [pageState, setPageState] = usePersistentPageState<SettingsPageDraftState>({
    key: SETTINGS_DRAFT_STORAGE_KEY,
    version: 1,
    defaultValue: () => createDefaultSettingsPageDraftState(),
  });
  const [firmName, setFirmName] = useState(pageState.firmName);
  const [defaultVdProfile, setDefaultVdProfile] = useState(pageState.defaultVdProfile);
  const [voltageDropGroupDefaults, setVoltageDropGroupDefaults] =
    useState<VoltageDropGroupSettingsDraft>(pageState.voltageDropGroupDefaults);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const engineQuery = useQuery({
    queryKey: queryKeys.engineVersion,
    queryFn: () => getBridge().app.engineVersion(),
    enabled: isBridgeAvailable(),
    staleTime: Infinity,
  });

  const firmNameQuery = useQuery({
    queryKey: queryKeys.setting("firmName"),
    queryFn: () => getBridge().settings.get("firmName"),
    enabled: isBridgeAvailable(),
  });

  const defaultVdQuery = useQuery({
    queryKey: queryKeys.setting("defaultVdProfile"),
    queryFn: () => getBridge().settings.get("defaultVdProfile"),
    enabled: isBridgeAvailable(),
  });

  const profilesQuery = useQuery({
    queryKey: queryKeys.vdProfiles,
    queryFn: () => getBridge().data.voltageDropProfiles(),
    enabled: isBridgeAvailable(),
  });

  const voltageDropGroupDefaultsQuery = useQuery({
    queryKey: queryKeys.setting(VOLTAGE_DROP_GROUP_DEFAULTS_SETTING_KEY),
    queryFn: () => getBridge().settings.get(VOLTAGE_DROP_GROUP_DEFAULTS_SETTING_KEY),
    enabled: isBridgeAvailable(),
  });

  useEffect(() => {
    setPageState({
      firmName,
      defaultVdProfile,
      voltageDropGroupDefaults,
    });
  }, [defaultVdProfile, firmName, setPageState, voltageDropGroupDefaults]);

  useEffect(() => {
    if (hasStoredDraftRef.current || didHydrateRemoteDefaultsRef.current) {
      return;
    }

    if (firmNameQuery.data?.value !== undefined) {
      setFirmName(String(firmNameQuery.data.value));
    }
  }, [firmNameQuery.data]);

  useEffect(() => {
    if (hasStoredDraftRef.current || didHydrateRemoteDefaultsRef.current) {
      return;
    }

    if (defaultVdQuery.data?.value !== undefined) {
      setDefaultVdProfile(String(defaultVdQuery.data.value));
    }
  }, [defaultVdQuery.data]);

  useEffect(() => {
    if (hasStoredDraftRef.current || didHydrateRemoteDefaultsRef.current) {
      return;
    }

    if (voltageDropGroupDefaultsQuery.data?.value !== undefined) {
      setVoltageDropGroupDefaults(
        mergeVoltageDropGroupDefaults(voltageDropGroupDefaultsQuery.data.value),
      );
    }
  }, [voltageDropGroupDefaultsQuery.data]);

  useEffect(() => {
    if (
      hasStoredDraftRef.current ||
      didHydrateRemoteDefaultsRef.current ||
      firmNameQuery.isLoading ||
      defaultVdQuery.isLoading ||
      voltageDropGroupDefaultsQuery.isLoading
    ) {
      return;
    }

    didHydrateRemoteDefaultsRef.current = true;
  }, [
    defaultVdQuery.isLoading,
    firmNameQuery.isLoading,
    voltageDropGroupDefaultsQuery.isLoading,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const bridge = getBridge();
      await bridge.settings.set("firmName", firmName);
      await bridge.settings.set("defaultVdProfile", defaultVdProfile);
      await bridge.settings.set(
        VOLTAGE_DROP_GROUP_DEFAULTS_SETTING_KEY,
        voltageDropGroupDefaults,
      );
    },
    onSuccess: () => {
      setSaved(true);
      setSaveError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: unknown) => {
      setSaveError(e instanceof Error ? e.message : "Kayıt sırasında hata oluştu.");
    },
  });

  const profiles: readonly VoltageDropProfileSummary[] = profilesQuery.data ?? [];
  const profileOptions = profiles.map((p) => ({
    value: p.id,
    label: `${p.titleTr} (${p.limitPercent}%)`,
  }));

  const isLoading =
    firmNameQuery.isLoading ||
    defaultVdQuery.isLoading ||
    profilesQuery.isLoading ||
    voltageDropGroupDefaultsQuery.isLoading;

  if (isLoading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Ayarlar</h1>

      <Card title="Görünüm">
        <Field label="Tema">
          <div className={styles.themeGrid} role="radiogroup" aria-label="Tema">
            {THEMES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={theme === mode}
                className={`${styles.themeCard} ${theme === mode ? styles.themeCardActive : ""}`}
                data-theme-preview={mode}
                onClick={() => setTheme(mode)}
              >
                <span className={styles.themeSwatch} aria-hidden="true">
                  <span className={styles.themeSwatchBg} />
                  <span className={styles.themeSwatchAccent} />
                </span>
                <span className={styles.themeCardLabel}>{THEME_LABELS[mode]}</span>
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <Card title="Gerilim Düşümü Grup Varsayılanları">
        <div className={styles.defaultsGrid}>
          <Field label="Faz">
            <Select
              value={voltageDropGroupDefaults.phaseMode}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  phaseMode: next as VoltageDropGroupSettingsDraft["phaseMode"],
                }))
              }
              options={PHASE_MODE_OPTIONS}
            />
          </Field>
          <Field label="Limit %">
            <NumberInput
              value={voltageDropGroupDefaults.limitPercent}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({ ...current, limitPercent: next }))
              }
              placeholder="3"
            />
          </Field>
          <Field label="3 faz gerilimi">
            <NumberInput
              value={voltageDropGroupDefaults.threePhaseVoltageV}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  threePhaseVoltageV: next,
                }))
              }
              placeholder="400"
            />
          </Field>
          <Field label="Tek faz gerilimi">
            <NumberInput
              value={voltageDropGroupDefaults.singlePhaseVoltageV}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  singlePhaseVoltageV: next,
                }))
              }
              placeholder="230"
            />
          </Field>
          <Field label="cos phi">
            <NumberInput
              value={voltageDropGroupDefaults.cosPhi}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({ ...current, cosPhi: next }))
              }
              placeholder="0,85"
            />
          </Field>
          <Field label="Verim %">
            <NumberInput
              value={voltageDropGroupDefaults.efficiencyPercent}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  efficiencyPercent: next,
                }))
              }
              placeholder="100"
            />
          </Field>
          <Field label="Malzeme">
            <Select
              value={voltageDropGroupDefaults.conductorMaterial}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  conductorMaterial: next as VoltageDropGroupSettingsDraft["conductorMaterial"],
                }))
              }
              options={CONDUCTOR_MATERIAL_OPTIONS}
            />
          </Field>
          <Field label="Montaj">
            <Select
              value={voltageDropGroupDefaults.installationMethod}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  installationMethod: next as VoltageDropGroupSettingsDraft["installationMethod"],
                }))
              }
              options={INSTALLATION_METHOD_OPTIONS}
            />
          </Field>
          <Field label="Izolasyon">
            <Select
              value={voltageDropGroupDefaults.insulationRating}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  insulationRating: next as VoltageDropGroupSettingsDraft["insulationRating"],
                }))
              }
              options={INSULATION_OPTIONS}
            />
          </Field>
          <Field label="Ortam C">
            <NumberInput
              value={voltageDropGroupDefaults.ambientTemperatureC}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  ambientTemperatureC: next,
                }))
              }
              placeholder="30"
            />
          </Field>
          <Field label="Gruplanan devre">
            <NumberInput
              value={voltageDropGroupDefaults.groupedCircuits}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  groupedCircuits: next,
                }))
              }
              placeholder="1"
            />
          </Field>
          <Field label="Iletken C">
            <NumberInput
              value={voltageDropGroupDefaults.conductorTempC}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  conductorTempC: next,
                }))
              }
              placeholder="70"
            />
          </Field>
          <Field label="Empedans">
            <Select
              value={voltageDropGroupDefaults.impedanceMode}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  impedanceMode: next as VoltageDropGroupSettingsDraft["impedanceMode"],
                }))
              }
              options={IMPEDANCE_OPTIONS}
            />
          </Field>
          <Field label="Terminal katsayisi">
            <NumberInput
              value={voltageDropGroupDefaults.terminalLossFactor}
              onChange={(next) =>
                setVoltageDropGroupDefaults((current) => ({
                  ...current,
                  terminalLossFactor: next,
                }))
              }
              placeholder="1,015"
            />
          </Field>
        </div>
      </Card>

      <Card title="Uygulama Ayarları">
        <div className={styles.form}>
          <Field label="Firma Adı">
            <input
              type="text"
              className={styles.input}
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="örn. Elektrik A.Ş."
            />
          </Field>

          {profileOptions.length > 0 && (
            <Field label="Varsayılan Gerilim Düşüm Profili">
              <Select
                value={defaultVdProfile}
                onChange={setDefaultVdProfile}
                options={profileOptions}
              />
            </Field>
          )}

          <Field label="Uygulama Sürümü (Engine)">
            <input
              type="text"
              className={styles.readonly}
              value={engineQuery.data ?? "…"}
              readOnly
            />
          </Field>

          {saveError && <ErrorBanner message={saveError} />}

          {saved && (
            <div className={styles.successMsg}>Ayarlar kaydedildi.</div>
          )}

          <div className={styles.actions}>
            <Button
              variant="primary"
              loading={saveMutation.isPending}
              onClick={() => {
                setSaveError(null);
                saveMutation.mutate();
              }}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
