import type { CircuitJson } from "circuit-json"

export interface RenodeMcuContract {
  componentName: string
  manufacturerPartNumber?: string
}

export interface RenodeLedContract {
  componentName: string
  mcuPortName: string
  gpioPeripheral: string
  gpioPin: number
  drivePortName: string
  referencePortName: string
  referenceNetName: string
  seriesResistorComponentName: string
  expectedResistanceOhms?: number
}

export interface RenodeButtonBiasContract {
  resistorComponentName: string
  referenceNetName: string
  expectedResistanceOhms?: number
}

export interface RenodeButtonContract {
  componentName: string
  mcuPortName: string
  gpioPeripheral: string
  gpioPin: number
  signalPortName: string
  referencePortName: string
  referenceNetName: string
  bias?: RenodeButtonBiasContract
}

export interface RenodeHardwareContract {
  mcu: RenodeMcuContract
  platformRepl: string
  leds: RenodeLedContract[]
  buttons: RenodeButtonContract[]
}

export interface RenodeFirmwareImage {
  path: string
  format: "elf"
  entryPoint?: number
  stackPointer?: number
}

export interface WaitStep {
  type: "wait"
  milliseconds: number
}

export interface SetButtonStep {
  type: "set_button"
  componentName: string
  isPressed: boolean
}

export interface AssertLedStep {
  type: "assert_led"
  componentName: string
  isOn: boolean
  timeoutMilliseconds?: number
}

export interface AssertUartStep {
  type: "assert_uart"
  peripheralPath: string
  expectedLine: string
}

export type FirmwareSimulationStep =
  | WaitStep
  | SetButtonStep
  | AssertLedStep
  | AssertUartStep

export interface FirmwareSimulationInput {
  name: string
  circuitJson: CircuitJson
  firmware: RenodeFirmwareImage
  hardware: RenodeHardwareContract
  steps: FirmwareSimulationStep[]
  timeoutMilliseconds?: number
}

export interface RenodeGeneratedSuite {
  platformRepl: string
  robotSuite: string
}

export interface RenodeProcessRequest {
  workspaceDirectory: string
  robotFileName: string
  timeoutMilliseconds: number
}

export interface RenodeProcessResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMilliseconds: number
}

export interface RenodeRunner {
  run: (request: RenodeProcessRequest) => Promise<RenodeProcessResult>
}

export interface FirmwareSimulationTestResult {
  name: string
  isPassing: boolean
  message?: string
}

export interface FirmwareSimulationResult {
  isPassing: boolean
  displayStatus: "passed" | "failed"
  tests: FirmwareSimulationTestResult[]
  stdout: string
  stderr: string
  durationMilliseconds: number
  workspaceDirectory?: string
}

export interface RenodeFirmwareEngine {
  simulate: (
    input: FirmwareSimulationInput,
  ) => Promise<FirmwareSimulationResult>
}
