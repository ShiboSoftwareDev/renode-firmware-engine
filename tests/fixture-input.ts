import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { CircuitJson } from "circuit-json"
import type { FirmwareSimulationInput } from "../lib"

export const fixtureDirectory = join(
  import.meta.dir,
  "fixtures",
  "stm32-button-led",
)

export const getFixtureInput = async (): Promise<FirmwareSimulationInput> => {
  const circuitJson = JSON.parse(
    await readFile(join(fixtureDirectory, "circuit", "circuit.json"), "utf8"),
  ) as CircuitJson

  return {
    name: "Firmware mirrors SW1 onto LED1",
    circuitJson,
    firmware: {
      path: join(fixtureDirectory, "generated", "firmware.elf"),
      format: "elf",
      stackPointer: 0x20040000,
      entryPoint: 0x08000100,
    },
    hardware: {
      mcu: {
        componentName: "U1",
        manufacturerPartNumber: "STM32F407VGT6",
      },
      platformRepl: "platforms/cpus/stm32f4.repl",
      leds: [
        {
          componentName: "LED1",
          mcuPortName: "PD12",
          gpioPeripheral: "gpioPortD",
          gpioPin: 12,
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
          mcuPortName: "PA0",
          gpioPeripheral: "gpioPortA",
          gpioPin: 0,
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
