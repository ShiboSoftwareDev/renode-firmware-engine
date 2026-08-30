# @tscircuit/renode-firmware-engine

A tscircuit-compatible firmware simulation engine using
[Renode](https://renode.io/). It is the firmware counterpart to
`@tscircuit/ngspice-spice-engine`: a small engine package owns the simulator
process while tscircuit remains the source of truth for the physical circuit.

The engine:

- validates MCU, GPIO, LED, switch, resistor, and reference-net bindings
  against Circuit JSON before running firmware;
- compiles those bindings to a Renode platform overlay (`.repl`);
- compiles test steps to a Renode Robot suite;
- loads the same ELF intended for the physical target;
- runs Renode natively or in the pinned `antmicro/renode:1.16.1` container;
- returns typed pass/fail results, logs, and per-test messages.

## Install

```sh
bun add @tscircuit/renode-firmware-engine
```

Use either a native Renode installation with `renode-test` on `PATH`, or
Docker. The Docker runner is the most reproducible option:

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
  name: "Button controls status LED",
  circuitJson,
  firmware: {
    path: "dist/firmware.elf",
    format: "elf",
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
})

if (!result.isPassing) throw new Error(result.tests[0]?.message)
```

The bare call `createRenodeFirmwareEngine()` uses native `renode-test`.

## Why the hardware contract matters

The Renode GPIO number alone is not enough to protect a board/firmware design.
Before launching Renode, this package checks the physical source netlist:

- the MCU part number and named GPIO port exist;
- the LED is driven through the named resistor with the expected resistance;
- the LED's other terminal reaches the expected reference net;
- the switch signal reaches the named MCU GPIO;
- the switch reference and optional bias resistor reach the expected nets;
- no two simulated peripherals claim the same Renode GPIO.

Changing PD12 to another pin, removing `R_LED`, swapping the switch reference,
or changing `R_BUTTON` causes a contract error before the firmware executes.

## Included end-to-end fixture

[`tests/fixtures/stm32-button-led`](./tests/fixtures/stm32-button-led) contains:

- a tscircuit LQFP100 STM32F407VGT6 circuit with the official PA0 (pin 23) and
  PD12 (pin 59) package positions;
- generated Circuit JSON and a PCB snapshot;
- Cortex-M4 assembly source and a reproducible ELF builder;
- a Docker-backed test that loads that ELF, verifies LED1 is initially off,
  presses SW1, verifies LED1 is on, releases SW1, and verifies LED1 is off.

Run everything with:

```sh
bun install
bun run check
bun run build:fixture-firmware
bun run test:e2e
```

To rebuild the Circuit JSON:

```sh
cd tests/fixtures/stm32-button-led/circuit
bun install
tsci check netlist
tsci check placement
tsci snapshot --update --pcb-only
tsci check routing-difficulty
tsci build
cp dist/index/circuit.json circuit.json
```

## Scope

The first release supports ELF loading, GPIO buttons, LEDs, timed virtual
execution, and UART-line assertions. The runtime and compiler interfaces are
separate so additional Renode peripherals can be added without changing the
process runner.

Firmware simulation verifies digital behavior and pin/net agreement. It does
not replace power-integrity analysis, analog simulation, PCB DRC, USB signal
integrity, production test, or hardware-in-the-loop validation. The fixture is
an executable integration example, not a complete production reference design.
