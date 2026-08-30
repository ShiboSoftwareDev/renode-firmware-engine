import type { CircuitJson } from "circuit-json"

export default ({ circuitJson }: { circuitJson: CircuitJson }) => ({
  name: "Program over USB, then mirror SW1 onto LED1",
  circuitJson,
  firmware: {
    path: "../generated/firmware.bin",
    format: "binary" as const,
    programming: {
      method: "usb_sam_ba" as const,
      loadAddress: 0x00002000,
      cpuPeripheralPath: "sysbus.cpu0",
    },
    stackPointer: 0x20004000,
    entryPoint: 0x00002100,
  },
  hardware: {
    mcu: {
      componentName: "U1",
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
  steps: [{ type: "wait" as const, milliseconds: 1 }],
  timeoutMilliseconds: 30_000,
})
