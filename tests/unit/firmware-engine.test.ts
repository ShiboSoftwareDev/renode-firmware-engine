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
        programming: {
          method: "usb_sam_ba",
          bytesWritten: 324,
          sha256: "fixture-sha256",
          isVerified: true,
        },
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
    programming: {
      method: "usb_sam_ba",
      bytesWritten: 324,
      isVerified: true,
    },
  })
  expect(capturedRequest).toBeDefined()
  expect(capturedPlatformRepl).toContain("LED1: Miscellaneous.LED")
  expect(capturedRequest?.programming).toMatchObject({
    method: "usb_sam_ba",
    firmwareFileName: "firmware.bin",
  })
  expect(capturedRobotSuite).toContain("sysbus.gpio_a.SW1 Press")
})

test("rejects a Thumb-bit entry point before starting Renode", async () => {
  const input = await getFixtureInput()
  if (input.firmware.format !== "binary") {
    throw new Error("Expected the USB fixture to use a binary")
  }
  input.firmware.entryPoint = 0x2101

  const engine = createRenodeFirmwareEngine({
    runner: {
      run: () => {
        throw new Error("Runner must not start for invalid input")
      },
    },
  })

  expect(engine.simulate(input)).rejects.toThrow(
    "entry point must be an aligned 32-bit Cortex-M code address",
  )
})
