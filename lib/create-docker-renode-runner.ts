import { runCommand } from "./run-command"
import type { RenodeRunner } from "./types"

export interface DockerRenodeRunnerOptions {
  dockerCommand?: string
  image?: string
  containerPlatform?: string
}

export const createDockerRenodeRunner = (
  options: DockerRenodeRunnerOptions = {},
): RenodeRunner => ({
  run: (request) => {
    const image = options.image ?? "antmicro/renode:1.16.1"
    const containerPlatform = options.containerPlatform ?? "linux/amd64"
    return runCommand({
      command: options.dockerCommand ?? "docker",
      arguments: [
        "run",
        "--rm",
        "--platform",
        containerPlatform,
        "-v",
        `${request.workspaceDirectory}:/workspace`,
        "-w",
        "/workspace",
        image,
        "renode-test",
        "--test-timeout",
        `${Math.ceil(request.timeoutMilliseconds / 1000)}`,
        request.robotFileName,
      ],
      cwd: request.workspaceDirectory,
      timeoutMilliseconds: request.timeoutMilliseconds + 10_000,
    })
  },
})
