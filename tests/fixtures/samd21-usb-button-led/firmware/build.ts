import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const fixtureDirectory = join(import.meta.dir, "..")
const sourcePath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(import.meta.dir, "main.S")
const generatedDirectory = process.argv[3]
  ? resolve(process.cwd(), process.argv[3])
  : join(fixtureDirectory, "generated")
const objectPath = join(generatedDirectory, "firmware.o")
const firmwarePath = join(generatedDirectory, "firmware.elf")
const firmwareBinaryPath = join(generatedDirectory, "firmware.bin")

const runClang = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.env.CLANG ?? "clang",
      [
        "-target",
        "armv6m-none-eabi",
        "-mcpu=cortex-m0plus",
        "-mthumb",
        "-c",
        sourcePath,
        "-o",
        objectPath,
      ],
      { stdio: "inherit" },
    )
    child.once("error", reject)
    child.once("close", (exitCode) => {
      if (exitCode === 0) resolve()
      else reject(new Error(`clang exited with ${exitCode ?? "no status"}`))
    })
  })

const readElfTextSection = async (): Promise<Buffer> => {
  const objectBytes = await readFile(objectPath)
  const objectView = new DataView(
    objectBytes.buffer,
    objectBytes.byteOffset,
    objectBytes.byteLength,
  )
  const sectionHeaderOffset = objectView.getUint32(32, true)
  const sectionHeaderSize = objectView.getUint16(46, true)
  const sectionCount = objectView.getUint16(48, true)
  const stringSectionIndex = objectView.getUint16(50, true)
  const stringSectionHeaderOffset =
    sectionHeaderOffset + stringSectionIndex * sectionHeaderSize
  const stringTableOffset = objectView.getUint32(
    stringSectionHeaderOffset + 16,
    true,
  )

  for (let index = 0; index < sectionCount; index += 1) {
    const headerOffset = sectionHeaderOffset + index * sectionHeaderSize
    const nameOffset = objectView.getUint32(headerOffset, true)
    let nameEnd = stringTableOffset + nameOffset
    while (objectBytes[nameEnd] !== 0) nameEnd += 1
    const sectionName = objectBytes
      .subarray(stringTableOffset + nameOffset, nameEnd)
      .toString("utf8")
    if (sectionName !== ".text") continue
    const textOffset = objectView.getUint32(headerOffset + 16, true)
    const textSize = objectView.getUint32(headerOffset + 20, true)
    return objectBytes.subarray(textOffset, textOffset + textSize)
  }
  throw new Error("The assembled firmware has no .text section")
}

const createFirmwareBinary = (textBytes: Buffer): Buffer => {
  const flashAddress = 0x00002000
  const codeOffset = 0x100
  const entryPoint = flashAddress + codeOffset + 1
  const segmentBytes = Buffer.alloc(codeOffset + textBytes.length)
  segmentBytes.writeUint32LE(0x20004000, 0)
  segmentBytes.writeUint32LE(entryPoint, 4)
  textBytes.copy(segmentBytes, codeOffset)
  return segmentBytes
}

const wrapBinaryInElf = (segmentBytes: Buffer): Buffer => {
  const flashAddress = 0x00002000
  const codeOffset = 0x100
  const entryPoint = flashAddress + codeOffset + 1
  const segmentFileOffset = 0x1000
  const elfBytes = Buffer.alloc(segmentFileOffset + segmentBytes.length)
  elfBytes.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1], 0)
  elfBytes.writeUint16LE(2, 16)
  elfBytes.writeUint16LE(40, 18)
  elfBytes.writeUint32LE(1, 20)
  elfBytes.writeUint32LE(entryPoint, 24)
  elfBytes.writeUint32LE(52, 28)
  elfBytes.writeUint32LE(0x05000000, 36)
  elfBytes.writeUint16LE(52, 40)
  elfBytes.writeUint16LE(32, 42)
  elfBytes.writeUint16LE(1, 44)
  elfBytes.writeUint32LE(1, 52)
  elfBytes.writeUint32LE(segmentFileOffset, 56)
  elfBytes.writeUint32LE(flashAddress, 60)
  elfBytes.writeUint32LE(flashAddress, 64)
  elfBytes.writeUint32LE(segmentBytes.length, 68)
  elfBytes.writeUint32LE(segmentBytes.length, 72)
  elfBytes.writeUint32LE(5, 76)
  elfBytes.writeUint32LE(0x1000, 80)
  segmentBytes.copy(elfBytes, segmentFileOffset)
  return elfBytes
}

await mkdir(generatedDirectory, { recursive: true })
await runClang()
const firmwareBinary = createFirmwareBinary(await readElfTextSection())
await Promise.all([
  writeFile(firmwareBinaryPath, firmwareBinary),
  writeFile(firmwarePath, wrapBinaryInElf(firmwareBinary)),
])
