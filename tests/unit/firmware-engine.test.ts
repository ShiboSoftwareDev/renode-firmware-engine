import { expect, test } from "bun:test"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  createRenodeFirmwareEngine,
  type RenodeProcessRequest,
  type RenodeRunner,
} from "../../lib"
import { getFixtureInput } from "../fixture-input"

test("writes a complete workspace and returns typed Robot results", async () => {
  let capturedRequest: RenodeProcessRequest | undefined
  let capturedPlatformRepl = ""
  let capturedRobotSuite = ""
  const runner: RenodeRunner = {
    run: async (request) => {
      capturedRequest = request
      capturedPlatformRepl = await readFile(
        join(request.workspaceDirectory, "platform.repl"),
        "utf8",
      )
      capturedRobotSuite = await readFile(
        join(request.workspaceDirectory, "scenario.robot"),
        "utf8",
      )
      await writeFile(
        join(request.workspaceDirectory, "robot_output.xml"),
        `<robot><suite><test name="Mock Renode"><status status="PASS"/></test></suite></robot>`,
      )
      return {
        exitCode: 0,
        stdout: "Tests finished successfully :)",
        stderr: "",
        durationMilliseconds: 12,
      }
    },
  }
  const engine = createRenodeFirmwareEngine({ runner })
  const result = await engine.simulate(await getFixtureInput())

  expect(result).toMatchObject({
    isPassing: true,
    displayStatus: "passed",
    tests: [{ name: "Mock Renode", isPassing: true }],
    durationMilliseconds: 12,
  })
  expect(capturedRequest).toBeDefined()
  expect(capturedPlatformRepl).toContain("LED1: Miscellaneous.LED")
  expect(capturedRobotSuite).toContain("sysbus.gpioPortA.SW1 Press")
})
