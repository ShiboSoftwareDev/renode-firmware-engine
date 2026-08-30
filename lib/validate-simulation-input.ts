import { stat } from "node:fs/promises"
import type { FirmwareSimulationInput } from "./types"
import { validateHardwareContract } from "./validate-hardware-contract"

export const validateSimulationInput = async (
  input: FirmwareSimulationInput,
): Promise<void> => {
  if (!input.name.trim()) throw new Error("Simulation name cannot be empty")
  if (input.firmware.format === "binary") {
    const programming = input.firmware.programming
    if (!input.hardware.usb) {
      throw new Error(
        "USB-programmed firmware requires a physical hardware.usb contract",
      )
    }
    if (
      !Number.isSafeInteger(programming.loadAddress) ||
      programming.loadAddress < 0
    ) {
      throw new Error(
        "USB programming load address must be a nonnegative safe integer",
      )
    }
    const chunkSizeBytes = programming.chunkSizeBytes ?? 256
    if (!Number.isSafeInteger(chunkSizeBytes) || chunkSizeBytes <= 0) {
      throw new Error(
        "USB programming chunk size must be a positive safe integer",
      )
    }
    const programmingTimeoutMilliseconds =
      programming.timeoutMilliseconds ?? 20_000
    if (
      !Number.isSafeInteger(programmingTimeoutMilliseconds) ||
      programmingTimeoutMilliseconds <= 0
    ) {
      throw new Error("USB programming timeout must be a positive safe integer")
    }
    for (const [name, value] of [
      ["vendor ID", programming.vendorId ?? 0x2341],
      ["product ID", programming.productId ?? 0x805a],
    ] as const) {
      if (Number.isInteger(value) && value >= 0 && value <= 0xffff) continue
      throw new Error(`USB programming ${name} must be a 16-bit integer`)
    }
    if (
      !Number.isInteger(input.firmware.entryPoint) ||
      input.firmware.entryPoint < 0 ||
      input.firmware.entryPoint > 0xffff_ffff ||
      input.firmware.entryPoint % 2 !== 0
    ) {
      throw new Error(
        "USB-programmed firmware entry point must be an aligned 32-bit Cortex-M code address",
      )
    }
    if (
      !Number.isInteger(input.firmware.stackPointer) ||
      input.firmware.stackPointer <= 0 ||
      input.firmware.stackPointer > 0xffff_ffff ||
      input.firmware.stackPointer % 4 !== 0
    ) {
      throw new Error(
        "USB-programmed firmware stack pointer must be an aligned, positive 32-bit value",
      )
    }
  }
  if (input.steps.length === 0) {
    throw new Error("A firmware simulation needs at least one step")
  }
  for (const step of input.steps) {
    if (step.type !== "assert_uart") continue
    if (/\r|\n|\t/.test(step.peripheralPath) || !step.peripheralPath.trim()) {
      throw new Error("UART peripheral path must be a nonempty single line")
    }
    if (/\r|\n|\t/.test(step.expectedLine)) {
      throw new Error("Expected UART output must be a single line")
    }
  }
  const timeoutMilliseconds = input.timeoutMilliseconds ?? 30_000
  if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
    throw new Error("Simulation timeout must be a positive safe integer")
  }
  const firmwareStats = await stat(input.firmware.path).catch(() => null)
  if (!firmwareStats?.isFile()) {
    throw new Error(`Firmware file does not exist: ${input.firmware.path}`)
  }
  validateHardwareContract(input.circuitJson, input.hardware)
}
