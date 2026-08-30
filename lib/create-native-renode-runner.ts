import { runCommand } from "./run-command"
import { runCommandWithUsbProgramming } from "./run-command-with-usb-programming"
import type { RenodeRunner } from "./types"

export interface NativeRenodeRunnerOptions {
  renodeTestCommand?: string
}

export const createNativeRenodeRunner = (
  options: NativeRenodeRunnerOptions = {},
): RenodeRunner => ({
  run: (request) => {
    const command = options.renodeTestCommand ?? "renode-test"
    const renodeArguments = [
      "--test-timeout",
      `${Math.ceil(request.timeoutMilliseconds / 1000)}`,
      request.robotFileName,
    ]
    if (!request.programming) {
      return runCommand({
        command,
        arguments: renodeArguments,
        cwd: request.workspaceDirectory,
        timeoutMilliseconds: request.timeoutMilliseconds + 10_000,
      })
    }
    return runCommandWithUsbProgramming({
      command,
      arguments: renodeArguments,
      cwd: request.workspaceDirectory,
      timeoutMilliseconds: request.timeoutMilliseconds + 10_000,
      usbIpHost: "127.0.0.1",
      usbIpPort: 3240,
      programming: request.programming,
    })
  },
})
