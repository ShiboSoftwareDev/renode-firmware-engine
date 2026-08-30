import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["PA00"],
  pin2: ["PA01"],
  pin3: ["PA02"],
  pin4: ["PA03"],
  pin5: ["PB04"],
  pin6: ["PB05"],
  pin7: ["GNDANA"],
  pin8: ["VDDANA"],
  pin9: ["PB06"],
  pin10: ["PB07"],
  pin11: ["PB08"],
  pin12: ["PB09"],
  pin13: ["PA04"],
  pin14: ["PA05"],
  pin15: ["PA06"],
  pin16: ["PA07"],
  pin17: ["PA08"],
  pin18: ["PA09"],
  pin19: ["PA10"],
  pin20: ["PA11"],
  pin21: ["VDDIO3"],
  pin22: ["GND4"],
  pin23: ["PB10"],
  pin24: ["PB11"],
  pin25: ["PB12"],
  pin26: ["PB13"],
  pin27: ["PB14"],
  pin28: ["PB15"],
  pin29: ["PA12"],
  pin30: ["PA13"],
  pin31: ["PA14"],
  pin32: ["PA15"],
  pin33: ["GND3"],
  pin34: ["VDDIO2"],
  pin35: ["PA16"],
  pin36: ["PA17"],
  pin37: ["PA18"],
  pin38: ["PA19"],
  pin39: ["PB16"],
  pin40: ["PB17"],
  pin41: ["PA20"],
  pin42: ["PA21"],
  pin43: ["PA22"],
  pin44: ["PA23"],
  pin45: ["PA24"],
  pin46: ["PA25"],
  pin47: ["GND2"],
  pin48: ["VDDIO1"],
  pin49: ["PB22"],
  pin50: ["PB23"],
  pin51: ["PA27"],
  pin52: ["RESET"],
  pin53: ["PA28"],
  pin54: ["GND1"],
  pin55: ["VDDCORE"],
  pin56: ["VDDIN"],
  pin57: ["PA30"],
  pin58: ["PA31"],
  pin59: ["PB30"],
  pin60: ["PB31"],
  pin61: ["PB00"],
  pin62: ["PB01"],
  pin63: ["PB02"],
  pin64: ["PB03"],
} as const

export const ATSAMD21J17D_AFT = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      supplierPartNumbers={{
        jlcpcb: ["C2053023"],
      }}
      manufacturerPartNumber="ATSAMD21J17D_AFT"
      footprint={
        <footprint>
          <smtpad
            portHints={["pin64"]}
            pcbX="-5.5499mm"
            pcbY="-3.750056mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin63"]}
            pcbX="-5.5499mm"
            pcbY="-3.24993mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin62"]}
            pcbX="-5.5499mm"
            pcbY="-2.750058mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin61"]}
            pcbX="-5.5499mm"
            pcbY="-2.249932mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin60"]}
            pcbX="-5.5499mm"
            pcbY="-1.75006mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin59"]}
            pcbX="-5.5499mm"
            pcbY="-1.249934mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin58"]}
            pcbX="-5.5499mm"
            pcbY="-0.750062mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin57"]}
            pcbX="-5.5499mm"
            pcbY="-0.249936mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin56"]}
            pcbX="-5.5499mm"
            pcbY="0.249936mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin55"]}
            pcbX="-5.5499mm"
            pcbY="0.750062mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin54"]}
            pcbX="-5.5499mm"
            pcbY="1.249934mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin53"]}
            pcbX="-5.5499mm"
            pcbY="1.75006mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin52"]}
            pcbX="-5.5499mm"
            pcbY="2.249932mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin51"]}
            pcbX="-5.5499mm"
            pcbY="2.750058mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin50"]}
            pcbX="-5.5499mm"
            pcbY="3.24993mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin49"]}
            pcbX="-5.5499mm"
            pcbY="3.750056mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin48"]}
            pcbX="-3.750056mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin47"]}
            pcbX="-3.24993mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin46"]}
            pcbX="-2.750058mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin45"]}
            pcbX="-2.249932mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin44"]}
            pcbX="-1.75006mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin43"]}
            pcbX="-1.249934mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin42"]}
            pcbX="-0.750062mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin41"]}
            pcbX="-0.249936mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin40"]}
            pcbX="0.249936mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin39"]}
            pcbX="0.750062mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin38"]}
            pcbX="1.249934mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin37"]}
            pcbX="1.75006mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin36"]}
            pcbX="2.249932mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin35"]}
            pcbX="2.750058mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin34"]}
            pcbX="3.24993mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin33"]}
            pcbX="3.750056mm"
            pcbY="5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin32"]}
            pcbX="5.5499mm"
            pcbY="3.750056mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin31"]}
            pcbX="5.5499mm"
            pcbY="3.24993mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin30"]}
            pcbX="5.5499mm"
            pcbY="2.750058mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin29"]}
            pcbX="5.5499mm"
            pcbY="2.249932mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin28"]}
            pcbX="5.5499mm"
            pcbY="1.75006mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin27"]}
            pcbX="5.5499mm"
            pcbY="1.249934mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin26"]}
            pcbX="5.5499mm"
            pcbY="0.750062mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin25"]}
            pcbX="5.5499mm"
            pcbY="0.249936mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin24"]}
            pcbX="5.5499mm"
            pcbY="-0.249936mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin23"]}
            pcbX="5.5499mm"
            pcbY="-0.750062mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin22"]}
            pcbX="5.5499mm"
            pcbY="-1.249934mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin21"]}
            pcbX="5.5499mm"
            pcbY="-1.75006mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin20"]}
            pcbX="5.5499mm"
            pcbY="-2.249932mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin19"]}
            pcbX="5.5499mm"
            pcbY="-2.750058mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin18"]}
            pcbX="5.5499mm"
            pcbY="-3.24993mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin17"]}
            pcbX="5.5499mm"
            pcbY="-3.750056mm"
            width="1.7999964mm"
            height="0.2800096mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin16"]}
            pcbX="3.750056mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin15"]}
            pcbX="3.24993mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin14"]}
            pcbX="2.750058mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin13"]}
            pcbX="2.249932mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin12"]}
            pcbX="1.75006mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin11"]}
            pcbX="1.249934mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin10"]}
            pcbX="0.750062mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin9"]}
            pcbX="0.249936mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin8"]}
            pcbX="-0.249936mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin7"]}
            pcbX="-0.750062mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin6"]}
            pcbX="-1.249934mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin5"]}
            pcbX="-1.75006mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin4"]}
            pcbX="-2.249932mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin3"]}
            pcbX="-2.750058mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="-3.24993mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin1"]}
            pcbX="-3.750056mm"
            pcbY="-5.5499mm"
            width="0.2800096mm"
            height="1.7999964mm"
            radius="0.1400048mm"
            shape="pill"
          />
          <silkscreenpath
            route={[
              { x: -5.399989199999993, y: -4.5212 },
              { x: -5.399989199999993, y: -5.389981600000006 },
              { x: -4.521199999999993, y: -5.389981600000006 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -4.999888400000003, y: -4.121302399999998 },
              { x: -4.999888400000003, y: -4.990083999999996 },
              { x: -4.121124600000002, y: -4.990083999999996 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -4.121200799999997, y: 4.999989999999997 },
              { x: -4.999989999999968, y: 4.999989999999997 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 4.999989999999997, y: 4.121200800000004 },
              { x: 4.999989999999997, y: 4.999989999999997 },
              { x: 4.121200799999997, y: 4.999989999999997 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 4.121200799999997, y: -4.989982399999995 },
              { x: 4.999989999999997, y: -4.989982399999995 },
              { x: 4.999989999999997, y: -4.121200800000004 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -4.999989999999968, y: 4.999989999999997 },
              { x: -4.999989999999968, y: 4.121200800000004 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -4.249927999999983, y: 4.249927999999997 },
              { x: -4.249927999999983, y: -4.249928000000004 },
              { x: 4.249928000000011, y: -4.249928000000004 },
              { x: 4.249928000000011, y: 4.249927999999997 },
              { x: -4.249927999999983, y: 4.249927999999997 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -3.6499799999999993, y: -6.919975999999998 },
              { x: -3.654065084537848, y: -6.951005297679252 },
              { x: -3.6660419463910614, y: -6.979919999999993 },
              { x: -3.6850943822170734, y: -7.004749617782892 },
              { x: -3.7099239999999725, y: -7.023802053608911 },
              { x: -3.7388387023207486, y: -7.035778915462139 },
              { x: -3.769867999999974, y: -7.0398640000000015 },
              { x: -3.800897297679228, y: -7.035778915462139 },
              { x: -3.8298119999999756, y: -7.023802053608911 },
              { x: -3.8546416177828746, y: -7.004749617782892 },
              { x: -3.873694053608915, y: -6.979919999999993 },
              { x: -3.8856709154621285, y: -6.951005297679252 },
              { x: -3.889755999999977, y: -6.919975999999998 },
              { x: -3.8856709154621285, y: -6.8889467023207445 },
              { x: -3.873694053608915, y: -6.860032000000004 },
              { x: -3.8546416177828746, y: -6.835202382217105 },
              { x: -3.8298119999999756, y: -6.816149946391086 },
              { x: -3.800897297679228, y: -6.804173084537858 },
              { x: -3.769867999999974, y: -6.800087999999995 },
              { x: -3.7388387023207486, y: -6.804173084537858 },
              { x: -3.7099239999999725, y: -6.816149946391086 },
              { x: -3.6850943822170734, y: -6.835202382217105 },
              { x: -3.6660419463910614, y: -6.860032000000004 },
              { x: -3.654065084537848, y: -6.8889467023207445 },
              { x: -3.6499799999999993, y: -6.919975999999998 },
            ]}
          />
          <silkscreentext
            text="{NAME}"
            pcbX="0.0127mm"
            pcbY="7.2992mm"
            anchorAlignment="center"
            fontSize="1mm"
          />
          <courtyardoutline
            outline={[
              { x: -6.549199999999985, y: 6.549199999999999 },
              { x: 6.574600000000032, y: 6.549199999999999 },
              { x: 6.574600000000032, y: -7.311199999999992 },
              { x: -6.549199999999985, y: -7.311199999999992 },
              { x: -6.549199999999985, y: 6.549199999999999 },
            ]}
          />
        </footprint>
      }
      cadModel={{
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C2053023.obj?uuid=ad237d82361743bc9055963a6e2e986f",
        stepUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C2053023.step?uuid=ad237d82361743bc9055963a6e2e986f",
        pcbRotationOffset: 90,
        modelOriginPosition: {
          x: -0.0006631000000014708,
          y: -0.0009535000000000515,
          z: 0.000917,
        },
      }}
      {...props}
    />
  )
}
