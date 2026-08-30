import { createDockerRenodeRunner, createRenodeFirmwareEngine } from "../lib"
import { getFixtureInput } from "../tests/fixture-input"

const input = await getFixtureInput()

console.log("Renode firmware simulation")
console.log("  Board: ATSAMD21J17D + USB-C + SW1 + LED1")
console.log("  Firmware: generated/firmware.bin")
console.log("  Programming transport: simulated USB SAM-BA")
console.log(
  "  Scenario: LED off -> press SW1 -> LED on -> release SW1 -> LED off",
)
console.log("\nProgramming and running firmware...")

const engine = createRenodeFirmwareEngine({
  runner: createDockerRenodeRunner(),
})
const result = await engine.simulate(input)

console.log(`\nSimulation ${result.displayStatus.toUpperCase()}`)
if (result.programming) {
  console.log(`  USB bytes written: ${result.programming.bytesWritten}`)
  console.log(`  Firmware SHA-256: ${result.programming.sha256}`)
  console.log(
    `  USB programming verified: ${result.programming.isVerified ? "yes" : "no"}`,
  )
}
for (const test of result.tests) {
  console.log(`  ${test.isPassing ? "PASS" : "FAIL"}: ${test.name}`)
  if (test.message) console.log(`    ${test.message}`)
}
if (result.isPassing) {
  console.log("  PASS: LED1 was off before SW1 was pressed")
  console.log("  PASS: LED1 turned on while SW1 was pressed")
  console.log("  PASS: LED1 turned off after SW1 was released")
}
console.log(`  Renode duration: ${result.durationMilliseconds} ms`)

if (!result.isPassing) {
  if (result.stdout) console.error(result.stdout)
  if (result.stderr) console.error(result.stderr)
  process.exitCode = 1
}
