import { expect, test } from "bun:test"
import { createDockerRenodeFirmwareSession } from "../lib"
import { getFixtureInput } from "./fixture-input"

test("keeps programmed firmware alive while switches drive LEDs", async () => {
  const session = await createDockerRenodeFirmwareSession(
    await getFixtureInput(),
  )
  try {
    const initialState = await session.getState()
    expect(initialState.programming.isVerified).toBe(true)
    expect(initialState.ledStates.LED1).toBe(false)

    const pressedState = await session.setButton({
      componentName: "SW1",
      isPressed: true,
    })
    expect(pressedState.buttonStates.SW1).toBe(true)
    expect(pressedState.ledStates.LED1).toBe(true)

    const releasedState = await session.setButton({
      componentName: "SW1",
      isPressed: false,
    })
    expect(releasedState.buttonStates.SW1).toBe(false)
    expect(releasedState.ledStates.LED1).toBe(false)

    const poweredOffState = await session.powerOff()
    expect(poweredOffState.isPowered).toBe(false)
    expect(poweredOffState.isRunning).toBe(false)

    const poweredOnState = await session.powerOn()
    expect(poweredOnState.isPowered).toBe(true)
    expect(poweredOnState.isRunning).toBe(true)
    expect(poweredOnState.ledStates.LED1).toBe(false)

    const resetState = await session.reset()
    expect(resetState.isPowered).toBe(true)
    expect(resetState.ledStates.LED1).toBe(false)
  } finally {
    await session.stop()
  }
}, 60_000)
