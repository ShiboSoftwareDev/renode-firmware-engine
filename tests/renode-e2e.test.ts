import { expect, test } from "bun:test"
import { createDockerRenodeRunner, createRenodeFirmwareEngine } from "../lib"
import { getFixtureInput } from "./fixture-input"

test("programs Cortex-M0+ firmware over USB and tests its physical GPIOs", async () => {
  const engine = createRenodeFirmwareEngine({
    runner: createDockerRenodeRunner(),
  })
  const result = await engine.simulate(await getFixtureInput())

  expect(result.isPassing, `${result.stdout}\n${result.stderr}`).toBe(true)
  expect(result.tests).toEqual([
    { name: "Firmware mirrors SW1 onto LED1", isPassing: true },
  ])
  expect(result.programming).toMatchObject({
    method: "usb_sam_ba",
    bytesWritten: 324,
    sha256: "dd43cae9ad8d60602e75685940bddf9d69ed6d231ebb94ba34ea00a7f62c9a1b",
    isVerified: true,
  })
}, 60_000)
