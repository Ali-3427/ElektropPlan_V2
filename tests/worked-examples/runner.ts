/* eslint-disable no-unused-vars */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface WorkedExampleFixture {
  input: JsonValue;
  expectedOutput: JsonValue;
  source: string;
  rationale: string;
}

const coreModule = (await import(
  new URL("../../../packages/calculation-core/dist/index.js", import.meta.url).href
)) as {
  calculateCableSizing: (_input: unknown) => any;
  calculateMotorCurrent: (_input: unknown) => any;
  calculateVoltageDrop: (_input: unknown) => any;
};

const {
  calculateCableSizing,
  calculateMotorCurrent,
  calculateVoltageDrop,
} = coreModule;

const CURRENT_RELATIVE_TOLERANCE = 0.0001;
const VOLTAGE_DROP_PERCENT_TOLERANCE = 0.1;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function approxEqualCurrent(actual: number, expected: number): boolean {
  const tolerance = Math.abs(expected) * CURRENT_RELATIVE_TOLERANCE;
  return Math.abs(actual - expected) <= tolerance;
}

function approxEqualVoltageDropPercent(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= VOLTAGE_DROP_PERCENT_TOLERANCE;
}

function compareSubset(
  actual: JsonValue,
  expected: JsonValue,
  context: string,
  exactMode: boolean,
): void {
  if (typeof expected === "number") {
    assert(
      typeof actual === "number",
      `${context}: expected numeric actual value, received ${typeof actual}.`,
    );

    if (exactMode) {
      assert(actual === expected, `${context}: expected ${expected}, received ${actual}.`);
      return;
    }

    if (context.endsWith(".currentA")) {
      assert(
        approxEqualCurrent(actual, expected),
        `${context}: expected ${expected} A +/-0.01%, received ${actual} A.`,
      );
      return;
    }

    if (context.endsWith(".deltaVPercent")) {
      assert(
        approxEqualVoltageDropPercent(actual, expected),
        `${context}: expected ${expected}% +/-0.1, received ${actual}%.`,
      );
      return;
    }

    assert(actual === expected, `${context}: expected ${expected}, received ${actual}.`);
    return;
  }

  if (
    typeof expected === "string" ||
    typeof expected === "boolean" ||
    expected === null
  ) {
    assert(actual === expected, `${context}: expected ${String(expected)}, received ${String(actual)}.`);
    return;
  }

  if (Array.isArray(expected)) {
    assert(Array.isArray(actual), `${context}: expected array actual value.`);
    const actualArray = actual as JsonValue[];
    assert(
      actualArray.length === expected.length,
      `${context}: expected array length ${expected.length}, received ${actualArray.length}.`,
    );

    expected.forEach((item, index) => {
      compareSubset(actualArray[index] as JsonValue, item, `${context}[${index}]`, exactMode);
    });
    return;
  }

  assert(isRecord(actual), `${context}: expected object actual value.`);

  for (const [key, expectedValue] of Object.entries(expected)) {
    assert(key in actual, `${context}: missing key '${key}' in actual output.`);
    compareSubset(actual[key] as JsonValue, expectedValue, `${context}.${key}`, exactMode);
  }
}

function runDirectMotorFixture(
  expectedOutput: JsonValue,
  input: JsonValue,
  fixtureName: string,
): void {
  const actual = calculateMotorCurrent(input as never) as unknown as JsonValue;
  compareSubset(actual, expectedOutput, `${fixtureName}.output`, fixtureName.includes("table-mode"));
}

function runBatchMotorFixture(
  expectedOutput: JsonValue,
  input: JsonValue,
  fixtureName: string,
): void {
  assert(isRecord(input), `${fixtureName}: batch input must be an object.`);
  assert(Array.isArray(input.cases), `${fixtureName}: input.cases must be an array.`);
  assert(isRecord(expectedOutput), `${fixtureName}: batch expectedOutput must be an object.`);
  assert(Array.isArray(expectedOutput.cases), `${fixtureName}: expectedOutput.cases must be an array.`);
  const inputCases = input.cases as JsonValue[];
  const expectedCases = expectedOutput.cases as JsonValue[];
  assert(
    inputCases.length === expectedCases.length,
    `${fixtureName}: batch input/output case counts must match.`,
  );

  inputCases.forEach((caseInput, index) => {
    const actual = calculateMotorCurrent(caseInput as never) as unknown as JsonValue;
    compareSubset(
      actual,
      expectedCases[index] as JsonValue,
      `${fixtureName}.cases[${index}]`,
      true,
    );
  });
}

function runRejectAcceptMotorFixture(
  expectedOutput: JsonValue,
  input: JsonValue,
  fixtureName: string,
): void {
  assert(isRecord(input), `${fixtureName}: reject/accept input must be an object.`);
  assert(isRecord(expectedOutput), `${fixtureName}: reject/accept expectedOutput must be an object.`);
  assert(isRecord(input.rejected), `${fixtureName}: input.rejected must be an object.`);
  assert(isRecord(input.accepted), `${fixtureName}: input.accepted must be an object.`);
  assert(
    typeof expectedOutput.rejectedMessage === "string",
    `${fixtureName}: expectedOutput.rejectedMessage must be a string.`,
  );
  assert(
    expectedOutput.accepted !== undefined,
    `${fixtureName}: expectedOutput.accepted must be provided.`,
  );
  const rejectedInput = input.rejected as JsonValue;
  const acceptedInput = input.accepted as JsonValue;

  let rejectedMessage = "";

  try {
    calculateMotorCurrent(rejectedInput as never);
  } catch (error) {
    rejectedMessage = error instanceof Error ? error.message : String(error);
  }

  assert(
    rejectedMessage === expectedOutput.rejectedMessage,
    `${fixtureName}.rejected: expected '${expectedOutput.rejectedMessage}', received '${rejectedMessage}'.`,
  );

  const acceptedActual = calculateMotorCurrent(acceptedInput as never) as unknown as JsonValue;
  compareSubset(
    acceptedActual,
    expectedOutput.accepted as JsonValue,
    `${fixtureName}.accepted`,
    true,
  );
}

function runMotorFixture(fixtureName: string, fixture: WorkedExampleFixture): void {
  assert(fixture.source.length > 0, `${fixtureName}: source is required.`);
  assert(fixture.rationale.length > 0, `${fixtureName}: rationale is required.`);

  if (isRecord(fixture.input) && Array.isArray(fixture.input.cases)) {
    runBatchMotorFixture(fixture.expectedOutput, fixture.input, fixtureName);
    return;
  }

  if (
    isRecord(fixture.input) &&
    "rejected" in fixture.input &&
    "accepted" in fixture.input
  ) {
    runRejectAcceptMotorFixture(fixture.expectedOutput, fixture.input, fixtureName);
    return;
  }

  runDirectMotorFixture(fixture.expectedOutput, fixture.input, fixtureName);
}

function runVoltageDropFixture(fixtureName: string, fixture: WorkedExampleFixture): void {
  const actual = calculateVoltageDrop(fixture.input as never) as unknown as JsonValue;
  compareSubset(actual, fixture.expectedOutput, `${fixtureName}.output`, false);
}

function runCableFixture(fixtureName: string, fixture: WorkedExampleFixture): void {
  assert(isRecord(fixture.expectedOutput), `${fixtureName}: cable expectedOutput must be an object.`);

  const actual = calculateCableSizing(fixture.input as never);
  const { candidateTraceChecks, ...expectedSubset } = fixture.expectedOutput;

  compareSubset(
    actual as unknown as JsonValue,
    expectedSubset as JsonValue,
    `${fixtureName}.output`,
    false,
  );

  if (candidateTraceChecks === undefined) {
    return;
  }

  assert(
    Array.isArray(candidateTraceChecks),
    `${fixtureName}: candidateTraceChecks must be an array when provided.`,
  );

  for (const check of candidateTraceChecks) {
    assert(isRecord(check), `${fixtureName}: candidate trace check must be an object.`);
    assert(
      typeof check.sectionMm2 === "number",
      `${fixtureName}: candidate trace check requires sectionMm2.`,
    );

    const candidate = actual.value.candidateTrace.find(
      (entry: { sectionMm2: number }) => entry.sectionMm2 === check.sectionMm2,
    );

    assert(
      candidate !== undefined,
      `${fixtureName}: candidate trace missing section ${check.sectionMm2} mm2.`,
    );

    compareSubset(
      candidate as unknown as JsonValue,
      check,
      `${fixtureName}.candidateTrace[section=${check.sectionMm2}]`,
      false,
    );
  }
}

function runFixtureFile(fileName: string, fixture: WorkedExampleFixture): void {
  if (fileName.startsWith("motor-")) {
    runMotorFixture(fileName, fixture);
    return;
  }

  if (fileName.startsWith("vdrop-")) {
    runVoltageDropFixture(fileName, fixture);
    return;
  }

  if (fileName.startsWith("cable-")) {
    runCableFixture(fileName, fixture);
    return;
  }

  throw new Error(`${fileName}: unsupported fixture prefix.`);
}

export function runWorkedExamples(): void {
  const runnerDir = dirname(fileURLToPath(import.meta.url));
  const fixturesDir = join(runnerDir, "..", "fixtures");
  const fixtureFiles = readdirSync(fixturesDir)
    .filter((fileName: string) => extname(fileName) === ".json")
    .sort();

  assert(fixtureFiles.length > 0, "No worked-example fixtures were found.");

  for (const fileName of fixtureFiles) {
    const raw = readFileSync(join(fixturesDir, fileName), "utf8");
    const fixture = JSON.parse(raw) as WorkedExampleFixture;
    runFixtureFile(fileName, fixture);
  }

  process.stdout.write(`Worked examples passed: ${fixtureFiles.length} fixture(s)\n`);
}

runWorkedExamples();
