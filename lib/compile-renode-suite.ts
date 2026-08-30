import { compilePlatformRepl } from "./compile-platform-repl"
import { compileRobotSuite } from "./compile-robot-suite"
import type { FirmwareSimulationInput, RenodeGeneratedSuite } from "./types"

export const compileRenodeSuite = (
  input: FirmwareSimulationInput,
  firmwareFileName = input.firmware.format === "binary"
    ? "firmware.bin"
    : "firmware.elf",
): RenodeGeneratedSuite => ({
  platformRepl: `${compilePlatformRepl(input.hardware)}\n`,
  robotSuite: compileRobotSuite(input, firmwareFileName),
})
