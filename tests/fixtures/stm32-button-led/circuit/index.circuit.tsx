const stm32PinLabels = {
  pin10: ["VSS1", "VSS"],
  pin11: ["VDD1", "VDD"],
  pin14: "NRST",
  pin19: ["VDD2", "VDD"],
  pin20: "VSSA",
  pin21: "VREF_PLUS",
  pin22: "VDDA",
  pin23: "PA0",
  pin27: ["VSS2", "VSS"],
  pin28: ["VDD3", "VDD"],
  pin49: "VCAP_1",
  pin50: ["VDD4", "VDD"],
  pin59: "PD12",
  pin72: "PA13_SWDIO",
  pin73: "VCAP_2",
  pin74: ["VSS3", "VSS"],
  pin75: ["VDD5", "VDD"],
  pin76: "PA14_SWCLK",
  pin94: "BOOT0",
  pin99: ["VSS4", "VSS"],
  pin100: ["VDD6", "VDD"],
} as const

export default () => (
  <board width="45mm" height="40mm">
    <chip
      name="U1"
      manufacturerPartNumber="STM32F407VGT6"
      footprint="kicad:Package_QFP/LQFP-100_14x14mm_P0.5mm"
      pinLabels={stm32PinLabels}
      pcbX={-6}
      pcbY={0}
      schX={-4}
      schY={0}
    />
    <resistor
      name="R_LED"
      resistance="1k"
      footprint="0402"
      pcbX={8}
      pcbY={5}
      schX={4}
      schY={4}
    />
    <led
      name="LED1"
      color="green"
      footprint="0603"
      pcbX={13}
      pcbY={5}
      schX={8}
      schY={4}
    />
    <pushbutton
      name="SW1"
      footprint="pushbutton"
      pcbX={12}
      pcbY={-7}
      schX={8}
      schY={-4}
    />
    <resistor
      name="R_BUTTON"
      resistance="10k"
      footprint="0402"
      pcbX={5}
      pcbY={-9}
      schX={3}
      schY={-6}
    />

    <trace name="led_drive" from=".U1 > .PD12" to=".R_LED > .pin1" />
    <trace name="led_series" from=".R_LED > .pin2" to=".LED1 > .anode" />
    <trace name="led_ground" from=".LED1 > .cathode" to="net.GND" />
    <trace name="button_input" from=".U1 > .PA0" to=".SW1 > .pin1" />
    <trace name="button_power" from=".SW1 > .pin2" to="net.VCC" />
    <trace
      name="button_bias_signal"
      from=".SW1 > .pin1"
      to=".R_BUTTON > .pin1"
    />
    <trace name="button_bias_ground" from=".R_BUTTON > .pin2" to="net.GND" />

    <trace from=".U1 > .VSS1" to="net.GND" />
    <trace from=".U1 > .VSS2" to="net.GND" />
    <trace from=".U1 > .VSS3" to="net.GND" />
    <trace from=".U1 > .VSS4" to="net.GND" />
    <trace from=".U1 > .VSSA" to="net.GND" />
    <trace from=".U1 > .VDD1" to="net.VCC" />
    <trace from=".U1 > .VDD2" to="net.VCC" />
    <trace from=".U1 > .VDD3" to="net.VCC" />
    <trace from=".U1 > .VDD4" to="net.VCC" />
    <trace from=".U1 > .VDD5" to="net.VCC" />
    <trace from=".U1 > .VDD6" to="net.VCC" />
    <trace from=".U1 > .VDDA" to="net.VCC" />
    <trace from=".U1 > .VREF_PLUS" to="net.VCC" />
  </board>
)
