import { getRenodeButtonPath, getRenodeLedPath } from "./compile-platform-repl"
import { toRenodeIdentifier } from "./renode-identifiers"
import type {
  FirmwareSimulationInput,
  FirmwareSimulationStep,
  RenodeButtonContract,
  RenodeLedContract,
} from "./types"

const robotRow = (cells: string[]): string => `    ${cells.join("    ")}`

const assertSingleLine = (text: string, description: string): void => {
  if (!/[\r\n\t]/.test(text)) return
  throw new Error(`${description} cannot contain a newline or tab`)
}

const formatHex = (integer: number): string => `0x${integer.toString(16)}`

const getLed = (
  componentName: string,
  leds: RenodeLedContract[],
): RenodeLedContract => {
  const led = leds.find(
    (candidate) => candidate.componentName === componentName,
  )
  if (led) return led
  throw new Error(`No LED contract was defined for "${componentName}"`)
}

const getButton = (
  componentName: string,
  buttons: RenodeButtonContract[],
): RenodeButtonContract => {
  const button = buttons.find(
    (candidate) => candidate.componentName === componentName,
  )
  if (button) return button
  throw new Error(`No button contract was defined for "${componentName}"`)
}

const getLedTesterVariable = (componentName: string): string =>
  `${toRenodeIdentifier(componentName).toUpperCase()}_TESTER`

const compileStep = (
  step: FirmwareSimulationStep,
  input: FirmwareSimulationInput,
): string[] => {
  if (step.type === "wait") {
    if (step.milliseconds <= 0) {
      throw new Error("Wait durations must be greater than zero")
    }
    return [
      robotRow([
        "Execute Command",
        `emulation RunFor "${step.milliseconds / 1000}"`,
      ]),
    ]
  }

  if (step.type === "set_button") {
    const button = getButton(step.componentName, input.hardware.buttons)
    return [
      robotRow([
        "Execute Command",
        `${getRenodeButtonPath(button)} ${step.isPressed ? "Press" : "Release"}`,
      ]),
    ]
  }

  if (step.type === "assert_led") {
    getLed(step.componentName, input.hardware.leds)
    const timeoutMilliseconds = step.timeoutMilliseconds ?? 200
    if (timeoutMilliseconds < 0) {
      throw new Error("LED assertion timeouts cannot be negative")
    }
    return [
      robotRow([
        "Assert Led State",
        step.isOn ? "True" : "False",
        `timeout=${timeoutMilliseconds / 1000}`,
        `testerId=\${${getLedTesterVariable(step.componentName)}}`,
      ]),
    ]
  }

  assertSingleLine(step.peripheralPath, "UART peripheral path")
  assertSingleLine(step.expectedLine, "Expected UART line")
  return [
    robotRow(["Create Terminal Tester", step.peripheralPath]),
    robotRow(["Wait For Line On Uart", step.expectedLine]),
  ]
}

export const compileRobotSuite = (
  input: FirmwareSimulationInput,
  firmwareFileName: string,
): string => {
  assertSingleLine(input.name, "Simulation name")
  assertSingleLine(firmwareFileName, "Firmware file name")

  const setupRows = [
    robotRow(["Execute Command", "mach create"]),
    robotRow([
      "Execute Command",
      `machine LoadPlatformDescription @\${CURDIR}/platform.repl`,
    ]),
    robotRow([
      "Execute Command",
      `sysbus LoadELF @\${CURDIR}/${firmwareFileName}`,
    ]),
  ]

  if (input.firmware.stackPointer !== undefined) {
    setupRows.push(
      robotRow([
        "Execute Command",
        `cpu SetRegisterUnsafe 13 ${formatHex(input.firmware.stackPointer)}`,
      ]),
    )
  }
  if (input.firmware.entryPoint !== undefined) {
    setupRows.push(
      robotRow([
        "Execute Command",
        `cpu PC ${formatHex(input.firmware.entryPoint)}`,
      ]),
    )
  }

  for (const led of input.hardware.leds) {
    const testerVariable = getLedTesterVariable(led.componentName)
    setupRows.push(
      robotRow([
        `\${${testerVariable}}=`,
        "Create Led Tester",
        getRenodeLedPath(led),
      ]),
    )
  }
  setupRows.push(robotRow(["Start Emulation"]))

  const stepRows = input.steps.flatMap((step) => compileStep(step, input))
  return [
    "*** Settings ***",
    "Library    RenodeLibrary",
    "",
    "*** Test Cases ***",
    input.name,
    ...setupRows,
    ...stepRows,
    "",
  ].join("\n")
}
