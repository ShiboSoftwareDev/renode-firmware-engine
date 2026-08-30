import { runCommand } from "./run-command"
import type { RenodeRunner } from "./types"

export interface NativeRenodeRunnerOptions {
  renodeTestCommand?: string
}

export const createNativeRenodeRunner = (
  options: NativeRenodeRunnerOptions = {},
): RenodeRunner => ({
  run: (request) =>
    runCommand({
      command: options.renodeTestCommand ?? "renode-test",
      arguments: [
        "--test-timeout",
        `${Math.ceil(request.timeoutMilliseconds / 1000)}`,
        request.robotFileName,
      ],
      cwd: request.workspaceDirectory,
      timeoutMilliseconds: request.timeoutMilliseconds + 10_000,
    }),
})
