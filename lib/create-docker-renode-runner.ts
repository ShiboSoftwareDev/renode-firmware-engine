import { createServer } from "node:net"
import { runCommand } from "./run-command"
import { runCommandWithUsbProgramming } from "./run-command-with-usb-programming"
import type { RenodeRunner } from "./types"

export interface DockerRenodeRunnerOptions {
  dockerCommand?: string
  image?: string
  containerPlatform?: string
}

const getAvailableLocalPort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close()
        reject(new Error("Could not allocate a local USB/IP port"))
        return
      }
      server.close((error) => {
        if (error) reject(error)
        else resolve(address.port)
      })
    })
  })

export const createDockerRenodeRunner = (
  options: DockerRenodeRunnerOptions = {},
): RenodeRunner => ({
  run: async (request) => {
    const image = options.image ?? "antmicro/renode:1.16.1"
    const containerPlatform = options.containerPlatform ?? "linux/amd64"
    const command = options.dockerCommand ?? "docker"
    const argumentsBeforeImage = [
      "run",
      "--rm",
      "--platform",
      containerPlatform,
      "-v",
      `${request.workspaceDirectory}:/workspace`,
      "-w",
      "/workspace",
    ]
    const argumentsAfterImage = [
      image,
      "renode-test",
      "--test-timeout",
      `${Math.ceil(request.timeoutMilliseconds / 1000)}`,
      request.robotFileName,
    ]
    if (!request.programming) {
      return runCommand({
        command,
        arguments: [...argumentsBeforeImage, ...argumentsAfterImage],
        cwd: request.workspaceDirectory,
        timeoutMilliseconds: request.timeoutMilliseconds + 10_000,
      })
    }

    const usbIpPort = await getAvailableLocalPort()
    return runCommandWithUsbProgramming({
      command,
      arguments: [
        ...argumentsBeforeImage,
        "-p",
        `127.0.0.1:${usbIpPort}:3240`,
        ...argumentsAfterImage,
      ],
      cwd: request.workspaceDirectory,
      timeoutMilliseconds: request.timeoutMilliseconds + 10_000,
      usbIpHost: "127.0.0.1",
      usbIpPort,
      programming: request.programming,
    })
  },
})
