export { compilePlatformRepl } from "./compile-platform-repl"
export { compileRenodeSuite } from "./compile-renode-suite"
export { compileRobotSuite } from "./compile-robot-suite"
export {
  createRenodeFirmwareEngine,
  default,
  type RenodeFirmwareEngineOptions,
} from "./create-renode-firmware-engine"
export {
  createRenodeFirmwareSession,
  type RenodeFirmwareSessionOptions,
} from "./create-renode-firmware-session"
export {
  type EnsureRenodeRuntimeOptions,
  ensureRenodeRuntime,
  getManagedRenodeVersion,
  type RenodeRuntime,
} from "./ensure-renode-runtime"
export { parseRobotOutput } from "./parse-robot-output"
export type * from "./types"
export {
  FirmwareHardwareContractError,
  validateHardwareContract,
} from "./validate-hardware-contract"
export { validateSimulationInput } from "./validate-simulation-input"
export const defineFirmwareSimulation = <
  T extends import("./types").FirmwareSimulationInputFactory,
>(
  factory: T,
): T => factory

export const defineFirmwareWorkbench = <
  T extends import("./types").FirmwareWorkbenchConfig,
>(
  config: T,
): T => config
