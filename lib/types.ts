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
  manufacturerPartNumber?: string
  mcuPortName: string
  gpioPeripheral: string
  gpioPin: number
  signalPortName: string
  referencePortName: string
  referenceNetName: string
  bias?: RenodeButtonBiasContract
}

export interface RenodeUsbDataLineContract {
  connectorPortNames: string[]
  mcuPortName: string
  seriesResistorComponentName: string
  expectedResistanceOhms?: number
}

export interface RenodeUsbPullDownContract {
  connectorPortName: string
  resistorComponentName: string
  expectedResistanceOhms?: number
}

export interface RenodeUsbContract {
  connectorComponentName: string
  connectorManufacturerPartNumber?: string
  dataPlus: RenodeUsbDataLineContract
  dataMinus: RenodeUsbDataLineContract
  vbusPortNames: string[]
  vbusNetName: string
  groundPortNames: string[]
  groundNetName: string
  configurationChannelPullDowns?: RenodeUsbPullDownContract[]
}

export interface RenodeHardwareContract {
  mcu: RenodeMcuContract
  platformRepl: string
  leds: RenodeLedContract[]
  buttons: RenodeButtonContract[]
  usb?: RenodeUsbContract
}

export interface RenodePreloadedFirmwareImage {
  path: string
  format: "elf"
  programming?: {
    method: "preloaded"
  }
  entryPoint?: number
  stackPointer?: number
}

export interface RenodeUsbSamBaProgramming {
  method: "usb_sam_ba"
  loadAddress: number
  cpuPeripheralPath?: string
  vendorId?: number
  productId?: number
  chunkSizeBytes?: number
  timeoutMilliseconds?: number
}

export interface RenodeUsbProgrammedFirmwareImage {
  path: string
  format: "binary"
  programming: RenodeUsbSamBaProgramming
  /** Renode PC value after programming; use the aligned address without the Thumb bit. */
  entryPoint: number
  /** Initial Cortex-M SP value after programming. */
  stackPointer: number
}

export type RenodeFirmwareImage =
  | RenodePreloadedFirmwareImage
  | RenodeUsbProgrammedFirmwareImage

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
  programming?: RenodeUsbProgrammingRequest
}

export interface RenodeUsbProgrammingRequest {
  method: "usb_sam_ba"
  firmwareFileName: string
  vendorId: number
  productId: number
  chunkSizeBytes: number
  timeoutMilliseconds: number
}

export interface FirmwareProgrammingResult {
  method: "usb_sam_ba"
  bytesWritten: number
  sha256: string
  /** True when erase/write acknowledgements completed and Renode accepted the image. */
  isVerified: boolean
}

export interface RenodeProcessResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMilliseconds: number
  programming?: FirmwareProgrammingResult
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
  programming?: FirmwareProgrammingResult
  workspaceDirectory?: string
}

export interface RenodeFirmwareEngine {
  simulate: (
    input: FirmwareSimulationInput,
  ) => Promise<FirmwareSimulationResult>
}
