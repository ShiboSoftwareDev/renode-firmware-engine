import { createRenodeFirmwareSession } from "./create-renode-firmware-session"
import type { FirmwareSimulationInput, FirmwareSimulationResult } from "./types"

export interface FirmwareScenarioControls {
  getLedState: (componentName: string) => Promise<boolean>
  setButton: (componentName: string, isPressed: boolean) => Promise<void>
  runFor: (milliseconds: number) => Promise<void>
  waitForUartLine: (
    peripheralPath: string,
    expectedLine: string,
    timeoutMilliseconds: number,
  ) => Promise<void>
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const assertLed = async (request: {
  controls: FirmwareScenarioControls
  componentName: string
  isOn: boolean
  timeoutMilliseconds: number
}): Promise<void> => {
  const deadline = Date.now() + request.timeoutMilliseconds
  while (true) {
    const isOn = await request.controls.getLedState(request.componentName)
    if (isOn === request.isOn) return
    if (Date.now() >= deadline) {
      throw new Error(
        `Expected ${request.componentName} to be ${request.isOn ? "on" : "off"}, but it was ${isOn ? "on" : "off"}`,
      )
    }
    await delay(10)
  }
}

export const runFirmwareScenarioSteps = async (
  input: FirmwareSimulationInput,
  controls: FirmwareScenarioControls,
): Promise<string[]> => {
  const output: string[] = []
  for (const step of input.steps) {
    if (step.type === "wait") {
      await controls.runFor(step.milliseconds)
      output.push(`Waited ${step.milliseconds}ms`)
      continue
    }
    if (step.type === "set_button") {
      await controls.setButton(step.componentName, step.isPressed)
      output.push(
        `${step.isPressed ? "Pressed" : "Released"} ${step.componentName}`,
      )
      continue
    }
    if (step.type === "assert_led") {
      await assertLed({
        controls,
        componentName: step.componentName,
        isOn: step.isOn,
        timeoutMilliseconds: step.timeoutMilliseconds ?? 200,
      })
      output.push(`Observed ${step.componentName} ${step.isOn ? "on" : "off"}`)
      continue
    }
    await controls.waitForUartLine(
      step.peripheralPath,
      step.expectedLine,
      input.timeoutMilliseconds ?? 30_000,
    )
    output.push(
      `Observed UART line "${step.expectedLine}" on ${step.peripheralPath}`,
    )
  }
  return output
}

export const runNativeFirmwareSimulation = async (
  input: FirmwareSimulationInput,
): Promise<FirmwareSimulationResult> => {
  if (input.firmware.format !== "binary") {
    throw new Error("The native USB scenario runner requires binary firmware")
  }
  const startedAt = Date.now()
  const session = await createRenodeFirmwareSession(input)
  const output: string[] = [
    `Programmed ${session.programming.bytesWritten} bytes over USB`,
  ]
  const controls: FirmwareScenarioControls = {
    getLedState: async (componentName) => {
      const state = await session.getState()
      const led = state.leds.find(
        (candidate) => candidate.componentName === componentName,
      )
      if (!led) throw new Error(`Renode did not expose LED "${componentName}"`)
      return led.isOn
    },
    setButton: async (componentName, isPressed) => {
      await session.setButton({ componentName, isPressed })
    },
    runFor: async (milliseconds) => {
      await session.runFor(milliseconds)
    },
    waitForUartLine: async (
      peripheralPath,
      expectedLine,
      timeoutMilliseconds,
    ) => {
      if (!session.waitForUartLine) {
        throw new Error("The native Renode session cannot capture UART output")
      }
      await session.waitForUartLine({
        peripheralPath,
        expectedLine,
        timeoutMilliseconds,
      })
    },
  }
  try {
    try {
      output.push(...(await runFirmwareScenarioSteps(input, controls)))
      return {
        isPassing: true,
        displayStatus: "passed",
        tests: [{ name: input.name, isPassing: true }],
        stdout: output.join("\n"),
        stderr: "",
        durationMilliseconds: Date.now() - startedAt,
        programming: session.programming,
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Firmware scenario failed"
      return {
        isPassing: false,
        displayStatus: "failed",
        tests: [{ name: input.name, isPassing: false, message }],
        stdout: output.join("\n"),
        stderr: message,
        durationMilliseconds: Date.now() - startedAt,
        programming: session.programming,
      }
    }
  } finally {
    await session.stop()
  }
}
