import { expect, test } from "bun:test"
import { compileRenodeSuite } from "../../lib"
import { getFixtureInput } from "../fixture-input"

test("compiles the circuit bindings into Renode REPL and Robot files", async () => {
  const input = await getFixtureInput()
  const suite = compileRenodeSuite(input)

  expect(suite.platformRepl).toBe(`using "platforms/cpus/atsamd21j17d-aft.repl"

LED1: Miscellaneous.LED @ gpio_a

gpio_a:
    17 -> LED1@0

SW1: Miscellaneous.Button @ gpio_a
    -> gpio_a@16
`)
  expect(suite.robotSuite).toContain(
    `machine LoadPlatformDescription @\${CURDIR}/platform.repl`,
  )
  expect(suite.robotSuite).not.toContain("LoadELF")
  expect(suite.robotSuite).toContain("emulation CreateUSBIPServer")
  expect(suite.robotSuite).toContain(
    'host.usb CreateArduinoLoader sysbus.cpu0 0x2000 0 "firmwareLoader"',
  )
  expect(suite.robotSuite).toContain("firmwareLoader WaitForBinary 20 false")
  expect(suite.robotSuite).toContain("sysbus.cpu0 SetRegister 13 0x20004000")
  expect(suite.robotSuite).toContain("sysbus.cpu0 PC 0x2100")
  expect(suite.robotSuite).toContain("sysbus.gpio_a.SW1 Press")
  expect(suite.robotSuite).toContain("sysbus.gpio_a.SW1 Release")
  expect(suite.robotSuite.match(/Assert Led State/g)).toHaveLength(3)
})

test("keeps explicit ELF preloading as a non-programming fast path", async () => {
  const input = await getFixtureInput()
  input.firmware = {
    path: "firmware.elf",
    format: "elf",
    programming: { method: "preloaded" },
  }

  const suite = compileRenodeSuite(input)

  expect(suite.robotSuite).toContain(`sysbus LoadELF @\${CURDIR}/firmware.elf`)
  expect(suite.robotSuite).not.toContain("CreateUSBIPServer")
  expect(suite.robotSuite).not.toContain("WaitForBinary")
})
