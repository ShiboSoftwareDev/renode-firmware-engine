import type { FirmwareSimulationTestResult } from "./types"

const decodeXml = (xmlText: string): string =>
  xmlText
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")

const stripXml = (xmlText: string): string =>
  decodeXml(xmlText.replace(/<[^>]+>/g, "")).trim()

export const parseRobotOutput = (
  robotOutputXml: string,
): FirmwareSimulationTestResult[] => {
  const tests: FirmwareSimulationTestResult[] = []
  const testPattern = /<test\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/test>/g

  for (const testMatch of robotOutputXml.matchAll(testPattern)) {
    const testBody = testMatch[2] ?? ""
    const statuses = [
      ...testBody.matchAll(
        /<status\b[^>]*\bstatus="(PASS|FAIL|SKIP|NOT RUN)"[^>]*>([\s\S]*?)<\/status>|<status\b[^>]*\bstatus="(PASS|FAIL|SKIP|NOT RUN)"[^>]*\/>/g,
      ),
    ]
    const finalStatus = statuses.at(-1)
    const displayStatus = finalStatus?.[1] ?? finalStatus?.[3] ?? "FAIL"
    const message = stripXml(finalStatus?.[2] ?? "")
    tests.push({
      name: decodeXml(testMatch[1] ?? "Unnamed Renode test"),
      isPassing: displayStatus === "PASS",
      ...(message ? { message } : {}),
    })
  }
  return tests
}
