import type { AnyCircuitElement, CircuitJson } from "circuit-json"
import { toRenodeIdentifier } from "./renode-identifiers"
import type {
  RenodeButtonContract,
  RenodeHardwareContract,
  RenodeLedContract,
} from "./types"

type SourceComponent = Extract<AnyCircuitElement, { type: "source_component" }>
type SourcePort = Extract<AnyCircuitElement, { type: "source_port" }>
type SourceTrace = Extract<AnyCircuitElement, { type: "source_trace" }>
type SourceNet = Extract<AnyCircuitElement, { type: "source_net" }>

interface CircuitIndex {
  components: SourceComponent[]
  ports: SourcePort[]
  traces: SourceTrace[]
  nets: SourceNet[]
}

export class FirmwareHardwareContractError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`Firmware hardware contract failed:\n- ${issues.join("\n- ")}`)
    this.name = "FirmwareHardwareContractError"
    this.issues = issues
  }
}

const indexCircuitJson = (circuitJson: CircuitJson): CircuitIndex => ({
  components: circuitJson.filter(
    (element): element is SourceComponent =>
      element.type === "source_component",
  ),
  ports: circuitJson.filter(
    (element): element is SourcePort => element.type === "source_port",
  ),
  traces: circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  ),
  nets: circuitJson.filter(
    (element): element is SourceNet => element.type === "source_net",
  ),
})

const findComponent = (
  componentName: string,
  circuitIndex: CircuitIndex,
): SourceComponent | undefined =>
  circuitIndex.components.find((component) => component.name === componentName)

const findPort = (
  request: { componentName: string; portName: string },
  circuitIndex: CircuitIndex,
): SourcePort | undefined => {
  const component = findComponent(request.componentName, circuitIndex)
  if (!component) return undefined
  return circuitIndex.ports.find(
    (port) =>
      port.source_component_id === component.source_component_id &&
      (port.name === request.portName ||
        port.port_hints?.includes(request.portName)),
  )
}

const findNet = (
  netName: string,
  circuitIndex: CircuitIndex,
): SourceNet | undefined =>
  circuitIndex.nets.find((sourceNet) => sourceNet.name === netName)

const hasTraceBetweenPorts = (
  request: { firstPort: SourcePort; secondPort: SourcePort },
  circuitIndex: CircuitIndex,
): boolean =>
  circuitIndex.traces.some(
    (trace) =>
      trace.connected_source_port_ids.includes(
        request.firstPort.source_port_id,
      ) &&
      trace.connected_source_port_ids.includes(
        request.secondPort.source_port_id,
      ),
  )

const hasTraceBetweenPortAndNet = (
  request: { port: SourcePort; net: SourceNet },
  circuitIndex: CircuitIndex,
): boolean =>
  circuitIndex.traces.some(
    (trace) =>
      trace.connected_source_port_ids.includes(request.port.source_port_id) &&
      trace.connected_source_net_ids.includes(request.net.source_net_id),
  )

const getComponentPorts = (
  component: SourceComponent,
  circuitIndex: CircuitIndex,
): SourcePort[] =>
  circuitIndex.ports
    .filter(
      (port) => port.source_component_id === component.source_component_id,
    )
    .sort(
      (firstPort, secondPort) =>
        (firstPort.pin_number ?? 0) - (secondPort.pin_number ?? 0),
    )

const hasSeriesPathBetweenPorts = (
  request: {
    firstPort: SourcePort
    secondPort: SourcePort
    seriesComponent: SourceComponent
  },
  circuitIndex: CircuitIndex,
): boolean => {
  const [firstSeriesPort, secondSeriesPort] = getComponentPorts(
    request.seriesComponent,
    circuitIndex,
  )
  if (!firstSeriesPort || !secondSeriesPort) return false
  const hasForwardPath =
    hasTraceBetweenPorts(
      { firstPort: request.firstPort, secondPort: firstSeriesPort },
      circuitIndex,
    ) &&
    hasTraceBetweenPorts(
      { firstPort: secondSeriesPort, secondPort: request.secondPort },
      circuitIndex,
    )
  const hasReversePath =
    hasTraceBetweenPorts(
      { firstPort: request.firstPort, secondPort: secondSeriesPort },
      circuitIndex,
    ) &&
    hasTraceBetweenPorts(
      { firstPort: firstSeriesPort, secondPort: request.secondPort },
      circuitIndex,
    )
  return hasForwardPath || hasReversePath
}

const hasSeriesPathToNet = (
  request: {
    firstPort: SourcePort
    net: SourceNet
    seriesComponent: SourceComponent
  },
  circuitIndex: CircuitIndex,
): boolean => {
  const [firstSeriesPort, secondSeriesPort] = getComponentPorts(
    request.seriesComponent,
    circuitIndex,
  )
  if (!firstSeriesPort || !secondSeriesPort) return false
  const hasForwardPath =
    hasTraceBetweenPorts(
      { firstPort: request.firstPort, secondPort: firstSeriesPort },
      circuitIndex,
    ) &&
    hasTraceBetweenPortAndNet(
      { port: secondSeriesPort, net: request.net },
      circuitIndex,
    )
  const hasReversePath =
    hasTraceBetweenPorts(
      { firstPort: request.firstPort, secondPort: secondSeriesPort },
      circuitIndex,
    ) &&
    hasTraceBetweenPortAndNet(
      { port: firstSeriesPort, net: request.net },
      circuitIndex,
    )
  return hasForwardPath || hasReversePath
}

const validateResistance = (
  request: {
    component: SourceComponent
    expectedResistanceOhms?: number
  },
  issues: string[],
): void => {
  if (request.component.ftype !== "simple_resistor") {
    issues.push(`${request.component.name} must be a resistor`)
    return
  }
  if (request.expectedResistanceOhms === undefined) return
  if (request.component.resistance === request.expectedResistanceOhms) return
  issues.push(
    `${request.component.name} must be ${request.expectedResistanceOhms} ohms, found ${request.component.resistance} ohms`,
  )
}

const validateLed = (
  request: {
    led: RenodeLedContract
    mcuComponentName: string
  },
  circuitIndex: CircuitIndex,
): string[] => {
  const issues: string[] = []
  const ledComponent = findComponent(request.led.componentName, circuitIndex)
  const resistorComponent = findComponent(
    request.led.seriesResistorComponentName,
    circuitIndex,
  )
  const mcuPort = findPort(
    {
      componentName: request.mcuComponentName,
      portName: request.led.mcuPortName,
    },
    circuitIndex,
  )
  const drivePort = findPort(
    {
      componentName: request.led.componentName,
      portName: request.led.drivePortName,
    },
    circuitIndex,
  )
  const referencePort = findPort(
    {
      componentName: request.led.componentName,
      portName: request.led.referencePortName,
    },
    circuitIndex,
  )
  const referenceNet = findNet(request.led.referenceNetName, circuitIndex)

  if (!ledComponent) issues.push(`Missing LED ${request.led.componentName}`)
  else if (ledComponent.ftype !== "simple_led") {
    issues.push(`${request.led.componentName} must be an LED`)
  }
  if (!mcuPort) {
    issues.push(
      `Missing MCU port ${request.mcuComponentName}.${request.led.mcuPortName}`,
    )
  }
  if (!drivePort) {
    issues.push(
      `Missing LED port ${request.led.componentName}.${request.led.drivePortName}`,
    )
  }
  if (!referencePort) {
    issues.push(
      `Missing LED port ${request.led.componentName}.${request.led.referencePortName}`,
    )
  }
  if (!referenceNet) issues.push(`Missing net ${request.led.referenceNetName}`)
  if (!resistorComponent) {
    issues.push(`Missing resistor ${request.led.seriesResistorComponentName}`)
  } else {
    validateResistance(
      {
        component: resistorComponent,
        expectedResistanceOhms: request.led.expectedResistanceOhms,
      },
      issues,
    )
  }

  if (
    mcuPort &&
    drivePort &&
    resistorComponent &&
    !hasSeriesPathBetweenPorts(
      {
        firstPort: mcuPort,
        secondPort: drivePort,
        seriesComponent: resistorComponent,
      },
      circuitIndex,
    )
  ) {
    issues.push(
      `${request.mcuComponentName}.${request.led.mcuPortName} must connect to ${request.led.componentName}.${request.led.drivePortName} through ${request.led.seriesResistorComponentName}`,
    )
  }
  if (
    referencePort &&
    referenceNet &&
    !hasTraceBetweenPortAndNet(
      { port: referencePort, net: referenceNet },
      circuitIndex,
    )
  ) {
    issues.push(
      `${request.led.componentName}.${request.led.referencePortName} must connect to ${request.led.referenceNetName}`,
    )
  }
  return issues
}

const validateButton = (
  request: {
    button: RenodeButtonContract
    mcuComponentName: string
  },
  circuitIndex: CircuitIndex,
): string[] => {
  const issues: string[] = []
  const buttonComponent = findComponent(
    request.button.componentName,
    circuitIndex,
  )
  const mcuPort = findPort(
    {
      componentName: request.mcuComponentName,
      portName: request.button.mcuPortName,
    },
    circuitIndex,
  )
  const signalPort = findPort(
    {
      componentName: request.button.componentName,
      portName: request.button.signalPortName,
    },
    circuitIndex,
  )
  const referencePort = findPort(
    {
      componentName: request.button.componentName,
      portName: request.button.referencePortName,
    },
    circuitIndex,
  )
  const referenceNet = findNet(request.button.referenceNetName, circuitIndex)

  if (!buttonComponent)
    issues.push(`Missing button ${request.button.componentName}`)
  else if (buttonComponent.ftype !== "simple_push_button") {
    issues.push(`${request.button.componentName} must be a push button`)
  }
  if (!mcuPort) {
    issues.push(
      `Missing MCU port ${request.mcuComponentName}.${request.button.mcuPortName}`,
    )
  }
  if (!signalPort) {
    issues.push(
      `Missing button port ${request.button.componentName}.${request.button.signalPortName}`,
    )
  }
  if (!referencePort) {
    issues.push(
      `Missing button port ${request.button.componentName}.${request.button.referencePortName}`,
    )
  }
  if (!referenceNet) {
    issues.push(`Missing net ${request.button.referenceNetName}`)
  }
  if (
    mcuPort &&
    signalPort &&
    !hasTraceBetweenPorts(
      { firstPort: mcuPort, secondPort: signalPort },
      circuitIndex,
    )
  ) {
    issues.push(
      `${request.mcuComponentName}.${request.button.mcuPortName} must connect to ${request.button.componentName}.${request.button.signalPortName}`,
    )
  }
  if (
    referencePort &&
    referenceNet &&
    !hasTraceBetweenPortAndNet(
      { port: referencePort, net: referenceNet },
      circuitIndex,
    )
  ) {
    issues.push(
      `${request.button.componentName}.${request.button.referencePortName} must connect to ${request.button.referenceNetName}`,
    )
  }

  if (request.button.bias && signalPort) {
    const biasResistor = findComponent(
      request.button.bias.resistorComponentName,
      circuitIndex,
    )
    const biasNet = findNet(request.button.bias.referenceNetName, circuitIndex)
    if (!biasResistor) {
      issues.push(
        `Missing bias resistor ${request.button.bias.resistorComponentName}`,
      )
    } else {
      validateResistance(
        {
          component: biasResistor,
          expectedResistanceOhms: request.button.bias.expectedResistanceOhms,
        },
        issues,
      )
    }
    if (!biasNet) {
      issues.push(`Missing net ${request.button.bias.referenceNetName}`)
    }
    if (
      biasResistor &&
      biasNet &&
      !hasSeriesPathToNet(
        { firstPort: signalPort, net: biasNet, seriesComponent: biasResistor },
        circuitIndex,
      )
    ) {
      issues.push(
        `${request.button.componentName}.${request.button.signalPortName} must connect to ${request.button.bias.referenceNetName} through ${request.button.bias.resistorComponentName}`,
      )
    }
  }
  return issues
}

const validateRenodeBindings = (hardware: RenodeHardwareContract): string[] => {
  const issues: string[] = []
  const renodeNames = [...hardware.leds, ...hardware.buttons].map(
    (peripheral) => toRenodeIdentifier(peripheral.componentName),
  )
  if (new Set(renodeNames).size !== renodeNames.length) {
    issues.push("Peripheral component names collide after Renode normalization")
  }
  const gpioBindings = [...hardware.leds, ...hardware.buttons].map(
    (peripheral) => `${peripheral.gpioPeripheral}:${peripheral.gpioPin}`,
  )
  if (new Set(gpioBindings).size !== gpioBindings.length) {
    issues.push("Each Renode GPIO pin can drive only one simulated peripheral")
  }
  for (const peripheral of [...hardware.leds, ...hardware.buttons]) {
    if (Number.isInteger(peripheral.gpioPin) && peripheral.gpioPin >= 0)
      continue
    issues.push(
      `GPIO pin for ${peripheral.componentName} must be a nonnegative integer`,
    )
  }
  return issues
}

export const validateHardwareContract = (
  circuitJson: CircuitJson,
  hardware: RenodeHardwareContract,
): void => {
  const circuitIndex = indexCircuitJson(circuitJson)
  const issues = validateRenodeBindings(hardware)
  const mcuComponent = findComponent(hardware.mcu.componentName, circuitIndex)
  if (!mcuComponent) issues.push(`Missing MCU ${hardware.mcu.componentName}`)
  else {
    if (mcuComponent.ftype !== "simple_chip") {
      issues.push(`${hardware.mcu.componentName} must be a chip`)
    }
    if (
      hardware.mcu.manufacturerPartNumber &&
      mcuComponent.manufacturer_part_number !==
        hardware.mcu.manufacturerPartNumber
    ) {
      issues.push(
        `${hardware.mcu.componentName} must use ${hardware.mcu.manufacturerPartNumber}, found ${mcuComponent.manufacturer_part_number ?? "no manufacturer part number"}`,
      )
    }
  }

  for (const led of hardware.leds) {
    issues.push(
      ...validateLed(
        { led, mcuComponentName: hardware.mcu.componentName },
        circuitIndex,
      ),
    )
  }
  for (const button of hardware.buttons) {
    issues.push(
      ...validateButton(
        { button, mcuComponentName: hardware.mcu.componentName },
        circuitIndex,
      ),
    )
  }
  if (issues.length > 0) throw new FirmwareHardwareContractError(issues)
}
