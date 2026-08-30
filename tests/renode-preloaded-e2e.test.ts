import { expect, test } from "bun:test"
import { join } from "node:path"
import { createRenodeFirmwareEngine } from "../lib"
import { fixtureDirectory, getFixtureInput } from "./fixture-input"

test("runs the explicit preloaded ELF fast path without Robot Framework", async () => {
  const input = await getFixtureInput()
  if (input.firmware.format !== "binary") {
    throw new Error("Expected the fixture to use binary firmware")
  }
  const { entryPoint, stackPointer } = input.firmware
  input.firmware = {
    path: join(fixtureDirectory, "generated", "firmware.elf"),
    format: "elf",
    programming: { method: "preloaded" },
    cpuPeripheralPath: "sysbus.cpu0",
    entryPoint,
    stackPointer,
  }

  const result = await createRenodeFirmwareEngine().simulate(input)

  expect(result.isPassing, `${result.stdout}\n${result.stderr}`).toBe(true)
  expect(result.programming).toBeUndefined()
}, 300_000)
