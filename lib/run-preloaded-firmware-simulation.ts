import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  compilePlatformRepl,
  getRenodeButtonPath,
  getRenodeLedPath,
} from "./compile-platform-repl"
import { ensureRenodeRuntime } from "./ensure-renode-runtime"
import { getAvailableLocalPort } from "./get-available-local-port"
import { RenodeMonitorClient } from "./renode-monitor-client"
import {
  type FirmwareScenarioControls,
  runFirmwareScenarioSteps,
} from "./run-native-firmware-simulation"
import type { FirmwareSimulationInput, FirmwareSimulationResult } from "./types"
import { validateSimulationInput } from "./validate-simulation-input"

const formatHex = (integer: number): string => `0x${integer.toString(16)}`

const waitForProcessExit = (
  child: ChildProcessWithoutNullStreams,
  timeoutMilliseconds: number,
): Promise<void> =>
  new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve()
      return
    }
    const timeout = setTimeout(() => {
      child.kill("SIGKILL")
      resolve()
    }, timeoutMilliseconds)
    child.once("close", () => {
      clearTimeout(timeout)
      resolve()
    })
  })

const readBooleanProperty = (
  response: string,
  description: string,
): boolean => {
  const matches = [...response.matchAll(/\b(True|False)\b/g)]
  const lastMatch = matches.at(-1)?.[1]
  if (lastMatch === "True") return true
  if (lastMatch === "False") return false
  throw new Error(`Renode did not return a boolean ${description}`)
}

export const runPreloadedFirmwareSimulation = async (
  input: FirmwareSimulationInput,
  options: { keepTemporaryFiles?: boolean } = {},
): Promise<FirmwareSimulationResult> => {
  await validateSimulationInput(input)
  if (input.firmware.format !== "elf") {
    throw new Error("The preloaded scenario runner requires ELF firmware")
  }
  const startedAt = Date.now()
  const workspaceDirectory = await mkdtemp(
    join(tmpdir(), "tscircuit-renode-preloaded-"),
  )
  const runtime = await ensureRenodeRuntime()
  const dotnetBundleDirectory = join(runtime.installDirectory, ".dotnet-bundle")
  await mkdir(dotnetBundleDirectory, { recursive: true })
  const monitorPort = await getAvailableLocalPort()
  const child = spawn(
    runtime.renodeCommand,
    ["--disable-xwt", "--plain", "--port", String(monitorPort)],
    {
      cwd: workspaceDirectory,
      env: {
        ...process.env,
        DOTNET_BUNDLE_EXTRACT_BASE_DIR: dotnetBundleDirectory,
      },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    },
  )
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8")
  })
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8")
  })
  let monitor: RenodeMonitorClient | undefined
  try {
    await Promise.all([
      copyFile(input.firmware.path, join(workspaceDirectory, "firmware.elf")),
      writeFile(
        join(workspaceDirectory, "platform.repl"),
        `${compilePlatformRepl(input.hardware)}\n`,
      ),
    ])
    monitor = await RenodeMonitorClient.connect({
      host: "127.0.0.1",
      port: monitorPort,
      timeoutMilliseconds: 20_000,
    })
    await monitor.execute("mach create")
    await monitor.execute("machine LoadPlatformDescription @platform.repl")
    const uartLogFileNames = new Map<string, string>()
    const uartPeripheralPaths = [
      ...new Set(
        input.steps.flatMap((step) =>
          step.type === "assert_uart" ? [step.peripheralPath] : [],
        ),
      ),
    ]
    for (const [index, peripheralPath] of uartPeripheralPaths.entries()) {
      const logFileName = `uart-${index}.log`
      await monitor.execute(
        `${peripheralPath} CreateFileBackend @${logFileName}`,
      )
      uartLogFileNames.set(peripheralPath, logFileName)
    }
    await monitor.execute("sysbus LoadELF @firmware.elf")
    const cpuPeripheralPath = input.firmware.cpuPeripheralPath ?? "sysbus.cpu"
    if (input.firmware.stackPointer !== undefined) {
      await monitor.execute(
        `${cpuPeripheralPath} SetRegister 13 ${formatHex(input.firmware.stackPointer)}`,
      )
    }
    if (input.firmware.entryPoint !== undefined) {
      await monitor.execute(
        `${cpuPeripheralPath} PC ${formatHex(input.firmware.entryPoint)}`,
      )
    }
    await monitor.execute("start")

    const runFor = async (milliseconds: number): Promise<void> => {
      await monitor?.execute("pause")
      await monitor?.execute(`emulation RunFor "${milliseconds / 1000}"`)
      await monitor?.execute("start")
    }
    const controls: FirmwareScenarioControls = {
      getLedState: async (componentName) => {
        const led = input.hardware.leds.find(
          (candidate) => candidate.componentName === componentName,
        )
        if (!led)
          throw new Error(`No LED contract exists for "${componentName}"`)
        const response = await monitor?.execute(
          `${getRenodeLedPath(led)} State`,
        )
        return readBooleanProperty(response ?? "", `state for ${componentName}`)
      },
      setButton: async (componentName, isPressed) => {
        const button = input.hardware.buttons.find(
          (candidate) => candidate.componentName === componentName,
        )
        if (!button) {
          throw new Error(`No button contract exists for "${componentName}"`)
        }
        await monitor?.execute(
          `${getRenodeButtonPath(button)} ${isPressed ? "Press" : "Release"}`,
        )
        await runFor(1)
      },
      runFor,
      waitForUartLine: async (
        peripheralPath,
        expectedLine,
        timeoutMilliseconds,
      ) => {
        const logFileName = uartLogFileNames.get(peripheralPath)
        if (!logFileName) {
          throw new Error(`No UART capture exists for "${peripheralPath}"`)
        }
        const deadline = Date.now() + timeoutMilliseconds
        const logPath = join(workspaceDirectory, logFileName)
        while (Date.now() <= deadline) {
          const output = await readFile(logPath, "utf8").catch(() => "")
          if (output.split(/\r?\n/).includes(expectedLine)) return
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error(
          `Timed out waiting for UART line "${expectedLine}" on ${peripheralPath}`,
        )
      },
    }

    try {
      const scenarioOutput = await runFirmwareScenarioSteps(input, controls)
      return {
        isPassing: true,
        displayStatus: "passed",
        tests: [{ name: input.name, isPassing: true }],
        stdout: scenarioOutput.join("\n"),
        stderr,
        durationMilliseconds: Date.now() - startedAt,
        ...(options.keepTemporaryFiles ? { workspaceDirectory } : {}),
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Firmware scenario failed"
      return {
        isPassing: false,
        displayStatus: "failed",
        tests: [{ name: input.name, isPassing: false, message }],
        stdout,
        stderr: [stderr.trim(), message].filter(Boolean).join("\n"),
        durationMilliseconds: Date.now() - startedAt,
        ...(options.keepTemporaryFiles ? { workspaceDirectory } : {}),
      }
    }
  } catch (error) {
    const processOutput = stderr.trim() || stdout.trim()
    throw new Error(
      `${error instanceof Error ? error.message : "Renode scenario failed"}${processOutput ? `\n${processOutput}` : ""}`,
      { cause: error },
    )
  } finally {
    monitor?.close()
    await waitForProcessExit(child, 5_000)
    if (!options.keepTemporaryFiles) {
      await rm(workspaceDirectory, { recursive: true, force: true })
    }
  }
}
