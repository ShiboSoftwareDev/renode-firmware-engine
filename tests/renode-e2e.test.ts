import { expect, test } from "bun:test"
import { createDockerRenodeRunner, createRenodeFirmwareEngine } from "../lib"
import { getFixtureInput } from "./fixture-input"

test("runs compiled Cortex-M4 firmware against the circuit-derived GPIO model", async () => {
  const engine = createRenodeFirmwareEngine({
    runner: createDockerRenodeRunner(),
  })
  const result = await engine.simulate(await getFixtureInput())

  expect(result.isPassing, `${result.stdout}\n${result.stderr}`).toBe(true)
  expect(result.tests).toEqual([
    { name: "Firmware mirrors SW1 onto LED1", isPassing: true },
  ])
})
