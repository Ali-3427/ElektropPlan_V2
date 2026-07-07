import { useEffect, useRef, useState } from "react";

import type { CalculationRecord } from "../../bridge/types";
import { getBridge } from "../../bridge/client";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ErrorBanner } from "../../ui/ErrorBanner";
import { Field, fieldGrid } from "../../ui/Field";
import { NumberInput } from "../../ui/NumberInput";
import { ResultPanel } from "../../ui/ResultPanel";
import { SaveDialog } from "../../ui/SaveDialog";
import { Select } from "../../ui/Select";
import { usePersistentPageState } from "../shared/usePersistentPageState";
import { SegmentInspector } from "./SegmentInspector";
import { SegmentListEditor } from "./SegmentListEditor";
import { SegmentTreeCanvas } from "./SegmentTreeCanvas";
import { VoltageDropResults } from "./VoltageDropResults";
import {
  CONDUCTOR_MATERIAL_OPTIONS,
  createInitialSettings,
  IMPEDANCE_OPTIONS,
  INSULATION_OPTIONS,
  INSTALLATION_METHOD_OPTIONS,
  mergeVoltageDropGroupDefaults,
  PHASE_MODE_OPTIONS,
  VOLTAGE_DROP_GROUP_DEFAULTS_SETTING_KEY,
  type VoltageDropGroupBridge,
  type VoltageDropGroupRequest,
  type VoltageDropGroupResponse,
  type VoltageDropGroupSettingsDraft,
} from "./voltageDropGroup";
import {
  buildVoltageDropTreeSubmission,
  createChildSegment,
  createRootSegment,
  removeSegmentDraft,
  reparentSegmentDraft,
  updateSegmentDraft,
  type VoltageDropTreeSegmentValuePatch,
  type VoltageDropTreeSegmentDraft,
} from "./treeModel";
import styles from "./VoltageDropPage.module.css";

interface VoltageDropPageState {
  readonly groupTitle: string;
  readonly segments: VoltageDropTreeSegmentDraft[];
  readonly settings: VoltageDropGroupSettingsDraft;
  readonly selectedSegmentId: string | null;
  readonly showAdvanced: boolean;
  readonly treeVisible: boolean;
  readonly result: VoltageDropGroupResponse | null;
  readonly lastRequest: VoltageDropGroupRequest | null;
}

function createDefaultVoltageDropPageState(): VoltageDropPageState {
  const settings = createInitialSettings();
  const rootSegment = createRootSegment(settings);
  return {
    groupTitle: "",
    segments: [rootSegment],
    settings,
    selectedSegmentId: rootSegment.id,
    showAdvanced: false,
    treeVisible: true,
    result: null,
    lastRequest: null,
  };
}

function isFreshVoltageDropPageState(state: VoltageDropPageState): boolean {
  return (
    state.groupTitle.trim() === "" &&
    state.segments.length === 1 &&
    state.segments[0]?.parentId === null &&
    state.segments[0]?.title === "Segment 1" &&
    state.segments[0]?.loadPowerKW === null &&
    state.segments[0]?.lengthM === null &&
    state.segments[0]?.fixedSectionKey === null &&
    state.result === null &&
    state.lastRequest === null &&
    state.showAdvanced === false
  );
}

export function VoltageDropPage() {
  const [pageState, setPageState] = usePersistentPageState<VoltageDropPageState>({
    key: "elektroplan.page.voltageDrop",
    version: 1,
    defaultValue: () => createDefaultVoltageDropPageState(),
  });
  const [groupTitle, setGroupTitle] = useState(pageState.groupTitle);
  const [segments, setSegments] = useState<VoltageDropTreeSegmentDraft[]>(pageState.segments);
  const [settings, setSettings] = useState<VoltageDropGroupSettingsDraft>(pageState.settings);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    pageState.selectedSegmentId,
  );
  const [showAdvanced, setShowAdvanced] = useState(pageState.showAdvanced);
  const [treeVisible, setTreeVisible] = useState(pageState.treeVisible);
  const [result, setResult] = useState<VoltageDropGroupResponse | null>(pageState.result);
  const [lastRequest, setLastRequest] = useState<VoltageDropGroupRequest | null>(
    pageState.lastRequest,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const submitInFlightRef = useRef(false);
  const shouldApplyDefaultsRef = useRef(isFreshVoltageDropPageState(pageState));

  useEffect(() => {
    setPageState({
      groupTitle,
      segments,
      settings,
      selectedSegmentId,
      showAdvanced,
      treeVisible,
      result,
      lastRequest,
    });
  }, [
    groupTitle,
    lastRequest,
    result,
    segments,
    selectedSegmentId,
    setPageState,
    settings,
    showAdvanced,
    treeVisible,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaults() {
      try {
        const stored = await getBridge().settings.get(VOLTAGE_DROP_GROUP_DEFAULTS_SETTING_KEY);
        if (cancelled || stored === null) {
          return;
        }

        if (!shouldApplyDefaultsRef.current) {
          return;
        }

        const merged = mergeVoltageDropGroupDefaults(stored.value);
        setSettings(merged);
        setSegments((current) => {
          const firstSegment = current[0];
          if (
            current.length === 1 &&
            firstSegment &&
            firstSegment.loadPowerKW === null &&
            firstSegment.lengthM === null
          ) {
            return [createRootSegment(merged)];
          }

          return current;
        });
      } catch {
        // Persisted defaults are optional; built-in defaults remain valid.
      }
    }

    void loadDefaults();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (segments.length === 0) {
      setSelectedSegmentId(null);
      return;
    }
    if (!selectedSegmentId || !segments.some((segment) => segment.id === selectedSegmentId)) {
      const firstSegment = segments[0];
      setSelectedSegmentId(firstSegment ? firstSegment.id : null);
    }
  }, [segments, selectedSegmentId]);

  const submission = buildVoltageDropTreeSubmission({
    title: groupTitle,
    segments,
    settings,
  });

  async function handleSubmit() {
    if (!submission || loading || submitInFlightRef.current) {
      return;
    }

    submitInFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const bridge = getBridge() as VoltageDropGroupBridge;
      const response = await bridge.calc.voltageDropGroup(submission.request);
      setResult(response);
      setLastRequest(submission.request);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Hesaplama hatasi.");
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  }

  function updateSegment(segmentId: string, next: VoltageDropTreeSegmentValuePatch) {
    setSegments((current) => updateSegmentDraft(current, segmentId, next));
  }

  function addChildSegment(parentId: string) {
    setSegments((current) => [
      ...current,
      createChildSegment(parentId, current.length, settings),
    ]);
  }

  function reparentSegment(segmentId: string, nextParentId: string) {
    setSegments((current) => reparentSegmentDraft(current, segmentId, nextParentId));
  }

  function updateGroupSettings(next: Partial<VoltageDropGroupSettingsDraft>) {
    setSettings((previousSettings) => {
      const nextSettings = { ...previousSettings, ...next };
      setSegments((current) =>
        current.map((segment) => {
          let nextSegmentSettings = { ...segment.settings };

          for (const key of Object.keys(next) as Array<keyof VoltageDropGroupSettingsDraft>) {
            const nextValue = next[key];
            if (
              nextValue !== undefined &&
              Object.is(segment.settings[key], previousSettings[key])
            ) {
              nextSegmentSettings = {
                ...nextSegmentSettings,
                [key]: nextValue,
              } as VoltageDropGroupSettingsDraft;
            }
          }

          return { ...segment, settings: nextSegmentSettings };
        }),
      );
      return nextSettings;
    });
  }

  function updateSegmentSettings(
    segmentId: string,
    next: Partial<VoltageDropGroupSettingsDraft>,
  ) {
    setSegments((current) =>
      current.map((segment) =>
        segment.id === segmentId
          ? { ...segment, settings: { ...segment.settings, ...next } }
          : segment,
      ),
    );
  }

  function removeSegment(segmentId: string) {
    setSegments((current) => {
      if (current.length <= 1) {
        return current;
      }

      return removeSegmentDraft(current, segmentId);
    });
  }

  const saveRecord: CalculationRecord | null =
    result && lastRequest
      ? {
          id: crypto.randomUUID(),
          calculator: "voltage-drop-group",
          title: groupTitle.trim() || "Gerilim dusumu agaci",
          version: {
            contractVersion: "1",
            engineVersion: result.engineVersion,
            dataVersion: result.dataVersion,
          },
          input: lastRequest,
          output: {
            ...result,
            warnings: [...result.warnings],
            assumptions: [...result.assumptions],
            value: {
              ...result.value,
              segments: [...result.value.segments],
              optimizationSteps: [...result.value.optimizationSteps],
            },
          },
        }
      : null;

  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const selectedSegmentIndex = selectedSegment
    ? segments.findIndex((segment) => segment.id === selectedSegment.id)
    : -1;
  const rootSegment = segments.find((segment) => segment.parentId === null) ?? segments[0] ?? null;
  const rootSegmentId = rootSegment?.id ?? null;
  const addTargetSegmentId = selectedSegmentId ?? rootSegmentId;
  const advancedPanelId = "voltage-drop-advanced-panel";
  const readinessLabel = submission ? "Hazir" : "Eksik veri";
  const complianceLabel = result
    ? result.value.isCompliant
      ? "Uygun"
      : "Uygun degil"
    : "Sonuc yok";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.heading}>Gerilim Dusumu</h1>
          <div className={styles.titleField}>
            <label className={styles.titleLabel} htmlFor="voltage-drop-group-title">
              Grup adi
            </label>
            <input
              id="voltage-drop-group-title"
              className={styles.textInput}
              type="text"
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
              placeholder="A grubu"
            />
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.headerActions}>
            <Button
              type="button"
              variant="primary"
              disabled={!submission}
              loading={loading}
              onClick={() => void handleSubmit()}
            >
              Hesapla
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!saveRecord}
              onClick={() => setShowSave(true)}
            >
              Kaydet
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTreeVisible((current) => !current)}
              aria-pressed={treeVisible}
            >
              {treeVisible ? "Agaci gizle" : "Agaci goster"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!addTargetSegmentId}
              onClick={() => {
                if (addTargetSegmentId) {
                  addChildSegment(addTargetSegmentId);
                }
              }}
            >
              Seciliye alt segment
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!rootSegmentId}
              onClick={() => {
                if (rootSegmentId) {
                  addChildSegment(rootSegmentId);
                }
              }}
            >
              Koke alt segment
            </Button>
          </div>
          <div
            className={styles.headerMeta}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={styles.srOnly}>
              Durum: {readinessLabel}. Uygunluk: {complianceLabel}.
            </span>
            <span className={styles.headerPill}>{segments.length} segment</span>
            <span
              className={`${styles.headerPill} ${
                submission ? styles.headerPillReady : styles.headerPillWarn
              }`}
            >
              {readinessLabel}
            </span>
            <span
              className={`${styles.headerPill} ${
                result
                  ? result.value.isCompliant
                    ? styles.headerPillReady
                    : styles.headerPillWarn
                  : styles.headerPillIdle
              }`}
            >
              {complianceLabel}
            </span>
          </div>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className={styles.layout} data-tree-visible={treeVisible ? "true" : "false"}>
        {treeVisible ? (
          <Card
            className={styles.canvasArea!}
            title="Segment agaci"
            subtitle="Agac uzerinden bir dugum secin ve cocuk segment ekleyin."
          >
            <SegmentTreeCanvas
              segments={segments}
              resultSegments={result?.value.segments ?? null}
              selectedSegmentId={selectedSegmentId}
              onSelectSegment={setSelectedSegmentId}
              onAddChild={addChildSegment}
            />
          </Card>
        ) : null}

        <Card
          className={styles.segmentListArea!}
          title="Segment listesi"
          subtitle="Agactan bagimsiz segment secin, ekleyin veya silin."
        >
          <SegmentListEditor
            segments={segments}
            resultSegments={result?.value.segments ?? null}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={setSelectedSegmentId}
            onAddChild={addChildSegment}
            onRemove={removeSegment}
            canRemove={() => segments.length > 1}
          />
        </Card>

        <Card
          className={styles.inspectorArea!}
          title="Segment denetleyici"
          subtitle="Secili dugumun yuk, mesafe, kesit ve ebeveyn ayarlarini duzenleyin."
        >
          <div className={styles.form}>
            {selectedSegment ? (
              <div className={styles.selectedEditorBlock}>
                <SegmentInspector
                  segment={selectedSegment}
                  segmentIndex={selectedSegmentIndex}
                  segments={segments}
                  canRemove={segments.length > 1}
                  onChange={(next) => updateSegment(selectedSegment.id, next)}
                  onSettingsChange={(next) => updateSegmentSettings(selectedSegment.id, next)}
                  onReparent={(nextParentId) =>
                    reparentSegment(selectedSegment.id, nextParentId)
                  }
                  onRemove={() => removeSegment(selectedSegment.id)}
                />
              </div>
            ) : (
              <div className={styles.emptyInspector}>
                Agactan bir segment secerek denetleyiciyi etkinlestirin.
              </div>
            )}

            <div className={styles.sectionBlock}>
              <Button
                variant="secondary"
                className={styles.advancedToggle ?? ""}
                onClick={() => setShowAdvanced((current) => !current)}
                aria-expanded={showAdvanced}
                aria-controls={advancedPanelId}
              >
                {showAdvanced ? "Gelismis ayarlari gizle" : "Gelismis ayarlari goster"}
              </Button>

              {showAdvanced ? (
                <div id={advancedPanelId} className={styles.advancedPanel}>
                  <div className={fieldGrid}>
                    <Field label="Limit %" required>
                      <NumberInput
                        value={settings.limitPercent}
                        onChange={(next) => updateGroupSettings({ limitPercent: next })}
                        placeholder="3"
                      />
                    </Field>
                    <Field label="Faz modu">
                      <Select
                        value={settings.phaseMode}
                        onChange={(next) =>
                          updateGroupSettings({
                            phaseMode: next as VoltageDropGroupSettingsDraft["phaseMode"],
                          })
                        }
                        options={PHASE_MODE_OPTIONS}
                      />
                    </Field>
                    <Field label="Tek faz gerilimi (V)" required>
                      <NumberInput
                        value={settings.singlePhaseVoltageV}
                        onChange={(next) =>
                          updateGroupSettings({
                            singlePhaseVoltageV: next,
                          })
                        }
                        placeholder="230"
                      />
                    </Field>
                    <Field label="Uclu faz gerilimi (V)" required>
                      <NumberInput
                        value={settings.threePhaseVoltageV}
                        onChange={(next) =>
                          updateGroupSettings({
                            threePhaseVoltageV: next,
                          })
                        }
                        placeholder="400"
                      />
                    </Field>
                    <Field label="cos phi" required>
                      <NumberInput
                        value={settings.cosPhi}
                        onChange={(next) => updateGroupSettings({ cosPhi: next })}
                        placeholder="0,8"
                      />
                    </Field>
                    <Field label="Verimlilik %" required>
                      <NumberInput
                        value={settings.efficiencyPercent}
                        onChange={(next) =>
                          updateGroupSettings({
                            efficiencyPercent: next,
                          })
                        }
                        placeholder="100"
                      />
                    </Field>
                    <Field label="Iletken malzeme" required>
                      <Select
                        value={settings.conductorMaterial}
                        onChange={(next) =>
                          updateGroupSettings({
                            conductorMaterial: next as VoltageDropGroupSettingsDraft["conductorMaterial"],
                          })
                        }
                        options={CONDUCTOR_MATERIAL_OPTIONS}
                      />
                    </Field>
                    <Field label="Montaj yontemi" required>
                      <Select
                        value={settings.installationMethod}
                        onChange={(next) =>
                          updateGroupSettings({
                            installationMethod: next as VoltageDropGroupSettingsDraft["installationMethod"],
                          })
                        }
                        options={INSTALLATION_METHOD_OPTIONS}
                      />
                    </Field>
                    <Field label="Izolasyon" required>
                      <Select
                        value={settings.insulationRating}
                        onChange={(next) =>
                          updateGroupSettings({
                            insulationRating: next as VoltageDropGroupSettingsDraft["insulationRating"],
                          })
                        }
                        options={INSULATION_OPTIONS}
                      />
                    </Field>
                    <Field label="Ortam sicakligi (C)" required>
                      <NumberInput
                        value={settings.ambientTemperatureC}
                        onChange={(next) =>
                          updateGroupSettings({
                            ambientTemperatureC: next,
                          })
                        }
                        placeholder="30"
                      />
                    </Field>
                    <Field label="Gruplanan devre" required>
                      <NumberInput
                        value={settings.groupedCircuits}
                        onChange={(next) =>
                          updateGroupSettings({
                            groupedCircuits: next,
                          })
                        }
                        placeholder="1"
                      />
                    </Field>
                    <Field label="3. harmonik %" required>
                      <NumberInput
                        value={settings.thirdHarmonicPercent}
                        onChange={(next) =>
                          updateGroupSettings({
                            thirdHarmonicPercent: next,
                          })
                        }
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Iletken sicakligi (C)" required>
                      <NumberInput
                        value={settings.conductorTempC}
                        onChange={(next) =>
                          updateGroupSettings({
                            conductorTempC: next,
                          })
                        }
                        placeholder="70"
                      />
                    </Field>
                    <Field label="Empedans modu" required>
                      <Select
                        value={settings.impedanceMode}
                        onChange={(next) =>
                          updateGroupSettings({
                            impedanceMode: next as VoltageDropGroupSettingsDraft["impedanceMode"],
                          })
                        }
                        options={IMPEDANCE_OPTIONS}
                      />
                    </Field>
                    {settings.impedanceMode === "exact-ac" ? (
                      <Field label="Reaktans (ohm/km)" required>
                        <NumberInput
                          value={settings.reactanceOhmPerKm}
                          onChange={(next) =>
                            updateGroupSettings({
                              reactanceOhmPerKm: next,
                            })
                          }
                          placeholder="0,08"
                        />
                      </Field>
                    ) : null}
                    <Field label="Terminal kaybi katsayisi" required>
                      <NumberInput
                        value={settings.terminalLossFactor}
                        onChange={(next) =>
                          updateGroupSettings({
                            terminalLossFactor: next,
                          })
                        }
                        placeholder="1,015"
                      />
                    </Field>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <div className={styles.resultsArea}>
          {result ? (
            <ResultPanel
              title="Hesap sonucu"
              warnings={[...result.warnings]}
              assumptions={[...result.assumptions]}
              engineVersion={result.engineVersion}
              dataVersion={result.dataVersion}
            >
              <VoltageDropResults result={result} groupTitle={groupTitle} />
            </ResultPanel>
          ) : (
            <Card
              title="Hesap sonucu"
              subtitle="Segmentleri doldurup hesaplama baslatinca ozet burada gorunur."
            >
              <div className={styles.emptyResult}>
                <div className={styles.emptyTitle}>Sonuc yok</div>
                <div className={styles.emptyBody}>
                  Segment kW ve mesafeleri girildikten sonra secilen kesitler, kumulatif
                  dusum ve uygunluk burada gorunur.
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {showSave && saveRecord ? (
        <SaveDialog record={saveRecord} onClose={() => setShowSave(false)} />
      ) : null}
    </div>
  );
}

