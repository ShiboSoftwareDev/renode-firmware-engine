import { spawn } from "node:child_process"
import { programSamBaOverUsbIp } from "./program-sam-ba-over-usb-ip"
import type { RenodeProcessResult, RenodeUsbProgrammingRequest } from "./types"

export interface RunCommandWithUsbProgrammingRequest {
  command: string
  arguments: string[]
  cwd: string
  timeoutMilliseconds: number
  usbIpHost: string
  usbIpPort: number
  programming: RenodeUsbProgrammingRequest
}

export const runCommandWithUsbProgramming = async (
  request: RunCommandWithUsbProgrammingRequest,
): Promise<RenodeProcessResult> => {
  const startedAtMilliseconds = Date.now()
  const abortController = new AbortController()
  const child = spawn(request.command, request.arguments, {
    cwd: request.cwd,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  })
  let stdout = ""
  let stderr = ""
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk
  })
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk
  })

  const processCompletion = new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("close", (exitCode) => resolve(exitCode ?? 1))
  })
  const timeout = setTimeout(() => {
    abortController.abort(
      new Error(`${request.command} exceeded ${request.timeoutMilliseconds}ms`),
    )
    child.kill("SIGKILL")
  }, request.timeoutMilliseconds)

  try {
    const [exitCode, programming] = await Promise.all([
      processCompletion,
      programSamBaOverUsbIp({
        host: request.usbIpHost,
        port: request.usbIpPort,
        workspaceDirectory: request.cwd,
        programming: request.programming,
        signal: abortController.signal,
      }),
    ])
    if (abortController.signal.aborted) {
      throw abortController.signal.reason
    }
    return {
      exitCode,
      stdout,
      stderr,
      durationMilliseconds: Date.now() - startedAtMilliseconds,
      programming,
    }
  } catch (error) {
    abortController.abort(error)
    child.kill("SIGKILL")
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
