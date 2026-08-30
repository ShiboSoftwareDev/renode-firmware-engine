import {
  assertRenodeIdentifier,
  assertRenodeReplPath,
  toRenodeIdentifier,
} from "./renode-identifiers"
import type {
  RenodeButtonContract,
  RenodeHardwareContract,
  RenodeLedContract,
} from "./types"

export const getRenodeLedPath = (led: RenodeLedContract): string => {
  const renodeIdentifier = toRenodeIdentifier(led.componentName)
  return `sysbus.${led.gpioPeripheral}.${renodeIdentifier}`
}

export const getRenodeButtonPath = (button: RenodeButtonContract): string => {
  const renodeIdentifier = toRenodeIdentifier(button.componentName)
  return `sysbus.${button.gpioPeripheral}.${renodeIdentifier}`
}

const compileLedRepl = (led: RenodeLedContract): string => {
  assertRenodeIdentifier(led.gpioPeripheral, "GPIO peripheral")
  const renodeIdentifier = toRenodeIdentifier(led.componentName)
  return `${renodeIdentifier}: Miscellaneous.LED @ ${led.gpioPeripheral}

${led.gpioPeripheral}:
    ${led.gpioPin} -> ${renodeIdentifier}@0`
}

const compileButtonRepl = (button: RenodeButtonContract): string => {
  assertRenodeIdentifier(button.gpioPeripheral, "GPIO peripheral")
  const renodeIdentifier = toRenodeIdentifier(button.componentName)
  return `${renodeIdentifier}: Miscellaneous.Button @ ${button.gpioPeripheral}
    -> ${button.gpioPeripheral}@${button.gpioPin}`
}

export const compilePlatformRepl = (
  hardware: RenodeHardwareContract,
): string => {
  assertRenodeReplPath(hardware.platformRepl)
  const peripheralDefinitions = [
    ...hardware.leds.map(compileLedRepl),
    ...hardware.buttons.map(compileButtonRepl),
  ]
  return [`using "${hardware.platformRepl}"`, ...peripheralDefinitions].join(
    "\n\n",
  )
}
