import type { AnyCircuitElement, CircuitJson } from "circuit-json"
import { toRenodeIdentifier } from "./renode-identifiers"
import type {
  RenodeButtonContract,
  RenodeHardwareContract,
  RenodeLedContract,
  RenodeResetContract,
  RenodeUsbContract,
  RenodeUsbDataLineContract,
  RenodeUsbPowerContract,
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

type ConnectivityEndpointKey = string & {
  readonly connectivityEndpointKey: unique symbol
}
type ConnectivityGraph = Map<
  ConnectivityEndpointKey,
  Set<ConnectivityEndpointKey>
>
interface CircuitConnectivityContext {
  circuitIndex: CircuitIndex
  graph: ConnectivityGraph
}

const getEndpointKey = (
  endpointType: "port" | "net",
  id: string,
): ConnectivityEndpointKey => `${endpointType}:${id}` as ConnectivityEndpointKey

const createConnectivityGraph = (
  circuitIndex: CircuitIndex,
): ConnectivityGraph => {
  const graph: ConnectivityGraph = new Map()
  for (const trace of circuitIndex.traces) {
    const endpoints = [
      ...trace.connected_source_port_ids.map((id: string) =>
        getEndpointKey("port", id),
      ),
      ...trace.connected_source_net_ids.map((id: string) =>
        getEndpointKey("net", id),
      ),
    ]
    for (const endpoint of endpoints) {
      const neighbors =
        graph.get(endpoint) ?? new Set<ConnectivityEndpointKey>()
      for (const otherEndpoint of endpoints) {
        if (otherEndpoint !== endpoint) neighbors.add(otherEndpoint)
      }
      graph.set(endpoint, neighbors)
    }
  }
  return graph
}

const hasConnectivityPath = (
  request: { start: ConnectivityEndpointKey; end: ConnectivityEndpointKey },
  graph: ConnectivityGraph,
): boolean => {
  const pending = [request.start]
  const visited = new Set<ConnectivityEndpointKey>()
  while (pending.length > 0) {
    const current = pending.shift()
    if (!current || visited.has(current)) continue
    if (current === request.end) return true
    visited.add(current)
    for (const neighbor of graph.get(current) ?? []) pending.push(neighbor)
  }
  return false
}

const arePortsConnected = (
  request: { firstPort: SourcePort; secondPort: SourcePort },
  graph: ConnectivityGraph,
): boolean =>
  hasConnectivityPath(
    {
      start: getEndpointKey("port", request.firstPort.source_port_id),
      end: getEndpointKey("port", request.secondPort.source_port_id),
    },
    graph,
  )

const isPortConnectedToNet = (
  request: { port: SourcePort; net: SourceNet },
  graph: ConnectivityGraph,
): boolean =>
  hasConnectivityPath(
    {
      start: getEndpointKey("port", request.port.source_port_id),
      end: getEndpointKey("net", request.net.source_net_id),
    },
    graph,
  )

const areNetsConnected = (
  request: { firstNet: SourceNet; secondNet: SourceNet },
  graph: ConnectivityGraph,
): boolean =>
  hasConnectivityPath(
    {
      start: getEndpointKey("net", request.firstNet.source_net_id),
      end: getEndpointKey("net", request.secondNet.source_net_id),
    },
    graph,
  )

const hasConnectedSeriesPath = (
  request: {
    firstPort: SourcePort
    secondPort: SourcePort
    seriesComponent: SourceComponent
  },
  context: CircuitConnectivityContext,
): boolean => {
  const [firstSeriesPort, secondSeriesPort] = getComponentPorts(
    request.seriesComponent,
    context.circuitIndex,
  )
  if (!firstSeriesPort || !secondSeriesPort) return false
  return (
    (arePortsConnected(
      { firstPort: request.firstPort, secondPort: firstSeriesPort },
      context.graph,
    ) &&
      arePortsConnected(
        { firstPort: secondSeriesPort, secondPort: request.secondPort },
        context.graph,
      )) ||
    (arePortsConnected(
      { firstPort: request.firstPort, secondPort: secondSeriesPort },
      context.graph,
    ) &&
      arePortsConnected(
        { firstPort: firstSeriesPort, secondPort: request.secondPort },
        context.graph,
      ))
  )
}

const hasConnectedSeriesPathToNet = (
  request: {
    firstPort: SourcePort
    net: SourceNet
    seriesComponent: SourceComponent
  },
  context: CircuitConnectivityContext,
): boolean => {
  const [firstSeriesPort, secondSeriesPort] = getComponentPorts(
    request.seriesComponent,
    context.circuitIndex,
  )
  if (!firstSeriesPort || !secondSeriesPort) return false
  return (
    (arePortsConnected(
      { firstPort: request.firstPort, secondPort: firstSeriesPort },
      context.graph,
    ) &&
      isPortConnectedToNet(
        { port: secondSeriesPort, net: request.net },
        context.graph,
      )) ||
    (arePortsConnected(
      { firstPort: request.firstPort, secondPort: secondSeriesPort },
      context.graph,
    ) &&
      isPortConnectedToNet(
        { port: firstSeriesPort, net: request.net },
        context.graph,
      ))
  )
}

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
  } else if (
    request.button.manufacturerPartNumber &&
    buttonComponent.manufacturer_part_number !==
      request.button.manufacturerPartNumber
  ) {
    issues.push(
      `${request.button.componentName} must use ${request.button.manufacturerPartNumber}, found ${buttonComponent.manufacturer_part_number ?? "no manufacturer part number"}`,
    )
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

const validateReset = (
  request: {
    reset: RenodeResetContract
    mcuComponentName: string
  },
  circuitIndex: CircuitIndex,
): string[] => {
  const issues: string[] = []
  const resetComponent = findComponent(
    request.reset.componentName,
    circuitIndex,
  )
  const mcuPort = findPort(
    {
      componentName: request.mcuComponentName,
      portName: request.reset.mcuPortName,
    },
    circuitIndex,
  )
  const signalPort = findPort(
    {
      componentName: request.reset.componentName,
      portName: request.reset.signalPortName,
    },
    circuitIndex,
  )
  const referencePort = findPort(
    {
      componentName: request.reset.componentName,
      portName: request.reset.referencePortName,
    },
    circuitIndex,
  )
  const referenceNet = findNet(request.reset.referenceNetName, circuitIndex)
  const pullReferenceNet = findNet(
    request.reset.pullReferenceNetName,
    circuitIndex,
  )
  const pullResistor = findComponent(
    request.reset.pullResistorComponentName,
    circuitIndex,
  )

  if (!resetComponent) {
    issues.push(`Missing reset button ${request.reset.componentName}`)
  } else if (resetComponent.ftype !== "simple_push_button") {
    issues.push(`${request.reset.componentName} must be a push button`)
  } else if (
    request.reset.manufacturerPartNumber &&
    resetComponent.manufacturer_part_number !==
      request.reset.manufacturerPartNumber
  ) {
    issues.push(
      `${request.reset.componentName} must use ${request.reset.manufacturerPartNumber}, found ${resetComponent.manufacturer_part_number ?? "no manufacturer part number"}`,
    )
  }
  if (!mcuPort) {
    issues.push(
      `Missing MCU reset port ${request.mcuComponentName}.${request.reset.mcuPortName}`,
    )
  }
  if (!signalPort) {
    issues.push(
      `Missing reset button port ${request.reset.componentName}.${request.reset.signalPortName}`,
    )
  }
  if (!referencePort) {
    issues.push(
      `Missing reset button port ${request.reset.componentName}.${request.reset.referencePortName}`,
    )
  }
  if (!referenceNet)
    issues.push(`Missing net ${request.reset.referenceNetName}`)
  if (!pullReferenceNet) {
    issues.push(`Missing net ${request.reset.pullReferenceNetName}`)
  }
  if (!pullResistor) {
    issues.push(
      `Missing reset pull resistor ${request.reset.pullResistorComponentName}`,
    )
  } else {
    validateResistance(
      {
        component: pullResistor,
        expectedResistanceOhms: request.reset.expectedPullResistanceOhms,
      },
      issues,
    )
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
      `${request.mcuComponentName}.${request.reset.mcuPortName} must connect to ${request.reset.componentName}.${request.reset.signalPortName}`,
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
      `${request.reset.componentName}.${request.reset.referencePortName} must connect to ${request.reset.referenceNetName}`,
    )
  }
  if (
    mcuPort &&
    pullResistor &&
    pullReferenceNet &&
    !hasSeriesPathToNet(
      {
        firstPort: mcuPort,
        net: pullReferenceNet,
        seriesComponent: pullResistor,
      },
      circuitIndex,
    )
  ) {
    issues.push(
      `${request.reset.componentName}.${request.reset.signalPortName} must connect to ${request.reset.pullReferenceNetName} through ${request.reset.pullResistorComponentName}`,
    )
  }
  return issues
}

const getRequiredRegulatorPortIssue = (
  request: {
    regulatorComponentName: string
    portName: string
    net: SourceNet
    netName: string
  },
  context: CircuitConnectivityContext,
): string | undefined => {
  const port = findPort(
    {
      componentName: request.regulatorComponentName,
      portName: request.portName,
    },
    context.circuitIndex,
  )
  if (!port) {
    return `Missing regulator port ${request.regulatorComponentName}.${request.portName}`
  }
  if (!isPortConnectedToNet({ port, net: request.net }, context.graph)) {
    return `${request.regulatorComponentName}.${request.portName} must connect to ${request.netName}`
  }
  return undefined
}

const validateUsbPower = (
  request: {
    power: RenodeUsbPowerContract
    mcuComponentName: string
    vbusNet: SourceNet
    groundNet: SourceNet
  },
  context: CircuitConnectivityContext,
): string[] => {
  const issues: string[] = []
  const outputNet = findNet(request.power.outputNetName, context.circuitIndex)
  const regulator = findComponent(
    request.power.regulatorComponentName,
    context.circuitIndex,
  )
  if (!outputNet) issues.push(`Missing net ${request.power.outputNetName}`)
  if (!regulator) {
    issues.push(`Missing regulator ${request.power.regulatorComponentName}`)
    return issues
  }
  const requiredRegulatorPorts = [
    {
      regulatorComponentName: request.power.regulatorComponentName,
      portName: request.power.inputPortName,
      net: request.vbusNet,
      netName: request.vbusNet.name,
    },
    {
      regulatorComponentName: request.power.regulatorComponentName,
      portName: request.power.groundPortName,
      net: request.groundNet,
      netName: request.groundNet.name,
    },
  ]
  if (outputNet) {
    requiredRegulatorPorts.push({
      regulatorComponentName: request.power.regulatorComponentName,
      portName: request.power.outputPortName,
      net: outputNet,
      netName: request.power.outputNetName,
    })
  }
  if (request.power.enablePortName) {
    requiredRegulatorPorts.push({
      regulatorComponentName: request.power.regulatorComponentName,
      portName: request.power.enablePortName,
      net: request.vbusNet,
      netName: request.vbusNet.name,
    })
  }
  for (const requiredRegulatorPort of requiredRegulatorPorts) {
    const issue = getRequiredRegulatorPortIssue(requiredRegulatorPort, context)
    if (issue) issues.push(issue)
  }
  if (
    outputNet &&
    areNetsConnected(
      { firstNet: outputNet, secondNet: request.groundNet },
      context.graph,
    )
  ) {
    issues.push(
      `${request.power.outputNetName} and ${request.groundNet.name} must not be shorted together`,
    )
  }
  for (const portName of request.power.mcuPowerPortNames) {
    const port = findPort(
      { componentName: request.mcuComponentName, portName },
      context.circuitIndex,
    )
    if (!port) {
      issues.push(
        `Missing MCU power port ${request.mcuComponentName}.${portName}`,
      )
    } else if (
      outputNet &&
      !isPortConnectedToNet({ port, net: outputNet }, context.graph)
    ) {
      issues.push(
        `${request.mcuComponentName}.${portName} must connect to ${request.power.outputNetName}`,
      )
    }
  }
  for (const portName of request.power.mcuGroundPortNames) {
    const port = findPort(
      { componentName: request.mcuComponentName, portName },
      context.circuitIndex,
    )
    if (!port) {
      issues.push(
        `Missing MCU ground port ${request.mcuComponentName}.${portName}`,
      )
    } else if (
      !isPortConnectedToNet({ port, net: request.groundNet }, context.graph)
    ) {
      issues.push(
        `${request.mcuComponentName}.${portName} must connect to ${request.groundNet.name}`,
      )
    }
  }
  return issues
}

const validateUsbDataLine = (
  request: {
    lineName: "D+" | "D-"
    line: RenodeUsbDataLineContract
    connectorComponentName: string
    mcuComponentName: string
  },
  context: CircuitConnectivityContext,
): { issues: string[]; connectorPorts: SourcePort[] } => {
  const issues: string[] = []
  const connectorPorts = request.line.connectorPortNames.flatMap((portName) => {
    const port = findPort(
      { componentName: request.connectorComponentName, portName },
      context.circuitIndex,
    )
    if (port) return [port]
    issues.push(
      `Missing USB ${request.lineName} port ${request.connectorComponentName}.${portName}`,
    )
    return []
  })
  const mcuPort = findPort(
    {
      componentName: request.mcuComponentName,
      portName: request.line.mcuPortName,
    },
    context.circuitIndex,
  )
  if (!mcuPort) {
    issues.push(
      `Missing MCU USB ${request.lineName} port ${request.mcuComponentName}.${request.line.mcuPortName}`,
    )
  }
  const resistor = findComponent(
    request.line.seriesResistorComponentName,
    context.circuitIndex,
  )
  if (!resistor) {
    issues.push(
      `Missing USB ${request.lineName} series resistor ${request.line.seriesResistorComponentName}`,
    )
  } else {
    validateResistance(
      {
        component: resistor,
        expectedResistanceOhms: request.line.expectedResistanceOhms,
      },
      issues,
    )
  }
  if (mcuPort && resistor) {
    for (const connectorPort of connectorPorts) {
      if (
        hasConnectedSeriesPath(
          {
            firstPort: connectorPort,
            secondPort: mcuPort,
            seriesComponent: resistor,
          },
          context,
        )
      ) {
        continue
      }
      issues.push(
        `${request.connectorComponentName}.${connectorPort.name} must connect to ${request.mcuComponentName}.${request.line.mcuPortName} through ${request.line.seriesResistorComponentName}`,
      )
    }
  }
  return { issues, connectorPorts }
}

const validateUsb = (
  request: { usb: RenodeUsbContract; mcuComponentName: string },
  circuitIndex: CircuitIndex,
): string[] => {
  const issues: string[] = []
  const connector = findComponent(
    request.usb.connectorComponentName,
    circuitIndex,
  )
  if (!connector) {
    issues.push(`Missing USB connector ${request.usb.connectorComponentName}`)
  } else if (
    request.usb.connectorManufacturerPartNumber &&
    connector.manufacturer_part_number !==
      request.usb.connectorManufacturerPartNumber
  ) {
    issues.push(
      `${request.usb.connectorComponentName} must use ${request.usb.connectorManufacturerPartNumber}, found ${connector.manufacturer_part_number ?? "no manufacturer part number"}`,
    )
  }
  if (request.usb.dataPlus.connectorPortNames.length === 0) {
    issues.push("USB D+ must define at least one connector port")
  }
  if (request.usb.dataMinus.connectorPortNames.length === 0) {
    issues.push("USB D- must define at least one connector port")
  }
  if (request.usb.vbusPortNames.length === 0) {
    issues.push("USB VBUS must define at least one connector port")
  }
  if (request.usb.groundPortNames.length === 0) {
    issues.push("USB ground must define at least one connector port")
  }
  if (request.usb.dataPlus.mcuPortName === request.usb.dataMinus.mcuPortName) {
    issues.push("USB D+ and D- must use different MCU ports")
  }
  if (
    request.usb.dataPlus.seriesResistorComponentName ===
    request.usb.dataMinus.seriesResistorComponentName
  ) {
    issues.push("USB D+ and D- must use different series resistors")
  }
  const graph = createConnectivityGraph(circuitIndex)
  const connectivityContext = { circuitIndex, graph }
  const dataPlus = validateUsbDataLine(
    {
      lineName: "D+",
      line: request.usb.dataPlus,
      connectorComponentName: request.usb.connectorComponentName,
      mcuComponentName: request.mcuComponentName,
    },
    connectivityContext,
  )
  const dataMinus = validateUsbDataLine(
    {
      lineName: "D-",
      line: request.usb.dataMinus,
      connectorComponentName: request.usb.connectorComponentName,
      mcuComponentName: request.mcuComponentName,
    },
    connectivityContext,
  )
  issues.push(...dataPlus.issues, ...dataMinus.issues)
  if (
    dataPlus.connectorPorts[0] &&
    dataMinus.connectorPorts[0] &&
    arePortsConnected(
      {
        firstPort: dataPlus.connectorPorts[0],
        secondPort: dataMinus.connectorPorts[0],
      },
      graph,
    )
  ) {
    issues.push("USB D+ and D- must not be shorted together")
  }

  const vbusNet = findNet(request.usb.vbusNetName, circuitIndex)
  const groundNet = findNet(request.usb.groundNetName, circuitIndex)
  if (!vbusNet) issues.push(`Missing net ${request.usb.vbusNetName}`)
  if (!groundNet) issues.push(`Missing net ${request.usb.groundNetName}`)
  if (
    vbusNet &&
    groundNet &&
    areNetsConnected({ firstNet: vbusNet, secondNet: groundNet }, graph)
  ) {
    issues.push(
      `USB ${request.usb.vbusNetName} and ${request.usb.groundNetName} must not be shorted together`,
    )
  }
  for (const [lineName, connectorPorts] of [
    ["D+", dataPlus.connectorPorts],
    ["D-", dataMinus.connectorPorts],
  ] as const) {
    for (const connectorPort of connectorPorts) {
      if (
        vbusNet &&
        isPortConnectedToNet({ port: connectorPort, net: vbusNet }, graph)
      ) {
        issues.push(`USB ${lineName} must not be shorted to ${vbusNet.name}`)
      }
      if (
        groundNet &&
        isPortConnectedToNet({ port: connectorPort, net: groundNet }, graph)
      ) {
        issues.push(`USB ${lineName} must not be shorted to ${groundNet.name}`)
      }
    }
  }
  for (const portName of request.usb.vbusPortNames) {
    const port = findPort(
      { componentName: request.usb.connectorComponentName, portName },
      circuitIndex,
    )
    if (!port) {
      issues.push(
        `Missing USB VBUS port ${request.usb.connectorComponentName}.${portName}`,
      )
    } else if (
      vbusNet &&
      !isPortConnectedToNet({ port, net: vbusNet }, graph)
    ) {
      issues.push(
        `${request.usb.connectorComponentName}.${portName} must connect to ${request.usb.vbusNetName}`,
      )
    }
  }
  for (const portName of request.usb.groundPortNames) {
    const port = findPort(
      { componentName: request.usb.connectorComponentName, portName },
      circuitIndex,
    )
    if (!port) {
      issues.push(
        `Missing USB ground port ${request.usb.connectorComponentName}.${portName}`,
      )
    } else if (
      groundNet &&
      !isPortConnectedToNet({ port, net: groundNet }, graph)
    ) {
      issues.push(
        `${request.usb.connectorComponentName}.${portName} must connect to ${request.usb.groundNetName}`,
      )
    }
  }

  for (const pullDown of request.usb.configurationChannelPullDowns ?? []) {
    const connectorPort = findPort(
      {
        componentName: request.usb.connectorComponentName,
        portName: pullDown.connectorPortName,
      },
      circuitIndex,
    )
    const resistor = findComponent(pullDown.resistorComponentName, circuitIndex)
    if (!connectorPort) {
      issues.push(
        `Missing USB configuration-channel port ${request.usb.connectorComponentName}.${pullDown.connectorPortName}`,
      )
    }
    if (!resistor) {
      issues.push(`Missing USB pull-down ${pullDown.resistorComponentName}`)
    } else {
      validateResistance(
        {
          component: resistor,
          expectedResistanceOhms: pullDown.expectedResistanceOhms,
        },
        issues,
      )
    }
    if (
      connectorPort &&
      resistor &&
      groundNet &&
      !hasConnectedSeriesPathToNet(
        {
          firstPort: connectorPort,
          net: groundNet,
          seriesComponent: resistor,
        },
        connectivityContext,
      )
    ) {
      issues.push(
        `${request.usb.connectorComponentName}.${pullDown.connectorPortName} must connect to ${request.usb.groundNetName} through ${pullDown.resistorComponentName}`,
      )
    }
  }
  if (request.usb.power && vbusNet && groundNet) {
    issues.push(
      ...validateUsbPower(
        {
          power: request.usb.power,
          mcuComponentName: request.mcuComponentName,
          vbusNet,
          groundNet,
        },
        connectivityContext,
      ),
    )
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
  if (hardware.reset) {
    issues.push(
      ...validateReset(
        { reset: hardware.reset, mcuComponentName: hardware.mcu.componentName },
        circuitIndex,
      ),
    )
  }
  if (hardware.usb) {
    issues.push(
      ...validateUsb(
        { usb: hardware.usb, mcuComponentName: hardware.mcu.componentName },
        circuitIndex,
      ),
    )
  }
  if (issues.length > 0) throw new FirmwareHardwareContractError(issues)
}
