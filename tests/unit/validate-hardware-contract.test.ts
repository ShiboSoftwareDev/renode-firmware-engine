import { expect, test } from "bun:test"
import {
  FirmwareHardwareContractError,
  validateHardwareContract,
} from "../../lib"
import { getFixtureInput } from "../fixture-input"

test("accepts the SAMD21 USB, button, and LED wiring", async () => {
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
      element.type === "source_trace" && element.name === "led_mcu_to_resistor",
  )
  disconnectedCircuitJson.splice(ledDriveTraceIndex, 1)

  expect(() =>
    validateHardwareContract(disconnectedCircuitJson, input.hardware),
  ).toThrow(FirmwareHardwareContractError)
  expect(() =>
    validateHardwareContract(disconnectedCircuitJson, input.hardware),
  ).toThrow("U1.PA17 must connect to LED1.anode through R_LED")
})

test("rejects a USB data line that bypasses its series resistor", async () => {
  const input = await getFixtureInput()
  const disconnectedCircuitJson = structuredClone(input.circuitJson)
  const dataPlusTraceIndex = disconnectedCircuitJson.findIndex(
    (element) =>
      element.type === "source_trace" && element.name === "usb_dp_to_mcu",
  )
  disconnectedCircuitJson.splice(dataPlusTraceIndex, 1)

  expect(() =>
    validateHardwareContract(disconnectedCircuitJson, input.hardware),
  ).toThrow("USB1.A6 must connect to U1.PA25 through R_USB_DP")
})

test("rejects a different MCU part number", async () => {
  const input = await getFixtureInput()
  input.hardware.mcu.manufacturerPartNumber = "ATSAMD21J18A-AU"

  expect(() =>
    validateHardwareContract(input.circuitJson, input.hardware),
  ).toThrow("U1 must use ATSAMD21J18A-AU")
})

test("rejects a logical USB power short", async () => {
  const input = await getFixtureInput()
  const shortedCircuitJson = structuredClone(input.circuitJson)
  const vbus = shortedCircuitJson.find(
    (element) => element.type === "source_net" && element.name === "VBUS",
  )
  const ground = shortedCircuitJson.find(
    (element) => element.type === "source_net" && element.name === "GND",
  )
  const traceTemplate = shortedCircuitJson.find(
    (element) => element.type === "source_trace",
  )
  if (
    vbus?.type !== "source_net" ||
    ground?.type !== "source_net" ||
    traceTemplate?.type !== "source_trace"
  ) {
    throw new Error("Fixture must contain VBUS, GND, and a source trace")
  }
  shortedCircuitJson.push({
    ...traceTemplate,
    source_trace_id: "source_trace_vbus_ground_short",
    name: "vbus_ground_short",
    connected_source_port_ids: [],
    connected_source_net_ids: [vbus.source_net_id, ground.source_net_id],
  })

  expect(() =>
    validateHardwareContract(shortedCircuitJson, input.hardware),
  ).toThrow("USB VBUS and GND must not be shorted together")
})

test("requires the physical reset button wiring", async () => {
  const input = await getFixtureInput()
  const disconnectedCircuitJson = structuredClone(input.circuitJson)
  const resetTraceIndex = disconnectedCircuitJson.findIndex(
    (element) =>
      element.type === "source_trace" && element.name === "reset_button",
  )
  disconnectedCircuitJson.splice(resetTraceIndex, 1)

  expect(() =>
    validateHardwareContract(disconnectedCircuitJson, input.hardware),
  ).toThrow("U1.RESET must connect to SW_RESET.pin1")
})
