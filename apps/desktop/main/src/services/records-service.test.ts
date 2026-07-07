import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CalculationGroup, CalculationRecord } from "@elektroplan/contracts";
import type {
  GroupsRepository,
  PersistedCalculationGroup,
  PersistedCalculationRecord,
  RecordsRepository,
  StorageRepositories,
} from "@elektroplan/storage";

import { createRecordsService } from "./records-service.js";

interface InMemoryStore {
  groups: Map<string, PersistedCalculationGroup>;
  records: Map<string, PersistedCalculationRecord>;
}

function timestampFor(index: number): string {
  return `2026-04-22T10:00:${String(index).padStart(2, "0")}.000Z`;
}

function createPersistedGroup(
  group: CalculationGroup,
  index: number,
): PersistedCalculationGroup {
  const timestamp = timestampFor(index);
  return {
    ...group,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createPersistedRecord(
  record: CalculationRecord,
  index: number,
): PersistedCalculationRecord {
  const timestamp = timestampFor(index);
  return {
    ...record,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createRepositories(
  initialGroups: readonly PersistedCalculationGroup[] = [],
  initialRecords: readonly PersistedCalculationRecord[] = [],
): {
  readonly repositories: Pick<StorageRepositories, "groups" | "records" | "transaction">;
  readonly store: InMemoryStore;
  failNextRecordUpsert(): void;
} {
  const store: InMemoryStore = {
    groups: new Map(initialGroups.map((group) => [group.id, group])),
    records: new Map(initialRecords.map((record) => [record.id, record])),
  };

  let groupCounter = initialGroups.length;
  let recordCounter = initialRecords.length;
  let failOnNextRecordUpsert = false;

  const groups: GroupsRepository = {
    delete(id) {
      return store.groups.delete(id);
    },
    getById(id) {
      return store.groups.get(id) ?? null;
    },
    list() {
      return Array.from(store.groups.values());
    },
    upsert(group) {
      const current = store.groups.get(group.id);
      groupCounter += 1;
      const timestamp = timestampFor(groupCounter);
      const persisted: PersistedCalculationGroup = {
        ...group,
        createdAt: current?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      store.groups.set(group.id, persisted);
      return persisted;
    },
  };

  const records: RecordsRepository = {
    delete(id) {
      return store.records.delete(id);
    },
    getById(id) {
      return store.records.get(id) ?? null;
    },
    list(options) {
      const values = Array.from(store.records.values());
      if (options?.groupId === undefined) {
        return values;
      }
      return values.filter((record) => record.grouping?.groupId === options.groupId);
    },
    upsert(record) {
      if (failOnNextRecordUpsert) {
        failOnNextRecordUpsert = false;
        throw new Error("Simulated record upsert failure.");
      }

      const current = store.records.get(record.id);
      recordCounter += 1;
      const timestamp = timestampFor(recordCounter);
      const persisted: PersistedCalculationRecord = {
        ...record,
        createdAt: current?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      store.records.set(record.id, persisted);
      return persisted;
    },
  };

  const repositories: Pick<StorageRepositories, "groups" | "records" | "transaction"> = {
    groups,
    records,
    transaction(fn) {
      const groupsSnapshot = new Map(store.groups);
      const recordsSnapshot = new Map(store.records);
      const groupCounterSnapshot = groupCounter;
      const recordCounterSnapshot = recordCounter;

      try {
        return fn();
      } catch (error) {
        store.groups.clear();
        for (const [id, group] of groupsSnapshot) {
          store.groups.set(id, group);
        }

        store.records.clear();
        for (const [id, record] of recordsSnapshot) {
          store.records.set(id, record);
        }

        groupCounter = groupCounterSnapshot;
        recordCounter = recordCounterSnapshot;
        throw error;
      }
    },
  };

  return {
    repositories,
    store,
    failNextRecordUpsert() {
      failOnNextRecordUpsert = true;
    },
  };
}

describe("RecordsService duplicateGroup", () => {
  it("deep copies a group and its records with fresh ids", () => {
    const sourceGroup = createPersistedGroup(
      {
        id: "g",
        order: 2,
        parentGroupId: "p",
        tags: ["motor", "saved"],
        title: "G1",
        version: {
          contractVersion: "1",
          dataVersion: "motor-ruler-standard-v1:v1",
          engineVersion: "1.0.0",
        },
      },
      1,
    );
    const sourceRecord = createPersistedRecord(
      {
        id: "r1",
        calculator: "motor",
        grouping: {
          groupId: "g",
          groupPath: ["Proj", "G1"],
          groupTitle: "G1",
          order: 5,
          quantity: 2,
          tags: ["saved", "motor"],
        },
        version: {
          contractVersion: "1",
          dataVersion: "motor-ruler-standard-v1:v1",
          engineVersion: "1.0.0",
        },
        input: { mode: "table", kW: 0.55, voltage: 380 },
        output: {
          value: {
            mode: "table",
            kW: 0.55,
            PS: 0.75,
            cosPhi: 0.75,
            efficiencyPercent: 69,
            currentA: 1.6,
            cableSpec: "4 x 2,5",
          },
          warnings: [],
          assumptions: [],
          formulaVariant: "table-mode-380V",
          dataVersion: "motor-ruler-standard-v1:v1",
          engineVersion: "1.0.0",
        },
      },
      1,
    );
    const { repositories, store } = createRepositories([sourceGroup], [sourceRecord]);
    const service = createRecordsService(repositories);
    const duplicate = service.duplicateGroup("g", "G1 (kopya)");

    assert.notEqual(duplicate.id, "g");
    assert.equal(duplicate.title, "G1 (kopya)");
    assert.equal(duplicate.parentGroupId, "p");
    assert.deepEqual(duplicate.tags, ["motor", "saved"]);

    const duplicatedRecords = service.listRecords({ groupId: duplicate.id });
    assert.equal(duplicatedRecords.length, 1);
    assert.notEqual(duplicatedRecords[0]?.id, "r1");
    assert.equal(duplicatedRecords[0]?.grouping?.groupId, duplicate.id);
    assert.equal(duplicatedRecords[0]?.grouping?.groupTitle, "G1 (kopya)");
    assert.deepEqual(duplicatedRecords[0]?.grouping?.groupPath, [
      "Proj",
      "G1 (kopya)",
    ]);
    assert.equal(duplicatedRecords[0]?.grouping?.quantity, 2);
    assert.deepEqual(duplicatedRecords[0]?.input, sourceRecord.input);
    assert.deepEqual(duplicatedRecords[0]?.output, sourceRecord.output);

    assert.deepEqual(store.groups.get("g"), sourceGroup);
    assert.deepEqual(store.records.get("r1"), sourceRecord);
  });

  it("throws on unknown group id", () => {
    const { repositories } = createRepositories();
    const service = createRecordsService(repositories);

    assert.throws(
      () => service.duplicateGroup("missing", "X"),
      /Group 'missing' not found\./,
    );
  });

  it("rejects blank titles", () => {
    const sourceGroup = createPersistedGroup(
      {
        id: "g",
        title: "G1",
        version: { contractVersion: "1" },
      },
      1,
    );
    const { repositories } = createRepositories([sourceGroup]);
    const service = createRecordsService(repositories);

    assert.throws(
      () => service.duplicateGroup("g", "   "),
      /newTitle must be a non-empty string\./,
    );
  });

  it("rolls back the duplicated group when record copy fails", () => {
    const sourceGroup = createPersistedGroup(
      {
        id: "g",
        title: "G1",
        version: { contractVersion: "1" },
      },
      1,
    );
    const sourceRecord = createPersistedRecord(
      {
        id: "r1",
        calculator: "protection",
        version: { contractVersion: "1" },
        input: { minimumNominalCurrentA: 16 },
        output: [],
        grouping: {
          groupId: "g",
          groupPath: ["Proj", "G1"],
          groupTitle: "G1",
        },
      },
      1,
    );
    const { repositories, store, failNextRecordUpsert } = createRepositories(
      [sourceGroup],
      [sourceRecord],
    );
    const service = createRecordsService(repositories);

    failNextRecordUpsert();

    assert.throws(
      () => service.duplicateGroup("g", "G1 (kopya)"),
      /Simulated record upsert failure\./,
    );
    assert.equal(store.groups.size, 1);
    assert.equal(store.records.size, 1);
    assert.deepEqual(store.groups.get("g"), sourceGroup);
    assert.deepEqual(store.records.get("r1"), sourceRecord);
  });
});
