import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { compileRenodeSuite } from "./compile-renode-suite"
import { createNativeRenodeRunner } from "./create-native-renode-runner"
import { parseRobotOutput } from "./parse-robot-output"
import type {
  FirmwareSimulationInput,
  FirmwareSimulationResult,
  RenodeFirmwareEngine,
  RenodeProcessResult,
  RenodeRunner,
} from "./types"
import { validateHardwareContract } from "./validate-hardware-contract"

export interface RenodeFirmwareEngineOptions {
  runner?: RenodeRunner
  keepTemporaryFiles?: boolean
}

const validateSimulationInput = async (
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

const readRobotTests = async (request: {
  workspaceDirectory: string
  input: FirmwareSimulationInput
  processResult: RenodeProcessResult
}) => {
  const robotOutputPath = join(request.workspaceDirectory, "robot_output.xml")
  const robotOutputXml = await readFile(robotOutputPath, "utf8").catch(() => "")
  const tests = parseRobotOutput(robotOutputXml)
  if (tests.length > 0) return tests
  return [
    {
      name: request.input.name,
      isPassing: request.processResult.exitCode === 0,
      ...(request.processResult.exitCode === 0
        ? {}
        : {
            message:
              request.processResult.stderr || request.processResult.stdout,
          }),
    },
  ]
}

const runSimulation = async (
  input: FirmwareSimulationInput,
  options: RenodeFirmwareEngineOptions,
): Promise<FirmwareSimulationResult> => {
  await validateSimulationInput(input)
  const workspaceDirectory = await mkdtemp(
    join(tmpdir(), "tscircuit-renode-firmware-"),
  )
  const firmwareFileName =
    input.firmware.format === "elf" ? "firmware.elf" : "firmware.bin"
  const robotFileName = "scenario.robot"

  try {
    const generatedSuite = compileRenodeSuite(input, firmwareFileName)
    await Promise.all([
      copyFile(input.firmware.path, join(workspaceDirectory, firmwareFileName)),
      writeFile(
        join(workspaceDirectory, "platform.repl"),
        generatedSuite.platformRepl,
      ),
      writeFile(
        join(workspaceDirectory, robotFileName),
        generatedSuite.robotSuite,
      ),
    ])

    const runner = options.runner ?? createNativeRenodeRunner()
    const processResult = await runner.run({
      workspaceDirectory,
      robotFileName,
      timeoutMilliseconds: input.timeoutMilliseconds ?? 30_000,
      ...(input.firmware.format === "binary"
        ? {
            programming: {
              method: "usb_sam_ba" as const,
              firmwareFileName,
              vendorId: input.firmware.programming.vendorId ?? 0x2341,
              productId: input.firmware.programming.productId ?? 0x805a,
              chunkSizeBytes: input.firmware.programming.chunkSizeBytes ?? 256,
              timeoutMilliseconds:
                input.firmware.programming.timeoutMilliseconds ?? 20_000,
            },
          }
        : {}),
    })
    const tests = await readRobotTests({
      workspaceDirectory,
      input,
      processResult,
    })
    const isPassing =
      processResult.exitCode === 0 && tests.every((test) => test.isPassing)
    return {
      isPassing,
      displayStatus: isPassing ? "passed" : "failed",
      tests,
      stdout: processResult.stdout,
      stderr: processResult.stderr,
      durationMilliseconds: processResult.durationMilliseconds,
      ...(processResult.programming
        ? { programming: processResult.programming }
        : {}),
      ...(options.keepTemporaryFiles ? { workspaceDirectory } : {}),
    }
  } finally {
    if (!options.keepTemporaryFiles) {
      await rm(workspaceDirectory, { recursive: true, force: true })
    }
  }
}

export const createRenodeFirmwareEngine = (
  options: RenodeFirmwareEngineOptions = {},
): RenodeFirmwareEngine => ({
  simulate: (input) => runSimulation(input, options),
})

export default createRenodeFirmwareEngine
