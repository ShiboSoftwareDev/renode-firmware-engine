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
  if (input.firmware.format !== "elf") {
    throw new Error(`Unsupported firmware format "${input.firmware.format}"`)
  }
  if (input.steps.length === 0) {
    throw new Error("A firmware simulation needs at least one step")
  }
  if ((input.timeoutMilliseconds ?? 30_000) <= 0) {
    throw new Error("Simulation timeout must be greater than zero")
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
  const firmwareFileName = "firmware.elf"
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
