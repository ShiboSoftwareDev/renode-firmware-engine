import { AP2112K_3_3TRG1 } from "./imports/AP2112K_3_3TRG1"
import { ATSAMD21J17D_AFT } from "./imports/ATSAMD21J17D_AFT"
import { TS_1187A_B_A_B } from "./imports/TS_1187A_B_A_B"
import { TYPE_C_31_M_12 } from "./imports/TYPE_C_31_M_12"

export default () => (
  <board width="55mm" height="45mm">
    <ATSAMD21J17D_AFT
      name="U1"
      manufacturerPartNumber="ATSAMD21J17D-AFT"
      pcbX={-5}
      pcbY={0}
      schX={0}
      schY={0}
    />
    <TYPE_C_31_M_12
      name="USB1"
      manufacturerPartNumber="TYPE-C-31-M-12"
      pcbX={-20}
      pcbY={0}
      pcbRotation={270}
      schX={-13}
      schY={0}
    />
    <AP2112K_3_3TRG1
      name="U_REG"
      manufacturerPartNumber="AP2112K-3.3TRG1"
      pcbX={-14}
      pcbY={-9}
      schX={-8}
      schY={-8}
    />

    <resistor
      name="R_USB_DP"
      resistance="22"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C25092"] }}
      pcbX={3}
      pcbY={3}
      schX={-7}
      schY={3}
    />
    <resistor
      name="R_USB_DM"
      resistance="22"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C25092"] }}
      pcbX={3}
      pcbY={1}
      schX={-7}
      schY={1}
    />
    <resistor
      name="R_CC1"
      resistance="5.1k"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C25905"] }}
      pcbX={-16}
      pcbY={6}
      schX={-10}
      schY={6}
    />
    <resistor
      name="R_CC2"
      resistance="5.1k"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C25905"] }}
      pcbX={-16}
      pcbY={8}
      schX={-10}
      schY={8}
    />

    <capacitor
      name="C_REG_IN"
      capacitance="1uF"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C52923"] }}
      pcbX={-17}
      pcbY={-12}
      schX={-11}
      schY={-10}
    />
    <capacitor
      name="C_REG_OUT"
      capacitance="1uF"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C52923"] }}
      pcbX={-11}
      pcbY={-11}
      schX={-5}
      schY={-10}
    />
    <capacitor
      name="C_VDD1"
      capacitance="100nF"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C1525"] }}
      pcbX={2}
      pcbY={-8}
      schX={5}
      schY={-7}
    />
    <capacitor
      name="C_VDD2"
      capacitance="100nF"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C1525"] }}
      pcbX={4}
      pcbY={-8}
      schX={7}
      schY={-7}
    />
    <capacitor
      name="C_VDD3"
      capacitance="100nF"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C1525"] }}
      pcbX={6}
      pcbY={-8}
      schX={9}
      schY={-7}
    />
    <capacitor
      name="C_VDDANA"
      capacitance="100nF"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C1525"] }}
      pcbX={8}
      pcbY={-8}
      schX={11}
      schY={-7}
    />
    <capacitor
      name="C_VDDCORE"
      capacitance="1uF"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C52923"] }}
      pcbX={-12.8}
      pcbY={1}
      pcbRotation={180}
      schX={13}
      schY={-7}
    />

    <resistor
      name="R_LED"
      resistance="1k"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C11702"] }}
      pcbX={8}
      pcbY={5}
      schX={7}
      schY={4}
    />
    <led
      name="LED1"
      color="green"
      footprint="0603"
      supplierPartNumbers={{ jlcpcb: ["C965799"] }}
      pcbX={13}
      pcbY={5}
      schX={11}
      schY={4}
    />
    <TS_1187A_B_A_B
      name="SW1"
      manufacturerPartNumber="TS-1187A-B-A-B"
      pcbX={12}
      pcbY={-3}
      schX={11}
      schY={-2}
    />
    <resistor
      name="R_BUTTON"
      resistance="10k"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C25744"] }}
      pcbX={7}
      pcbY={-4}
      schX={7}
      schY={-4}
    />
    <TS_1187A_B_A_B
      name="SW_RESET"
      manufacturerPartNumber="TS-1187A-B-A-B"
      pcbX={21}
      pcbY={-9}
      schX={15}
      schY={-4}
    />
    <resistor
      name="R_RESET"
      resistance="10k"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C25744"] }}
      pcbX={13}
      pcbY={-9}
      schX={12}
      schY={-7}
    />

    <trace from=".USB1 > .A6" to="net.USB_DP_CONNECTOR" />
    <trace from=".USB1 > .B6" to="net.USB_DP_CONNECTOR" />
    <trace from="net.USB_DP_CONNECTOR" to=".R_USB_DP > .pin1" />
    <trace name="usb_dp_to_mcu" from=".R_USB_DP > .pin2" to=".U1 > .PA25" />
    <trace from=".USB1 > .A7" to="net.USB_DM_CONNECTOR" />
    <trace from=".USB1 > .B7" to="net.USB_DM_CONNECTOR" />
    <trace from="net.USB_DM_CONNECTOR" to=".R_USB_DM > .pin1" />
    <trace name="usb_dm_to_mcu" from=".R_USB_DM > .pin2" to=".U1 > .PA24" />

    <trace from=".USB1 > .A4B9" to="net.VBUS" />
    <trace from=".USB1 > .B4A9" to="net.VBUS" />
    <trace from=".USB1 > .A1B12" to="net.GND" />
    <trace from=".USB1 > .B1A12" to="net.GND" />
    <trace from=".USB1 > .EH1" to="net.GND" />
    <trace from=".USB1 > .EH2" to="net.GND" />
    <trace from=".USB1 > .EH3" to="net.GND" />
    <trace from=".USB1 > .EH4" to="net.GND" />
    <trace name="usb_cc1" from=".USB1 > .A5" to=".R_CC1 > .pin1" />
    <trace from=".R_CC1 > .pin2" to="net.GND" />
    <trace name="usb_cc2" from=".USB1 > .B5" to=".R_CC2 > .pin1" />
    <trace from=".R_CC2 > .pin2" to="net.GND" />

    <trace from="net.VBUS" to=".U_REG > .VIN" />
    <trace from="net.VBUS" to=".U_REG > .EN" />
    <trace from=".U_REG > .GND" to="net.GND" />
    <trace from=".U_REG > .VOUT" to="net.VCC" />
    <trace from="net.VBUS" to=".C_REG_IN > .pin1" />
    <trace from=".C_REG_IN > .pin2" to="net.GND" />
    <trace from="net.VCC" to=".C_REG_OUT > .pin1" />
    <trace from=".C_REG_OUT > .pin2" to="net.GND" />

    <trace name="led_mcu_to_resistor" from=".U1 > .PA17" to=".R_LED > .pin1" />
    <trace
      name="led_resistor_to_anode"
      from=".R_LED > .pin2"
      to=".LED1 > .anode"
    />
    <trace from=".LED1 > .cathode" to="net.GND" />
    <trace name="button_to_mcu" from=".U1 > .PA16" to=".SW1 > .pin1" />
    <trace from=".SW1 > .pin2" to="net.VCC" />
    <trace name="button_pair_a" from=".SW1 > .pin3" to=".SW1 > .pin1" />
    <trace name="button_pair_b" from=".SW1 > .pin4" to=".SW1 > .pin2" />
    <trace name="button_bias" from=".SW1 > .pin1" to=".R_BUTTON > .pin1" />
    <trace from=".R_BUTTON > .pin2" to="net.GND" />

    <trace name="reset_button" from=".U1 > .RESET" to=".SW_RESET > .pin1" />
    <trace from=".SW_RESET > .pin2" to="net.GND" />
    <trace
      name="reset_pair_a"
      from=".SW_RESET > .pin3"
      to=".SW_RESET > .pin1"
    />
    <trace
      name="reset_pair_b"
      from=".SW_RESET > .pin4"
      to=".SW_RESET > .pin2"
    />
    <trace name="reset_pullup" from=".U1 > .RESET" to=".R_RESET > .pin1" />
    <trace from=".R_RESET > .pin2" to="net.VCC" />

    <trace from=".U1 > .GND1" to="net.GND" />
    <trace from=".U1 > .GND2" to="net.GND" />
    <trace from=".U1 > .GND3" to="net.GND" />
    <trace from=".U1 > .GND4" to="net.GND" />
    <trace from=".U1 > .GNDANA" to="net.GND" />
    <trace from=".U1 > .VDDIO1" to="net.VCC" />
    <trace from=".U1 > .VDDIO2" to="net.VCC" />
    <trace from=".U1 > .VDDIO3" to="net.VCC" />
    <trace from=".U1 > .VDDANA" to="net.VCC" />
    <trace from=".U1 > .VDDIN" to="net.VCC" />
    <trace
      name="vddcore_decoupling"
      from=".U1 > .VDDCORE"
      to=".C_VDDCORE > .pin1"
      maxLength="2mm"
    />
    <trace from=".C_VDDCORE > .pin2" to="net.GND" maxLength="3mm" />
    <trace from="net.VCC" to=".C_VDD1 > .pin1" />
    <trace from=".C_VDD1 > .pin2" to="net.GND" />
    <trace from="net.VCC" to=".C_VDD2 > .pin1" />
    <trace from=".C_VDD2 > .pin2" to="net.GND" />
    <trace from="net.VCC" to=".C_VDD3 > .pin1" />
    <trace from=".C_VDD3 > .pin2" to="net.GND" />
    <trace from="net.VCC" to=".C_VDDANA > .pin1" />
    <trace from=".C_VDDANA > .pin2" to="net.GND" />
  </board>
)
