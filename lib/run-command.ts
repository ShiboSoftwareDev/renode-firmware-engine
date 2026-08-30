import { spawn } from "node:child_process"
import type { RenodeProcessResult } from "./types"

export interface RunCommandRequest {
  command: string
  arguments: string[]
  cwd: string
  timeoutMilliseconds: number
}

export const runCommand = (
  request: RunCommandRequest,
): Promise<RenodeProcessResult> =>
  new Promise((resolve, reject) => {
    const startedAtMilliseconds = Date.now()
    const child = spawn(request.command, request.arguments, {
      cwd: request.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let hasSettled = false

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk
    })

    const timeout = setTimeout(() => {
      if (hasSettled) return
      hasSettled = true
      child.kill("SIGKILL")
      reject(
        new Error(
          `${request.command} exceeded ${request.timeoutMilliseconds}ms`,
        ),
      )
    }, request.timeoutMilliseconds)

    child.once("error", (error) => {
      if (hasSettled) return
      hasSettled = true
      clearTimeout(timeout)
      reject(error)
    })

    child.once("close", (exitCode) => {
      if (hasSettled) return
      hasSettled = true
      clearTimeout(timeout)
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
        durationMilliseconds: Date.now() - startedAtMilliseconds,
      })
    })
  })
