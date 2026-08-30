import { expect, test } from "bun:test"
import {
  FirmwareHardwareContractError,
  validateHardwareContract,
} from "../../lib"
import { getFixtureInput } from "../fixture-input"

test("accepts the LQFP100 button and LED wiring", async () => {
  const input = await getFixtureInput()
  expect(() =>
    validateHardwareContract(input.circuitJson, input.hardware),
  ).not.toThrow()
})

test("rejects firmware bindings that do not match the physical netlist", async () => {
  const input = await getFixtureInput()
  const disconnectedCircuitJson = structuredClone(input.circuitJson)
  const ledDriveTraceIndex = disconnectedCircuitJson.findIndex(
    (element) =>
      element.type === "source_trace" && element.display_name?.includes("PD12"),
  )
  disconnectedCircuitJson.splice(ledDriveTraceIndex, 1)

  expect(() =>
    validateHardwareContract(disconnectedCircuitJson, input.hardware),
  ).toThrow(FirmwareHardwareContractError)
  expect(() =>
    validateHardwareContract(disconnectedCircuitJson, input.hardware),
  ).toThrow("U1.PD12 must connect to LED1.anode through R_LED")
})

test("rejects a different MCU part number", async () => {
  const input = await getFixtureInput()
  input.hardware.mcu.manufacturerPartNumber = "STM32F407ZGT6"

  expect(() =>
    validateHardwareContract(input.circuitJson, input.hardware),
  ).toThrow("U1 must use STM32F407ZGT6")
})
