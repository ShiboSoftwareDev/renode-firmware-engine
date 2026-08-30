import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { CircuitJson } from "circuit-json"
import type { FirmwareSimulationInput } from "../lib"

export const fixtureDirectory = join(
  import.meta.dir,
  "fixtures",
  "samd21-usb-button-led",
)

export const getFixtureInput = async (): Promise<FirmwareSimulationInput> => {
  const circuitJson = JSON.parse(
    await readFile(join(fixtureDirectory, "circuit", "circuit.json"), "utf8"),
  ) as CircuitJson

  return {
    name: "Firmware mirrors SW1 onto LED1",
    circuitJson,
    firmware: {
      path: join(fixtureDirectory, "generated", "firmware.bin"),
      format: "binary",
      programming: {
        method: "usb_sam_ba",
        loadAddress: 0x00002000,
        cpuPeripheralPath: "sysbus.cpu0",
      },
      stackPointer: 0x20004000,
      entryPoint: 0x00002100,
    },
    hardware: {
      mcu: {
        componentName: "U1",
        manufacturerPartNumber: "ATSAMD21J17D-AFT",
      },
      platformRepl: "platforms/cpus/atsamd21j17d-aft.repl",
      leds: [
        {
          componentName: "LED1",
          mcuPortName: "PA17",
          gpioPeripheral: "gpio_a",
          gpioPin: 17,
          drivePortName: "anode",
          referencePortName: "cathode",
          referenceNetName: "GND",
          seriesResistorComponentName: "R_LED",
          expectedResistanceOhms: 1_000,
        },
      ],
      buttons: [
        {
          componentName: "SW1",
          manufacturerPartNumber: "TS-1187A-B-A-B",
          mcuPortName: "PA16",
          gpioPeripheral: "gpio_a",
          gpioPin: 16,
          signalPortName: "pin1",
          referencePortName: "pin2",
          referenceNetName: "VCC",
          bias: {
            resistorComponentName: "R_BUTTON",
            referenceNetName: "GND",
            expectedResistanceOhms: 10_000,
          },
        },
      ],
      usb: {
        connectorComponentName: "USB1",
        connectorManufacturerPartNumber: "TYPE-C-31-M-12",
        dataPlus: {
          connectorPortNames: ["A6", "B6"],
          mcuPortName: "PA25",
          seriesResistorComponentName: "R_USB_DP",
          expectedResistanceOhms: 22,
        },
        dataMinus: {
          connectorPortNames: ["A7", "B7"],
          mcuPortName: "PA24",
          seriesResistorComponentName: "R_USB_DM",
          expectedResistanceOhms: 22,
        },
        vbusPortNames: ["A4B9", "B4A9"],
        vbusNetName: "VBUS",
        groundPortNames: ["A1B12", "B1A12", "EH1", "EH2", "EH3", "EH4"],
        groundNetName: "GND",
        configurationChannelPullDowns: [
          {
            connectorPortName: "A5",
            resistorComponentName: "R_CC1",
            expectedResistanceOhms: 5_100,
          },
          {
            connectorPortName: "B5",
            resistorComponentName: "R_CC2",
            expectedResistanceOhms: 5_100,
          },
        ],
      },
    },
    steps: [
      { type: "assert_led", componentName: "LED1", isOn: false },
      { type: "set_button", componentName: "SW1", isPressed: true },
      { type: "assert_led", componentName: "LED1", isOn: true },
      { type: "set_button", componentName: "SW1", isPressed: false },
      { type: "assert_led", componentName: "LED1", isOn: false },
    ],
    timeoutMilliseconds: 30_000,
  }
}
