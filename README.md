# @tscircuit/renode-firmware-engine

End-to-end firmware simulation for tscircuit using
[Renode](https://renode.io/). It is the firmware counterpart to
`@tscircuit/ngspice-spice-engine`: tscircuit remains the source of truth for the
physical board, while this package owns programming, execution, and behavioral
tests.

The default USB flow performs the same sequence as a real development cycle:

```text
Circuit JSON -> hardware-contract check -> USB bootloader enumerates
             -> host erases/transfers binary -> application starts
             -> switches, LEDs, UART, and virtual time are tested
```

This is real host-to-device traffic inside the simulation. The host discovers a
USB CDC/ACM bootloader through USB/IP, sends SAM-BA erase/write/execute commands,
checks every block acknowledgement, and only then runs the firmware. It does not
silently inject the application with `LoadELF`.

## Capabilities

- Programs raw Cortex-M firmware over a simulated USB SAM-BA bootloader.
- Uses a built-in, unprivileged USB/IP host client; Docker does not need
  `--privileged`, `sudo`, a kernel USB/IP module, or a physical `/dev/ttyACM*`.
- Validates the MCU, USB connector MPN, both USB-C orientations, D+/D- series
  resistors, CC pull-downs, VBUS, ground, LEDs, switches, bias resistors, and
  MCU pin names against Circuit JSON before Renode starts.
- Executes the programmed image on Renode's Cortex-M CPU and SoC peripheral
  models.
- Drives physical switch bindings and observes physical LED bindings.
- Supports virtual-time waits and UART-line assertions.
- Returns programming byte count, SHA-256, acknowledgement status, Robot test
  results, process logs, and duration.
- Retains direct ELF preloading as an explicit fast path for low-level firmware
  tests that do not need the programming flow.
- Runs with a native `renode-test` or the pinned
  `antmicro/renode:1.16.1` Docker image.

## Install

```sh
bun add @tscircuit/renode-firmware-engine
```

Docker is the most reproducible runner:

```ts
import { readFile } from "node:fs/promises"
import type { CircuitJson } from "circuit-json"
import {
  createDockerRenodeRunner,
  createRenodeFirmwareEngine,
} from "@tscircuit/renode-firmware-engine"

const circuitJson = JSON.parse(
  await readFile("dist/index/circuit.json", "utf8"),
) as CircuitJson

const engine = createRenodeFirmwareEngine({
  runner: createDockerRenodeRunner(),
})

const result = await engine.simulate({
  name: "Program over USB, then mirror SW1 onto LED1",
  circuitJson,
  firmware: {
    path: "dist/firmware.bin",
    format: "binary",
    programming: {
      method: "usb_sam_ba",
      loadAddress: 0x2000,
      cpuPeripheralPath: "sysbus.cpu0",
    },
    stackPointer: 0x20004000,
    entryPoint: 0x2100,
  },
  hardware: {
    mcu: {
      componentName: "U1",
      manufacturerPartNumber: "ATSAMD21J17D-AFT",
    },
    platformRepl: "platforms/cpus/atsamd21j17d-aft.repl",
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
  },
  steps: [
    { type: "assert_led", componentName: "LED1", isOn: false },
    { type: "set_button", componentName: "SW1", isPressed: true },
    { type: "assert_led", componentName: "LED1", isOn: true },
    { type: "set_button", componentName: "SW1", isPressed: false },
    { type: "assert_led", componentName: "LED1", isOn: false },
  ],
})

if (!result.isPassing) throw new Error(result.tests[0]?.message)

console.log(result.programming)
// {
//   method: "usb_sam_ba",
//   bytesWritten: 324,
//   sha256: "dd43cae9...",
//   isVerified: true,
// }
```

The bare `createRenodeFirmwareEngine()` call uses a native `renode-test` and
expects Renode's USB/IP server on `127.0.0.1:3240`. The Docker runner publishes
that server on a random loopback-only host port, allowing parallel test runs.

## What “programmed and verified” means

For `usb_sam_ba`, the engine completes four observable phases:

1. Renode exposes its bootloader as USB `2341:805a` by default.
2. The host client enumerates and configures that device over USB/IP.
3. The client erases it, transfers the exact binary in blocks, and requires an
   acknowledgement after every flash-copy operation.
4. Renode accepts the complete image at `loadAddress`; the CPU then starts from
   the configured stack pointer and entry point.

`programming.sha256` identifies the host binary that was transferred.
`programming.isVerified` means the erase/write acknowledgements succeeded and
Renode accepted the image. It is not a byte-for-byte physical-flash readback.

## Included board and firmware

[`tests/fixtures/samd21-usb-button-led`](./tests/fixtures/samd21-usb-button-led)
is a complete executable fixture:

- `ATSAMD21J17D-AFT` (`JLCPCB C2053023`) Cortex-M0+ MCU;
- `TYPE-C-31-M-12` (`JLCPCB C165948`) USB-C receptacle with both data
  orientations, 22 ohm D+/D- resistors, and 5.1 kohm CC pull-downs;
- `AP2112K-3.3TRG1` (`JLCPCB C51118`) 3.3 V supply, decoupling, and reset
  circuit;
- `TS-1187A-B-A-B` (`JLCPCB C318884`) application and reset switches with all
  four physical pads wired;
- PA16 application switch with a 10 kohm pull-down;
- PA17 status LED with a 1 kohm series resistor;
- Cortex-M0+ assembly that enables PA16's SAMD21 input buffer and mirrors the
  switch state onto PA17;
- generated Circuit JSON, routed PCB snapshot, raw binary, and ELF artifact;
- a Docker-backed test that programs the binary through USB and verifies
  off -> press/on -> release/off.

Run the package and real Renode regression tests with:

```sh
bun install
bun run check
bun run build:fixture-firmware
bun run test:e2e
```

Rebuild the tscircuit artifacts with:

```sh
cd tests/fixtures/samd21-usb-button-led/circuit
bun install
tsci check netlist
tsci check placement
tsci snapshot --update --pcb-only
tsci check routing-difficulty
tsci build
cp dist/index/circuit.json circuit.json
```

## Using the result on a manufactured board

The simulation and board use the same MCU pins and the same application binary.
The physical MCU must already contain a USB bootloader compatible with the
selected SAM-BA protocol and VID/PID; a blank MCU normally needs that bootloader
installed once through SWD or as a programming service. After that, the real
workflow is USB plug-in, bootloader entry, binary upload, reset, and application
execution. The protocol transfer and application execution are exercised here;
the bootloader-entry gesture is abstracted as an already-active bootloader.

Renode's `ArduinoLoader` is a protocol-level bootloader model, not execution of
your chosen bootloader's own firmware. Test that bootloader separately if its
reset gesture, flash protection, rollback, signing, or update policy is part of
the product.

## Direct ELF fast path

For tests where programming is intentionally out of scope:

```ts
firmware: {
  path: "dist/firmware.elf",
  format: "elf",
  programming: { method: "preloaded" },
}
```

That path uses Renode `LoadELF`; it should not be presented as a USB programming
test.

## Boundaries

This package closes the digital loop between board netlist, programming
protocol, production application binary, MCU execution, and user-visible GPIO
behavior. It cannot promise that manufactured hardware works “exactly” from
simulation alone. Renode does not model USB eye diagrams, connector/cable loss,
power integrity, component tolerances, ESD, oscillator startup, flash wear, or
assembly defects. Keep tscircuit fabrication checks, analog simulation, design
review, prototype bring-up, and hardware-in-the-loop tests in the release gate.
