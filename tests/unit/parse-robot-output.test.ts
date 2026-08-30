import { expect, test } from "bun:test"
import { parseRobotOutput } from "../../lib"

test("parses Robot pass and failure results", () => {
  const tests = parseRobotOutput(`
<robot>
  <suite name="scenario">
    <test name="Button &amp; LED">
      <kw><status status="PASS" start="1" elapsed="0.1"/></kw>
      <status status="PASS" start="1" elapsed="0.2"/>
    </test>
    <test name="UART">
      <status status="FAIL" start="2" elapsed="0.2">Expected &lt;ready&gt;</status>
    </test>
  </suite>
</robot>`)

  expect(tests).toEqual([
    { name: "Button & LED", isPassing: true },
    { name: "UART", isPassing: false, message: "Expected <ready>" },
  ])
})
