import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createDockerRenodeFirmwareSession } from "../lib"
import firmwareSimulation from "./fixtures/samd21-usb-button-led/circuit/firmware-simulation"

const circuitDirectory = join(
  import.meta.dir,
  "fixtures/samd21-usb-button-led/circuit",
)

test("builds, USB-programs, and runs editable blinking firmware", async () => {
  const buildProcess = Bun.spawn(
    ["bun", "../firmware/build.ts", "firmware/main.S", "generated"],
    {
      cwd: circuitDirectory,
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  expect(await buildProcess.exited).toBe(0)

  const circuitJson = JSON.parse(
    await readFile(join(circuitDirectory, "circuit.json"), "utf8"),
  )
  const unresolvedInput = await firmwareSimulation({ circuitJson })
  const input = {
    ...unresolvedInput,
    firmware: {
      ...unresolvedInput.firmware,
      path: join(circuitDirectory, unresolvedInput.firmware.path),
    },
  }
  const session = await createDockerRenodeFirmwareSession(input)
  try {
    const observedLedStates = new Set<boolean>()
    for (let index = 0; index < 12; index += 1) {
      const state = await session.runFor(50)
      observedLedStates.add(
        state.leds.find((led) => led.componentName === "LED1")?.isOn ?? false,
      )
    }
    expect(observedLedStates).toEqual(new Set([true, false]))

    await session.setButton({ componentName: "SW1", isPressed: true })
    const pressedState = await session.runFor(300)
    expect(pressedState.buttons).toContainEqual({
      componentName: "SW1",
      isPressed: true,
    })
    expect(pressedState.leds).toContainEqual({
      componentName: "LED1",
      isOn: true,
    })
  } finally {
    await session.stop()
  }
})
