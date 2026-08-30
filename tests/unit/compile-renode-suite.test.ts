import { expect, test } from "bun:test"
import { compileRenodeSuite } from "../../lib"
import { getFixtureInput } from "../fixture-input"

test("compiles the circuit bindings into Renode REPL and Robot files", async () => {
  const input = await getFixtureInput()
  const suite = compileRenodeSuite(input)

  expect(suite.platformRepl).toBe(`using "platforms/cpus/stm32f4.repl"

LED1: Miscellaneous.LED @ gpioPortD

gpioPortD:
    12 -> LED1@0

SW1: Miscellaneous.Button @ gpioPortA
    -> gpioPortA@0
`)
  expect(suite.robotSuite).toContain(
    `machine LoadPlatformDescription @\${CURDIR}/platform.repl`,
  )
  expect(suite.robotSuite).toContain(`sysbus LoadELF @\${CURDIR}/firmware.elf`)
  expect(suite.robotSuite).toContain("cpu SetRegisterUnsafe 13 0x20040000")
  expect(suite.robotSuite).toContain("cpu PC 0x8000100")
  expect(suite.robotSuite).toContain("sysbus.gpioPortA.SW1 Press")
  expect(suite.robotSuite).toContain("sysbus.gpioPortA.SW1 Release")
  expect(suite.robotSuite.match(/Assert Led State/g)).toHaveLength(3)
})
