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
import {
  type EnsureRenodeRuntimeOptions,
  ensureRenodeRuntime,
} from "./ensure-renode-runtime"
import { getAvailableLocalPort } from "./get-available-local-port"
import { programSamBaOverUsbIp } from "./program-sam-ba-over-usb-ip"
import { RenodeMonitorClient } from "./renode-monitor-client"
import type {
  FirmwareProgrammingResult,
  FirmwareSimulationInput,
  FirmwareSimulationSessionState,
  RenodeFirmwareSession,
} from "./types"
import { validateSimulationInput } from "./validate-simulation-input"

export interface RenodeFirmwareSessionOptions {
  runtime?: EnsureRenodeRuntimeOptions
  startupTimeoutMilliseconds?: number
}

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

interface NativeRenodeFirmwareSessionRequest {
  input: FirmwareSimulationInput
  monitor: RenodeMonitorClient
  child: ChildProcessWithoutNullStreams
  workspaceDirectory: string
  programming: FirmwareProgrammingResult
  uartLogFileNames: Map<string, string>
}

class NativeRenodeFirmwareSession implements RenodeFirmwareSession {
  private readonly input: FirmwareSimulationInput
  private readonly monitor: RenodeMonitorClient
  private readonly child: ChildProcessWithoutNullStreams
  private readonly workspaceDirectory: string
  private readonly uartLogFileNames: Map<string, string>
  readonly programming: FirmwareProgrammingResult
  private buttons: Array<{ componentName: string; isPressed: boolean }>
  private virtualTimeMilliseconds = 0
  private runningSince = Date.now()
  private isPowered = true
  private isStopped = false

  constructor(request: NativeRenodeFirmwareSessionRequest) {
    this.input = request.input
    this.monitor = request.monitor
    this.child = request.child
    this.workspaceDirectory = request.workspaceDirectory
    this.programming = request.programming
    this.uartLogFileNames = request.uartLogFileNames
    this.buttons = request.input.hardware.buttons.map((button) => ({
      componentName: button.componentName,
      isPressed: false,
    }))
  }

  async getState(): Promise<FirmwareSimulationSessionState> {
    if (this.isStopped || !this.isPowered) {
      return {
        isRunning: false,
        isPowered: false,
        displayStatus: "stopped",
        programming: this.programming,
        buttons: this.buttons.map((button) => ({ ...button })),
        leds: [],
        virtualTimeMilliseconds: this.virtualTimeMilliseconds,
      }
    }
    this.captureElapsedWallTime()
    const leds: Array<{ componentName: string; isOn: boolean }> = []
    for (const led of this.input.hardware.leds) {
      const response = await this.monitor.execute(
        `${getRenodeLedPath(led)} State`,
      )
      leds.push({
        componentName: led.componentName,
        isOn: readBooleanProperty(response, `state for ${led.componentName}`),
      })
    }
    return {
      isRunning: true,
      isPowered: true,
      displayStatus: "ready",
      programming: this.programming,
      buttons: this.buttons.map((button) => ({ ...button })),
      leds,
      virtualTimeMilliseconds: this.virtualTimeMilliseconds,
    }
  }

  async setButton(request: {
    componentName: string
    isPressed: boolean
  }): Promise<FirmwareSimulationSessionState> {
    if (this.isStopped) throw new Error("The firmware session is stopped")
    if (!this.isPowered) throw new Error("The simulated board is not powered")
    const button = this.input.hardware.buttons.find(
      (candidate) => candidate.componentName === request.componentName,
    )
    if (!button) {
      throw new Error(
        `No button contract was defined for "${request.componentName}"`,
      )
    }
    await this.monitor.execute(
      `${getRenodeButtonPath(button)} ${request.isPressed ? "Press" : "Release"}`,
    )
    this.buttons = this.buttons.map((buttonState) =>
      buttonState.componentName === request.componentName
        ? { ...buttonState, isPressed: request.isPressed }
        : buttonState,
    )
    // Let the running MCU observe the physical edge before reporting the
    // resulting board state. This is an internal settling interval, not a
    // user-facing virtual-clock control.
    return this.runFor(1)
  }

  async runFor(milliseconds: number): Promise<FirmwareSimulationSessionState> {
    if (this.isStopped) throw new Error("The firmware session is stopped")
    if (!this.isPowered) throw new Error("The simulated board is not powered")
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
      throw new Error("Virtual time must be greater than zero")
    }
    await this.monitor.execute("pause")
    this.captureElapsedWallTime()
    await this.monitor.execute(`emulation RunFor "${milliseconds / 1000}"`)
    this.virtualTimeMilliseconds += milliseconds
    await this.monitor.execute("start")
    this.runningSince = Date.now()
    return this.getState()
  }

  async waitForUartLine(request: {
    peripheralPath: string
    expectedLine: string
    timeoutMilliseconds?: number
  }): Promise<void> {
    if (this.isStopped) throw new Error("The firmware session is stopped")
    if (!this.isPowered) throw new Error("The simulated board is not powered")
    const logFileName = this.uartLogFileNames.get(request.peripheralPath)
    if (!logFileName) {
      throw new Error(
        `No UART capture was configured for "${request.peripheralPath}"`,
      )
    }
    const timeoutMilliseconds = request.timeoutMilliseconds ?? 1_000
    const deadline = Date.now() + timeoutMilliseconds
    const logPath = join(this.workspaceDirectory, logFileName)
    while (Date.now() <= deadline) {
      const output = await readFile(logPath, "utf8").catch(() => "")
      if (output.split(/\r?\n/).includes(request.expectedLine)) return
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error(
      `Timed out waiting for UART line "${request.expectedLine}" on ${request.peripheralPath}`,
    )
  }

  async reset(): Promise<FirmwareSimulationSessionState> {
    if (this.isStopped) throw new Error("The firmware session is stopped")
    if (!this.isPowered) throw new Error("The simulated board is not powered")
    await this.monitor.execute("pause")
    this.captureElapsedWallTime()
    await this.monitor.execute("machine Reset")
    if (this.input.firmware.format === "binary") {
      const programming = this.input.firmware.programming
      const cpuPeripheralPath = programming.cpuPeripheralPath ?? "sysbus.cpu"
      await this.monitor.execute(
        `${cpuPeripheralPath} SetRegister 13 ${formatHex(this.input.firmware.stackPointer)}`,
      )
      await this.monitor.execute(
        `${cpuPeripheralPath} PC ${formatHex(this.input.firmware.entryPoint)}`,
      )
    }
    this.buttons = this.input.hardware.buttons.map((button) => ({
      componentName: button.componentName,
      isPressed: false,
    }))
    await this.monitor.execute("start")
    this.runningSince = Date.now()
    return this.getState()
  }

  async powerOff(): Promise<FirmwareSimulationSessionState> {
    if (this.isStopped) throw new Error("The firmware session is stopped")
    await this.monitor.execute("pause")
    this.captureElapsedWallTime()
    this.isPowered = false
    this.buttons = this.input.hardware.buttons.map((button) => ({
      componentName: button.componentName,
      isPressed: false,
    }))
    return this.getState()
  }

  async powerOn(): Promise<FirmwareSimulationSessionState> {
    if (this.isStopped) throw new Error("The firmware session is stopped")
    this.isPowered = true
    this.runningSince = Date.now()
    return this.reset()
  }

  async stop(): Promise<void> {
    if (this.isStopped) return
    this.isStopped = true
    this.isPowered = false
    this.monitor.close()
    await waitForProcessExit(this.child, 5_000)
    await rm(this.workspaceDirectory, { recursive: true, force: true })
  }

  private captureElapsedWallTime(): void {
    if (!this.isPowered) return
    const now = Date.now()
    this.virtualTimeMilliseconds += Math.max(0, now - this.runningSince)
    this.runningSince = now
  }
}

const startRenode = (request: {
  command: string
  installDirectory: string
  workspaceDirectory: string
  monitorPort: number
}): ChildProcessWithoutNullStreams =>
  spawn(
    request.command,
    ["--disable-xwt", "--plain", "--port", String(request.monitorPort)],
    {
      cwd: request.workspaceDirectory,
      env: {
        ...process.env,
        DOTNET_BUNDLE_EXTRACT_BASE_DIR: join(
          request.installDirectory,
          ".dotnet-bundle",
        ),
      },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    },
  )

export const createRenodeFirmwareSession = async (
  input: FirmwareSimulationInput,
  options: RenodeFirmwareSessionOptions = {},
): Promise<RenodeFirmwareSession> => {
  await validateSimulationInput(input)
  if (input.firmware.format !== "binary") {
    throw new Error(
      "Interactive Renode sessions require USB-programmed binary firmware",
    )
  }

  const workspaceDirectory = await mkdtemp(
    join(tmpdir(), "tscircuit-renode-session-"),
  )
  const firmwareFileName = "firmware.bin"
  const monitorPort = await getAvailableLocalPort()
  const usbIpPort = await getAvailableLocalPort()
  const runtime = await ensureRenodeRuntime(options.runtime)
  await mkdir(join(runtime.installDirectory, ".dotnet-bundle"), {
    recursive: true,
  })
  const child = startRenode({
    command: runtime.renodeCommand,
    installDirectory: runtime.installDirectory,
    workspaceDirectory,
    monitorPort,
  })
  let startupStdout = ""
  let startupStderr = ""
  child.stdout.on("data", (chunk: Buffer) => {
    startupStdout = `${startupStdout}${chunk.toString("utf8")}`.slice(-32_768)
  })
  child.stderr.on("data", (chunk: Buffer) => {
    startupStderr = `${startupStderr}${chunk.toString("utf8")}`.slice(-32_768)
  })
  let monitor: RenodeMonitorClient | undefined
  try {
    await Promise.all([
      copyFile(input.firmware.path, join(workspaceDirectory, firmwareFileName)),
      writeFile(
        join(workspaceDirectory, "platform.repl"),
        `${compilePlatformRepl(input.hardware)}\n`,
      ),
    ])
    monitor = await RenodeMonitorClient.connect({
      host: "127.0.0.1",
      port: monitorPort,
      timeoutMilliseconds: options.startupTimeoutMilliseconds ?? 20_000,
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
    await monitor.execute(`emulation CreateUSBIPServer ${usbIpPort}`)
    const programming = input.firmware.programming
    const cpuPeripheralPath = programming.cpuPeripheralPath ?? "sysbus.cpu"
    await monitor.execute(
      `host.usb CreateArduinoLoader ${cpuPeripheralPath} ${formatHex(programming.loadAddress)} 0 "firmwareLoader"`,
    )

    const programmingRequest = {
      method: "usb_sam_ba" as const,
      firmwareFileName,
      vendorId: programming.vendorId ?? 0x2341,
      productId: programming.productId ?? 0x805a,
      chunkSizeBytes: programming.chunkSizeBytes ?? 256,
      timeoutMilliseconds: programming.timeoutMilliseconds ?? 20_000,
    }
    const waitForBinary = monitor.execute(
      `firmwareLoader WaitForBinary ${Math.ceil(programmingRequest.timeoutMilliseconds / 1000)} false`,
      programmingRequest.timeoutMilliseconds + 5_000,
    )
    const programmingResult = programSamBaOverUsbIp({
      host: "127.0.0.1",
      port: usbIpPort,
      workspaceDirectory,
      programming: programmingRequest,
    })
    const [, programmingReceipt] = await Promise.all([
      waitForBinary,
      programmingResult,
    ])
    await monitor.execute(
      `${cpuPeripheralPath} SetRegister 13 ${formatHex(input.firmware.stackPointer)}`,
    )
    await monitor.execute(
      `${cpuPeripheralPath} PC ${formatHex(input.firmware.entryPoint)}`,
    )
    await monitor.execute('emulation RunFor "0.001"')
    await monitor.execute("start")

    return new NativeRenodeFirmwareSession({
      input,
      monitor,
      child,
      workspaceDirectory,
      programming: programmingReceipt,
      uartLogFileNames,
    })
  } catch (error) {
    monitor?.close()
    child.kill("SIGKILL")
    await waitForProcessExit(child, 2_000)
    await rm(workspaceDirectory, { recursive: true, force: true })
    const processOutput = startupStderr.trim() || startupStdout.trim()
    throw new Error(
      `${error instanceof Error ? error.message : "Renode session failed"}${processOutput ? `\n${processOutput}` : ""}`,
      { cause: error },
    )
  }
}
