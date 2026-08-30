import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { compileRenodeSuite } from "./compile-renode-suite"
import { parseRobotOutput } from "./parse-robot-output"
import { runNativeFirmwareSimulation } from "./run-native-firmware-simulation"
import { runPreloadedFirmwareSimulation } from "./run-preloaded-firmware-simulation"
import type {
  FirmwareSimulationInput,
  FirmwareSimulationResult,
  RenodeFirmwareEngine,
  RenodeProcessResult,
  RenodeRunner,
} from "./types"
import { validateSimulationInput } from "./validate-simulation-input"

export interface RenodeFirmwareEngineOptions {
  runner?: RenodeRunner
  keepTemporaryFiles?: boolean
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

    const runner = options.runner
    if (!runner) {
      throw new Error("A custom Renode runner was not provided")
    }
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
  simulate: (input) =>
    options.runner
      ? runSimulation(input, options)
      : input.firmware.format === "binary"
        ? runNativeFirmwareSimulation(input)
        : runPreloadedFirmwareSimulation(input, options),
})

export default createRenodeFirmwareEngine
