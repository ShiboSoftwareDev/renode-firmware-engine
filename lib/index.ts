export { compilePlatformRepl } from "./compile-platform-repl"
export { compileRenodeSuite } from "./compile-renode-suite"
export { compileRobotSuite } from "./compile-robot-suite"
export {
  createDockerRenodeFirmwareSession,
  type DockerRenodeFirmwareSessionOptions,
} from "./create-docker-renode-firmware-session"
export {
  createDockerRenodeRunner,
  type DockerRenodeRunnerOptions,
} from "./create-docker-renode-runner"
export {
  createNativeRenodeRunner,
  type NativeRenodeRunnerOptions,
} from "./create-native-renode-runner"
export {
  createRenodeFirmwareEngine,
  default,
  type RenodeFirmwareEngineOptions,
} from "./create-renode-firmware-engine"
export { parseRobotOutput } from "./parse-robot-output"
export type * from "./types"
export {
  FirmwareHardwareContractError,
  validateHardwareContract,
} from "./validate-hardware-contract"
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
