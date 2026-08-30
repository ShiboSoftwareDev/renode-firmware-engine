import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  compilePlatformRepl,
  getRenodeButtonPath,
  getRenodeLedPath,
} from "./compile-platform-repl"
import { validateSimulationInput } from "./create-renode-firmware-engine"
import { getAvailableLocalPort } from "./get-available-local-port"
import { programSamBaOverUsbIp } from "./program-sam-ba-over-usb-ip"
import { RenodeMonitorClient } from "./renode-monitor-client"
import type {
  FirmwareProgrammingResult,
  FirmwareSimulationInput,
  FirmwareSimulationSessionState,
  RenodeFirmwareSession,
} from "./types"

export interface DockerRenodeFirmwareSessionOptions {
  dockerCommand?: string
  image?: string
  containerPlatform?: string
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

class DockerRenodeFirmwareSession implements RenodeFirmwareSession {
  private buttonStates: Record<string, boolean>
  private virtualTimeMilliseconds = 0
  private runningSince = Date.now()
  private isPowered = true
  private isStopped = false

  constructor(
    private readonly input: FirmwareSimulationInput,
    private readonly monitor: RenodeMonitorClient,
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly workspaceDirectory: string,
    readonly programming: FirmwareProgrammingResult,
  ) {
    this.buttonStates = Object.fromEntries(
      input.hardware.buttons.map((button) => [button.componentName, false]),
    )
  }

  async getState(): Promise<FirmwareSimulationSessionState> {
    if (this.isStopped || !this.isPowered) {
      return {
        isRunning: false,
        isPowered: false,
        displayStatus: "stopped",
        programming: this.programming,
        buttonStates: { ...this.buttonStates },
        ledStates: {},
        virtualTimeMilliseconds: this.virtualTimeMilliseconds,
      }
    }
    this.captureElapsedWallTime()
    const ledStates: Record<string, boolean> = {}
    for (const led of this.input.hardware.leds) {
      const response = await this.monitor.execute(
        `${getRenodeLedPath(led)} State`,
      )
      ledStates[led.componentName] = readBooleanProperty(
        response,
        `state for ${led.componentName}`,
      )
    }
    return {
      isRunning: true,
      isPowered: true,
      displayStatus: "ready",
      programming: this.programming,
      buttonStates: { ...this.buttonStates },
      ledStates,
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
    this.buttonStates[request.componentName] = request.isPressed
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
    this.buttonStates = Object.fromEntries(
      this.input.hardware.buttons.map((button) => [
        button.componentName,
        false,
      ]),
    )
    await this.monitor.execute("start")
    this.runningSince = Date.now()
    return this.getState()
  }

  async powerOff(): Promise<FirmwareSimulationSessionState> {
    if (this.isStopped) throw new Error("The firmware session is stopped")
    await this.monitor.execute("pause")
    this.captureElapsedWallTime()
    this.isPowered = false
    this.buttonStates = Object.fromEntries(
      this.input.hardware.buttons.map((button) => [
        button.componentName,
        false,
      ]),
    )
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

const startContainer = (request: {
  command: string
  image: string
  containerPlatform: string
  containerName: string
  workspaceDirectory: string
  monitorPort: number
  usbIpPort: number
}): ChildProcessWithoutNullStreams =>
  spawn(
    request.command,
    [
      "run",
      "--rm",
      "--platform",
      request.containerPlatform,
      "--name",
      request.containerName,
      "-v",
      `${request.workspaceDirectory}:/workspace`,
      "-w",
      "/workspace",
      "-p",
      `127.0.0.1:${request.monitorPort}:1234`,
      "-p",
      `127.0.0.1:${request.usbIpPort}:3240`,
      request.image,
      "renode",
      "--disable-xwt",
      "--plain",
      "--port",
      "1234",
    ],
    {
      cwd: request.workspaceDirectory,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    },
  )

export const createDockerRenodeFirmwareSession = async (
  input: FirmwareSimulationInput,
  options: DockerRenodeFirmwareSessionOptions = {},
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
  const child = startContainer({
    command: options.dockerCommand ?? "docker",
    image: options.image ?? "antmicro/renode:1.16.1",
    containerPlatform: options.containerPlatform ?? "linux/amd64",
    containerName: `tscircuit-renode-${process.pid}-${randomUUID().slice(0, 8)}`,
    workspaceDirectory,
    monitorPort,
    usbIpPort,
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
    await monitor.execute(
      "machine LoadPlatformDescription @/workspace/platform.repl",
    )
    await monitor.execute("emulation CreateUSBIPServer")
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

    return new DockerRenodeFirmwareSession(
      input,
      monitor,
      child,
      workspaceDirectory,
      programmingReceipt,
    )
  } catch (error) {
    monitor?.close()
    child.kill("SIGKILL")
    await waitForProcessExit(child, 2_000)
    await rm(workspaceDirectory, { recursive: true, force: true })
    throw error
  }
}
